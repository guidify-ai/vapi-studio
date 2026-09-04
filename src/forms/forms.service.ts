import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventService } from '../events/event.service';
import {
  FormChannelUnavailableError,
  FormDeliverTimeoutError,
  FormFilloutTimeoutError,
  type FormDisposeAdapter,
  type FormExposeHandle,
  type FormExposeSpec,
  type FormValues,
} from './form.types';
import { FORM_DISPOSE_ADAPTER } from './form.tokens';
import { NoopFormDisposeAdapter } from './noop-form-dispose.adapter';
import { envNumber } from '../util/studio-env';

const DEFAULT_ACK_MS = 15_000;
const DEFAULT_FILLOUT_MS = 10 * 60_000;

function resolveAckMs(): number {
  return envNumber('STUDIO_FORM_ACK_MS', 'RA9_FORM_ACK_MS', DEFAULT_ACK_MS);
}

interface PendingExpose {
  exposeId: string;
  formId: number;
  conversationId: string;
  fields: FormExposeSpec['fields'];
  branch?: string;
  deliveryBranch: string;
  createdAt: string;
  delivered: boolean;
  ackReceived: boolean;
  /** Opaque dispose hints (phone, channel) for {@link resend}. */
  disposeContext?: Record<string, unknown>;
  /** Non-blocking open(): values wait here until claimSubmitted(). */
  values?: FormValues;
  /** open() path — no Node is awaiting waitFillout. */
  deferFillout: boolean;
  ackResolve?: () => void;
  fillResolve?: (values: FormValues) => void;
  fillReject?: (err: Error) => void;
  fillTimer?: ReturnType<typeof setTimeout>;
}

@Injectable()
export class FormsService {
  private readonly pending: Map<string, PendingExpose> = new Map<string, PendingExpose>();
  private readonly byConversation: Map<string, Set<string>> = new Map<string, Set<string>>();
  private readonly adapter: FormDisposeAdapter;

  public constructor(
    private readonly events: EventService,
    @Optional()
    @Inject(FORM_DISPOSE_ADAPTER)
    adapter?: FormDisposeAdapter,
  ) {
    this.adapter = adapter ?? new NoopFormDisposeAdapter();
  }

  /**
   * Deliver + ACK + onDelivered, then **block** until submit / fillout timeout.
   * Prefer {@link open} on live Vapi — holding Custom LLM SSE open for minutes
   * truncates TTS and races silence hangup.
   */
  public async expose(
    conversationId: string,
    spec: FormExposeSpec,
  ): Promise<FormValues> {
    const entry = await this.beginExpose(conversationId, spec, false);
    try {
      const values = await this.waitFillout(
        entry,
        spec.filloutTimeoutMs ?? DEFAULT_FILLOUT_MS,
      );
      await this.events.emit({
        type: 'FORM_SUBMITTED',
        conversationId,
        payload: {
          exposeId: entry.exposeId,
          formId: entry.formId,
          branch: entry.branch ?? null,
          deliveryBranch: entry.deliveryBranch,
          keys: Object.keys(values),
          mode: 'blocking',
        },
      });
      return values;
    } catch (err) {
      if (err instanceof FormFilloutTimeoutError) {
        await this.events.emit({
          type: 'FORM_FILLOUT_TIMEOUT',
          conversationId,
          payload: {
            exposeId: entry.exposeId,
            formId: entry.formId,
            branch: entry.branch ?? null,
            deliveryBranch: entry.deliveryBranch,
            filloutMs: spec.filloutTimeoutMs ?? DEFAULT_FILLOUT_MS,
          },
        });
      }
      throw err;
    } finally {
      this.cleanup(entry.exposeId);
    }
  }

  /**
   * Deliver + ACK + onDelivered, return immediately. Caller finishes the channel
   * turn (so TTS can complete). Later: {@link submit} then {@link claimSubmitted}.
   */
  public async open(
    conversationId: string,
    spec: FormExposeSpec,
  ): Promise<FormExposeHandle> {
    const entry = await this.beginExpose(conversationId, spec, true);
    const filloutMs = spec.filloutTimeoutMs ?? DEFAULT_FILLOUT_MS;
    entry.fillTimer = setTimeout(() => {
      if (!this.pending.has(entry.exposeId) || entry.values) return;
      void this.events.emit({
        type: 'FORM_FILLOUT_TIMEOUT',
        conversationId,
        payload: {
          exposeId: entry.exposeId,
          formId: entry.formId,
          branch: entry.branch ?? null,
          deliveryBranch: entry.deliveryBranch,
          filloutMs,
          mode: 'open',
        },
      });
      this.cleanup(entry.exposeId);
    }, filloutMs);
    return this.toHandle(entry);
  }

