import { Injectable } from '@nestjs/common';
import type { StudioEvent, StudioEventListener } from '@guidify-ai/vapi-studio';

/** Shared store so AppModule + Studio eventListeners see the same buffer. */
const store = {
  byConversation: new Map<string, StudioEvent[]>(),
  maxPerConversation: 500,
};

/** In-memory analytics ring buffer for the studio UI (per conversation). */
@Injectable()
export class StudioEventBuffer implements StudioEventListener {
  handle(event: StudioEvent): void {
    const id = event.conversationId;
    if (!id) return;
    const list = store.byConversation.get(id) ?? [];
    list.push(event);
    while (list.length > store.maxPerConversation) {
      list.shift();
    }
    store.byConversation.set(id, list);
  }

  list(conversationId: string): StudioEvent[] {
    return [...(store.byConversation.get(conversationId) ?? [])];
  }

  pushSynthetic(
    conversationId: string,
    type: string,
    payload: Record<string, unknown>,
  ): StudioEvent {
    const event: StudioEvent = {
      id: `studio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      ts: new Date().toISOString(),
      level: 'info',
      conversationId,
      payload,
    };
    this.handle(event);
    return event;
  }

  clear(conversationId: string): void {
    store.byConversation.delete(conversationId);
  }
}
