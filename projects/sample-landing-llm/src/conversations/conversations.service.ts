import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ConversationEntity,
  ConversationRepository,
  SupervisedConversationRegistry,
  type ConversationHistory,
  type SupervisedConversation,
} from '@guidify-ai/vapi-studio';
import {
  conversationChannel,
  vapiDashboardCallUrl,
} from './vapi-dashboard-url';

export interface ConversationListItem {
  conversationId: string;
  providerCallId: string;
  provider: string;
  status: string;
  callerId: string | null;
  channel: 'studio' | 'vapi' | 'unknown';
  createdAt: string;
  endedAt: string | null;
  lastActivityAt: string | null;
  currentNodeId: string | null;
  chatPreview: string | null;
  vapiCallUrl: string | null;
}

export interface ConversationDetail {
  conversationId: string;
  providerCallId: string;
  provider: string;
  status: string;
  callerId: string | null;
  channel: 'studio' | 'vapi' | 'unknown';
  createdAt: string;
  endedAt: string | null;
  lastActivityAt: string | null;
  runtimeInstanceId: string | null;
  currentNodeId: string | null;
  normalFlowNodeId: string | null;
  activeModuleId: string | null;
  workflowId: string | null;
  brainProfileId: string | null;
  history: ConversationHistory;
  memory: Record<string, unknown>;
  variables: Record<string, unknown>;
  portalState: unknown;
  metadata: Record<string, unknown>;
  liveInMemory: boolean;
  vapiCallUrl: string | null;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }>;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly registry: SupervisedConversationRegistry,
  ) {}

  async list(input?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: ConversationListItem[]; total: number }> {
    const { items, total } = await this.conversations.listRecent(input);
    return {
      total,
      items: items.map((row) => this.toListItem(row)),
    };
  }

  async getDetail(conversationId: string): Promise<ConversationDetail> {
    const row = await this.conversations.findById(conversationId);
    if (!row) {
      throw new NotFoundException('Conversation not found');
    }

    const events = await this.conversations.listEvents(conversationId);
    const eventDtos = events.map((ev) => ({
      id: ev.id,
      type: ev.type,
      createdAt: ev.createdAt.toISOString(),
      payload: ev.payload ?? {},
    }));

    const live = this.registry.getByConversationId(conversationId);
    if (live && live.status !== 'ENDED') {
      return { ...this.detailFromLive(row, live), events: eventDtos };
    }

    const state = (row.finalState ?? row.runtimeState) as
      | Record<string, unknown>
      | null;
    return { ...this.detailFromSnapshot(row, state), events: eventDtos };
  }

  private toListItem(row: ConversationEntity): ConversationListItem {
    const state = (row.finalState ?? row.runtimeState) as
      | Record<string, unknown>
      | null;
    const history = this.readHistory(state);
    const lastUser = [...history.chat].reverse().find((m) => m.role === 'user');
    const meta =
      row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return {
      conversationId: row.id,
      providerCallId: row.providerCallId,
      provider: row.provider,
      status: row.status,
      callerId: row.callerId,
      channel: conversationChannel(row.providerCallId, meta),
      createdAt: row.createdAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
      currentNodeId: this.readCurrentNodeId(state),
      chatPreview: lastUser?.text ?? null,
      vapiCallUrl: vapiDashboardCallUrl(row.providerCallId),
    };
  }

  private detailFromLive(
    row: ConversationEntity,
    live: SupervisedConversation,
  ): Omit<ConversationDetail, 'events'> {
    const meta =
      live.metadata && typeof live.metadata === 'object' ? live.metadata : {};
    return {
      conversationId: row.id,
      providerCallId: live.providerCallId,
      provider: row.provider,
      status: live.status,
      callerId: row.callerId,
      channel: conversationChannel(live.providerCallId, meta),
      createdAt: row.createdAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
      runtimeInstanceId: live.runtimeInstanceId,
      currentNodeId: live.currentNodeId,
      normalFlowNodeId: live.normalFlowNodeId,
      activeModuleId:
        typeof meta.activeModuleId === 'string' ? meta.activeModuleId : null,
      workflowId:
        typeof meta.workflowId === 'string' ? meta.workflowId : null,
      brainProfileId: live.brainProfileId,
      history: live.history ?? { chat: [], nodes: [] },
      memory: { ...(live.memory as Record<string, unknown>) },
      variables: { ...(live.variables as Record<string, unknown>) },
      portalState: live.portalState,
      metadata: { ...meta },
      liveInMemory: true,
      vapiCallUrl: vapiDashboardCallUrl(live.providerCallId),
    };
  }

  private detailFromSnapshot(
    row: ConversationEntity,
    state: Record<string, unknown> | null,
  ): Omit<ConversationDetail, 'events'> {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? { ...row.metadata }
        : {};
    const stateMeta =
      state?.metadata && typeof state.metadata === 'object'
        ? (state.metadata as Record<string, unknown>)
        : {};
    const mergedMeta = { ...meta, ...stateMeta };

    return {
      conversationId: row.id,
      providerCallId: row.providerCallId,
      provider: row.provider,
      status: row.status,
      callerId: row.callerId,
      channel: conversationChannel(row.providerCallId, mergedMeta),
      createdAt: row.createdAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
      runtimeInstanceId:
        typeof state?.runtimeInstanceId === 'string'
          ? state.runtimeInstanceId
          : row.runtimeInstanceId,
      currentNodeId: this.readCurrentNodeId(state),
      normalFlowNodeId:
        typeof state?.normalFlowNodeId === 'string'
          ? state.normalFlowNodeId
          : null,
      activeModuleId:
        typeof mergedMeta.activeModuleId === 'string'
          ? mergedMeta.activeModuleId
          : null,
      workflowId:
        typeof mergedMeta.workflowId === 'string'
          ? mergedMeta.workflowId
          : null,
      brainProfileId:
        typeof state?.brainProfileId === 'string' ? state.brainProfileId : null,
      history: this.readHistory(state),
      memory:
        state?.memory && typeof state.memory === 'object'
          ? { ...(state.memory as Record<string, unknown>) }
          : {},
      variables:
        state?.variables && typeof state.variables === 'object'
          ? { ...(state.variables as Record<string, unknown>) }
          : {},
      portalState: state?.portalState ?? null,
      metadata: mergedMeta,
      liveInMemory: false,
      vapiCallUrl: vapiDashboardCallUrl(row.providerCallId),
    };
  }

  private readHistory(
    state: Record<string, unknown> | null,
  ): ConversationHistory {
    const raw = state?.history;
    if (!raw || typeof raw !== 'object') {
      return { chat: [], nodes: [] };
    }
    const h = raw as ConversationHistory;
    return {
      chat: Array.isArray(h.chat) ? h.chat : [],
      nodes: Array.isArray(h.nodes) ? h.nodes : [],
    };
  }

  private readCurrentNodeId(state: Record<string, unknown> | null): string | null {
    return typeof state?.currentNodeId === 'string' ? state.currentNodeId : null;
  }
}
