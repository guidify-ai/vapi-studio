import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  BRAIN_SERVICE,
  type BrainService,
} from '../brain/brain.service';
import {
  resolveConfidenceThreshold,
  scoresToRankedCandidates,
  selectWalkableIntentions,
  type BrainIntentionOption,
} from '../brain/brain-ranking';
import { STANDARD_INTENTIONS } from '../intentions/standard-intentions';
import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { IntentionCandidate } from '../conversation/types';
import {
  appendChat,
  appendNodeVisit,
  DEFAULT_INTENTION_PRIORITY,
} from '../conversation/conversation-history';
import {
  mergeSayAndListenOptions,
  missingRequiredExtractKeys,
  tryResolveListenIntention,
  type ListenExpectation,
} from '../conversation/listen-expectation';
import { resolveListenTimeoutSeconds } from '../conversation/listen-timeout';
import { EventService } from '../events/event.service';
import { IntegrationClient } from '../integrations/integration-client';
import { FormsService } from '../forms/forms.service';
import {
  RA9_BRAIN_CONFIG,
  type Ra9BrainConfig,
} from '../brain/brain-config';
import { snapshotUserMemory } from '../events/conversation-console';
import {
  actionForensics,
  listenForensics,
  nodeResultForensics,
  walkForensics,
  type RouteRejectRow,
  type RouteWinnerRow,
} from '../events/route-forensics';
import {
  CONDITION_GOTO_PREFIX,
  conditionGotoIntention,
  FlowLoader,
  type FlowNodeDefinition,
} from '../flow/flow-loader';
import {
  RA9_INTENTION_REGISTRY,
  intentionContextFromRuntime,
  type Ra9Intention,
  type Ra9IntentionRegistry,
} from '../intention/ra9-intention';
import {
  RA9_NODE_REGISTRY,
  nodeContextFromRuntime,
  type NodeContext,
  type Ra9Node,
  type Ra9NodeRegistry,
} from '../node/ra9-node';
import type { CatchDirective } from '../node/catch-directive';
import {
  BufferedConversationOutput,
  type NodeResult,
  type OutputAction,
} from '../output/conversation-output';
import { ConversationBootstrapService } from '../conversation/conversation-bootstrap.service';
import {
  CHANNEL_META,
  type ChannelToolResult,
} from '../channel/channel-tools';

const MAX_NODE_RESTARTS = 2;
const MAX_FORCE_INTENTION_HOPS = 3;

export interface TurnExecutionResult {
  runtime: SupervisedConversation;
  intentionNames: string[];
  selectedNodeId: string;
  selectedClass: string;
  result: NodeResult;
  actions: OutputAction[];
  portalOriginRestored?: string | null;
  extracted?: Record<string, unknown>;
}

@Injectable()
export class Supervisor {
  constructor(
    @Inject(BRAIN_SERVICE) private readonly brain: BrainService,
    private readonly flowLoader: FlowLoader,
    @Inject(RA9_NODE_REGISTRY) private readonly nodes: Ra9NodeRegistry,
    private readonly events: EventService,
    private readonly bootstrap: ConversationBootstrapService,
    @Optional() private readonly integrations?: IntegrationClient,
    @Optional() private readonly forms?: FormsService,
    @Optional()
    @Inject(RA9_BRAIN_CONFIG)
    private readonly brainConfig?: Ra9BrainConfig,
    @Optional()
    @Inject(RA9_INTENTION_REGISTRY)
    private readonly intentions?: Ra9IntentionRegistry,
  ) {}

