import type { SupervisedConversation } from '../conversation/supervised-conversation';
import { appendNodeVisit } from '../conversation/conversation-history';
import {
  mergeSayAndListenOptions,
} from '../conversation/listen-expectation';
import { resolveListenTimeoutSeconds } from '../conversation/listen-timeout';
import { CHANNEL_META } from '../channel/channel-tools';
import {
  type NodeContext,
  type AgentNode,
} from '../node/agent-node';
import type { CatchDirective } from '../node/catch-directive';
import {
  BufferedConversationOutput,
  type NodeResult,
} from '../output/conversation-output';
import type { FlowNodeDefinition } from '../flow/flow-loader';
import { snapshotUserMemory } from '../events/conversation-console';
import {
  actionForensics,
  nodeResultForensics,
} from '../events/route-forensics';
import type { SupervisorEngine } from './supervisor.types';
import { MAX_NODE_RESTARTS } from './supervisor.types';


export async function executeNodeWithCatch(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  node: AgentNode;
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



/**
 * Stamp the resolved listen window onto the active expectation.
 * sayAndListen timeout > listen() timeout > Node.listenTimeoutSeconds > default.
 */
export function stampListenTimeout(this: SupervisorEngine, 
  runtime: SupervisedConversation,
  node: AgentNode,
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



export function enterPortal(this: SupervisorEngine, 
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



export function enterNormal(this: SupervisorEngine, 
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



/**
 * After a toolCall terminal action, remember which Node requested it so the
 * next Custom LLM turn with role:tool can re-enter without Brain scan.
 */
export function stampPendingToolNode(this: SupervisorEngine, 
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

