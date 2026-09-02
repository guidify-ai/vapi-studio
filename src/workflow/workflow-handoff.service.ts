import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { FlowLoader } from '../flow/flow-loader';
import { EventService } from '../events/event.service';
import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { OutputAction } from '../output/conversation-output';
import { WorkflowLoader } from './workflow-loader';
import { ConversationBootstrapService } from '../conversation/conversation-bootstrap.service';

/**
 * Applies workflow module handoffs and same-flow `continueTo` jumps on a
 * shared Conversation runtime. Does not end the Conversation.
 */
@Injectable()
export class WorkflowHandoffService {
  constructor(
    private readonly workflows: WorkflowLoader,
    private readonly flows: FlowLoader,
    private readonly events: EventService,
    private readonly bootstrap: ConversationBootstrapService,
  ) {}

  configDir(): string {
    return process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
  }

  /**
   * Enrich handoff actions with Vapi assistantName; apply in-memory module
   * switches and same-flow continueTo jumps. Returns the (possibly enriched) actions.
   */
  async applyHandoffs(
    runtime: SupervisedConversation,
    actions: OutputAction[],
  ): Promise<OutputAction[]> {
    const out: OutputAction[] = [];
    for (const action of actions) {
      if (action.kind === 'continueTo' && action.continueToNodeId) {
        out.push(action);
        await this.applyContinueTo(runtime, action);
        continue;
      }

      if (action.kind !== 'handoff' || !action.handoffTo) {
        out.push(action);
        continue;
      }

      if (!this.workflows.hasWorkflow()) {
        // Handoff requested but no Squad workflow loaded — treat as no-op warn.
        this.events.log('warn', 'HANDOFF_WITHOUT_WORKFLOW', {
          conversationId: runtime.conversationId,
          handoffTo: action.handoffTo,
          note: 'output.handoff requires a loaded workflow.yaml; use continueTo for single-assistant jumps.',
        });
        out.push(action);
        continue;
      }

      const mod = this.workflows.getModule(action.handoffTo);
      const enriched: OutputAction = {
        ...action,
        assistantName: mod.assistantName,
      };
      out.push(enriched);

      const fromModule =
        typeof runtime.metadata.activeModuleId === 'string'
          ? runtime.metadata.activeModuleId
          : null;

      runtime.metadata.activeModuleId = mod.id;
      runtime.metadata.workflowId = this.workflows.getWorkflow().id;
      runtime.metadata.lastHandoff = {
        from: fromModule,
        to: mod.id,
        reason: action.handoffReason ?? null,
        at: new Date().toISOString(),
      };

      if (mod.kind === 'studio' && mod.flowFile) {
        const flowPath = join(this.configDir(), mod.flowFile);
        const flow = this.flows.loadFromFile(flowPath);
        const entry = mod.entryNode ?? flow.start;
        runtime.enterNormalNode(entry);
        runtime.listenExpectation = null;
        runtime.metadata.moduleNeedsEntrySpeak = true;
      }

      await this.events.persist(runtime.conversationId, 'WORKFLOW_HANDOFF', {
        from: fromModule,
        to: mod.id,
        assistantName: mod.assistantName,
        reason: action.handoffReason ?? null,
        payload: action.handoffPayload ?? null,
        turnNumber: runtime.turn.turnNumber,
        providerCallId: runtime.providerCallId,
      });

      await this.bootstrap.checkpoint(runtime);
    }
    return out;
  }

  private async applyContinueTo(
    runtime: SupervisedConversation,
    action: OutputAction,
  ): Promise<void> {
    const nodeId = action.continueToNodeId!.trim();
    const flow = this.flows.getFlow();
    if (!flow.nodes[nodeId]) {
      throw new Error(
        `continueTo node "${nodeId}" is not in the loaded flow "${flow.id}"`,
      );
    }
    const fromNode = runtime.currentNodeId;
    runtime.enterNormalNode(nodeId);
    runtime.listenExpectation = null;
    runtime.metadata.moduleNeedsEntrySpeak = true;
    runtime.metadata.lastContinueTo = {
      from: fromNode,
      to: nodeId,
      reason: action.handoffReason ?? null,
      at: new Date().toISOString(),
    };

    await this.events.persist(runtime.conversationId, 'FLOW_CONTINUE', {
      from: fromNode,
      to: nodeId,
      reason: action.handoffReason ?? null,
      turnNumber: runtime.turn.turnNumber,
      providerCallId: runtime.providerCallId,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    await this.bootstrap.checkpoint(runtime);
  }

  /** Load entry module flow for a new Conversation. */
  activateEntryModule(runtime: SupervisedConversation): void {
    if (!this.workflows.hasWorkflow()) return;
    const wf = this.workflows.getWorkflow();
    const mod = this.workflows.getModule(wf.entryModuleId);
    runtime.metadata.workflowId = wf.id;
    runtime.metadata.activeModuleId = mod.id;
    if (mod.kind === 'studio' && mod.flowFile) {
      this.flows.loadFromFile(join(this.configDir(), mod.flowFile));
    }
  }

  /** Ensure the flow for the runtime's active module is loaded. */
  ensureActiveFlow(runtime: SupervisedConversation): void {
    if (!this.workflows.hasWorkflow()) return;
    const moduleId =
      typeof runtime.metadata.activeModuleId === 'string'
        ? runtime.metadata.activeModuleId
        : this.workflows.getWorkflow().entryModuleId;
    const mod = this.workflows.getModule(moduleId);
    if (mod.kind === 'studio' && mod.flowFile) {
      const flow = this.flows.loadFromFile(
        join(this.configDir(), mod.flowFile),
      );
      // Keep current node if it exists in this flow; else jump to entry.
      if (
        !runtime.currentNodeId ||
        !flow.nodes[runtime.currentNodeId]
      ) {
        runtime.enterNormalNode(mod.entryNode ?? flow.start);
      }
    }
  }
}
