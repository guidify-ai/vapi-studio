import { ConversationRepository } from '../persistence/conversation.repository';
import type { StudioEvent, StudioEventListener } from './studio-event';
/**
 * Default event listener — durable conversation_events rows in Postgres.
 * Skips events with no conversationId (nothing to hang the row on).
 */
export declare class PostgresEventListener implements StudioEventListener {
    private readonly conversations;
    constructor(conversations: ConversationRepository);
    handle(event: StudioEvent): Promise<void>;
}
//# sourceMappingURL=postgres-event.listener.d.ts.map