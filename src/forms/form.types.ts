export type FormFieldType = 'string' | 'email' | 'tel' | 'textarea';

export interface FormFieldSpec {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
}

export interface FormExposeSpec {
  /** App-defined form template id. */
  formId: number;
  fields: FormFieldSpec[];
  /**
   * Conversation branch this sendout belongs to (app-owned id for forensics /
   * flow edges). Emitted on `FORM_SENDOUT` before delivery wait.
   * Example: `identity_html_form`, `appointment_intake`.
   */
  branch?: string;
  /** Called after the channel ACKs delivery (≤15s). Use to speak “form exposed, waiting”. */
  onDelivered?: () => Promise<void>;
  /** Fillout wait (ms). Default 10 minutes. */
  filloutTimeoutMs?: number;
  /**
   * Optional channel hints for the dispose adapter (e.g. contactPhone, channel).
   * Opaque to the framework — apps/adapters interpret it.
   */
  disposeContext?: Record<string, unknown>;
}

export type FormValues = Record<string, string>;

export interface FormExposeHandle {
  exposeId: string;
  formId: number;
  conversationId: string;
  fields: FormFieldSpec[];
  createdAt: string;
  /** App conversation branch from the expose spec, if any. */
  branch?: string;
  /** Delivery branch reported by the dispose adapter. */
  deliveryBranch?: string;
}

export interface FormDisposePayload {
  exposeId: string;
  formId: number;
  conversationId: string;
  fields: FormFieldSpec[];
  /** App conversation branch from FormExposeSpec.branch. */
  branch?: string;
  disposeContext?: Record<string, unknown>;
}

/**
 * Channel-specific dispose (Studio modal, first-party HTML link, SMS later).
 * Must make the form visible to the caller; ACK is separate via FormsService.ack
 * (or the adapter may ACK once the link is ready / page is openable).
 *
 * `branch` is the **delivery** path this driver implements (html_link / sms / …).
 * It is stamped on `FORM_SENDOUT` early so logs show which sendout lane ran
 * before ACK / fillout.
 */
export interface FormDisposeAdapter {
  readonly id: string;
  /** Delivery branch id this driver owns (e.g. `html_link`, `sms`, `unavailable`). */
  readonly branch: string;
  dispose(payload: FormDisposePayload): Promise<void>;
}

export class FormDeliverTimeoutError extends Error {
  readonly code = 'FORM_DELIVER_TIMEOUT' as const;
  constructor(
    readonly exposeId: string,
    readonly conversationId: string,
  ) {
    super(
      `Form expose ${exposeId} was not acknowledged within the delivery window`,
    );
    this.name = 'FormDeliverTimeoutError';
  }
}

export class FormFilloutTimeoutError extends Error {
  readonly code = 'FORM_FILLOUT_TIMEOUT' as const;
  constructor(
    readonly exposeId: string,
    readonly conversationId: string,
  ) {
    super(`Form expose ${exposeId} fillout timed out`);
    this.name = 'FormFilloutTimeoutError';
  }
}

export class FormChannelUnavailableError extends Error {
  readonly code = 'FORM_CHANNEL_UNAVAILABLE' as const;
  constructor(message = 'No form dispose adapter can deliver on this channel') {
    super(message);
    this.name = 'FormChannelUnavailableError';
  }
}
