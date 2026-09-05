import { DynamicModule, type Type } from '@nestjs/common';
import { type BrainAdapter } from './brain/brain.service';
import { type ConversationEntryPoint } from './conversation/conversation-entry';
import { type Ra9EventListener } from './events/ra9-event';
import { type Ra9Node } from './node/ra9-node';
import { type Ra9Intention } from './intention/ra9-intention';
import { type Ra9BrainConfig } from './brain/brain-config';
import { type ConversationLimitsConfig } from './conversation/conversation-limits';
import type { FormDisposeAdapter } from './forms/form.types';
export interface Ra9ModuleOptions {
    nodes: Array<{
        className: string;
        useClass: Type<Ra9Node<any>>;
    }>;
    /**
     * Optional code intentions (`Ra9Intention`) — cascade meta + before/match/run.
     * Force-phase intentions run before listen resolve / Brain.
     */
    intentions?: Array<Type<Ra9Intention<any>>>;
    /**
     * Conversation entry point that seeds typed variables at bootstrap.
     * Defaults to an empty variables object when omitted.
     */
    entryPoint?: Type<ConversationEntryPoint<object>>;
    /**
     * Brain adapter (Mock, ChatGPT, or app-owned e.g. Roofr API).
     * Defaults to MockBrainAdapter. Supervisor depends only on BRAIN_SERVICE.
     */
    brainAdapter?: Type<BrainAdapter>;
    /**
     * Extra event listeners (additive). PostgresEventListener is always registered.
     * App code (e.g. roofr-poc) can append Datadog / webhook listeners here.
     */
    eventListeners?: Array<Type<Ra9EventListener>>;
    /**
     * Brain settings (model, scan threshold). Code layer — not .env.
     * `model` must be on the cheap whitelist. Default gpt-4.1-nano / 0.4.
     */
    brain?: Ra9BrainConfig;
    /**
     * Hard conversation caps (turns + wall-clock). Always on — defaults 40 turns /
     * 20 minutes. Cannot be disabled; values are clamped to safe ceilings.
     */
    limits?: ConversationLimitsConfig;
    /**
     * How to dispose `forms.expose` to the active channel.
     * Default: noop (ACK never arrives → Nodes fall back to voice).
     * Studio registers a developer-tools chat dispose adapter.
     */
    formDisposeAdapter?: Type<FormDisposeAdapter>;
}
export declare class Ra9Module {
    static forRoot(options: Ra9ModuleOptions): DynamicModule;
}
//# sourceMappingURL=ra9.module.d.ts.map