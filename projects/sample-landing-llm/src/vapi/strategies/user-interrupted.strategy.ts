import { Injectable } from '@nestjs/common';
import {
  EventService,
  SupervisedConversationRegistry,
} from '@guidify-ai/vapi-studio';
import type {
  VapiStrategy,
  VapiMessageType,
  VapiWebhookCommand,
  VapiWebhookResponse,
} from '../vapi.types';

@Injectable()
export class UserInterruptedStrategy implements VapiStrategy {
  constructor(
    private readonly registry: SupervisedConversationRegistry,
    private readonly events: EventService,
  ) {}

  supports(type: VapiMessageType): boolean {
    return type === 'user-interrupted';
  }

  async handle(command: VapiWebhookCommand): Promise<VapiWebhookResponse> {
    const runtime = this.registry.getByProviderCallId(command.callId);
    if (runtime) {
      runtime.turn.interrupted = true;
      runtime.turn.lastInterruptAt = new Date().toISOString();
    }
    this.events.log('info', 'USER_INTERRUPTED', {
      providerCallId: command.callId,
      runtimeInstanceId: runtime?.runtimeInstanceId,
      conversationId: runtime?.conversationId,
      rawKeys: Object.keys(command.raw),
    });
    return { body: { ok: true } };
  }
}