  async handleTurn(input: {
    runtime: SupervisedConversation;
    userText: string;
    /** Channel tool results from this Custom LLM request (`role:tool`). */
    toolResults?: ChannelToolResult[];
    /**
     * Force a known intention (idle portal, synthetic still-there, …)
     * without Brain scan.
     */
    forceIntention?: string;
    onSay?: (text: string) => Promise<void>;
  }): Promise<TurnExecutionResult> {
    const result = await this.executeTurn(input);
    try {
      await this.bootstrap.checkpoint(input.runtime);
    } catch (error) {
      this.events.log('warn', 'RUNTIME_CHECKPOINT_FAILED', {
        conversationId: input.runtime.conversationId,
        providerCallId: input.runtime.providerCallId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return result;
  }

  private async executeTurn(input: {
    runtime: SupervisedConversation;
    userText: string;
    toolResults?: ChannelToolResult[];
    forceIntention?: string;
    onSay?: (text: string) => Promise<void>;
  }): Promise<TurnExecutionResult> {
    const { runtime, userText, onSay } = input;
    runtime.turn.turnNumber += 1;
    runtime.turn.interrupted = false;
    if (userText.trim()) {
      appendChat(runtime.history, 'user', userText);
    }

    const toolResults = input.toolResults ?? [];
    if (toolResults.length > 0) {
      runtime.metadata[CHANNEL_META.toolResults] = toolResults;
      this.events.log('info', 'TOOL_RESULT_RECEIVED', {
        conversationId: runtime.conversationId,
        providerCallId: runtime.providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        turnNumber: runtime.turn.turnNumber,
        count: toolResults.length,
        names: toolResults.map((r) => r.name ?? r.toolCallId ?? '?'),
      });
    } else {
      delete runtime.metadata[CHANNEL_META.toolResults];
    }

    const recordSay = async (text: string) => {
      appendChat(runtime.history, 'assistant', text);
      if (onSay) await onSay(text);
    };

    /**
     * Vapi Custom LLM (assistant speaks first / generated message mode):
     * the first request must run() flow.start — no Brain scan, no sequence advance.
     */
    if (!runtime.openingCompleted) {
      return this.executeOpeningTurn({ runtime, userText, onSay: recordSay });
    }

    /**
     * After a workflow handoff into an rA9 module, speak the destination entry
     * Node once (same Conversation; does not re-run call opening).
     */
    if (runtime.metadata.moduleNeedsEntrySpeak === true) {
      runtime.metadata.moduleNeedsEntrySpeak = false;
      return this.executeModuleEntryTurn({
        runtime,
        userText,
        onSay: recordSay,
      });
    }

    // Tool-result-only turn: re-enter the Node that requested the toolCall.
    if (toolResults.length > 0 && !userText.trim()) {
      return this.executeToolResultTurn({
        runtime,
        userText,
        onSay: recordSay,
      });
    }

    // Forced intention (e.g. Studio/Vapi idle → still-there portal).
    if (input.forceIntention?.trim()) {
      const output = new BufferedConversationOutput(recordSay);
      const routed = await this.routeIntentions({
        runtime,
        userText,
        output,
        ranked: [
          {
            name: input.forceIntention.trim(),
            confidence: 1,
            priority: DEFAULT_INTENTION_PRIORITY,
            rank: 0,
          },
        ],
        forceHop: 0,
      });
      this.stampPendingToolNode(runtime, routed.result, routed.selectedNodeId);
      return {
        runtime,
        intentionNames: [input.forceIntention.trim()],
        selectedNodeId: routed.selectedNodeId,
        selectedClass: routed.selectedClass,
        result: routed.result,
        actions: output.actions,
        portalOriginRestored: routed.portalOriginRestored,
      };
    }

    /**
     * Cascade step 0 — code intentions with phase: 'force'.
     * Full before/match/run freedom; no listen_resolve, no Brain.
     */
    {
      const forced = await this.tryForceIntentions({
        runtime,
        userText,
        onSay: recordSay,
      });
      if (forced) {
        return forced;
      }
    }

    /**
     * Cascade step 1 — condition `force: true` transitions (YAML sugar).
     * Pure memory/variable gates; no listen_resolve, no Brain.
     */
    {
      const forced = this.flowLoader.matchingConditionTransitions(
        {
          currentNodeId: runtime.currentNodeId,
          memory: runtime.memory as Record<string, unknown>,
          variables: runtime.variables as Record<string, unknown>,
        },
        { force: true },
      );
      if (forced.length > 0) {
        const output = new BufferedConversationOutput(recordSay);
        for (const t of forced) {
          const payload = {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            providerCallId: runtime.providerCallId,
            turnNumber: runtime.turn.turnNumber,
            transitionId: t.id,
            from: runtime.currentNodeId,
            to: t.to,
            when: t.when,
            force: true,
            reason: t.reason ?? null,
            userText,
            memory: snapshotUserMemory(
              runtime.memory as Record<string, unknown>,
            ),
          };
          if (runtime.conversationId) {
            await this.events.persist(
              runtime.conversationId,
              'CONDITION_TRANSITION',
              payload,
            );
          } else {
            this.events.log('info', 'CONDITION_TRANSITION', payload);
          }
        }
        const ranked: IntentionCandidate[] = forced.map((t, i) => ({
          name: conditionGotoIntention(t.to),
          confidence: 1,
          priority: t.priority ?? 1_000_000,
          rank: i,
        }));
        const routed = await this.routeIntentions({
          runtime,
          userText,
          output,
          ranked,
          forceHop: 0,
          resolvedVia: 'condition_force',
          allowMiss: true,
        });
        if (routed) {
          this.stampPendingToolNode(
            runtime,
            routed.result,
            routed.selectedNodeId,
          );
          return {
            runtime,
            intentionNames: ranked.map((i) => i.name),
            selectedNodeId: routed.selectedNodeId,
            selectedClass: routed.selectedClass,
            result: routed.result,
            actions: output.actions,
            portalOriginRestored: routed.portalOriginRestored,
          };
        }
        this.events.log('warn', 'CONDITION_TRANSITION_MISSED', {
          conversationId: runtime.conversationId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          turnNumber: runtime.turn.turnNumber,
          tried: forced.map((t) => t.id),
          note: 'force transitions matched when but every before() refused; falling through cascade',
        });
      }
    }

    const activeListen = runtime.listenExpectation;
    const candidates = this.buildBrainCandidates(activeListen, runtime);
    const confidenceThreshold = resolveConfidenceThreshold(
      this.brainConfig?.confidenceThreshold,
    );

    /**
     * Cascade — phase: 'match' code intentions (local confidence, may skip Brain).
     */
    const matchOutcome = await this.tryMatchIntentions({
      runtime,
      userText,
      onSay: recordSay,
      confidenceThreshold,
    });
    if (matchOutcome?.kind === 'routed') {
      return matchOutcome.result;
    }
    const matchResolved =
      matchOutcome?.kind === 'score'
        ? { name: matchOutcome.name, confidence: matchOutcome.confidence }
        : null;

    const resolvedName =
      matchResolved?.name ??
      (await tryResolveListenIntention({
        listen: activeListen,
        userText,
        memory: runtime.memory as Record<string, unknown>,
      }));
    const scan = resolvedName
      ? {
          intentions: scoresToRankedCandidates(
            [
              {
                name: resolvedName,
                confidence: matchResolved?.confidence ?? 1,
                reason: matchResolved ? 'intention_match' : 'listen_resolve',
              },
            ],
            candidates,
          ),
        }
      : await this.brain.scan({
          runtime,
          userText,
          listen: activeListen,
          candidates,
          confidenceThreshold,
          history: {
            chat: runtime.history.chat,
            nodes: runtime.history.nodes,
          },
        });
    if (resolvedName) {
      runtime.brainSequenceIndex = (runtime.brainSequenceIndex ?? 0) + 1;
      this.events.log(
        'info',
        matchResolved ? 'INTENTION_MATCHED' : 'LISTEN_RESOLVED',
        {
          conversationId: runtime.conversationId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          turnNumber: runtime.turn.turnNumber,
          intention: resolvedName,
          userText,
          via: matchResolved ? 'intention_match' : 'listen_resolve',
          confidence: matchResolved?.confidence ?? 1,
        },
      );
    }
    const intentions = scan.intentions;
    if (activeListen?.extract?.fields?.length) {
      const missingRequired = missingRequiredExtractKeys(
        activeListen.extract.fields,
        scan.extracted,
      );
      if (activeListen.extract.onExtracted) {
        await activeListen.extract.onExtracted(scan.extracted ?? {}, {
          memory: runtime.memory as Record<string, unknown>,
          variables: runtime.variables as Record<string, unknown>,
          userText,
        });
      }
      this.events.log('info', 'LISTEN_EXTRACTED', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        turnNumber: runtime.turn.turnNumber,
        extracted: scan.extracted,
        missingRequired,
        appliedViaCallback: Boolean(activeListen.extract.onExtracted),
        memory: snapshotUserMemory(
          runtime.memory as Record<string, unknown>,
        ),
      });
    }
    this.events.log('info', 'INTENTION_SCAN', {
      conversationId: runtime.conversationId,
      providerCallId: runtime.providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      turnNumber: runtime.turn.turnNumber,
      intentions,
      extracted: scan.extracted,
      listen: activeListen,
      candidates,
      confidenceThreshold,
      activePortalId: runtime.portalState.activePortalId,
      originNodeId: runtime.portalState.originNodeId,
      normalFlowNodeId: runtime.normalFlowNodeId,
      memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
    });

    const ranked = selectWalkableIntentions(
      intentions,
      confidenceThreshold,
      STANDARD_INTENTIONS.isUnknownTransition,
    );

    /**
     * Cascade step 3 — soft condition boosts (force: false).
     * High priority studio.goto.* candidates merged ahead of Brain walk.
     * Default priority 50: above normal nodes, below typical portals (85+).
     */
    const soft = this.flowLoader.matchingConditionTransitions(
      {
        currentNodeId: runtime.currentNodeId,
        memory: runtime.memory as Record<string, unknown>,
        variables: runtime.variables as Record<string, unknown>,
      },
      { force: false },
    );
    const softRanked: IntentionCandidate[] = [];
    for (const [i, t] of soft.entries()) {
      const payload = {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        providerCallId: runtime.providerCallId,
        turnNumber: runtime.turn.turnNumber,
        transitionId: t.id,
        from: runtime.currentNodeId,
        to: t.to,
        when: t.when,
        force: false,
        reason: t.reason ?? null,
        userText,
        memory: snapshotUserMemory(
          runtime.memory as Record<string, unknown>,
        ),
      };
      if (runtime.conversationId) {
        await this.events.persist(
          runtime.conversationId,
          'CONDITION_TRANSITION',
          payload,
        );
      } else {
        this.events.log('info', 'CONDITION_TRANSITION', payload);
      }
      softRanked.push({
        name: conditionGotoIntention(t.to),
        confidence: 1,
        priority: t.priority ?? 50,
        rank: -(soft.length - i),
      });
    }
    const mergedRanked = [...softRanked, ...ranked].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.rank - b.rank;
    });

    const output = new BufferedConversationOutput(recordSay);

    const routed = await this.routeIntentions({
      runtime,
      userText,
      output,
      ranked: mergedRanked,
      forceHop: 0,
      resolvedVia: matchResolved
        ? 'intention_match'
        : resolvedName
          ? 'listen_resolve'
          : 'brain',
      confidenceThreshold,
      activeListen,
    });

    this.stampPendingToolNode(runtime, routed.result, routed.selectedNodeId);

    return {
      runtime,
      intentionNames: mergedRanked.map((i) => i.name),
      selectedNodeId: routed.selectedNodeId,
      selectedClass: routed.selectedClass,
      result: routed.result,
      actions: output.actions,
      portalOriginRestored: routed.portalOriginRestored,
      extracted: scan.extracted,
    };
  }

