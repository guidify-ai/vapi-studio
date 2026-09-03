import { Injectable } from '@nestjs/common';
import type { SupervisedConversation } from './supervised-conversation';
import type { PortalState } from './types';
import type { ListenExpectation } from './listen-expectation';
import type { ConversationHistory } from './conversation-history';
import { emptyConversationHistory } from './conversation-history';
import { EventService } from '../events/event.service';
import {
  ConversationRepository,
  extractCallerIdFromBags,
  type ResumableConversation,
} from '../persistence/conversation.repository';
import { SupervisedConversationRegistry } from './supervised-conversation.registry';
import { CallTurnQueueRegistry } from './call-turn-queue';
import { BrainUsageTracker } from '../brain/brain-usage.tracker';

/** Default window for “continue where you left off?” */
export const DEFAULT_RESUME_WITHIN_MS = 10 * 60 * 1000;

const CHANNEL_META_KEYS = [
  'caller',
  'callerId',
  'channel',
  'callerPhoneNumber',
  'callerChannel',
  'startedBy',
  'afterHours',
  'abOverrides',
  'featureFlags',
] as const;

export interface ResumePeekResult {
  prior: ResumableConversation;
  summary: {
    activeModuleId: string | null;
    currentNodeId: string | null;
    firstName: string | null;
  };
}

/**
 * Cross-call resume: find a recent Conversation for the same caller and
 * clone its durable state into the **current** call (new providerCallId).
 *
 * Avoids injecting ConversationBootstrapService (Entry↔Bootstrap cycle).
 */
@Injectable()
export class ConversationResumeService {
  public constructor(
    private readonly conversations: ConversationRepository,
    private readonly events: EventService,
    private readonly registry: SupervisedConversationRegistry,
    private readonly turnQueues: CallTurnQueueRegistry,
    private readonly brainUsage: BrainUsageTracker,
  ) {}

  public async peek(input: {
    callerId: string;
    excludeConversationId: string;
    withinMs?: number;
  }): Promise<ResumePeekResult | null> {
    const prior = await this.conversations.findResumableForCaller({
      callerId: input.callerId,
      withinMs: input.withinMs ?? DEFAULT_RESUME_WITHIN_MS,
      excludeConversationId: input.excludeConversationId,
    });
    if (!prior) return null;
    const mem =
      prior.state.memory && typeof prior.state.memory === 'object'
        ? (prior.state.memory as Record<string, unknown>)
        : {};
    const meta =
      prior.state.metadata && typeof prior.state.metadata === 'object'
        ? (prior.state.metadata as Record<string, unknown>)
        : {};
    return {
      prior,
      summary: {
        activeModuleId:
          typeof meta.activeModuleId === 'string' ? meta.activeModuleId : null,
        currentNodeId:
          typeof prior.state.currentNodeId === 'string'
            ? prior.state.currentNodeId
            : null,
        firstName: typeof mem.firstName === 'string' ? mem.firstName : null,
      },
    };
  }

  public async applyCloneByConversationId(
    runtime: SupervisedConversation,
    priorConversationId: string,
  ): Promise<boolean> {
    const row = await this.conversations.findById(priorConversationId);
    if (!row) return false;
    const state =
      row.status === 'ENDED'
        ? row.finalState
        : (row.runtimeState ?? row.finalState);
    if (!state || typeof state !== 'object') return false;
    await this.applyClone(runtime, {
      conversationId: row.id,
      providerCallId: row.providerCallId,
      status: row.status,
      state: state as Record<string, unknown>,
      activityAt: row.lastActivityAt ?? row.endedAt ?? row.createdAt,
    });
    return true;
  }

