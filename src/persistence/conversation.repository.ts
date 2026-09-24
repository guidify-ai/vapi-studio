import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
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
  public constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
  ) {}

  public createActive(input: {
    projectId: string;
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
      projectId: input.projectId,
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

  public findByProviderCallId(
    providerCallId: string,
    projectId?: string,
  ): Promise<ConversationEntity | null> {
    if (projectId) {
      return this.conversations.findOne({
        where: { providerCallId, projectId },
      });
    }
    return this.conversations.findOne({ where: { providerCallId } });
  }

  public findById(conversationId: string): Promise<ConversationEntity | null> {
    return this.conversations.findOne({ where: { id: conversationId } });
  }

  /** ACTIVE rows that have a checkpoint (eligible for crash restore). */
  public listActiveWithState(): Promise<ConversationEntity[]> {
    return this.conversations
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'ACTIVE' })
      .andWhere('c.runtime_state IS NOT NULL')
      .orderBy('c.created_at', 'ASC')
      .getMany();
  }

  public listActive(): Promise<ConversationEntity[]> {
    return this.conversations.find({
      where: { status: 'ACTIVE' },
      order: { createdAt: 'ASC' },
    });
  }

  /** Recent conversations for operator debug UIs (newest first). */
  public async listRecent(input?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: ConversationEntity[]; total: number }> {
    const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
    const offset = Math.max(input?.offset ?? 0, 0);
    const [items, total] = await this.conversations.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  /** Ended conversations with a final_state snapshot (for analytics backfill). */
  public listEndedWithFinalState(input: {
    projectId: string;
    since?: Date;
    limit?: number;
  }): Promise<ConversationEntity[]> {
    const limit = Math.min(Math.max(input.limit ?? 500, 1), 2000);
    const qb = this.conversations
      .createQueryBuilder('c')
      .where('c.project_id = :projectId', { projectId: input.projectId })
      .andWhere(`c.status = 'ENDED'`)
      .andWhere('c.final_state IS NOT NULL')
      .orderBy('c.ended_at', 'DESC')
      .take(limit);
    if (input.since) {
      qb.andWhere('c.created_at >= :since', { since: input.since });
    }
    return qb.getMany();
  }

  /**
   * Latest ENDED (with final_state) or abandoned ACTIVE (with runtime_state)
   * for this caller within the window, excluding the current conversation.
   */
  public async findResumableForCaller(input: {
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

  public async saveRuntimeCheckpoint(input: {
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

  public async markEnded(input: {
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

  public async countConversationsByProject(input: {
    projectId: string;
    since?: Date;
  }): Promise<{ total: number; active: number; ended: number }> {
    const whereBase: Record<string, unknown> = { projectId: input.projectId };
    const qbTotal = this.conversations
      .createQueryBuilder('c')
      .where('c.project_id = :projectId', whereBase);
    if (input.since) {
      qbTotal.andWhere('c.created_at >= :since', { since: input.since });
    }
    const total = await qbTotal.getCount();

    const qbActive = this.conversations
      .createQueryBuilder('c')
      .where('c.project_id = :projectId', whereBase)
      .andWhere('c.status = :status', { status: 'ACTIVE' });
    if (input.since) {
      qbActive.andWhere('c.created_at >= :since', { since: input.since });
    }
    const active = await qbActive.getCount();

    const qbEnded = this.conversations
      .createQueryBuilder('c')
      .where('c.project_id = :projectId', whereBase)
      .andWhere('c.status = :status', { status: 'ENDED' });
    if (input.since) {
      qbEnded.andWhere('c.created_at >= :since', { since: input.since });
    }
    const ended = await qbEnded.getCount();

    return { total, active, ended };
  }

  public async callDurationPercentiles(input: {
    projectId: string;
    since?: Date;
    /** Inclusive 0–1 values, e.g. 0.8 / 0.9. */
    percentiles?: number[];
  }): Promise<{
    sampleSize: number;
    /** Keys like `p80`, `p90` → seconds (rounded to 1 decimal) or null. */
    valuesSec: Record<string, number | null>;
  }> {
    const pcts = (input.percentiles?.length ? input.percentiles : [0.8, 0.9])
      .map((p) => Math.min(1, Math.max(0, Number(p))))
      .filter((p) => Number.isFinite(p));
    const unique = [...new Set(pcts)];
    if (!unique.length) {
      return { sampleSize: 0, valuesSec: {} };
    }

    const params: unknown[] = [input.projectId];
    let sinceSql = '';
    if (input.since) {
      params.push(input.since);
      sinceSql = ` AND c.created_at >= $${params.length}`;
    }
    const pctSelects = unique
      .map(
        (p, i) =>
          `percentile_cont(${p}) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (c.ended_at - c.created_at))) AS p${i}`,
      )
      .join(', ');
    const rows = (await this.conversations.query(
      `
      SELECT COUNT(*)::int AS sample_size, ${pctSelects}
      FROM conversations c
      WHERE c.project_id = $1
        AND c.status = 'ENDED'
        AND c.ended_at IS NOT NULL
        ${sinceSql}
      `,
      params,
    )) as Array<Record<string, string | number | null>>;
    const raw = rows[0] ?? {};
    const sampleSize = Number(raw.sample_size) || 0;
    const valuesSec: Record<string, number | null> = {};
    unique.forEach((p, i) => {
      const key = `p${Math.round(p * 100)}`;
      const v = raw[`p${i}`];
      if (v == null || sampleSize === 0) {
        valuesSec[key] = null;
        return;
      }
      const n = typeof v === 'number' ? v : Number(v);
      valuesSec[key] = Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
    });
    return { sampleSize, valuesSec };
  }
}
