import { Injectable } from '@nestjs/common';
import { ConversationRepository } from '../persistence/conversation.repository';
import type { Ra9Event, Ra9EventListener } from './ra9-event';

/**
 * Default event listener — durable conversation_events rows in Postgres.
 * Skips events with no conversationId (nothing to hang the row on).
 */
@Injectable()
export class PostgresEventListener implements Ra9EventListener {
  public constructor(private readonly conversations: ConversationRepository) {}

  public async handle(event: Ra9Event): Promise<void> {
    if (!event.conversationId) {
      return;
    }
    await this.conversations.appendEvent({
      conversationId: event.conversationId,
      type: String(event.type).slice(0, 64),
      payload: {
        id: event.id,
        ts: event.ts,
        level: event.level,
        runtimeInstanceId: event.runtimeInstanceId,
        providerCallId: event.providerCallId,
        ...event.payload,
      },
    });
  }
}
