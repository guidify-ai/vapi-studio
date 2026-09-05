import { Injectable } from '@nestjs/common';
import {
  ConversationBootstrapService,
  EventService,
  WorkflowHandoffService,
} from '@guidify-ai/vapi-studio';
import {
  phoneCaller,
  withCallerMetadata,
} from '../../caller/caller-identity';
import type {
  VapiStrategy,
  VapiMessageType,
  VapiWebhookCommand,
  VapiWebhookResponse,
} from '../vapi.types';

@Injectable()
export class StatusUpdateStrategy implements VapiStrategy {
  constructor(
    private readonly bootstrap: ConversationBootstrapService,
    private readonly events: EventService,
    private readonly handoffs: WorkflowHandoffService,
  ) {}

  supports(type: VapiMessageType): boolean {
    return type === 'status-update';
  }

  async handle(command: VapiWebhookCommand): Promise<VapiWebhookResponse> {
    this.events.log('info', 'STATUS_UPDATE', {
      providerCallId: command.callId,
      status: command.status,
    });

    if (command.status === 'in-progress' || command.status === 'ringing') {
      const brainProfileId = process.env.POC_BRAIN_PROFILE || 'planner';
      const base = {
        messageType: command.type,
        status: command.status,
        brainProfileId,
        projectId: command.projectId,
      };
      const runtime = await this.bootstrap.bootstrap({
        projectId: command.projectId,
        providerCallId: command.callId,
        brainProfileId,
        metadata: command.callerPhoneNumber
          ? withCallerMetadata(base, phoneCaller(command.callerPhoneNumber))
          : base,
      });
      this.handoffs.activateEntryModule(runtime);
    }

    if (command.status === 'ended') {
      await this.bootstrap.finalizeEnded(command.callId);
    }

    return { body: { ok: true } };
  }
}
