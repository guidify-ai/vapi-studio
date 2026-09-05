import { SupervisedConversation } from './supervised-conversation';
export declare class SupervisedConversationRegistry {
    private readonly byProviderCallId;
    private readonly byConversationId;
    set(runtime: SupervisedConversation): void;
    getByProviderCallId(providerCallId: string): SupervisedConversation | undefined;
    getByConversationId(conversationId: string): SupervisedConversation | undefined;
    delete(providerCallId: string): void;
    has(providerCallId: string): boolean;
    size(): number;
    /** All live runtimes (crash restore / disaster status). */
    list(): SupervisedConversation[];
}
//# sourceMappingURL=supervised-conversation.registry.d.ts.map