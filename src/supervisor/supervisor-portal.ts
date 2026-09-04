import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { IntentionCandidate } from '../conversation/types';
import {
  tryResolveListenIntention,
  type ListenExpectation,
} from '../conversation/listen-expectation';
import {
  resolveConfidenceThreshold,
  scoresToRankedCandidates,
  selectWalkableIntentions,
} from '../brain/brain-ranking';
import { STANDARD_INTENTIONS } from '../intentions/standard-intentions';
import { BufferedConversationOutput, type NodeResult } from '../output/conversation-output';
import { nodeContextFromRuntime } from '../node/ra9-node';
import { ROUTE_RESOLVED_VIA } from '../intention/ra9-intention';
import type { FlowNodeDefinition } from '../flow/flow-loader';
import type { SupervisorEngine } from './supervisor.types';
import { MAX_FORCE_INTENTION_HOPS } from './supervisor.types';


/** Continue / isContinue is an escape hatch back to the pre-portal node. */
export function isContinueNode(this: SupervisorEngine, candidate: FlowNodeDefinition): boolean {
  return (
    candidate.class === 'ContinueNode' ||
    candidate.id === 'continue' ||
    (candidate.intentions.length === 1 &&
      candidate.intentions[0] === 'isContinue')
  );
}



export function isStillThereNode(this: SupervisorEngine, candidate: FlowNodeDefinition): boolean {
  return (
    candidate.class === 'StillThereNode' ||
    candidate.id === 'stillThere' ||
    candidate.intentions.includes(STANDARD_INTENTIONS.isStillThere)
  );
}

/** True when the active portal owns `studio.isUnknownTransition`. */



/** True when the active portal owns `studio.isUnknownTransition`. */
export function isUnknownPortalActive(this: SupervisorEngine, runtime: SupervisedConversation): boolean {
  const portalId = runtime.portalState.activePortalId;
  if (!portalId) return false;
  const def = this.flowLoader.getFlow().nodes[portalId];
  if (!def?.portal) return false;
  return def.intentions.includes(STANDARD_INTENTIONS.isUnknownTransition);
}

/**
 * While in unknown recovery, try the origin’s listen (snapshot or refresh).
 * If the utterance resolves / ranks as a non-unknown product (or portal)
 * intention, exit the portal and route that intention on this turn — do not
 * re-scan against unknown’s thin candidate list.
 */



/**
 * While in unknown recovery, try the origin’s listen (snapshot or refresh).
 * If the utterance resolves / ranks as a non-unknown product (or portal)
 * intention, exit the portal and route that intention on this turn — do not
 * re-scan against unknown’s thin candidate list.
 */
