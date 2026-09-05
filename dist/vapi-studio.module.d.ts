import { DynamicModule, type Type } from '@nestjs/common';
import { type BrainAdapter } from './brain/brain.service';
import { type ConversationEntryPoint } from './conversation/conversation-entry';
import { type StudioEventListener } from './events/studio-event';
import { type AgentNode } from './node/agent-node';
import { type CodeIntention } from './intention/code-intention';
import { type StudioBrainConfig } from './brain/brain-config';
import { type ConversationLimitsConfig } from './conversation/conversation-limits';
import type { FormDisposeAdapter } from './forms/form.types';
export interface VapiStudioModuleOptions {
    nodes: Array<{
        className: string;
        useClass: Type<AgentNode<any>>;
    }>;
    /**
     * Optional code intentions (`CodeIntention`) — cascade meta + before/match/run.
     * Force-phase intentions run before listen resolve / Brain.
     */
    intentions?: Array<Type<CodeIntention<any>>>;
    /**
     * Conversation entry point that seeds typed variables at bootstrap.
     * Defaults to an empty variables object when omitted.
     */
    entryPoint?: Type<ConversationEntryPoint<object>>;
    /**
     * Brain adapter (Mock, ChatGPT, Claude, Gemini, Grok, or app-owned).
     * Defaults to MockBrainAdapter. Supervisor depends only on BRAIN_SERVICE.
     */
    brainAdapter?: Type<BrainAdapter>;
    /**
     * Extra event listeners (additive). PostgresEventListener is always registered.
     * App code (e.g. roofr-poc) can append Datadog / webhook listeners here.
     */
    eventListeners?: Array<Type<StudioEventListener>>;
    /**
     * Brain settings (model, scan threshold). Code layer — not .env.
     * `model` must be on the cheap whitelist. Default gpt-4.1-nano / 0.4.
     */
    brain?: StudioBrainConfig;
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
export declare class VapiStudioModule {
    static forRoot(options: VapiStudioModuleOptions): DynamicModule;
}
//# sourceMappingURL=vapi-studio.module.d.ts.map