  /** Studio / channel ACK — form is openable on the client. */
  public ack(exposeId: string): FormExposeHandle | null {
    const entry = this.pending.get(exposeId);
    if (!entry) return null;
    entry.ackReceived = true;
    entry.ackResolve?.();
    entry.ackResolve = undefined;
    return this.toHandle(entry);
  }

  /** Studio / channel submit — resolves blocking expose() or parks values for claim. */
  public submit(exposeId: string, values: FormValues): FormExposeHandle | null {
    const entry = this.pending.get(exposeId);
    if (!entry) return null;
    const cleaned: FormValues = {};
    for (const field of entry.fields) {
      const raw = values[field.name];
      cleaned[field.name] = typeof raw === 'string' ? raw.trim() : '';
      if (field.required && !cleaned[field.name]) {
        throw new Error(`Missing required field: ${field.name}`);
      }
    }
    entry.values = cleaned;
    if (entry.fillTimer) {
      clearTimeout(entry.fillTimer);
      entry.fillTimer = undefined;
    }
    if (entry.fillResolve) {
      entry.fillResolve(cleaned);
      entry.fillResolve = undefined;
      entry.fillReject = undefined;
    } else {
      void this.events.emit({
        type: 'FORM_SUBMITTED',
        conversationId: entry.conversationId,
        payload: {
          exposeId: entry.exposeId,
          formId: entry.formId,
          branch: entry.branch ?? null,
          deliveryBranch: entry.deliveryBranch,
          keys: Object.keys(cleaned),
          mode: 'open',
        },
      });
    }
    return this.toHandle(entry);
  }

  /**
   * Take submitted values for a conversation (open() path) and remove the expose.
   * Returns null when still waiting or nothing pending.
   */
  public claimSubmitted(conversationId: string): FormValues | null {
    const ids = this.byConversation.get(conversationId);
    if (!ids) return null;
    for (const id of [...ids]) {
      const entry = this.pending.get(id);
      if (entry?.values) {
        const values = entry.values;
        this.cleanup(id);
        return values;
      }
    }
    return null;
  }

  /** True when open() expose has been submitted but not yet claimed. */
  public hasUnclaimedSubmit(conversationId: string): boolean {
    const ids = this.byConversation.get(conversationId);
    if (!ids) return false;
    for (const id of ids) {
      const entry = this.pending.get(id);
      if (entry?.values) return true;
    }
    return false;
  }

  /** Pending undelivered/unsubmitted expose for Studio poll. */
  public getPending(conversationId: string): FormExposeHandle | null {
    const ids = this.byConversation.get(conversationId);
    if (!ids) return null;
    for (const id of ids) {
      const entry = this.pending.get(id);
      if (entry && !entry.values) {
        return this.toHandle(entry);
      }
    }
    return null;
  }

