import type { SupervisedConversation } from '../conversation/supervised-conversation';
import {
  DEFAULT_MAX_CONVERSATION_DURATION_MS,
  DEFAULT_MAX_CONVERSATION_TURNS,
  evaluateConversationLimits,
  type ResolvedConversationLimits,
} from '../conversation/conversation-limits';
import { BufferedConversationOutput } from '../output/conversation-output';
import type { SupervisorEngine } from './supervisor.types';
import type { TurnExecutionResult } from './supervisor.types';

/** Supervisor built outside forRoot: bounds still apply; no app words to speak. */
const UNCONFIGURED_LIMITS: ResolvedConversationLimits = {
  maxTurns: DEFAULT_MAX_CONVERSATION_TURNS,
  maxDurationMs: DEFAULT_MAX_CONVERSATION_DURATION_MS,
  endMessage: '',
};

export async function enforceConversationLimits(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult | null> {
  const limits = this.conversationLimits ?? UNCONFIGURED_LIMITS;
  const check = evaluateConversationLimits({
    turnNumber: input.runtime.turn.turnNumber,
    createdAt: input.runtime.createdAt,
    limits,
  });
  if (!check.exceeded) return null;

  const output = new BufferedConversationOutput(input.onSay);
  const result = await output.endCall(limits.endMessage || undefined);

  this.events.log('warn', 'CONVERSATION_LIMIT_EXCEEDED', {
    conversationId: input.runtime.conversationId,
    providerCallId: input.runtime.providerCallId,
    runtimeInstanceId: input.runtime.runtimeInstanceId,
    turnNumber: input.runtime.turn.turnNumber,
    reason: check.reason,
    elapsedMs: check.elapsedMs,
    maxTurns: limits.maxTurns,
    maxDurationMs: limits.maxDurationMs,
  });

  return {
    runtime: input.runtime,
    intentionNames: [],
    selectedNodeId: input.runtime.currentNodeId ?? 'conversation_limit',
    selectedClass: 'ConversationLimit',
    result,
    actions: output.actions,
  };
}

