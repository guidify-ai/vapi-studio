import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  BRAIN_SERVICE,
  type BrainService,
} from '../brain/brain.service';
import {
  STUDIO_BRAIN_CONFIG,
  type StudioBrainConfig,
} from '../brain/brain-config';
import {
  STUDIO_CONVERSATION_LIMITS,
  type ResolvedConversationLimits,
} from '../conversation/conversation-limits';
import { ConversationBootstrapService } from '../conversation/conversation-bootstrap.service';
import type { SupervisedConversation } from '../conversation/supervised-conversation';
import { EventService } from '../events/event.service';
import { FormsService } from '../forms/forms.service';
import { FlowLoader } from '../flow/flow-loader';
import { IntegrationClient } from '../integrations/integration-client';
import {
  STUDIO_INTENTION_REGISTRY,
  type CodeIntentionRegistry,
} from '../intention/code-intention';
import {
  STUDIO_NODE_REGISTRY,
  type AgentNodeRegistry,
} from '../node/agent-node';
import type { ChannelToolResult } from '../channel/channel-tools';
import {
  createSupervisorEngine,
  type SupervisorEngine,
} from './supervisor-engine';
import type { TurnExecutionResult } from './supervisor.types';

export type { TurnExecutionResult } from './supervisor.types';

/**
 * Nest facade for turn orchestration.
 *
 * Implementation is split across focused modules assembled by
 * `createSupervisorEngine`:
 * - `supervisor-orchestration` — handleTurn / executeTurn
 * - `supervisor-limits` — max turns / duration fail-closed endCall
 * - `supervisor-special-turns` — opening / module entry / tool-result
 * - `supervisor-cascade` — force / match / Brain candidates
 * - `supervisor-route` — walk candidates → node
 * - `supervisor-portal` — continue / unknown-origin consume
 * - `supervisor-node-exec` — listen/run/catch + portal enter/exit
 */
@Injectable()
export class Supervisor {
  private readonly engine: SupervisorEngine;

  public constructor(
    @Inject(BRAIN_SERVICE) brain: BrainService,
    flowLoader: FlowLoader,
    @Inject(STUDIO_NODE_REGISTRY) nodes: AgentNodeRegistry,
    events: EventService,
    bootstrap: ConversationBootstrapService,
    @Optional() integrations?: IntegrationClient,
    @Optional() forms?: FormsService,
    @Optional()
    @Inject(STUDIO_BRAIN_CONFIG)
    brainConfig?: StudioBrainConfig,
    @Optional()
    @Inject(STUDIO_INTENTION_REGISTRY)
    intentions?: CodeIntentionRegistry,
    @Optional()
    @Inject(STUDIO_CONVERSATION_LIMITS)
    conversationLimits?: ResolvedConversationLimits,
  ) {
    this.engine = createSupervisorEngine({
      brain,
      flowLoader,
      nodes,
      events,
      bootstrap,
      integrations,
      forms,
      brainConfig,
      intentions,
      conversationLimits,
    });
  }

  public async handleTurn(input: {
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
    return this.engine.handleTurn(input);
  }
}
