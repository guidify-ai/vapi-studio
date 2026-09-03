import { Injectable } from '@nestjs/common';
import { SupervisedConversation } from './supervised-conversation';

@Injectable()
export class SupervisedConversationRegistry {
  private readonly byProviderCallId: Map<string, SupervisedConversation> = new Map<string, SupervisedConversation>();
  private readonly byConversationId: Map<string, SupervisedConversation> = new Map<string, SupervisedConversation>();

  public set(runtime: SupervisedConversation): void {
    this.byProviderCallId.set(runtime.providerCallId, runtime);
    this.byConversationId.set(runtime.conversationId, runtime);
  }

  public getByProviderCallId(providerCallId: string): SupervisedConversation | undefined {
    return this.byProviderCallId.get(providerCallId);
  }

  public getByConversationId(conversationId: string): SupervisedConversation | undefined {
    return this.byConversationId.get(conversationId);
  }

  public delete(providerCallId: string): void {
    const runtime = this.byProviderCallId.get(providerCallId);
    if (!runtime) {
      return;
    }
    this.byProviderCallId.delete(providerCallId);
    this.byConversationId.delete(runtime.conversationId);
  }

  public has(providerCallId: string): boolean {
    return this.byProviderCallId.has(providerCallId);
  }

  public size(): number {
    return this.byProviderCallId.size;
  }

  /** All live runtimes (crash restore / disaster status). */
  public list(): SupervisedConversation[] {
    return [...this.byProviderCallId.values()];
  }
}