  /**
   * Speak the active module's current/entry Node after WORKFLOW_HANDOFF
   * (does not toggle openingCompleted).
   */
  private async executeModuleEntryTurn(input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
  }): Promise<TurnExecutionResult> {
    const { runtime, userText, onSay } = input;
    const flow = this.flowLoader.getFlow();
    const entryId = runtime.currentNodeId ?? flow.start;
    const candidate = flow.nodes[entryId];
    if (!candidate) {
      throw new Error(`Module entry node "${entryId}" missing`);
    }
    const node = this.nodes.get(candidate.class);
    if (!node) {
      throw new Error(`Module entry class not registered: ${candidate.class}`);
    }

    const output = new BufferedConversationOutput(onSay);
    const ctx = nodeContextFromRuntime({
      runtime,
      userText,
      output,
      events: this.events,
      brain: this.brain,
      integrations: this.integrations,
      forms: this.forms,
      intention: candidate.intentions[0] ?? 'studio.moduleEntry',
    });

    this.events.log('info', 'MODULE_ENTRY_TURN', {
      conversationId: runtime.conversationId,
      providerCallId: runtime.providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      entryNodeId: entryId,
      class: candidate.class,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
      workflowId: runtime.metadata.workflowId ?? null,
      turnNumber: runtime.turn.turnNumber,
      memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
    });

    const can = await node.before(ctx);
    if (!can) {
      throw new Error(`Module entry node ${entryId} rejected before()`);
    }

    if (candidate.portal) {
      this.enterPortal(runtime, candidate);
    } else {
      this.enterNormal(runtime, candidate);
    }

    const executed = await this.executeNodeWithCatch({
      runtime,
      userText,
      output,
      node,
      candidate,
      intentionName: candidate.intentions[0] ?? 'studio.moduleEntry',
      ctx,
      restarts: 0,
      forceHop: 0,
    });

    if (executed.kind === 'forceIntention') {
      const routed = await this.routeIntentions({
        runtime,
        userText,
        output,
        ranked: [
          {
            name: executed.intention,
            confidence: 1,
            priority: DEFAULT_INTENTION_PRIORITY,
            rank: 0,
          },
        ],
        forceHop: 1,
      });
      return {
        runtime,
        intentionNames: ['studio.moduleEntry', executed.intention],
        selectedNodeId: routed.selectedNodeId,
        selectedClass: routed.selectedClass,
        result: routed.result,
        actions: output.actions,
        portalOriginRestored: routed.portalOriginRestored,
      };
    }

    return {
      runtime,
      intentionNames: ['studio.moduleEntry'],
      selectedNodeId: candidate.id,
      selectedClass: candidate.class,
      result: executed.result,
      actions: output.actions,
    };
  }

  /**
   * First Custom LLM turn: execute flow.start Node.run() so the assistant
   * speaks before any user utterance / Brain routing.
   */
  private async executeOpeningTurn(input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
  }): Promise<TurnExecutionResult> {
    const { runtime, userText, onSay } = input;
    const flow = this.flowLoader.getFlow();
    const startId = flow.start;
    const candidate = flow.nodes[startId];
    if (!candidate) {
      throw new Error(`Flow start node "${startId}" missing`);
    }
    const node = this.nodes.get(candidate.class);
    if (!node) {
      throw new Error(`Start node class not registered: ${candidate.class}`);
    }

    const output = new BufferedConversationOutput(onSay);
    const ctx = nodeContextFromRuntime({
      runtime,
      userText,
      output,
      events: this.events,
      brain: this.brain,
      integrations: this.integrations,
      forms: this.forms,
      intention: candidate.intentions[0] ?? 'studio.opening',
    });

    this.events.log('info', 'OPENING_TURN', {
      conversationId: runtime.conversationId,
      providerCallId: runtime.providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      startNodeId: startId,
      class: candidate.class,
      userText,
      turnNumber: runtime.turn.turnNumber,
      memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
    });

    const can = await node.before(ctx);
    if (!can) {
      throw new Error(`Opening start node ${startId} rejected before()`);
    }

    if (candidate.portal) {
      this.enterPortal(runtime, candidate);
    } else {
      this.enterNormal(runtime, candidate);
    }

    const executed = await this.executeNodeWithCatch({
      runtime,
      userText,
      output,
      node,
      candidate,
      intentionName: candidate.intentions[0] ?? 'studio.opening',
      ctx,
      restarts: 0,
      forceHop: 0,
    });

    if (executed.kind === 'forceIntention') {
      runtime.openingCompleted = true;
      this.events.log('info', 'OPENING_FORCE_INTENTION', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        intention: executed.intention,
      });
      const routed = await this.routeIntentions({
        runtime,
        userText,
        output,
        ranked: [
          {
            name: executed.intention,
            confidence: 1,
            priority: DEFAULT_INTENTION_PRIORITY,
            rank: 0,
          },
        ],
        forceHop: 1,
      });
      return {
        runtime,
        intentionNames: ['studio.opening', executed.intention],
        selectedNodeId: routed.selectedNodeId,
        selectedClass: routed.selectedClass,
        result: routed.result,
        actions: output.actions,
        portalOriginRestored: routed.portalOriginRestored,
      };
    }

    runtime.openingCompleted = true;

    return {
      runtime,
      intentionNames: ['studio.opening'],
      selectedNodeId: candidate.id,
      selectedClass: candidate.class,
      result: executed.result,
      actions: output.actions,
    };
  }

  private async routeIntentions(input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    ranked: IntentionCandidate[];
    forceHop: number;
    resolvedVia?: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    allowMiss: true;
  }): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
  } | null>;
  private async routeIntentions(input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    ranked: IntentionCandidate[];
    forceHop: number;
    resolvedVia?: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    allowMiss?: false;
  }): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
  }>;
  private async routeIntentions(input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    ranked: IntentionCandidate[];
    forceHop: number;
    resolvedVia?: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    /** When true, return null instead of throwing if every candidate is rejected. */
    allowMiss?: boolean;
  }): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
  } | null> {
    const {
      runtime,
      userText,
      output,
      ranked,
      forceHop,
      resolvedVia,
      confidenceThreshold,
      activeListen,
      allowMiss,
    } = input;

    const rejected: RouteRejectRow[] = [];

    for (const scored of ranked) {
      const intentionName = scored.name;
      const nodeCandidates = this.flowLoader.nodesForIntention(intentionName);
      for (const candidate of nodeCandidates) {
        const node = this.nodes.get(candidate.class);
        if (!node) {
          rejected.push({
            nodeId: candidate.id,
            class: candidate.class,
            intention: intentionName,
            reason: 'missing',
            confidence: scored.confidence,
            priority: scored.priority,
          });
          this.events.log('warn', 'NODE_MISSING', {
            class: candidate.class,
            intention: intentionName,
          });
          continue;
        }

        const ctx = nodeContextFromRuntime({
          runtime,
          userText,
          output,
          events: this.events,
          brain: this.brain,
          integrations: this.integrations,
          forms: this.forms,
          intention: intentionName,
        });

        const can = await node.before(ctx);
        if (!can) {
          rejected.push({
            nodeId: candidate.id,
            class: candidate.class,
            intention: intentionName,
            reason: 'before_false',
            confidence: scored.confidence,
            priority: scored.priority,
          });
          this.events.log('info', 'NODE_REJECT', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            nodeId: candidate.id,
            class: candidate.class,
            intention: intentionName,
            confidence: scored.confidence,
            priority: scored.priority,
            reason: 'before_false',
          });
          continue;
        }

        const winner: RouteWinnerRow = {
          nodeId: candidate.id,
          class: candidate.class,
          intention: intentionName,
          confidence: scored.confidence,
          priority: scored.priority,
          portal: Boolean(candidate.portal),
        };

        // isContinue: never speak “Okay, continuing.” — restore portal origin and
        // re-route the same utterance against that node’s listen. Only when a
        // portal is active; otherwise let ContinueNode.run (e.g. catch recovery).
        if (
          this.isContinueNode(candidate) &&
          runtime.portalState.activePortalId
        ) {
          await this.emitRouteDecision({
            runtime,
            userText,
            resolvedVia: resolvedVia ?? 'continue',
            confidenceThreshold,
            activeListen,
            ranked,
            rejected,
            winner: { ...winner, class: `${winner.class}→continue_replay` },
          });
          return this.replayOriginAfterContinue({
            runtime,
            userText,
            output,
            forceHop: forceHop + 1,
            fromNodeId: candidate.id,
          });
        }

        await this.emitRouteDecision({
          runtime,
          userText,
          resolvedVia: this.resolveViaForWinner(
            resolvedVia,
            intentionName,
            forceHop,
          ),
          confidenceThreshold,
          activeListen,
          ranked,
          rejected,
          winner,
        });

        let portalOriginRestored: string | null | undefined;
        if (candidate.portal) {
          portalOriginRestored = this.enterPortal(runtime, candidate);
        } else {
          portalOriginRestored = this.enterNormal(runtime, candidate);
        }

        const executed = await this.executeNodeWithCatch({
          runtime,
          userText,
          output,
          node,
          candidate,
          intentionName,
          ctx,
          restarts: 0,
          forceHop,
        });

        if (executed.kind === 'forceIntention') {
          if (forceHop >= MAX_FORCE_INTENTION_HOPS) {
            throw new Error(
              `forceIntention hop limit (${MAX_FORCE_INTENTION_HOPS}) exceeded`,
            );
          }
          this.events.log('info', 'CATCH_FORCE_INTENTION', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            fromNodeId: candidate.id,
            intention: executed.intention,
            forceHop: forceHop + 1,
          });
          return this.routeIntentions({
            runtime,
            userText,
            output,
            ranked: [
              {
                name: executed.intention,
                confidence: 1,
                priority: DEFAULT_INTENTION_PRIORITY,
                rank: 0,
              },
            ],
            forceHop: forceHop + 1,
            resolvedVia: 'force_intention',
            confidenceThreshold,
            activeListen: runtime.listenExpectation,
          });
        }

        return {
          selectedNodeId: candidate.id,
          selectedClass: candidate.class,
          result: executed.result,
          portalOriginRestored,
        };
      }
    }

    await this.emitRouteDecision({
      runtime,
      userText,
      resolvedVia: resolvedVia ?? 'brain',
      confidenceThreshold,
      activeListen,
      ranked,
      rejected,
      winner: null,
      failed: true,
    });
    if (allowMiss) {
      return null;
    }
    // Brain/listen picked something every Node refused (before_false) — never 500
    // the channel. Recover through the unknown-transition portal once.
    if (
      resolvedVia !== 'route_fallback_unknown' &&
      forceHop < MAX_FORCE_INTENTION_HOPS
    ) {
      this.events.log('warn', 'ROUTE_FALLBACK_UNKNOWN', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        turnNumber: runtime.turn.turnNumber,
        userText,
        rejected,
        note: 'all candidates before() false — falling back to ra9.isUnknownTransition',
      });
      return this.routeIntentions({
        runtime,
        userText,
        output,
        ranked: [
          {
            name: STANDARD_INTENTIONS.isUnknownTransition,
            confidence: 1,
            priority: 0,
            rank: 0,
          },
        ],
        forceHop: forceHop + 1,
        resolvedVia: 'route_fallback_unknown',
        confidenceThreshold,
        activeListen,
      });
    }
    throw new Error('Supervisor could not route turn to any eligible node');
  }

  private resolveViaForWinner(
    resolvedVia: string | undefined,
    intentionName: string,
    forceHop: number,
  ): string {
    if (resolvedVia === 'condition_force') return 'condition_force';
    if (resolvedVia === 'intention_force') return 'intention_force';
    if (resolvedVia === 'intention_match') return 'intention_match';
    if (intentionName.startsWith(CONDITION_GOTO_PREFIX)) {
      return 'condition_boost';
    }
    return resolvedVia ?? (forceHop > 0 ? 'force_intention' : 'brain');
  }

  /** Durable + console forensic: why this node won (or none did). */
  private async emitRouteDecision(input: {
    runtime: SupervisedConversation;
    userText: string;
    resolvedVia: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    ranked: IntentionCandidate[];
    rejected: RouteRejectRow[];
    winner: RouteWinnerRow | null;
    failed?: boolean;
  }): Promise<void> {
    const {
      runtime,
      userText,
      resolvedVia,
      confidenceThreshold,
      activeListen,
      ranked,
      rejected,
      winner,
      failed,
    } = input;
    const type = failed ? 'ROUTE_FAILED' : 'ROUTE_DECISION';
    const payload = {
      runtimeInstanceId: runtime.runtimeInstanceId,
      providerCallId: runtime.providerCallId,
      turnNumber: runtime.turn.turnNumber,
      userText,
      resolvedVia,
      confidenceThreshold: confidenceThreshold ?? null,
      listen: listenForensics(activeListen),
      walk: walkForensics(ranked),
      rejected,
      winner,
      activePortalId: runtime.portalState.activePortalId ?? null,
      originNodeId: runtime.portalState.originNodeId ?? null,
      normalFlowNodeId: runtime.normalFlowNodeId ?? null,
      currentNodeId: runtime.currentNodeId ?? null,
      memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
    };
    if (runtime.conversationId) {
      await this.events.persist(runtime.conversationId, type, payload);
    } else {
      this.events.log(failed ? 'error' : 'info', type, payload);
    }
  }

  /** Continue / isContinue is an escape hatch back to the pre-portal node. */
  private isContinueNode(candidate: FlowNodeDefinition): boolean {
    return (
      candidate.class === 'ContinueNode' ||
      candidate.id === 'continue' ||
      (candidate.intentions.length === 1 &&
        candidate.intentions[0] === 'isContinue')
    );
  }

  /**
   * Exit the active portal (if any), restore the origin Node, refresh its
   * listen, re-scan the same user text, and route again — without speaking a
   * filler “Okay, continuing.”
   */
  private async replayOriginAfterContinue(input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    forceHop: number;
    fromNodeId: string;
  }): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
  }> {
    const { runtime, userText, output, forceHop, fromNodeId } = input;

    if (forceHop >= MAX_FORCE_INTENTION_HOPS) {
      throw new Error(
        `continue replay hop limit (${MAX_FORCE_INTENTION_HOPS}) exceeded`,
      );
    }

    const originId =
      runtime.portalState.originNodeId ??
      runtime.normalFlowNodeId ??
      runtime.currentNodeId;

    let portalOriginRestored: string | null = null;
    if (runtime.portalState.activePortalId) {
      portalOriginRestored = runtime.exitPortal();
    }

    const targetId = portalOriginRestored ?? originId;
    if (!targetId || targetId === 'continue' || targetId === fromNodeId) {
      this.events.log('warn', 'CONTINUE_NO_ORIGIN', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        fromNodeId,
        originId,
        userText,
      });
      // Last resort: stay silent of filler — re-ask via unknown.
      return this.routeIntentions({
        runtime,
        userText,
        output,
        ranked: [
          {
            name: STANDARD_INTENTIONS.isUnknownTransition,
            confidence: 1,
            priority: 0,
            rank: 0,
          },
        ],
        forceHop,
      });
    }

    runtime.enterNormalNode(targetId);

    const flow = this.flowLoader.getFlow();
    const originCandidate = flow.nodes[targetId];
    if (!originCandidate) {
      throw new Error(`Continue origin node "${targetId}" missing from flow`);
    }
    const originNode = this.nodes.get(originCandidate.class);
    if (!originNode) {
      throw new Error(
        `Continue origin class not registered: ${originCandidate.class}`,
      );
    }

    const listenCtx = nodeContextFromRuntime({
      runtime,
      userText,
      output,
      events: this.events,
      brain: this.brain,
      integrations: this.integrations,
      forms: this.forms,
      intention: 'isContinue',
    });
    const listenExpectation = await originNode.listen(listenCtx);
    runtime.listenExpectation = listenExpectation;
    this.stampListenTimeout(runtime, originNode);

    const confidenceThreshold = resolveConfidenceThreshold(
      this.brainConfig?.confidenceThreshold,
    );
    const brainCandidates = this.buildBrainCandidates(
      listenExpectation,
      runtime,
    );
    const resolvedName = await tryResolveListenIntention({
      listen: listenExpectation,
      userText,
      memory: runtime.memory as Record<string, unknown>,
    });
    const scan = resolvedName
      ? {
          intentions: scoresToRankedCandidates(
            [
              {
                name: resolvedName,
                confidence: 1,
                reason: 'continue_replay_resolve',
              },
            ],
            brainCandidates,
          ),
        }
      : await this.brain.scan({
          runtime,
          userText,
          listen: listenExpectation,
          candidates: brainCandidates,
          confidenceThreshold,
          history: {
            chat: runtime.history.chat,
            nodes: runtime.history.nodes,
          },
        });

    if (resolvedName) {
      runtime.brainSequenceIndex = (runtime.brainSequenceIndex ?? 0) + 1;
    }

    let ranked = selectWalkableIntentions(
      scan.intentions,
      confidenceThreshold,
      STANDARD_INTENTIONS.isUnknownTransition,
    ).filter((i) => i.name !== 'isContinue');

    if (ranked.length === 0) {
      ranked = [
        {
          name: STANDARD_INTENTIONS.isUnknownTransition,
          confidence: 1,
          priority: 0,
          rank: 0,
        },
      ];
    }

    this.events.log('info', 'CONTINUE_REPLAY_ORIGIN', {
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      fromNodeId,
      originNodeId: targetId,
      userText,
      resolvedName: resolvedName ?? null,
      ranked: ranked.map((i) => i.name),
      forceHop,
    });

    const routed = await this.routeIntentions({
      runtime,
      userText,
      output,
      ranked,
      forceHop,
    });
    return {
      ...routed,
      portalOriginRestored: portalOriginRestored ?? routed.portalOriginRestored,
    };
  }

  private async executeNodeWithCatch(input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    node: Ra9Node;
    candidate: FlowNodeDefinition;
    intentionName: string;
    ctx: NodeContext;
    restarts: number;
    forceHop: number;
  }): Promise<
    | { kind: 'done'; result: NodeResult }
    | { kind: 'forceIntention'; intention: string }
  > {
    const {
      runtime,
      output,
      node,
      candidate,
      intentionName,
      ctx,
      restarts,
    } = input;

    // Register listen BEFORE speech so mid-talk interrupts still bind here.
    const listenExpectation = await node.listen(ctx);
    runtime.listenExpectation = listenExpectation;
    this.stampListenTimeout(runtime, node);
    if (listenExpectation) {
      this.events.log('info', 'LISTEN_REGISTERED', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        nodeId: candidate.id,
        class: candidate.class,
        listen: runtime.listenExpectation,
        restart: restarts,
      });
    }

    this.events.log('info', 'NODE_ENTER', {
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      nodeId: candidate.id,
      class: candidate.class,
      intention: intentionName,
      portal: Boolean(candidate.portal),
      originNodeId: runtime.portalState.originNodeId,
      normalFlowNodeId: runtime.normalFlowNodeId,
      activePortalId: runtime.portalState.activePortalId,
      restart: restarts,
      turnNumber: runtime.turn.turnNumber,
      memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
    });
    if (restarts === 0) {
      appendNodeVisit(runtime.history, {
        nodeId: candidate.id,
        intention: intentionName,
        turnNumber: runtime.turn.turnNumber,
        at: new Date().toISOString(),
      });
    }

    try {
      const result = await node.run(ctx);
      if (result.kind === 'sayAndListen') {
        runtime.listenExpectation = mergeSayAndListenOptions(
          runtime.listenExpectation,
          result.sayAndListen,
        );
        this.stampListenTimeout(
          runtime,
          node,
          result.sayAndListen?.timeoutSeconds,
        );
        if (result.sayAndListen?.extract?.fields?.length) {
          this.events.log('info', 'LISTEN_EXTRACT_REGISTERED', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            nodeId: candidate.id,
            fields: result.sayAndListen.extract.fields,
            hasOnExtracted: Boolean(result.sayAndListen.extract.onExtracted),
          });
        }
      }
      await node.after(ctx, result);
      this.events.log('info', 'NODE_AFTER', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        providerCallId: runtime.providerCallId,
        nodeId: candidate.id,
        class: candidate.class,
        intention: intentionName,
        resultKind: result.kind,
        resultDetail: nodeResultForensics(result),
        turnNumber: runtime.turn.turnNumber,
        memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
        actions: actionForensics(output.actions),
      });
      return { kind: 'done', result };
    } catch (error) {
      const directive: CatchDirective = await node.catch(ctx, error);
      this.events.log('warn', 'NODE_CATCH', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        nodeId: candidate.id,
        class: candidate.class,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: String(error) },
        directive,
        restart: restarts,
      });

      if (directive.kind === 'restartNode') {
        if (restarts >= MAX_NODE_RESTARTS) {
          throw new Error(
            `restartNode limit (${MAX_NODE_RESTARTS}) exceeded for ${candidate.id}`,
          );
        }
        // Drop partial speech from the failed attempt before retrying.
        output.actions.length = 0;
        return this.executeNodeWithCatch({
          ...input,
          restarts: restarts + 1,
        });
      }

      if (directive.kind === 'forceIntention') {
        output.actions.length = 0;
        return { kind: 'forceIntention', intention: directive.intention };
      }

      if (directive.kind === 'result') {
        await node.after(ctx, directive.result);
        return { kind: 'done', result: directive.result };
      }

      throw error;
    }
  }

  private intentionList(): Ra9Intention[] {
    return this.intentions ? [...this.intentions.values()] : [];
  }

  /**
   * phase: 'force' — before listen/Brain. First before()===true wins (registry order).
   */
  private async tryForceIntentions(input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
  }): Promise<TurnExecutionResult | null> {
    const forceList = this.intentionList().filter((i) => i.phase === 'force');
    if (!forceList.length) return null;

    const ctx = intentionContextFromRuntime({
      runtime: input.runtime,
      userText: input.userText,
      events: this.events,
    });
    const output = new BufferedConversationOutput(input.onSay);

    for (const intention of forceList) {
      const ok = await intention.before(ctx);
      if (!ok) continue;

      const confidence = (await intention.match(ctx)) ?? 1;
      const runResult = await intention.run(ctx);
      await intention.after(ctx);

      const gotoNodeId =
        runResult?.kind === 'goto'
          ? runResult.nodeId
          : intention.toNodeId ?? null;
      const reason =
        (runResult && 'reason' in runResult ? runResult.reason : undefined) ??
        intention.reason ??
        null;

      const payload = {
        conversationId: input.runtime.conversationId,
        runtimeInstanceId: input.runtime.runtimeInstanceId,
        providerCallId: input.runtime.providerCallId,
        turnNumber: input.runtime.turn.turnNumber,
        intention: intention.name,
        phase: 'force',
        from: input.runtime.currentNodeId,
        to: gotoNodeId,
        confidence,
        priority: intention.priority,
        boost: intention.boost,
        reason,
        userText: input.userText,
        memory: snapshotUserMemory(
          input.runtime.memory as Record<string, unknown>,
        ),
      };
      if (input.runtime.conversationId) {
        await this.events.persist(
          input.runtime.conversationId,
          'INTENTION_FORCE',
          payload,
        );
      } else {
        this.events.log('info', 'INTENTION_FORCE', payload);
      }

      const rankedName = gotoNodeId
        ? conditionGotoIntention(gotoNodeId)
        : intention.name;
      const ranked: IntentionCandidate[] = [
        {
          name: rankedName,
          confidence: Math.min(1, Math.max(0, confidence)),
          priority: intention.priority || 1_000_000,
          rank: 0,
        },
      ];
      const routed = await this.routeIntentions({
        runtime: input.runtime,
        userText: input.userText,
        output,
        ranked,
        forceHop: 0,
        resolvedVia: 'intention_force',
        allowMiss: true,
      });
      if (!routed) {
        this.events.log('warn', 'INTENTION_FORCE_MISSED', {
          ...payload,
          note: 'force intention matched but no node accepted before()',
        });
        continue;
      }
      this.stampPendingToolNode(
        input.runtime,
        routed.result,
        routed.selectedNodeId,
      );
      return {
        runtime: input.runtime,
        intentionNames: [intention.name],
        selectedNodeId: routed.selectedNodeId,
        selectedClass: routed.selectedClass,
        result: routed.result,
        actions: output.actions,
        portalOriginRestored: routed.portalOriginRestored,
      };
    }
    return null;
  }

  /**
   * phase: 'match' — local confidence; may skip Brain. goto from run() routes now.
   */
  private async tryMatchIntentions(input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
    confidenceThreshold: number;
  }): Promise<
    | { kind: 'routed'; result: TurnExecutionResult }
    | { kind: 'score'; name: string; confidence: number }
    | null
  > {
    const matchList = this.intentionList().filter((i) => i.phase === 'match');
    if (!matchList.length) return null;

    const ctx = intentionContextFromRuntime({
      runtime: input.runtime,
      userText: input.userText,
      events: this.events,
    });

    for (const intention of matchList) {
      const ok = await intention.before(ctx);
      if (!ok) continue;
      const matched = await intention.match(ctx);
      if (matched == null) continue;
      const confidence = Math.min(1, Math.max(0, matched));
      if (confidence < input.confidenceThreshold) continue;

      const runResult = await intention.run(ctx);
      await intention.after(ctx);

      this.events.log('info', 'INTENTION_MATCH', {
        conversationId: input.runtime.conversationId,
        runtimeInstanceId: input.runtime.runtimeInstanceId,
        turnNumber: input.runtime.turn.turnNumber,
        intention: intention.name,
        confidence,
        run: runResult,
        userText: input.userText,
      });

      const gotoNodeId =
        runResult?.kind === 'goto'
          ? runResult.nodeId
          : intention.toNodeId ?? null;
      if (gotoNodeId) {
        const output = new BufferedConversationOutput(input.onSay);
        const routed = await this.routeIntentions({
          runtime: input.runtime,
          userText: input.userText,
          output,
          ranked: [
            {
              name: conditionGotoIntention(gotoNodeId),
              confidence,
              priority: intention.priority || 1_000_000,
              rank: 0,
            },
          ],
          forceHop: 0,
          resolvedVia: 'intention_match',
          allowMiss: true,
        });
        if (routed) {
          this.stampPendingToolNode(
            input.runtime,
            routed.result,
            routed.selectedNodeId,
          );
          return {
            kind: 'routed',
            result: {
              runtime: input.runtime,
              intentionNames: [intention.name],
              selectedNodeId: routed.selectedNodeId,
              selectedClass: routed.selectedClass,
              result: routed.result,
              actions: output.actions,
              portalOriginRestored: routed.portalOriginRestored,
            },
          };
        }
      }

      return { kind: 'score', name: intention.name, confidence };
    }
    return null;
  }

  /**
   * Limited Brain candidate set for this listen:
   * - listen-prioritized next-node intentions (with boost + priority)
   * - registered Ra9Intention boost/priority overlays
   * - all portal intentions (except: while in `mad`, only the mad portal — sticky)
   * - ra9.isUnknownTransition (scan-failure global; not while sticky mad)
   * - if no listen yet: all normal-flow intentions + portals
   */
  private buildBrainCandidates(
    listen: ListenExpectation | null | undefined,
    runtime?: SupervisedConversation,
  ): BrainIntentionOption[] {
    const byName = new Map<string, BrainIntentionOption>();

    const upsert = (option: BrainIntentionOption) => {
      const existing = byName.get(option.name);
      if (!existing) {
        byName.set(option.name, {
          ...option,
          priority: option.priority ?? DEFAULT_INTENTION_PRIORITY,
        });
        return;
      }
      byName.set(option.name, {
        ...existing,
        boost: Math.max(existing.boost ?? 0, option.boost ?? 0),
        priority: Math.max(
          existing.priority ?? DEFAULT_INTENTION_PRIORITY,
          option.priority ?? DEFAULT_INTENTION_PRIORITY,
        ),
        source: existing.source === 'listen' ? 'listen' : option.source,
      });
    };

    for (const intent of listen?.intentions ?? []) {
      upsert({
        name: intent.name,
        boost: intent.boost,
        priority: intent.priority,
        source: 'listen',
      });
    }

    for (const intention of this.intentionList()) {
      if (intention.phase === 'force') continue;
      upsert({
        name: intention.name,
        boost: intention.boost,
        priority: intention.priority,
        source: 'runtime',
      });
    }

    const stickyMad = runtime?.portalState.activePortalId === 'mad';
    const madIntentionNames = stickyMad
      ? new Set(this.flowLoader.getFlow().nodes.mad?.intentions ?? [])
      : null;

    for (const name of this.flowLoader.portalIntentionNames()) {
      if (madIntentionNames && !madIntentionNames.has(name)) {
        continue;
      }
      upsert({ name, source: 'portal' });
    }

    if (!listen?.intentions?.length) {
      for (const name of this.flowLoader.normalIntentionNames()) {
        upsert({ name, source: 'flow' });
      }
    }

    if (!stickyMad) {
      upsert({
        name: STANDARD_INTENTIONS.isUnknownTransition,
        boost: 0,
        priority: 0,
        source: 'runtime',
      });
    }

    return [...byName.values()];
  }

  /**
   * Stamp the resolved listen window onto the active expectation.
   * sayAndListen timeout > listen() timeout > Node.listenTimeoutSeconds > default.
   */
  private stampListenTimeout(
    runtime: SupervisedConversation,
    node: Ra9Node,
    fromSayAndListen?: number,
  ): void {
    const timeoutSeconds = resolveListenTimeoutSeconds({
      fromSayAndListen,
      fromListen: runtime.listenExpectation?.timeoutSeconds,
      fromNode: node.listenTimeoutSeconds,
    });
    if (!runtime.listenExpectation) {
      runtime.listenExpectation = {
        intentions: [],
        timeoutSeconds,
        interruptible: node.interruptible,
      };
      return;
    }
    runtime.listenExpectation.timeoutSeconds = timeoutSeconds;
    if (runtime.listenExpectation.interruptible === undefined) {
      runtime.listenExpectation.interruptible = node.interruptible;
    }
  }

  private enterPortal(
    runtime: SupervisedConversation,
    candidate: FlowNodeDefinition,
  ): string | null | undefined {
    const switching =
      runtime.portalState.activePortalId &&
      runtime.portalState.activePortalId !== candidate.id;

    if (switching) {
      const restored = runtime.exitPortal();
      this.events.log('info', 'PORTAL_EXIT', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        restoredOriginNodeId: restored,
        reason: 'switch_portal',
      });
    }

    const alreadyInSame =
      runtime.portalState.activePortalId === candidate.id;

    runtime.enterPortal(candidate.id);

    this.events.log('info', alreadyInSame ? 'PORTAL_REENTER' : 'PORTAL_ENTER', {
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      portalId: candidate.id,
      originNodeId: runtime.portalState.originNodeId,
    });

    return undefined;
  }

  private enterNormal(
    runtime: SupervisedConversation,
    candidate: FlowNodeDefinition,
  ): string | null | undefined {
    let restored: string | null | undefined;
    if (runtime.portalState.activePortalId) {
      restored = runtime.exitPortal();
      this.events.log('info', 'PORTAL_EXIT', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        restoredOriginNodeId: restored,
        nextNodeId: candidate.id,
        reason: 'normal_intention',
      });
    }
    runtime.enterNormalNode(candidate.id);
    return restored;
  }

  /**
   * After a toolCall terminal action, remember which Node requested it so the
   * next Custom LLM turn with role:tool can re-enter without Brain scan.
   */
  private stampPendingToolNode(
    runtime: SupervisedConversation,
    result: NodeResult,
    selectedNodeId: string,
  ): void {
    if (result.kind === 'toolCall') {
      runtime.metadata[CHANNEL_META.pendingToolNodeId] = selectedNodeId;
      return;
    }
    // Non-tool terminals clear the pending marker.
    if (
      result.kind === 'sayAndListen' ||
      result.kind === 'endCall' ||
      result.kind === 'transferToHuman' ||
      result.kind === 'handoff' ||
      result.kind === 'continueTo'
    ) {
      delete runtime.metadata[CHANNEL_META.pendingToolNodeId];
    }
  }

  /**
   * Tool-result-only Custom LLM turn — re-run the Node that emitted toolCall.
   */
  private async executeToolResultTurn(input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
  }): Promise<TurnExecutionResult> {
    const { runtime, userText, onSay } = input;
    const flow = this.flowLoader.getFlow();
    const pendingId =
      typeof runtime.metadata[CHANNEL_META.pendingToolNodeId] === 'string'
        ? String(runtime.metadata[CHANNEL_META.pendingToolNodeId])
        : null;
    const entryId =
      pendingId ||
      runtime.currentNodeId ||
      runtime.normalFlowNodeId ||
      flow.start;
    const candidate = flow.nodes[entryId];
    if (!candidate) {
      throw new Error(`Tool-result node "${entryId}" missing`);
    }
    const node = this.nodes.get(candidate.class);
    if (!node) {
      throw new Error(`Tool-result class not registered: ${candidate.class}`);
    }

    const output = new BufferedConversationOutput(onSay);
    const ctx = nodeContextFromRuntime({
      runtime,
      userText,
      output,
      events: this.events,
      brain: this.brain,
      integrations: this.integrations,
      forms: this.forms,
      intention: STANDARD_INTENTIONS.isToolResult,
    });

    this.events.log('info', 'TOOL_RESULT_TURN', {
      conversationId: runtime.conversationId,
      providerCallId: runtime.providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      entryNodeId: entryId,
      class: candidate.class,
      turnNumber: runtime.turn.turnNumber,
    });

    const can = await node.before(ctx);
    if (!can) {
      throw new Error(`Tool-result node ${entryId} rejected before()`);
    }

    if (candidate.portal) {
      this.enterPortal(runtime, candidate);
    } else {
      this.enterNormal(runtime, candidate);
    }

    const executed = await this.executeNodeWithCatch({
      runtime,
      userText,
      output,
      node,
      candidate,
      intentionName: STANDARD_INTENTIONS.isToolResult,
      ctx,
      restarts: 0,
      forceHop: 0,
    });

    if (executed.kind === 'forceIntention') {
      const routed = await this.routeIntentions({
        runtime,
        userText,
        output,
        ranked: [
          {
            name: executed.intention,
            confidence: 1,
            priority: DEFAULT_INTENTION_PRIORITY,
            rank: 0,
          },
        ],
        forceHop: 1,
      });
      this.stampPendingToolNode(runtime, routed.result, routed.selectedNodeId);
      return {
        runtime,
        intentionNames: [STANDARD_INTENTIONS.isToolResult, executed.intention],
        selectedNodeId: routed.selectedNodeId,
        selectedClass: routed.selectedClass,
        result: routed.result,
        actions: output.actions,
        portalOriginRestored: routed.portalOriginRestored,
      };
    }

    this.stampPendingToolNode(runtime, executed.result, candidate.id);
    return {
      runtime,
      intentionNames: [STANDARD_INTENTIONS.isToolResult],
      selectedNodeId: candidate.id,
      selectedClass: candidate.class,
      result: executed.result,
      actions: output.actions,
    };
  }
}