  public async applyClone(
    runtime: SupervisedConversation,
    prior: ResumableConversation,
  ): Promise<void> {
    const state = prior.state;
    const keepVars = { ...(runtime.variables as Record<string, unknown>) };
    const keepMeta: Record<string, unknown> = {};
    for (const key of CHANNEL_META_KEYS) {
      if (runtime.metadata[key] !== undefined) {
        keepMeta[key] = runtime.metadata[key];
      }
    }

    const priorMeta =
      state.metadata && typeof state.metadata === 'object'
        ? { ...(state.metadata as Record<string, unknown>) }
        : {};
    const priorMemory =
      state.memory && typeof state.memory === 'object'
        ? { ...(state.memory as Record<string, unknown>) }
        : {};

    delete priorMemory.pendingResumeConversationId;
    delete priorMemory.pendingResumeAsked;
    delete priorMemory.pendingResumeModuleId;
    delete priorMemory.pendingResumeNodeId;
    priorMemory.resumedFromConversationId = prior.conversationId;

    runtime.memory = priorMemory;
    if (state.history && typeof state.history === 'object') {
      runtime.history = state.history as ConversationHistory;
    } else {
      runtime.history = emptyConversationHistory();
    }

    if (state.portalState && typeof state.portalState === 'object') {
      const ps = state.portalState as PortalState;
      runtime.portalState = {
        activePortalId: ps.activePortalId ?? null,
        originNodeId: ps.originNodeId ?? null,
        originListenExpectation: null,
        transferToHuman: {
          reengagementAttempts:
            ps.transferToHuman?.reengagementAttempts ?? 0,
        },
        stillThere: {
          attempts: ps.stillThere?.attempts ?? 0,
        },
      };
    }

    runtime.currentNodeId =
      typeof state.currentNodeId === 'string' ? state.currentNodeId : null;
    runtime.normalFlowNodeId =
      typeof state.normalFlowNodeId === 'string'
        ? state.normalFlowNodeId
        : runtime.currentNodeId;
    runtime.brainSequenceIndex =
      typeof state.brainSequenceIndex === 'number'
        ? state.brainSequenceIndex
        : 0;
    runtime.openingCompleted = true;
    runtime.listenExpectation =
      (state.listenExpectation as ListenExpectation | null) ?? null;
    runtime.lastAssistantSpeech = Array.isArray(state.lastAssistantSpeech)
      ? (state.lastAssistantSpeech as string[]).filter(
          (s) => typeof s === 'string',
        )
      : [];
    if (state.turn && typeof state.turn === 'object') {
      const t = state.turn as {
        turnNumber?: number;
        interrupted?: boolean;
        lastInterruptAt?: string;
      };
      runtime.turn = {
        turnNumber:
          typeof t.turnNumber === 'number'
            ? t.turnNumber
            : runtime.turn.turnNumber,
        interrupted: Boolean(t.interrupted),
        lastInterruptAt: t.lastInterruptAt,
      };
    }
    if (typeof state.brainProfileId === 'string' && state.brainProfileId) {
      runtime.brainProfileId = state.brainProfileId;
    }

    const priorVars =
      state.variables && typeof state.variables === 'object'
        ? { ...(state.variables as Record<string, unknown>) }
        : {};
    runtime.variables = {
      ...priorVars,
      ...keepVars,
    };

    runtime.metadata = {
      ...priorMeta,
      ...keepMeta,
      activeModuleId: priorMeta.activeModuleId ?? null,
      workflowId: priorMeta.workflowId ?? null,
      lastHandoff: priorMeta.lastHandoff,
      resumedFromConversationId: prior.conversationId,
      resumedFromProviderCallId: prior.providerCallId,
    };

    const cloned = await this.conversations.cloneEvents({
      fromConversationId: prior.conversationId,
      toConversationId: runtime.conversationId,
    });

    await this.events.persist(runtime.conversationId, 'CONVERSATION_RESUMED', {
      fromConversationId: prior.conversationId,
      fromProviderCallId: prior.providerCallId,
      fromStatus: prior.status,
      eventsCloned: cloned,
      currentNodeId: runtime.currentNodeId,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
      callerId: extractCallerIdFromBags(
        runtime.variables as Record<string, unknown>,
        runtime.metadata,
      ),
    });

    if (runtime.status === 'ACTIVE') {
      await this.conversations.saveRuntimeCheckpoint({
        conversationId: runtime.conversationId,
        runtimeState: runtime.snapshot(),
        callerId: extractCallerIdFromBags(
          runtime.variables as Record<string, unknown>,
          runtime.metadata,
        ),
      });
    }

    if (prior.status === 'ACTIVE') {
      await this.sealAbandonedPrior(prior);
    }
  }

  private async sealAbandonedPrior(
    prior: ResumableConversation,
  ): Promise<void> {
    const live = this.registry.getByProviderCallId(prior.providerCallId);
    if (live && live.conversationId === prior.conversationId) {
      live.status = 'ENDED';
      this.registry.delete(prior.providerCallId);
      this.turnQueues.delete(prior.providerCallId);
      this.brainUsage.clear(prior.providerCallId);
    }
    await this.conversations.markEnded({
      conversationId: prior.conversationId,
      finalState: {
        ...prior.state,
        status: 'ENDED',
        supersededByResume: true,
      },
      callerId: extractCallerIdFromBags(
        prior.state.variables as Record<string, unknown> | undefined,
        prior.state.metadata as Record<string, unknown> | undefined,
      ),
    });
  }
}
