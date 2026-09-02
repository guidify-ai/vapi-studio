import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupervisedConversation } from './supervised-conversation';
import { SupervisedConversationRegistry } from './supervised-conversation.registry';
import { CallTurnQueueRegistry } from './call-turn-queue';
import { ConversationRepository } from '../persistence/conversation.repository';
import { extractCallerIdFromBags } from '../persistence/conversation.repository';
import { EventService } from '../events/event.service';
import { beginCallLog } from '../events/daily-log.driver';
import { BrainUsageTracker } from '../brain/brain-usage.tracker';
import { FlowLoader } from '../flow/flow-loader';
import {
  CONVERSATION_ENTRY_POINT,
  DefaultConversationEntry,
  type ConversationEntryPoint,
} from './conversation-entry';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; driverError?: { code?: string } };
  return e.code === '23505' || e.driverError?.code === '23505';
}

@Injectable()
export class ConversationBootstrapService {
  private readonly entry: ConversationEntryPoint;
  /** Serialize concurrent bootstrap for the same Vapi call (assistant.started ∥ Custom LLM). */
  private readonly bootstrapping = new Map<
    string,
    Promise<SupervisedConversation>
  >();

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly registry: SupervisedConversationRegistry,
    private readonly flowLoader: FlowLoader,
    private readonly events: EventService,
    private readonly turnQueues: CallTurnQueueRegistry,
    private readonly brainUsage: BrainUsageTracker,
    @Optional()
    @Inject(CONVERSATION_ENTRY_POINT)
    entryPoint?: ConversationEntryPoint,
  ) {
    this.entry = entryPoint ?? new DefaultConversationEntry();
  }

  async bootstrap(input: {
    providerCallId: string;
    brainProfileId: string;
    metadata?: Record<string, unknown>;
    variables?: Record<string, unknown>;
  }): Promise<SupervisedConversation> {
    const existing = this.registry.getByProviderCallId(input.providerCallId);
    if (existing) {
      this.openCallLog(existing, input.metadata);
      this.events.log('warn', 'BOOTSTRAP_REUSE', {
        providerCallId: input.providerCallId,
        runtimeInstanceId: existing.runtimeInstanceId,
        conversationId: existing.conversationId,
      });
      return existing;
    }

    const inflight = this.bootstrapping.get(input.providerCallId);
    if (inflight) {
      this.events.log('info', 'BOOTSTRAP_WAIT', {
        providerCallId: input.providerCallId,
      });
      return inflight;
    }

    const pending = this.bootstrapExclusive(input).finally(() => {
      this.bootstrapping.delete(input.providerCallId);
    });
    this.bootstrapping.set(input.providerCallId, pending);
    return pending;
  }

  private async bootstrapExclusive(input: {
    providerCallId: string;
    brainProfileId: string;
    metadata?: Record<string, unknown>;
    variables?: Record<string, unknown>;
  }): Promise<SupervisedConversation> {
    const raced = this.registry.getByProviderCallId(input.providerCallId);
    if (raced) {
      this.openCallLog(raced, input.metadata);
      return raced;
    }

    const flow = this.flowLoader.getFlow();
    const runtimeInstanceId = randomUUID();

    const seeded = await this.entry.createVariables({
      providerCallId: input.providerCallId,
      metadata: input.metadata,
    });
    const variables = {
      ...(seeded as Record<string, unknown>),
      ...(input.variables ?? {}),
    };

    let row;
    try {
      row = await this.conversations.createActive({
        providerCallId: input.providerCallId,
        runtimeInstanceId,
        metadata: {
          ...(input.metadata ?? {}),
          variables,
        },
        callerId: extractCallerIdFromBags(input.metadata, variables),
        provider:
          input.metadata?.channel === 'web'
            ? 'studio'
            : input.metadata?.channel === 'phone'
              ? 'vapi'
              : undefined,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Parallel webhook + Custom LLM both inserted — attach to the winner.
      const existingRow = await this.conversations.findByProviderCallId(
        input.providerCallId,
      );
      if (!existingRow) {
        throw error;
      }
      const attached = this.registry.getByProviderCallId(input.providerCallId);
      if (attached) {
        this.openCallLog(attached, input.metadata);
        this.events.log('warn', 'BOOTSTRAP_REUSE_AFTER_RACE', {
          providerCallId: input.providerCallId,
          conversationId: attached.conversationId,
          runtimeInstanceId: attached.runtimeInstanceId,
        });
        return attached;
      }
      const runtime = new SupervisedConversation({
        conversationId: existingRow.id,
        providerCallId: input.providerCallId,
        flowId: flow.id,
        brainProfileId: input.brainProfileId,
        startNodeId: flow.start,
        runtimeInstanceId: existingRow.runtimeInstanceId ?? runtimeInstanceId,
        metadata: input.metadata,
        variables: {
          ...((existingRow.metadata?.variables as Record<string, unknown>) ??
            {}),
          ...variables,
        },
      });
      this.registry.set(runtime);
      this.openCallLog(runtime, input.metadata);
      this.events.log('warn', 'BOOTSTRAP_ATTACH_EXISTING_ROW', {
        providerCallId: input.providerCallId,
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
      });
      return runtime;
    }

    const runtime = new SupervisedConversation({
      conversationId: row.id,
      providerCallId: input.providerCallId,
      flowId: flow.id,
      brainProfileId: input.brainProfileId,
      startNodeId: flow.start,
      runtimeInstanceId,
      metadata: input.metadata,
      variables,
    });

    this.registry.set(runtime);
    this.openCallLog(runtime, input.metadata);
    await this.events.persist(runtime.conversationId, 'BOOTSTRAP', {
      providerCallId: runtime.providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      flowId: runtime.flowId,
      brainProfileId: runtime.brainProfileId,
      variables: runtime.variables,
    });

    if (this.entry.beforeEach) {
      await this.entry.beforeEach({
        runtime,
        variables: runtime.variables,
      });
      await this.events.persist(runtime.conversationId, 'CONVERSATION_BEFORE_EACH', {
        providerCallId: runtime.providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        variables: runtime.variables,
      });
    }

    await this.checkpoint(runtime);

    return runtime;
  }

  private openCallLog(
    runtime: SupervisedConversation,
    metadata?: Record<string, unknown>,
  ): void {
    const fromMeta = metadata?.callerPhoneNumber;
    const phone =
      (typeof fromMeta === 'string' && fromMeta.trim()
        ? fromMeta.trim()
        : null) ??
      (typeof runtime.metadata.callerPhoneNumber === 'string'
        ? runtime.metadata.callerPhoneNumber
        : null);
    if (phone) {
      runtime.metadata.callerPhoneNumber = phone;
    }
    beginCallLog({
      callId: runtime.providerCallId,
      callerPhone: phone,
    });
  }

  async finalizeEnded(providerCallId: string): Promise<void> {
    const runtime = this.registry.getByProviderCallId(providerCallId);
    if (!runtime) {
      this.events.log('warn', 'FINALIZE_MISSING_RUNTIME', { providerCallId });
      return;
    }
    runtime.status = 'FINALIZING';

    if (this.entry.afterEach) {
      await this.entry.afterEach({
        runtime,
        variables: runtime.variables,
      });
      await this.events.persist(runtime.conversationId, 'CONVERSATION_AFTER_EACH', {
        providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        variables: runtime.variables,
      });
    }

    const finalState = runtime.snapshot();
    await this.conversations.markEnded({
      conversationId: runtime.conversationId,
      finalState,
      callerId: extractCallerIdFromBags(
        runtime.variables as Record<string, unknown>,
        runtime.metadata,
      ),
    });
    await this.events.persist(runtime.conversationId, 'FINALIZE', {
      providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      finalState,
    });
    runtime.status = 'ENDED';
    this.registry.delete(providerCallId);
    this.turnQueues.delete(providerCallId);

    const cost = this.brainUsage.summary(providerCallId);
    if (cost && cost.calls > 0) {
      this.events.log('info', 'BRAIN_COST_SUMMARY', {
        providerCallId,
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        calls: cost.calls,
        promptTokens: cost.promptTokens,
        completionTokens: cost.completionTokens,
        totalTokens: cost.totalTokens,
        estimatedUsd: cost.estimatedUsd,
        money: this.brainUsage.formatMoney(cost.estimatedUsd),
        byModel: cost.byModel,
      });
    }
    this.brainUsage.clear(providerCallId);

    this.events.log('info', 'RUNTIME_REMOVED', {
      providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      conversationId: runtime.conversationId,
      registrySize: this.registry.size(),
    });
  }

  /** Persist live runtime so a process crash can restore ACTIVE conversations. */
  async checkpoint(runtime: SupervisedConversation): Promise<void> {
    if (runtime.status !== 'ACTIVE') return;
    const runtimeState = runtime.snapshot();
    await this.conversations.saveRuntimeCheckpoint({
      conversationId: runtime.conversationId,
      runtimeState,
      callerId: extractCallerIdFromBags(
        runtime.variables as Record<string, unknown>,
        runtime.metadata,
      ),
    });
    this.events.log('info', 'RUNTIME_CHECKPOINT', {
      conversationId: runtime.conversationId,
      providerCallId: runtime.providerCallId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      turnNumber: runtime.turn.turnNumber,
      currentNodeId: runtime.currentNodeId,
    });
  }

  /**
   * Simulate process memory loss: drop all in-memory runtimes without ending DB rows.
   * Checkpoints already in Postgres remain ACTIVE for restore.
   */
  simulateCrash(): {
    dropped: number;
    providerCallIds: string[];
  } {
    const providerCallIds: string[] = [];
    // Registry has no list API — snapshot via size + known map through delete loop.
    // Collect by scanning provider ids from active DB would race; use registry internals via size.
    const before = this.registry.size();
    for (const runtime of this.listRegistryRuntimes()) {
      providerCallIds.push(runtime.providerCallId);
      this.registry.delete(runtime.providerCallId);
      this.turnQueues.delete(runtime.providerCallId);
    }
    this.events.log('warn', 'DISASTER_SIMULATE_CRASH', {
      dropped: providerCallIds.length,
      providerCallIds,
      registrySizeBefore: before,
      registrySizeAfter: this.registry.size(),
    });
    return { dropped: providerCallIds.length, providerCallIds };
  }

  /** Reload every ACTIVE conversation that has a runtime_state checkpoint. */
  async restoreAllActive(): Promise<{
    restored: number;
    skipped: number;
    conversationIds: string[];
  }> {
    const rows = await this.conversations.listActiveWithState();
    let restored = 0;
    let skipped = 0;
    const conversationIds: string[] = [];

    for (const row of rows) {
      if (this.registry.getByConversationId(row.id)) {
        skipped += 1;
        continue;
      }
      if (!row.runtimeState) {
        skipped += 1;
        continue;
      }
      const runtime = SupervisedConversation.fromSnapshot(row.runtimeState);
      // Ensure DB identity wins if snapshot drifted.
      if (runtime.conversationId !== row.id) {
        skipped += 1;
        this.events.log('warn', 'DISASTER_RESTORE_SKIP_ID_MISMATCH', {
          rowId: row.id,
          snapshotConversationId: runtime.conversationId,
        });
        continue;
      }
      runtime.status = 'ACTIVE';
      this.registry.set(runtime);
      this.openCallLog(runtime, runtime.metadata);
      conversationIds.push(runtime.conversationId);
      restored += 1;
      await this.events.persist(runtime.conversationId, 'DISASTER_RESTORED', {
        providerCallId: runtime.providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        currentNodeId: runtime.currentNodeId,
        turnNumber: runtime.turn.turnNumber,
      });
    }

    this.events.log('info', 'DISASTER_RESTORE_ALL', {
      restored,
      skipped,
      conversationIds,
      registrySize: this.registry.size(),
    });
    return { restored, skipped, conversationIds };
  }

  async disasterStatus(): Promise<{
    memoryCount: number;
    dbActiveCount: number;
    dbCheckpointCount: number;
    memory: Array<{
      conversationId: string;
      providerCallId: string;
      currentNodeId: string | null;
      turnNumber: number;
    }>;
  }> {
    const memory = this.listRegistryRuntimes().map((r) => ({
      conversationId: r.conversationId,
      providerCallId: r.providerCallId,
      currentNodeId: r.currentNodeId,
      turnNumber: r.turn.turnNumber,
    }));
    const active = await this.conversations.listActive();
    const withState = await this.conversations.listActiveWithState();
    return {
      memoryCount: memory.length,
      dbActiveCount: active.length,
      dbCheckpointCount: withState.length,
      memory,
    };
  }

  /** Registry has no public iterator — poke via provider ids we track on restore/bootstrap. */
  private listRegistryRuntimes(): SupervisedConversation[] {
    return this.registry.list();
  }
}
