import { EventService } from '../events/event.service';
import { type FormDisposeAdapter, type FormExposeHandle, type FormExposeSpec, type FormValues } from './form.types';
export declare class FormsService {
    private readonly events;
    private readonly pending;
    private readonly byConversation;
    private readonly adapter;
    constructor(events: EventService, adapter?: FormDisposeAdapter);
    /**
     * Deliver + ACK + onDelivered, then **block** until submit / fillout timeout.
     * Prefer {@link open} on live Vapi — holding Custom LLM SSE open for minutes
     * truncates TTS and races silence hangup.
     */
    expose(conversationId: string, spec: FormExposeSpec): Promise<FormValues>;
    /**
     * Deliver + ACK + onDelivered, return immediately. Caller finishes the channel
     * turn (so TTS can complete). Later: {@link submit} then {@link claimSubmitted}.
     */
    open(conversationId: string, spec: FormExposeSpec): Promise<FormExposeHandle>;
    /** Studio / channel ACK — form is openable on the client. */
    ack(exposeId: string): FormExposeHandle | null;
    /** Studio / channel submit — resolves blocking expose() or parks values for claim. */
    submit(exposeId: string, values: FormValues): FormExposeHandle | null;
    /**
     * Take submitted values for a conversation (open() path) and remove the expose.
     * Returns null when still waiting or nothing pending.
     */
    claimSubmitted(conversationId: string): FormValues | null;
    /** True when open() expose has been submitted but not yet claimed. */
    hasUnclaimedSubmit(conversationId: string): boolean;
    /** Pending undelivered/unsubmitted expose for Studio poll. */
    getPending(conversationId: string): FormExposeHandle | null;
    /**
     * All open (unsubmitted) exposes — newest first.
     * Operator / localhost watchers use this when conversationId is unknown.
     */
    listPending(): FormExposeHandle[];
    /** Newest open expose, or null. */
    getLatestPending(): FormExposeHandle | null;
    getByExposeId(exposeId: string): FormExposeHandle | null;
    /**
     * Re-run dispose for the conversation’s open (unsubmitted) expose — e.g. caller
     * says they never got the SMS / link. Same exposeId; adapter may text again.
     */
    resend(conversationId: string): Promise<FormExposeHandle | null>;
    private beginExpose;
    private toHandle;
    private waitAck;
    private waitFillout;
    private cleanup;
}
//# sourceMappingURL=forms.service.d.ts.map