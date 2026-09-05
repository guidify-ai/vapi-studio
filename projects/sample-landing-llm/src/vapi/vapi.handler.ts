import { Injectable } from '@nestjs/common';
import {
  EventService,
  ProviderIngressRepository,
  extractVapiCallerNumber,
  rememberCallerPhone,
} from '@guidify-ai/vapi-studio';
import { projectVapiBasePath } from '../project/project.config';
import { VapiStrategyTriager } from './vapi.triager';
import type { VapiWebhookCommand, VapiWebhookResponse } from './vapi.types';

@Injectable()
export class VapiWebhookHandler {
  constructor(
    private readonly triager: VapiStrategyTriager,
    private readonly events: EventService,
    private readonly ingress: ProviderIngressRepository,
  ) {}

  async handle(
    raw: Record<string, unknown>,
    projectId: string,
  ): Promise<VapiWebhookResponse> {
    const message = (raw.message ?? raw) as Record<string, unknown>;
    const call = message.call as { id?: string } | undefined;
    const callId = call?.id;
    const webhookPath = `${projectVapiBasePath(projectId)}/webhook`;
    if (!callId) {
      await this.ingress.record({
        projectId,
        kind: 'webhook',
        path: webhookPath,
        messageType: String(message.type ?? 'unknown'),
        body: raw,
        responseStatus: 400,
        responseBody: { error: 'missing_message_call_id' },
      });
      throw new Error('message.call.id required');
    }

    const command: VapiWebhookCommand = {
      type: String(message.type ?? 'unknown'),
      callId,
      projectId,
      raw: message,
      status: typeof message.status === 'string' ? message.status : undefined,
      callerPhoneNumber: extractVapiCallerNumber(raw),
    };
    if (command.callerPhoneNumber) {
      rememberCallerPhone(callId, command.callerPhoneNumber);
    }

    const ingressRow = await this.ingress.record({
      projectId,
      kind: 'webhook',
      path: webhookPath,
      providerCallId: callId,
      messageType: command.type,
      body: raw,
    });

    this.events.log('info', 'WEBHOOK_RECEIVED', {
      messageType: command.type,
      callId: command.callId,
      projectId,
      status: command.status,
      callerPhoneNumber: command.callerPhoneNumber,
      ingressId: ingressRow.id,
    });

    try {
      const response = await this.triager.triage(command);
      await this.ingress.setResponse(
        ingressRow.id,
        response.statusCode ?? 200,
        response.body ?? { ok: true },
      );
      return response;
    } catch (error) {
      await this.ingress.setResponse(ingressRow.id, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
