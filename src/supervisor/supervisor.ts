import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  BRAIN_SERVICE,
  type BrainService,
} from '../brain/brain.service';
import {
  RA9_BRAIN_CONFIG,
  type Ra9BrainConfig,
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
  RA9_INTENTION_REGISTRY,
  type Ra9IntentionRegistry,
} from '../intention/ra9-intention';
import {
  RA9_NODE_REGISTRY,
  type Ra9NodeRegistry,
} from '../node/ra9-node';
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
    @Inject(RA9_NODE_REGISTRY) nodes: Ra9NodeRegistry,
    events: EventService,
    bootstrap: ConversationBootstrapService,
    @Optional() integrations?: IntegrationClient,
    @Optional() forms?: FormsService,
    @Optional()
    @Inject(RA9_BRAIN_CONFIG)
    brainConfig?: Ra9BrainConfig,
    @Optional()
    @Inject(RA9_INTENTION_REGISTRY)
    intentions?: Ra9IntentionRegistry,
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
