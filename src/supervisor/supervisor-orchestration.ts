import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { IntentionCandidate } from '../conversation/types';
import type { ChannelToolResult } from '../channel/channel-tools';
import { CHANNEL_META } from '../channel/channel-tools';
import { appendChat, DEFAULT_INTENTION_PRIORITY } from '../conversation/conversation-history';
import {
  missingRequiredExtractKeys,
  tryResolveListenIntention,
} from '../conversation/listen-expectation';
import {
  resolveConfidenceThreshold,
  scoresToRankedCandidates,
  selectWalkableIntentions,
} from '../brain/brain-ranking';
import { STANDARD_INTENTIONS } from '../intentions/standard-intentions';
import { BufferedConversationOutput } from '../output/conversation-output';
import { ROUTE_RESOLVED_VIA } from '../intention/code-intention';
import { conditionGotoIntention } from '../flow/flow-loader';
import { snapshotUserMemory } from '../events/conversation-console';
import type { SupervisorEngine } from './supervisor.types';
import type { TurnExecutionResult } from './supervisor.types';


export async function handleTurn(this: SupervisorEngine, input: {
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
    await this.bootstrap?.checkpoint(input.runtime);
  } catch (error) {
    this.events.log('warn', 'RUNTIME_CHECKPOINT_FAILED', {
      conversationId: input.runtime.conversationId,
      providerCallId: input.runtime.providerCallId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}



export async function executeTurn(this: SupervisorEngine, input: {
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

  const limitResult = await this.enforceConversationLimits({
    runtime,
    onSay: recordSay,
  });
  if (limitResult) return limitResult;

  /**
   * Vapi Custom LLM (assistant speaks first / generated message mode):
   * the first request must run() flow.start — no Brain scan, no sequence advance.
   */
  if (!runtime.openingCompleted) {
    return this.executeOpeningTurn({ runtime, userText, onSay: recordSay });
  }

  /**
   * After a workflow handoff into a Studio module, speak the destination entry
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
      resolvedVia: ROUTE_RESOLVED_VIA.ForceIntention,
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
        resolvedVia: ROUTE_RESOLVED_VIA.ConditionForce,
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

  /**
   * Unknown portal: consume the restatement against the origin listen first
   * (Continue-style). Prevents unknown’s thin candidate list from stealing
   * the turn to the wrong happy-path node.
   */
  if (this.isUnknownPortalActive(runtime) && userText.trim()) {
    const output = new BufferedConversationOutput(recordSay);
    const consumed = await this.tryUnknownOriginConsume({
      runtime,
      userText,
      output,
      forceHop: 0,
    });
    if (consumed) {
      this.stampPendingToolNode(
        runtime,
        consumed.result,
        consumed.selectedNodeId,
      );
      return {
        runtime,
        intentionNames: consumed.intentionNames,
        selectedNodeId: consumed.selectedNodeId,
        selectedClass: consumed.selectedClass,
        result: consumed.result,
        actions: output.actions,
        portalOriginRestored: consumed.portalOriginRestored,
      };
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
              reason: matchResolved
                ? ROUTE_RESOLVED_VIA.IntentionMatch
                : ROUTE_RESOLVED_VIA.ListenResolve,
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
        via: matchResolved
          ? ROUTE_RESOLVED_VIA.IntentionMatch
          : ROUTE_RESOLVED_VIA.ListenResolve,
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
      ? ROUTE_RESOLVED_VIA.IntentionMatch
      : resolvedName
        ? ROUTE_RESOLVED_VIA.ListenResolve
        : ROUTE_RESOLVED_VIA.Brain,
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
