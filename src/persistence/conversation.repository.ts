import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { ConversationEventEntity } from './conversation-event.entity';
import type { ConversationStatus } from '../conversation/types';

/** Pull caller id from bootstrap metadata / snapshot bags. */
export function extractCallerIdFromBags(
  ...bags: Array<Record<string, unknown> | null | undefined>
): string | null {
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object') continue;
    const direct = bag.callerId;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const phone = bag.callerPhoneNumber;
    if (typeof phone === 'string' && phone.trim()) return phone.trim();
    const caller = bag.caller;
    if (caller && typeof caller === 'object' && !Array.isArray(caller)) {
      const id = (caller as { id?: unknown }).id;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
    const vars = bag.variables;
    if (vars && typeof vars === 'object' && !Array.isArray(vars)) {
      const vid = (vars as { callerId?: unknown }).callerId;
      if (typeof vid === 'string' && vid.trim()) return vid.trim();
    }
  }
  return null;
}

export interface ResumableConversation {
  conversationId: string;
  providerCallId: string;
  status: ConversationStatus;
  /** Best snapshot for clone (finalState preferred, else runtimeState). */
  state: Record<string, unknown>;
  activityAt: Date;
}

@Injectable()
export class ConversationRepository {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(ConversationEventEntity)
    private readonly events: Repository<ConversationEventEntity>,
  ) {}

  createActive(input: {
    providerCallId: string;
    runtimeInstanceId: string;
    metadata?: Record<string, unknown>;
    provider?: string;
    callerId?: string | null;
  }): Promise<ConversationEntity> {
    const meta = input.metadata ?? {};
    const callerId =
      (typeof input.callerId === 'string' && input.callerId.trim()
        ? input.callerId.trim()
        : null) ?? extractCallerIdFromBags(meta);
    const row = this.conversations.create({
      provider: input.provider ?? 'vapi',
      providerCallId: input.providerCallId,
      status: 'ACTIVE',
      callerId,
      runtimeInstanceId: input.runtimeInstanceId,
      metadata: meta,
      endedAt: null,
      lastActivityAt: new Date(),
      runtimeState: null,
      finalState: null,
    });
    return this.conversations.save(row);
  }

  findByProviderCallId(
    providerCallId: string,
  ): Promise<ConversationEntity | null> {
    return this.conversations.findOne({ where: { providerCallId } });
  }

  findById(conversationId: string): Promise<ConversationEntity | null> {
    return this.conversations.findOne({ where: { id: conversationId } });
  }

  /** ACTIVE rows that have a checkpoint (eligible for crash restore). */
  listActiveWithState(): Promise<ConversationEntity[]> {
    return this.conversations
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'ACTIVE' })
      .andWhere('c.runtime_state IS NOT NULL')
      .orderBy('c.created_at', 'ASC')
      .getMany();
  }

  listActive(): Promise<ConversationEntity[]> {
    return this.conversations.find({
      where: { status: 'ACTIVE' },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Latest ENDED (with final_state) or abandoned ACTIVE (with runtime_state)
   * for this caller within the window, excluding the current conversation.
   */
  async findResumableForCaller(input: {
    callerId: string;
    withinMs: number;
    excludeConversationId?: string;
  }): Promise<ResumableConversation | null> {
    const callerId = input.callerId.trim();
    if (!callerId) return null;
    const since = new Date(Date.now() - input.withinMs);

    const qb = this.conversations
      .createQueryBuilder('c')
      .where('c.caller_id = :callerId', { callerId })
      .andWhere(
        `(
          (c.status = 'ENDED' AND c.final_state IS NOT NULL AND COALESCE(c.last_activity_at, c.ended_at, c.created_at) >= :since)
          OR
          (c.status = 'ACTIVE' AND c.runtime_state IS NOT NULL AND COALESCE(c.last_activity_at, c.created_at) >= :since)
        )`,
        { since },
      )
      .orderBy(
        `COALESCE(c.last_activity_at, c.ended_at, c.created_at)`,
        'DESC',
      )
      .take(8);

    if (input.excludeConversationId) {
      qb.andWhere('c.id != :excludeId', {
        excludeId: input.excludeConversationId,
      });
    }

    const rows = await qb.getMany();
    for (const row of rows) {
      const state =
        row.status === 'ENDED'
          ? row.finalState
          : (row.runtimeState ?? row.finalState);
      if (!state || typeof state !== 'object') continue;
      const activityAt =
        row.lastActivityAt ?? row.endedAt ?? row.createdAt;
      if (activityAt.getTime() < since.getTime()) continue;
      return {
        conversationId: row.id,
        providerCallId: row.providerCallId,
        status: row.status,
        state: state as Record<string, unknown>,
        activityAt,
      };
    }
    return null;
  }

  async saveRuntimeCheckpoint(input: {
    conversationId: string;
    runtimeState: Record<string, unknown>;
    callerId?: string | null;
  }): Promise<void> {
    const patch: Record<string, unknown> = {
      runtimeState: input.runtimeState,
      lastActivityAt: new Date(),
    };
    if (typeof input.runtimeState.runtimeInstanceId === 'string') {
      patch.runtimeInstanceId = input.runtimeState.runtimeInstanceId;
    }
    const callerId =
      (typeof input.callerId === 'string' && input.callerId.trim()
        ? input.callerId.trim()
        : null) ??
      extractCallerIdFromBags(
        input.runtimeState.variables as Record<string, unknown> | undefined,
        input.runtimeState.metadata as Record<string, unknown> | undefined,
      );
    if (callerId) {
      patch.callerId = callerId;
    }
    await this.conversations.update(
      { id: input.conversationId, status: 'ACTIVE' },
      patch as never,
    );
  }

  async markEnded(input: {
    conversationId: string;
    finalState: Record<string, unknown>;
    callerId?: string | null;
  }): Promise<void> {
    const row = await this.conversations.findOneByOrFail({
      id: input.conversationId,
    });
    row.status = 'ENDED';
    row.endedAt = new Date();
    row.lastActivityAt = row.endedAt;
    row.finalState = input.finalState;
    row.runtimeState = input.finalState;
    const callerId =
      (typeof input.callerId === 'string' && input.callerId.trim()
        ? input.callerId.trim()
        : null) ??
      extractCallerIdFromBags(
        input.finalState.variables as Record<string, unknown> | undefined,
        input.finalState.metadata as Record<string, unknown> | undefined,
        row.metadata,
      );
    if (callerId) {
      row.callerId = callerId;
    }
    await this.conversations.save(row);
  }

  async appendEvent(input: {
    conversationId: string;
    type: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const row = this.events.create({
      conversationId: input.conversationId,
      type: input.type,
      payload: input.payload ?? {},
    });
    await this.events.save(row);
  }

  listEvents(conversationId: string): Promise<ConversationEventEntity[]> {
    return this.events.find({
      where: { conversationId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Copy all events from one conversation onto another.
   * Preserves original type; stamps clone provenance into payload.
   */
  async cloneEvents(input: {
    fromConversationId: string;
    toConversationId: string;
  }): Promise<number> {
    const source = await this.listEvents(input.fromConversationId);
    if (source.length === 0) return 0;
    const rows = source.map((ev) =>
      this.events.create({
        conversationId: input.toConversationId,
        type: ev.type,
        payload: {
          ...(ev.payload ?? {}),
          clonedFromConversationId: input.fromConversationId,
          clonedFromEventId: ev.id,
          originalCreatedAt: ev.createdAt.toISOString(),
        },
      }),
    );
    await this.events.save(rows);
    return rows.length;
  }
}
