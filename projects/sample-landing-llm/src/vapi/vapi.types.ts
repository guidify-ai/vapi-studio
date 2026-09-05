export type VapiMessageType =
  | 'assistant-request'
  | 'status-update'
  | 'user-interrupted'
  | string;

export interface VapiWebhookCommand {
  type: VapiMessageType;
  callId: string;
  /** Owning project ingress UUID (from URL). */
  projectId: string;
  raw: Record<string, unknown>;
  status?: string;
  callerPhoneNumber?: string | null;
}

export interface VapiWebhookResponse {
  statusCode?: number;
  body?: Record<string, unknown>;
}

export interface VapiStrategy {
  supports(type: VapiMessageType): boolean;
  handle(command: VapiWebhookCommand): Promise<VapiWebhookResponse>;
}