export async function tryUnknownOriginConsume(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  forceHop: number;
}): Promise<{
  intentionNames: string[];
  selectedNodeId: string;
  selectedClass: string;
  result: NodeResult;
  portalOriginRestored?: string | null;
} | null> {
  const { runtime, userText, output, forceHop } = input;
  const portalId = runtime.portalState.activePortalId;
  const originId =
    runtime.portalState.originNodeId ?? runtime.normalFlowNodeId;
  if (!portalId || !originId) return null;

  const savedListen = runtime.portalState.originListenExpectation ?? null;
  const probeListen =
    savedListen ??
    (await this.resolveOriginListenForReplay({
      runtime,
      userText,
      output,
      originId,
      preferSaved: false,
      clearSaved: false,
    }));
  if (!probeListen) return null;

  const confidenceThreshold = resolveConfidenceThreshold(
    this.brainConfig?.confidenceThreshold,
  );
  const brainCandidates = this.buildBrainCandidates(probeListen, runtime);
  const resolvedName = await tryResolveListenIntention({
    listen: probeListen,
    userText,
    memory: runtime.memory as Record<string, unknown>,
  });

  let ranked: IntentionCandidate[];
  if (resolvedName) {
    ranked = scoresToRankedCandidates(
      [
        {
          name: resolvedName,
          confidence: 1,
          reason: ROUTE_RESOLVED_VIA.UnknownOriginConsume,
        },
      ],
      brainCandidates,
    );
    runtime.brainSequenceIndex = (runtime.brainSequenceIndex ?? 0) + 1;
  } else {
    const scan = await this.brain.scan({
      runtime,
      userText,
      listen: probeListen,
      candidates: brainCandidates,
      confidenceThreshold,
      history: {
        chat: runtime.history.chat,
        nodes: runtime.history.nodes,
      },
    });
    ranked = selectWalkableIntentions(
      scan.intentions,
      confidenceThreshold,
      STANDARD_INTENTIONS.isUnknownTransition,
    );
  }

  ranked = ranked.filter(
    (i) =>
      i.name !== 'isContinue' &&
      i.name !== STANDARD_INTENTIONS.isUnknownTransition,
  );
  if (ranked.length === 0) {
    return null;
  }

  this.events.log('info', 'UNKNOWN_ORIGIN_CONSUME', {
    conversationId: runtime.conversationId,
    runtimeInstanceId: runtime.runtimeInstanceId,
    portalId,
    originNodeId: originId,
    userText,
    resolvedName: resolvedName ?? null,
    ranked: ranked.map((i) => i.name),
    usedSavedOriginListen: Boolean(savedListen),
  });

  const portalOriginRestored = runtime.exitPortal();
  const targetId = portalOriginRestored ?? originId;
  runtime.enterNormalNode(targetId!);
  runtime.listenExpectation = probeListen;
  const originCandidate = this.flowLoader.getFlow().nodes[targetId!];
  const originNode = originCandidate
    ? this.nodes.get(originCandidate.class)
    : undefined;
  if (originNode) {
    this.stampListenTimeout(runtime, originNode);
  }

  const routed = await this.routeIntentions({
    runtime,
    userText,
    output,
    ranked,
    forceHop: forceHop + 1,
    resolvedVia: ROUTE_RESOLVED_VIA.UnknownOriginConsume,
  });

  return {
    intentionNames: ranked.map((i) => i.name),
    selectedNodeId: routed.selectedNodeId,
    selectedClass: routed.selectedClass,
    result: routed.result,
    portalOriginRestored:
      portalOriginRestored ?? routed.portalOriginRestored,
  };
}

/**
 * Origin listen for Continue / unknown consume: prefer the snapshot taken at
 * portal enter (keeps `sayAndListen` overrides + resolveIntention).
 */



/**
 * Origin listen for Continue / unknown consume: prefer the snapshot taken at
 * portal enter (keeps `sayAndListen` overrides + resolveIntention).
 */
export async function resolveOriginListenForReplay(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  originId: string;
  preferSaved: boolean;
  clearSaved: boolean;
}): Promise<ListenExpectation | null> {
  const { runtime, userText, output, originId, preferSaved, clearSaved } =
    input;
  const saved = preferSaved
    ? runtime.portalState.originListenExpectation
    : null;
  if (clearSaved) {
    runtime.portalState.originListenExpectation = null;
  }
  if (saved) {
    return saved;
  }

  const flow = this.flowLoader.getFlow();
  const originCandidate = flow.nodes[originId];
  if (!originCandidate) return null;
  const originNode = this.nodes.get(originCandidate.class);
  if (!originNode) return null;

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
  return originNode.listen(listenCtx);
}

/**
 * Exit the active portal (if any), restore the origin Node, refresh its
 * listen, re-scan the same user text, and route again — without speaking a
 * filler “Okay, continuing.”
 */



/**
 * Exit the active portal (if any), restore the origin Node, refresh its
 * listen, re-scan the same user text, and route again — without speaking a
 * filler “Okay, continuing.”
 */
export async function replayOriginAfterContinue(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  forceHop: number;
  fromNodeId: string;
  resolvedVia?: string;
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

  // Keep snapshot before exitPortal clears it.
  const savedListen = runtime.portalState.originListenExpectation ?? null;

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

  const listenExpectation =
    savedListen ??
    (await this.resolveOriginListenForReplay({
      runtime,
      userText,
      output,
      originId: targetId,
      preferSaved: false,
      clearSaved: false,
    }));
  if (!listenExpectation) {
    throw new Error(`Continue origin listen missing for "${targetId}"`);
  }
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
              reason:
                input.resolvedVia ?? ROUTE_RESOLVED_VIA.Continue,
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
    via: input.resolvedVia ?? ROUTE_RESOLVED_VIA.Continue,
    usedSavedOriginListen: Boolean(savedListen),
  });

  const routed = await this.routeIntentions({
    runtime,
    userText,
    output,
    ranked,
    forceHop,
    resolvedVia: input.resolvedVia ?? ROUTE_RESOLVED_VIA.Continue,
  });
  return {
    ...routed,
    portalOriginRestored: portalOriginRestored ?? routed.portalOriginRestored,
  };
}
