import { Injectable } from '@nestjs/common';
import type { VapiStrategy, VapiWebhookCommand, VapiWebhookResponse } from './vapi.types';
import { AssistantRequestStrategy } from './strategies/assistant-request.strategy';
import { CallStartedStrategy } from './strategies/call-started.strategy';
import { StatusUpdateStrategy } from './strategies/status-update.strategy';
import { UserInterruptedStrategy } from './strategies/user-interrupted.strategy';
import { ToolCallsStrategy } from './strategies/tool-calls.strategy';

@Injectable()
export class VapiStrategyTriager {
  private readonly strategies: VapiStrategy[];

  constructor(
    assistantRequest: AssistantRequestStrategy,
    callStarted: CallStartedStrategy,
    statusUpdate: StatusUpdateStrategy,
    userInterrupted: UserInterruptedStrategy,
    toolCalls: ToolCallsStrategy,
  ) {
    this.strategies = [
      assistantRequest,
      callStarted,
      statusUpdate,
      userInterrupted,
      toolCalls,
    ];
  }

  async triage(command: VapiWebhookCommand): Promise<VapiWebhookResponse> {
    const strategy = this.strategies.find((s) => s.supports(command.type));
    if (!strategy) {
      return { body: { ok: true, ignored: command.type } };
    }
    return strategy.handle(command);
  }
}
