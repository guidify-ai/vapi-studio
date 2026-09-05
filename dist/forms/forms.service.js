"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const event_service_1 = require("../events/event.service");
const form_types_1 = require("./form.types");
const form_tokens_1 = require("./form.tokens");
const noop_form_dispose_adapter_1 = require("./noop-form-dispose.adapter");
const studio_env_1 = require("../util/studio-env");
const DEFAULT_ACK_MS = 15_000;
const DEFAULT_FILLOUT_MS = 10 * 60_000;
function resolveAckMs() {
    return (0, studio_env_1.envNumber)('STUDIO_FORM_ACK_MS', undefined, DEFAULT_ACK_MS);
}
let FormsService = class FormsService {
    events;
    pending = new Map();
    byConversation = new Map();
    adapter;
    constructor(events, adapter) {
        this.events = events;
        this.adapter = adapter ?? new noop_form_dispose_adapter_1.NoopFormDisposeAdapter();
    }
    /**
     * Deliver + ACK + onDelivered, then **block** until submit / fillout timeout.
     * Prefer {@link open} on live Vapi — holding Custom LLM SSE open for minutes
     * truncates TTS and races silence hangup.
     */
    async expose(conversationId, spec) {
        const entry = await this.beginExpose(conversationId, spec, false);
        try {
            const values = await this.waitFillout(entry, spec.filloutTimeoutMs ?? DEFAULT_FILLOUT_MS);
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
        }
        catch (err) {
            if (err instanceof form_types_1.FormFilloutTimeoutError) {
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
        }
        finally {
            this.cleanup(entry.exposeId);
        }
    }
    /**
     * Deliver + ACK + onDelivered, return immediately. Caller finishes the channel
     * turn (so TTS can complete). Later: {@link submit} then {@link claimSubmitted}.
     */
    async open(conversationId, spec) {
        const entry = await this.beginExpose(conversationId, spec, true);
        const filloutMs = spec.filloutTimeoutMs ?? DEFAULT_FILLOUT_MS;
        entry.fillTimer = setTimeout(() => {
            if (!this.pending.has(entry.exposeId) || entry.values)
                return;
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
    ack(exposeId) {
        const entry = this.pending.get(exposeId);
        if (!entry)
            return null;
        entry.ackReceived = true;
        entry.ackResolve?.();
        entry.ackResolve = undefined;
        return this.toHandle(entry);
    }
    /** Studio / channel submit — resolves blocking expose() or parks values for claim. */
    submit(exposeId, values) {
        const entry = this.pending.get(exposeId);
        if (!entry)
            return null;
        const cleaned = {};
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
        }
        else {
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
    claimSubmitted(conversationId) {
        const ids = this.byConversation.get(conversationId);
        if (!ids)
            return null;
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
    hasUnclaimedSubmit(conversationId) {
        const ids = this.byConversation.get(conversationId);
        if (!ids)
            return false;
        for (const id of ids) {
            const entry = this.pending.get(id);
            if (entry?.values)
                return true;
        }
        return false;
    }
    /** Pending undelivered/unsubmitted expose for Studio poll. */
    getPending(conversationId) {
        const ids = this.byConversation.get(conversationId);
        if (!ids)
            return null;
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
    listPending() {
        const rows = [];
        for (const entry of this.pending.values()) {
            if (!entry.values)
                rows.push(this.toHandle(entry));
        }
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    /** Newest open expose, or null. */
    getLatestPending() {
        return this.listPending()[0] ?? null;
    }
    getByExposeId(exposeId) {
        const entry = this.pending.get(exposeId);
        return entry ? this.toHandle(entry) : null;
    }
    /**
     * Re-run dispose for the conversation’s open (unsubmitted) expose — e.g. caller
     * says they never got the SMS / link. Same exposeId; adapter may text again.
     */
    async resend(conversationId) {
        const pending = this.getPending(conversationId);
        if (!pending)
            return null;
        const entry = this.pending.get(pending.exposeId);
        if (!entry || entry.values)
            return null;
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
        }
        catch (err) {
            throw err instanceof Error
                ? err
                : new form_types_1.FormChannelUnavailableError(String(err));
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
    async beginExpose(conversationId, spec, deferFillout) {
        if (!conversationId) {
            throw new Error('forms.expose requires conversationId');
        }
        if (!spec.fields?.length) {
            throw new Error('forms.expose requires at least one field');
        }
        const exposeId = (0, crypto_1.randomUUID)();
        const createdAt = new Date().toISOString();
        const conversationBranch = spec.branch?.trim() || undefined;
        const deliveryBranch = this.adapter.branch;
        const entry = {
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
        }
        catch (err) {
            this.cleanup(exposeId);
            throw err instanceof Error
                ? err
                : new form_types_1.FormChannelUnavailableError(String(err));
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
            throw new form_types_1.FormDeliverTimeoutError(exposeId, conversationId);
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
    toHandle(entry) {
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
    waitAck(entry, ms) {
        if (entry.ackReceived)
            return Promise.resolve(true);
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
    waitFillout(entry, ms) {
        if (entry.values)
            return Promise.resolve(entry.values);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                entry.fillResolve = undefined;
                entry.fillReject = undefined;
                reject(new form_types_1.FormFilloutTimeoutError(entry.exposeId, entry.conversationId));
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
    cleanup(exposeId) {
        const entry = this.pending.get(exposeId);
        if (!entry)
            return;
        if (entry.fillTimer)
            clearTimeout(entry.fillTimer);
        this.pending.delete(exposeId);
        const set = this.byConversation.get(entry.conversationId);
        if (set) {
            set.delete(exposeId);
            if (!set.size)
                this.byConversation.delete(entry.conversationId);
        }
    }
};
exports.FormsService = FormsService;
exports.FormsService = FormsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(form_tokens_1.FORM_DISPOSE_ADAPTER)),
    __metadata("design:paramtypes", [event_service_1.EventService, Object])
], FormsService);
//# sourceMappingURL=forms.service.js.map