  /**
   * All open (unsubmitted) exposes — newest first.
   * Operator / localhost watchers use this when conversationId is unknown.
   */
  public listPending(): FormExposeHandle[] {
    const rows: FormExposeHandle[] = [];
    for (const entry of this.pending.values()) {
      if (!entry.values) rows.push(this.toHandle(entry));
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Newest open expose, or null. */
  public getLatestPending(): FormExposeHandle | null {
    return this.listPending()[0] ?? null;
  }

  public getByExposeId(exposeId: string): FormExposeHandle | null {
    const entry = this.pending.get(exposeId);
    return entry ? this.toHandle(entry) : null;
  }

  /**
   * Re-run dispose for the conversation’s open (unsubmitted) expose — e.g. caller
   * says they never got the SMS / link. Same exposeId; adapter may text again.
   */
  public async resend(conversationId: string): Promise<FormExposeHandle | null> {
    const pending = this.getPending(conversationId);
    if (!pending) return null;
    const entry = this.pending.get(pending.exposeId);
    if (!entry || entry.values) return null;

    await this.events.persist(conversationId, 'FORM_RESEND', {
      exposeId: entry.exposeId,
      formId: entry.formId,
      branch: entry.branch ?? null,
      deliveryBranch: entry.deliveryBranch,
      adapter: this.adapter.id,
      disposeContext: entry.disposeContext ?? null,
    });

    try {
      await this.adapter.dispose({
        exposeId: entry.exposeId,
        formId: entry.formId,
        conversationId: entry.conversationId,
        fields: entry.fields,
        branch: entry.branch,
        disposeContext: entry.disposeContext,
      });
    } catch (err) {
      throw err instanceof Error
        ? err
        : new FormChannelUnavailableError(String(err));
    }

    // Link adapters ACK immediately; keep delivered=true either way.
    entry.delivered = true;
    entry.ackReceived = true;
    await this.events.emit({
      type: 'FORM_RESENT',
      conversationId,
      payload: {
        exposeId: entry.exposeId,
        formId: entry.formId,
        branch: entry.branch ?? null,
        deliveryBranch: entry.deliveryBranch,
      },
    });
    return this.toHandle(entry);
  }

  private async beginExpose(
    conversationId: string,
    spec: FormExposeSpec,
    deferFillout: boolean,
  ): Promise<PendingExpose> {
    if (!conversationId) {
      throw new Error('forms.expose requires conversationId');
    }
    if (!spec.fields?.length) {
      throw new Error('forms.expose requires at least one field');
    }

    const exposeId = randomUUID();
    const createdAt = new Date().toISOString();
    const conversationBranch = spec.branch?.trim() || undefined;
    const deliveryBranch = this.adapter.branch;
    const entry: PendingExpose = {
      exposeId,
      formId: spec.formId,
      conversationId,
      fields: spec.fields,
      branch: conversationBranch,
      deliveryBranch,
      createdAt,
      delivered: false,
      ackReceived: false,
      deferFillout,
      disposeContext: spec.disposeContext,
    };
    this.pending.set(exposeId, entry);
    const set = this.byConversation.get(conversationId) ?? new Set();
    set.add(exposeId);
    this.byConversation.set(conversationId, set);

    await this.events.persist(conversationId, 'FORM_SENDOUT', {
      exposeId,
      formId: spec.formId,
      branch: conversationBranch ?? null,
      deliveryBranch,
      adapter: this.adapter.id,
      fields: spec.fields.map((f) => f.name),
      disposeContext: spec.disposeContext ?? null,
      deferFillout,
    });

    await this.events.emit({
      type: 'FORM_EXPOSE',
      conversationId,
      payload: {
        exposeId,
        formId: spec.formId,
        branch: conversationBranch ?? null,
        deliveryBranch,
        fields: spec.fields.map((f) => f.name),
        adapter: this.adapter.id,
        disposeContext: spec.disposeContext ?? null,
        deferFillout,
      },
    });

    try {
      await this.adapter.dispose({
        exposeId,
        formId: spec.formId,
        conversationId,
        fields: spec.fields,
        branch: conversationBranch,
        disposeContext: spec.disposeContext,
      });
    } catch (err) {
      this.cleanup(exposeId);
      throw err instanceof Error
        ? err
        : new FormChannelUnavailableError(String(err));
    }

    const ackWindowMs = resolveAckMs();
    const ackOk = await this.waitAck(entry, ackWindowMs);
    if (!ackOk) {
      await this.events.emit({
        type: 'FORM_DELIVER_TIMEOUT',
        conversationId,
        payload: {
          exposeId,
          formId: spec.formId,
          branch: conversationBranch ?? null,
          deliveryBranch,
          ackMs: ackWindowMs,
        },
      });
      this.cleanup(exposeId);
      throw new FormDeliverTimeoutError(exposeId, conversationId);
    }

    entry.delivered = true;
    await this.events.emit({
      type: 'FORM_DELIVERED',
      conversationId,
      payload: {
        exposeId,
        formId: spec.formId,
        branch: conversationBranch ?? null,
        deliveryBranch,
      },
    });

    if (spec.onDelivered) {
      await spec.onDelivered();
    }

    return entry;
  }

  private toHandle(entry: PendingExpose): FormExposeHandle {
    return {
      exposeId: entry.exposeId,
      formId: entry.formId,
      conversationId: entry.conversationId,
      fields: entry.fields,
      createdAt: entry.createdAt,
      branch: entry.branch,
      deliveryBranch: entry.deliveryBranch,
    };
  }

  private waitAck(entry: PendingExpose, ms: number): Promise<boolean> {
    if (entry.ackReceived) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        entry.ackResolve = undefined;
        resolve(false);
      }, ms);
      entry.ackResolve = () => {
        clearTimeout(timer);
        resolve(true);
      };
    });
  }

  private waitFillout(entry: PendingExpose, ms: number): Promise<FormValues> {
    if (entry.values) return Promise.resolve(entry.values);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        entry.fillResolve = undefined;
        entry.fillReject = undefined;
        reject(
          new FormFilloutTimeoutError(entry.exposeId, entry.conversationId),
        );
      }, ms);
      entry.fillResolve = (values) => {
        clearTimeout(timer);
        resolve(values);
      };
      entry.fillReject = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  }

  private cleanup(exposeId: string): void {
    const entry = this.pending.get(exposeId);
    if (!entry) return;
    if (entry.fillTimer) clearTimeout(entry.fillTimer);
    this.pending.delete(exposeId);
    const set = this.byConversation.get(entry.conversationId);
    if (set) {
      set.delete(exposeId);
      if (!set.size) this.byConversation.delete(entry.conversationId);
    }
  }
}
