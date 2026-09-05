import { Injectable } from '@nestjs/common';

/**
 * Mid-turn assistant lines for Studio poll (so speech appears before a blocking
 * form CTA, not only when the HTTP turn finally returns).
 */
@Injectable()
export class StudioLiveSpeechBuffer {
  private readonly byConversation = new Map<string, string[]>();

  push(conversationId: string, text: string): void {
    const line = text.trim();
    if (!conversationId || !line) return;
    const list = this.byConversation.get(conversationId) ?? [];
    list.push(line);
    this.byConversation.set(conversationId, list);
  }

  /** Drain pending lines (UI appends them in order). */
  drain(conversationId: string): string[] {
    const list = this.byConversation.get(conversationId) ?? [];
    this.byConversation.delete(conversationId);
    return list;
  }

  clear(conversationId: string): void {
    this.byConversation.delete(conversationId);
  }
}
