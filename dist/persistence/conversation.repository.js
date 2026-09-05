"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationRepository = void 0;
exports.extractCallerIdFromBags = extractCallerIdFromBags;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const conversation_entity_1 = require("./conversation.entity");
const conversation_event_entity_1 = require("./conversation-event.entity");
/** Pull caller id from bootstrap metadata / snapshot bags. */
function extractCallerIdFromBags(...bags) {
    for (const bag of bags) {
        if (!bag || typeof bag !== 'object')
            continue;
        const direct = bag.callerId;
        if (typeof direct === 'string' && direct.trim())
            return direct.trim();
        const phone = bag.callerPhoneNumber;
        if (typeof phone === 'string' && phone.trim())
            return phone.trim();
        const caller = bag.caller;
        if (caller && typeof caller === 'object' && !Array.isArray(caller)) {
            const id = caller.id;
            if (typeof id === 'string' && id.trim())
                return id.trim();
        }
        const vars = bag.variables;
        if (vars && typeof vars === 'object' && !Array.isArray(vars)) {
            const vid = vars.callerId;
            if (typeof vid === 'string' && vid.trim())
                return vid.trim();
        }
    }
    return null;
}
let ConversationRepository = class ConversationRepository {
    conversations;
    events;
    constructor(conversations, events) {
        this.conversations = conversations;
        this.events = events;
    }
    createActive(input) {
        const meta = input.metadata ?? {};
        const callerId = (typeof input.callerId === 'string' && input.callerId.trim()
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
    findByProviderCallId(providerCallId, projectId) {
        if (projectId) {
            return this.conversations.findOne({
                where: { providerCallId, projectId },
            });
        }
        return this.conversations.findOne({ where: { providerCallId } });
    }
    findById(conversationId) {
        return this.conversations.findOne({ where: { id: conversationId } });
    }
    /** ACTIVE rows that have a checkpoint (eligible for crash restore). */
    listActiveWithState() {
        return this.conversations
            .createQueryBuilder('c')
            .where('c.status = :status', { status: 'ACTIVE' })
            .andWhere('c.runtime_state IS NOT NULL')
            .orderBy('c.created_at', 'ASC')
            .getMany();
    }
    listActive() {
        return this.conversations.find({
            where: { status: 'ACTIVE' },
            order: { createdAt: 'ASC' },
        });
    }
    /** Recent conversations for operator debug UIs (newest first). */
    async listRecent(input) {
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
    listEndedWithFinalState(input) {
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
    async findResumableForCaller(input) {
        const callerId = input.callerId.trim();
        if (!callerId)
            return null;
        const since = new Date(Date.now() - input.withinMs);
        const qb = this.conversations
            .createQueryBuilder('c')
            .where('c.caller_id = :callerId', { callerId })
            .andWhere(`(
          (c.status = 'ENDED' AND c.final_state IS NOT NULL AND COALESCE(c.last_activity_at, c.ended_at, c.created_at) >= :since)
          OR
          (c.status = 'ACTIVE' AND c.runtime_state IS NOT NULL AND COALESCE(c.last_activity_at, c.created_at) >= :since)
        )`, { since })
            .orderBy(`COALESCE(c.last_activity_at, c.ended_at, c.created_at)`, 'DESC')
            .take(8);
        if (input.excludeConversationId) {
            qb.andWhere('c.id != :excludeId', {
                excludeId: input.excludeConversationId,
            });
        }
        const rows = await qb.getMany();
        for (const row of rows) {
            const state = row.status === 'ENDED'
                ? row.finalState
                : (row.runtimeState ?? row.finalState);
            if (!state || typeof state !== 'object')
                continue;
            const activityAt = row.lastActivityAt ?? row.endedAt ?? row.createdAt;
            if (activityAt.getTime() < since.getTime())
                continue;
            return {
                conversationId: row.id,
                providerCallId: row.providerCallId,
                status: row.status,
                state: state,
                activityAt,
            };
        }
        return null;
    }
    async saveRuntimeCheckpoint(input) {
        const patch = {
            runtimeState: input.runtimeState,
            lastActivityAt: new Date(),
        };
        if (typeof input.runtimeState.runtimeInstanceId === 'string') {
            patch.runtimeInstanceId = input.runtimeState.runtimeInstanceId;
        }
        const callerId = (typeof input.callerId === 'string' && input.callerId.trim()
            ? input.callerId.trim()
            : null) ??
            extractCallerIdFromBags(input.runtimeState.variables, input.runtimeState.metadata);
        if (callerId) {
            patch.callerId = callerId;
        }
        await this.conversations.update({ id: input.conversationId, status: 'ACTIVE' }, patch);
    }
    async markEnded(input) {
        const row = await this.conversations.findOneByOrFail({
            id: input.conversationId,
        });
        row.status = 'ENDED';
        row.endedAt = new Date();
        row.lastActivityAt = row.endedAt;
        row.finalState = input.finalState;
        row.runtimeState = input.finalState;
        const callerId = (typeof input.callerId === 'string' && input.callerId.trim()
            ? input.callerId.trim()
            : null) ??
            extractCallerIdFromBags(input.finalState.variables, input.finalState.metadata, row.metadata);
        if (callerId) {
            row.callerId = callerId;
        }
        await this.conversations.save(row);
    }
    async appendEvent(input) {
        const row = this.events.create({
            conversationId: input.conversationId,
            type: input.type,
            payload: input.payload ?? {},
        });
        await this.events.save(row);
    }
    listEvents(conversationId) {
        return this.events.find({
            where: { conversationId },
            order: { createdAt: 'ASC', id: 'ASC' },
        });
    }
    async countConversationsByProject(input) {
        const whereBase = { projectId: input.projectId };
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
    /**
     * Distinct conversations per event type for a project (top tags / funnel).
     */
    async countConversationsByEventType(input) {
        const limit = Math.min(Math.max(input.limit ?? 40, 1), 200);
        const qb = this.events
            .createQueryBuilder('e')
            .innerJoin(conversation_entity_1.ConversationEntity, 'c', 'c.id = e.conversation_id')
            .select('e.type', 'type')
            .addSelect('COUNT(DISTINCT e.conversation_id)', 'conversations')
            .addSelect('COUNT(*)', 'events')
            .where('c.project_id = :projectId', { projectId: input.projectId })
            .groupBy('e.type')
            .orderBy('conversations', 'DESC')
            .addOrderBy('events', 'DESC')
            .limit(limit);
        if (input.since) {
            qb.andWhere('e.created_at >= :since', { since: input.since });
        }
        if (input.types?.length) {
            qb.andWhere('e.type IN (:...types)', { types: input.types });
        }
        const rows = await qb.getRawMany();
        return rows.map((r) => ({
            type: r.type,
            conversations: Number(r.conversations) || 0,
            events: Number(r.events) || 0,
        }));
    }
    /**
     * Distinct conversations that hit ANALYTICS_TAG with a given payload.tag.
     */
    async countConversationsByAnalyticsTag(input) {
        const limit = Math.min(Math.max(input.limit ?? 40, 1), 200);
        const qb = this.events
            .createQueryBuilder('e')
            .innerJoin(conversation_entity_1.ConversationEntity, 'c', 'c.id = e.conversation_id')
            .select(`e.payload->>'tag'`, 'tag')
            .addSelect('COUNT(DISTINCT e.conversation_id)', 'conversations')
            .addSelect('COUNT(*)', 'events')
            .where('c.project_id = :projectId', { projectId: input.projectId })
            .andWhere('e.type = :type', { type: 'ANALYTICS_TAG' })
            .andWhere(`e.payload->>'tag' IS NOT NULL`)
            .andWhere(`e.payload->>'tag' <> ''`)
            .groupBy(`e.payload->>'tag'`)
            .orderBy('conversations', 'DESC')
            .addOrderBy('events', 'DESC')
            .limit(limit);
        if (input.since) {
            qb.andWhere('e.created_at >= :since', { since: input.since });
        }
        const rows = await qb.getRawMany();
        return rows.map((r) => ({
            tag: r.tag,
            conversations: Number(r.conversations) || 0,
            events: Number(r.events) || 0,
        }));
    }
    /**
     * Distinct conversations matching a funnel step.
     * - Default: any of `eventTypes` OR any of `tags` (OR).
     * - Outcome steps: `requireAllTags` (AND) with optional `excludeTags`.
     * - Legacy: when `funnelId` is set with `tags`, also filter payload.funnels.
     */
    async countConversationsMatchingStep(input) {
        const requireAll = input.requireAllTags?.filter(Boolean) ?? [];
        if (requireAll.length) {
            return this.countConversationsMatchingTagRules({
                projectId: input.projectId,
                since: input.since,
                requireTags: requireAll,
                excludeTags: input.excludeTags,
            });
        }
        const types = input.eventTypes?.filter(Boolean) ?? [];
        const tags = input.tags?.filter(Boolean) ?? [];
        if (!types.length && !tags.length)
            return 0;
        const qb = this.events
            .createQueryBuilder('e')
            .innerJoin(conversation_entity_1.ConversationEntity, 'c', 'c.id = e.conversation_id')
            .select('COUNT(DISTINCT e.conversation_id)', 'conversations')
            .where('c.project_id = :projectId', { projectId: input.projectId });
        if (input.since) {
            qb.andWhere('e.created_at >= :since', { since: input.since });
        }
        const parts = [];
        if (types.length) {
            parts.push('e.type IN (:...types)');
            qb.setParameter('types', types);
        }
        if (tags.length) {
            const funnelId = input.funnelId?.trim();
            if (funnelId) {
                // funnels: string[]  OR  legacy singular funnel (incl. old catch-all "main")
                parts.push(`(e.type = :analyticsType AND e.payload->>'tag' IN (:...tags) AND (` +
                    `e.payload->>'funnel' = :funnelId OR ` +
                    `e.payload->>'funnel' = 'main' OR ` +
                    `(jsonb_typeof(e.payload->'funnels') = 'array' AND e.payload->'funnels' ? :funnelId)` +
                    `))`);
                qb.setParameter('funnelId', funnelId);
            }
            else {
                parts.push(`(e.type = :analyticsType AND e.payload->>'tag' IN (:...tags))`);
            }
            qb.setParameter('analyticsType', 'ANALYTICS_TAG');
            qb.setParameter('tags', tags);
        }
        qb.andWhere(`(${parts.join(' OR ')})`);
        const raw = await qb.getRawOne();
        return Number(raw?.conversations) || 0;
    }
    /**
     * Conversations that have every `requireTags` ANALYTICS_TAG and none of
     * `excludeTags` (within the optional since window on matching events).
     */
    async countConversationsMatchingTagRules(input) {
        const requireTags = input.requireTags.map(String).filter(Boolean);
        const excludeTags = (input.excludeTags ?? []).map(String).filter(Boolean);
        if (!requireTags.length)
            return 0;
        const qb = this.conversations
            .createQueryBuilder('c')
            .select('COUNT(DISTINCT c.id)', 'conversations')
            .where('c.project_id = :projectId', { projectId: input.projectId });
        for (let i = 0; i < requireTags.length; i += 1) {
            const tagParam = `reqTag${i}`;
            const sinceParam = `reqSince${i}`;
            const sinceClause = input.since
                ? ` AND e${i}.created_at >= :${sinceParam}`
                : '';
            qb.andWhere(`EXISTS (
          SELECT 1 FROM conversation_events e${i}
          WHERE e${i}.conversation_id = c.id
            AND e${i}.type = 'ANALYTICS_TAG'
            AND e${i}.payload->>'tag' = :${tagParam}${sinceClause}
        )`);
            qb.setParameter(tagParam, requireTags[i]);
            if (input.since)
                qb.setParameter(sinceParam, input.since);
        }
        for (let i = 0; i < excludeTags.length; i += 1) {
            const tagParam = `exTag${i}`;
            const sinceParam = `exSince${i}`;
            const sinceClause = input.since
                ? ` AND x${i}.created_at >= :${sinceParam}`
                : '';
            qb.andWhere(`NOT EXISTS (
          SELECT 1 FROM conversation_events x${i}
          WHERE x${i}.conversation_id = c.id
            AND x${i}.type = 'ANALYTICS_TAG'
            AND x${i}.payload->>'tag' = :${tagParam}${sinceClause}
        )`);
            qb.setParameter(tagParam, excludeTags[i]);
            if (input.since)
                qb.setParameter(sinceParam, input.since);
        }
        const raw = await qb.getRawOne();
        return Number(raw?.conversations) || 0;
    }
    /** Top conversation path signatures (CONVERSATION_PATH events). */
    async countTopConversationPaths(input) {
        const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
        const qb = this.events
            .createQueryBuilder('e')
            .innerJoin(conversation_entity_1.ConversationEntity, 'c', 'c.id = e.conversation_id')
            .select(`e.payload->>'signature'`, 'signature')
            .addSelect(`MAX(e.payload->>'branchLabel')`, 'branchLabel')
            .addSelect(`(array_agg(e.payload->'nodes' ORDER BY e.created_at DESC))[1]`, 'nodes')
            .addSelect('COUNT(DISTINCT e.conversation_id)', 'conversations')
            .where('c.project_id = :projectId', { projectId: input.projectId })
            .andWhere('e.type = :type', { type: 'CONVERSATION_PATH' })
            .andWhere(`e.payload->>'signature' IS NOT NULL`)
            .andWhere(`e.payload->>'signature' <> ''`)
            .groupBy(`e.payload->>'signature'`)
            .orderBy('conversations', 'DESC')
            .limit(limit);
        if (input.since) {
            qb.andWhere('e.created_at >= :since', { since: input.since });
        }
        const rows = await qb.getRawMany();
        return rows.map((r) => {
            let nodes = [];
            if (Array.isArray(r.nodes)) {
                nodes = r.nodes.map(String);
            }
            else if (typeof r.nodes === 'string') {
                try {
                    const parsed = JSON.parse(r.nodes);
                    if (Array.isArray(parsed))
                        nodes = parsed.map(String);
                }
                catch {
                    nodes = [];
                }
            }
            return {
                signature: r.signature,
                branchLabel: r.branchLabel || 'Other path',
                nodes,
                conversations: Number(r.conversations) || 0,
            };
        });
    }
    /** Distinct conversations per CALL_OUTCOME payload.outcome. */
    async countConversationsByCallOutcome(input) {
        const qb = this.events
            .createQueryBuilder('e')
            .innerJoin(conversation_entity_1.ConversationEntity, 'c', 'c.id = e.conversation_id')
            .select(`e.payload->>'outcome'`, 'outcome')
            .addSelect('COUNT(DISTINCT e.conversation_id)', 'conversations')
            .addSelect('COUNT(*)', 'events')
            .where('c.project_id = :projectId', { projectId: input.projectId })
            .andWhere('e.type = :type', { type: 'CALL_OUTCOME' })
            .andWhere(`e.payload->>'outcome' IN ('success','failure','unknown')`)
            .groupBy(`e.payload->>'outcome'`)
            .orderBy('conversations', 'DESC');
        if (input.since) {
            qb.andWhere('e.created_at >= :since', { since: input.since });
        }
        const rows = await qb.getRawMany();
        return rows.map((r) => ({
            outcome: r.outcome,
            conversations: Number(r.conversations) || 0,
            events: Number(r.events) || 0,
        }));
    }
    /**
     * Duration percentiles (seconds) for ENDED conversations:
     * `ended_at - created_at`. Returns null percentiles when sample is empty.
     */
    async callDurationPercentiles(input) {
        const pcts = (input.percentiles?.length ? input.percentiles : [0.8, 0.9])
            .map((p) => Math.min(1, Math.max(0, Number(p))))
            .filter((p) => Number.isFinite(p));
        const unique = [...new Set(pcts)];
        if (!unique.length) {
            return { sampleSize: 0, valuesSec: {} };
        }
        const params = [input.projectId];
        let sinceSql = '';
        if (input.since) {
            params.push(input.since);
            sinceSql = ` AND c.created_at >= $${params.length}`;
        }
        const pctSelects = unique
            .map((p, i) => `percentile_cont(${p}) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (c.ended_at - c.created_at))) AS p${i}`)
            .join(', ');
        const rows = (await this.conversations.query(`
      SELECT COUNT(*)::int AS sample_size, ${pctSelects}
      FROM conversations c
      WHERE c.project_id = $1
        AND c.status = 'ENDED'
        AND c.ended_at IS NOT NULL
        ${sinceSql}
      `, params));
        const raw = rows[0] ?? {};
        const sampleSize = Number(raw.sample_size) || 0;
        const valuesSec = {};
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
    /**
     * Distinct conversations matching any of the event matchers (OR).
     * Optional `payloadEquals` ANDs `payload->>key = value` for that matcher.
     */
    async countConversationsMatchingEventMatchers(input) {
        const matchers = input.matchers.filter((m) => m.type?.trim());
        if (!matchers.length)
            return 0;
        const qb = this.events
            .createQueryBuilder('e')
            .innerJoin(conversation_entity_1.ConversationEntity, 'c', 'c.id = e.conversation_id')
            .select('COUNT(DISTINCT e.conversation_id)', 'conversations')
            .where('c.project_id = :projectId', { projectId: input.projectId });
        if (input.since) {
            qb.andWhere('e.created_at >= :since', { since: input.since });
        }
        const parts = [];
        matchers.forEach((m, i) => {
            const typeParam = `mType${i}`;
            const clauses = [`e.type = :${typeParam}`];
            qb.setParameter(typeParam, m.type.trim());
            const eqs = m.payloadEquals ?? {};
            Object.entries(eqs).forEach(([key, value], j) => {
                const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
                if (!safeKey)
                    return;
                const vParam = `mVal${i}_${j}`;
                clauses.push(`e.payload->>'${safeKey}' = :${vParam}`);
                qb.setParameter(vParam, value);
            });
            parts.push(`(${clauses.join(' AND ')})`);
        });
        qb.andWhere(`(${parts.join(' OR ')})`);
        const raw = await qb.getRawOne();
        return Number(raw?.conversations) || 0;
    }
    /**
     * Copy all events from one conversation onto another.
     * Preserves original type; stamps clone provenance into payload.
     */
    async cloneEvents(input) {
        const source = await this.listEvents(input.fromConversationId);
        if (source.length === 0)
            return 0;
        const rows = source.map((ev) => this.events.create({
            conversationId: input.toConversationId,
            type: ev.type,
            payload: {
                ...(ev.payload ?? {}),
                clonedFromConversationId: input.fromConversationId,
                clonedFromEventId: ev.id,
                originalCreatedAt: ev.createdAt.toISOString(),
            },
        }));
        await this.events.save(rows);
        return rows.length;
    }
};
exports.ConversationRepository = ConversationRepository;
exports.ConversationRepository = ConversationRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(conversation_entity_1.ConversationEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(conversation_event_entity_1.ConversationEventEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ConversationRepository);
//# sourceMappingURL=conversation.repository.js.map