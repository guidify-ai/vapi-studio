import type { Variables } from './conversation-entry';

/**
 * Full Conversation type schema — apps define this once; Nodes inherit it via generics.
 *
 * @example
 * interface RoofrConversationSchema {
 *   variables: { companyName: string };
 *   memory: { conversationReady?: boolean; setupAt?: string };
 * }
 * class AcknowledgeNode extends Ra9Node<RoofrConversationSchema> { ... }
 */
export interface ConversationSchema {
  variables: object;
  memory: object;
}

export type SchemaVariables<T extends ConversationSchema> = Variables<T['variables']>;
export type SchemaMemory<T extends ConversationSchema> = T['memory'];

/** Default empty schema when an app has not declared one yet. */
export interface DefaultConversationSchema {
  variables: Record<string, never>;
  memory: Record<string, unknown>;
}
