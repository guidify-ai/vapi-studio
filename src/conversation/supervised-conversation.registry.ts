import { Injectable } from '@nestjs/common';
import { SupervisedConversation } from './supervised-conversation';

@Injectable()
export class SupervisedConversationRegistry {
  private readonly byProviderCallId = new Map<string, SupervisedConversation>();
  private readonly byConversationId = new Map<string, SupervisedConversation>();

  set(runtime: SupervisedConversation): void {
    this.byProviderCallId.set(runtime.providerCallId, runtime);
    this.byConversationId.set(runtime.conversationId, runtime);
  }

  getByProviderCallId(providerCallId: string): SupervisedConversation | undefined {
    return this.byProviderCallId.get(providerCallId);
  }

  getByConversationId(conversationId: string): SupervisedConversation | undefined {
    return this.byConversationId.get(conversationId);
  }

  delete(providerCallId: string): void {
    const runtime = this.byProviderCallId.get(providerCallId);
    if (!runtime) {
      return;
    }
    this.byProviderCallId.delete(providerCallId);
    this.byConversationId.delete(runtime.conversationId);
  }

  has(providerCallId: string): boolean {
    return this.byProviderCallId.has(providerCallId);
  }

  size(): number {
    return this.byProviderCallId.size;
  }

  /** All live runtimes (crash restore / disaster status). */
  list(): SupervisedConversation[] {
    return [...this.byProviderCallId.values()];
  }
}
