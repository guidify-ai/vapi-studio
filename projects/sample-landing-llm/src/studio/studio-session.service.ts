import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ConversationBootstrapService,
  EventService,
  FormsService,
  STANDARD_INTENTIONS,
  Supervisor,
  SupervisedConversationRegistry,
  WorkflowHandoffService,
  type FormExposeHandle,
  type FormValues,
  type OutputAction,
  type SupervisedConversation,
  type TurnExecutionResult,
} from '@guidify-ai/vapi-studio';
import { brainConfig } from '../brain/brain.config';
import { resolveProjectUuid } from '../project/project.config';
import { StudioEventBuffer } from './studio-event-buffer';
import { StudioLiveSpeechBuffer } from './studio-live-speech.buffer';
import { FormResumeService } from '../forms/form-resume.service';
import {
  type CallerIdentity,
  resolveCaller,
  webCaller,
  withCallerMetadata,
} from '../caller/caller-identity';

export interface StudioTurnView {
  conversationId: string;
  providerCallId: string;
  status: string;
  currentNodeId: string | null;
  normalFlowNodeId: string | null;
  workflowId?: string | null;
  activeModuleId?: string | null;
  selectedNodeId?: string;
  selectedClass?: string;
  intentionNames?: string[];
  say: string[];
  actions: OutputAction[];
  memory: Record<string, unknown>;
  variables: Record<string, unknown>;
  caller: CallerIdentity | null;
  history: unknown;
  portalState: unknown;
  listenExpectation: unknown;
  events: unknown[];
  formExpose?: FormExposeHandle | null;
  ended?: boolean;
  endReason?: string;
  /**
   * Flow diagram highlight override (e.g. `__end` for exit · endCall).
   * Does not change runtime `currentNodeId` — synthetic bookends are UI-only.
   */
  diagramHighlightNodeId?: string | null;
}

@Injectable()
export class StudioSessionService {
  constructor(
    private readonly bootstrap: ConversationBootstrapService,
    private readonly supervisor: Supervisor,
    private readonly registry: SupervisedConversationRegistry,
    private readonly events: EventService,
    private readonly buffer: StudioEventBuffer,
    private readonly handoffs: WorkflowHandoffService,
    private readonly forms: FormsService,
    private readonly liveSpeech: StudioLiveSpeechBuffer,
    private readonly formResume: FormResumeService,
  ) {}

  private trackSay(conversationId: string, say: string[]) {
    return async (line: string) => {
      say.push(line);
      this.liveSpeech.push(conversationId, line);
    };
  }

  /**
   * “Call” — bootstrap + speak-first opening only (entry phrase). No user text.
   * `afterHours: true` marks the Conversation so human transfer is blocked.
   */
  async startCall(
    webCallerId: string,
    opts: {
      afterHours?: boolean;
      abOverrides?: Record<string, string>;
      featureFlagOverrides?: Record<string, boolean>;
      contactName?: string;
      contactEmail?: string;
      guestCompanyName?: string;
    } = {},
  ): Promise<StudioTurnView> {
    const caller = webCaller(webCallerId);
    const afterHours = opts.afterHours === true;
    const abOverrides = sanitizeAbOverrides(opts.abOverrides);
    const featureFlags = sanitizeFeatureFlags(opts.featureFlagOverrides);
    const providerCallId = `studio-${randomUUID()}`;
    const brainProfileId = process.env.POC_BRAIN_PROFILE ?? 'planner';

    const projectId = resolveProjectUuid();
    const runtime = await this.bootstrap.bootstrap({
      projectId,
      providerCallId,
      brainProfileId,
      metadata: withCallerMetadata(
        {
          startedBy: 'flow-studio-call',
          projectId,
          afterHours,
          ...(opts.contactName ? { contactName: opts.contactName } : {}),
          ...(opts.contactEmail ? { contactEmail: opts.contactEmail } : {}),
          ...(opts.guestCompanyName
            ? { guestCompanyName: opts.guestCompanyName }
            : {}),
          ...(Object.keys(abOverrides).length ? { abOverrides } : {}),
          ...(Object.keys(featureFlags).length
            ? { featureFlags }
            : {}),
        },
        caller,
      ),
    });
    this.handoffs.activateEntryModule(runtime);

    this.buffer.pushSynthetic(runtime.conversationId, 'STUDIO_SESSION_START', {
      providerCallId,
      brainProfileId,
      mode: 'call',
      afterHours,
      abOverrides,
      featureFlags,
      caller,
      workflowId: runtime.metadata.workflowId ?? null,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    if (afterHours) {
      await this.events.persist(
        runtime.conversationId,
        'CALL_AFTER_HOURS_MODE',
        { callerId: caller.id, channel: caller.channel },
      );
    }
    if (Object.keys(featureFlags).length) {
      await this.events.persist(
        runtime.conversationId,
        'FEATURE_FLAG_OVERRIDES',
        { flags: featureFlags },
      );
    }

    const say: string[] = [];
    let turn: TurnExecutionResult | null = null;
    const onSay = this.trackSay(runtime.conversationId, say);

    if (!runtime.openingCompleted) {
      turn = await this.supervisor.handleTurn({
        runtime,
        userText: '',
        onSay,
      });
    }

    const actions = turn
      ? await this.applyHandoffsWithEntrySpeak(runtime, turn.actions, say)
      : [];

    this.buffer.pushSynthetic(runtime.conversationId, 'STUDIO_OPENING', {
      selectedNodeId: turn?.selectedNodeId,
      selectedClass: turn?.selectedClass,
      say: [...say],
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    return this.view(runtime.conversationId, {
      selectedNodeId: turn?.selectedNodeId,
      selectedClass: turn?.selectedClass,
      intentionNames: turn?.intentionNames,
      say,
      actions,
    });
  }

  /**
   * First chat message: bootstrap + opening turn (empty user) + user turn.
   * Text-only — no Vapi / audio.
   */
  async startWithMessage(
    userText: string,
    webCallerId: string,
  ): Promise<StudioTurnView> {
    const text = userText.trim();
    if (!text) {
      throw new BadRequestException('First message cannot be empty');
    }

    const caller = webCaller(webCallerId);
    const providerCallId = `studio-${randomUUID()}`;
    const brainProfileId = process.env.POC_BRAIN_PROFILE ?? 'planner';

    const projectId = resolveProjectUuid();
    const runtime = await this.bootstrap.bootstrap({
      projectId,
      providerCallId,
      brainProfileId,
      metadata: withCallerMetadata(
        {
          startedBy: 'flow-studio',
          projectId,
        },
        caller,
      ),
    });
    this.handoffs.activateEntryModule(runtime);

    this.buffer.pushSynthetic(runtime.conversationId, 'STUDIO_SESSION_START', {
      providerCallId,
      brainProfileId,
      firstUserText: text,
      caller,
      workflowId: runtime.metadata.workflowId ?? null,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    const say: string[] = [];
    const collect = this.trackSay(runtime.conversationId, say);

    if (!runtime.openingCompleted) {
      await this.supervisor.handleTurn({
        runtime,
        userText: '',
        onSay: collect,
      });
    }

    const turn = await this.supervisor.handleTurn({
      runtime,
      userText: text,
      onSay: collect,
    });

    const actions = await this.applyHandoffsWithEntrySpeak(
      runtime,
      turn.actions,
      say,
    );

    this.buffer.pushSynthetic(runtime.conversationId, 'STUDIO_TURN', {
      userText: text,
      selectedNodeId: turn.selectedNodeId,
      selectedClass: turn.selectedClass,
      intentionNames: turn.intentionNames,
      say: [...say],
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    return this.finishTurnView(runtime, {
      selectedNodeId: turn.selectedNodeId,
      selectedClass: turn.selectedClass,
      intentionNames: turn.intentionNames,
      say,
      actions,
    });
  }

  async sendTurn(conversationId: string, userText: string): Promise<StudioTurnView> {
    const text = userText.trim();
    if (!text) {
      throw new BadRequestException('Message cannot be empty');
    }
    const runtime = this.registry.getByConversationId(conversationId);
    if (!runtime || runtime.status === 'ENDED') {
      throw new NotFoundException('No active studio conversation');
    }

    this.handoffs.ensureActiveFlow(runtime);

    const say: string[] = [];
    const onSay = this.trackSay(conversationId, say);
    const turn = await this.supervisor.handleTurn({
      runtime,
      userText: text,
      onSay,
    });

    const actions = await this.applyHandoffsWithEntrySpeak(
      runtime,
      turn.actions,
      say,
    );

    this.buffer.pushSynthetic(conversationId, 'STUDIO_TURN', {
      userText: text,
      selectedNodeId: turn.selectedNodeId,
      selectedClass: turn.selectedClass,
      intentionNames: turn.intentionNames,
      say: [...say],
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    return this.finishTurnView(runtime, {
      selectedNodeId: turn.selectedNodeId,
      selectedClass: turn.selectedClass,
      intentionNames: turn.intentionNames,
      say,
      actions,
    });
  }

  /**
   * Flow Studio silence clock — mirrors Vapi `customer.speech.timeout`
   * by forcing the still-there portal (ask ×2 then endCall).
   */
  async idleStillThere(conversationId: string): Promise<StudioTurnView> {
    const runtime = this.registry.getByConversationId(conversationId);
    if (!runtime || runtime.status === 'ENDED') {
      throw new NotFoundException('No active studio conversation');
    }

    if (this.forms.getPending(conversationId)) {
      this.buffer.pushSynthetic(conversationId, 'STUDIO_IDLE_STILL_THERE_SKIPPED', {
        note: 'form expose pending — silence expected during fillout',
        activeModuleId: runtime.metadata.activeModuleId ?? null,
      });
      return this.finishTurnView(runtime, {
        selectedNodeId: runtime.currentNodeId ?? undefined,
        selectedClass: undefined,
        intentionNames: [],
        say: [],
        actions: [],
      });
    }

    this.handoffs.ensureActiveFlow(runtime);

    const say: string[] = [];
    const onSay = this.trackSay(conversationId, say);
    const turn = await this.supervisor.handleTurn({
      runtime,
      userText: '',
      forceIntention: STANDARD_INTENTIONS.isStillThere,
      onSay,
    });

    const actions = await this.applyHandoffsWithEntrySpeak(
      runtime,
      turn.actions,
      say,
    );

    this.buffer.pushSynthetic(conversationId, 'STUDIO_IDLE_STILL_THERE', {
      selectedNodeId: turn.selectedNodeId,
      selectedClass: turn.selectedClass,
      intentionNames: turn.intentionNames,
      say: [...say],
      attempt: runtime.portalState.stillThere.attempts,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    return this.finishTurnView(runtime, {
      selectedNodeId: turn.selectedNodeId,
      selectedClass: turn.selectedClass,
      intentionNames: turn.intentionNames,
      say,
      actions,
    });
  }

  async end(
    conversationId: string,
    reason: string,
  ): Promise<StudioTurnView> {
    const runtime = this.registry.getByConversationId(conversationId);
    if (!runtime) {
      throw new NotFoundException('No active studio conversation');
    }
    const endReason = reason.trim() || 'customer_ended';
    await this.events.persist(conversationId, 'STUDIO_END_REASON', {
      reason: endReason,
      source: 'studio_ui',
    });
    this.buffer.pushSynthetic(conversationId, 'STUDIO_SESSION_END', {
      reason: endReason,
    });
    const snap = this.view(conversationId, { say: [], actions: [] });
    await this.bootstrap.finalizeEnded(runtime.providerCallId);
    return {
      ...snap,
      status: 'ENDED',
      ended: true,
      endReason,
      diagramHighlightNodeId: '__end',
    };
  }

  getState(conversationId: string): StudioTurnView {
    const runtime = this.registry.getByConversationId(conversationId);
    if (!runtime) {
      const events = this.buffer.list(conversationId);
      if (!events.length) {
        throw new NotFoundException('Unknown studio conversation');
      }
      return {
        conversationId,
        providerCallId: '',
        status: 'ENDED',
        currentNodeId: null,
        normalFlowNodeId: null,
        workflowId: null,
        activeModuleId: null,
        say: [],
        actions: [],
        memory: {},
        variables: {},
        caller: null,
        history: { chat: [], nodes: [] },
        portalState: {},
        listenExpectation: null,
        events,
        formExpose: null,
        ended: true,
      };
    }
    return this.view(conversationId, { say: [], actions: [] });
  }

  getPendingForm(conversationId: string): {
    formExpose: FormExposeHandle | null;
    liveSays: string[];
    awaitingFormResume: boolean;
  } {
    return {
      formExpose: this.forms.getPending(conversationId),
      liveSays: this.liveSpeech.drain(conversationId),
      awaitingFormResume: this.forms.hasUnclaimedSubmit(conversationId),
    };
  }

  ackForm(conversationId: string, exposeId: string): {
    ok: boolean;
    formExpose: FormExposeHandle | null;
  } {
    const pending = this.forms.getByExposeId(exposeId);
    if (!pending || pending.conversationId !== conversationId) {
      throw new NotFoundException('Unknown form expose');
    }
    const handle = this.forms.ack(exposeId);
    this.buffer.pushSynthetic(conversationId, 'FORM_DELIVERED_ACK', {
      exposeId,
      formId: pending.formId,
    });
    return { ok: Boolean(handle), formExpose: handle };
  }

  submitForm(
    conversationId: string,
    exposeId: string,
    values: FormValues,
  ): Promise<{ ok: boolean; say: string[]; formExpose: FormExposeHandle | null }> {
    const pending = this.forms.getByExposeId(exposeId);
    if (!pending || pending.conversationId !== conversationId) {
      throw new NotFoundException('Unknown form expose');
    }
    try {
      const handle = this.forms.submit(exposeId, values);
      this.buffer.pushSynthetic(conversationId, 'FORM_SUBMITTED', {
        exposeId,
        formId: pending.formId,
        keys: Object.keys(values),
      });
      return this.formResume.afterSubmit(conversationId).then((say) => {
        this.buffer.pushSynthetic(conversationId, 'STUDIO_FORM_RESUME', {
          exposeId,
          sayLines: say.length,
        });
        const drained = this.liveSpeech.drain(conversationId);
        const merged = [...say, ...drained].filter(
          (line, i, arr) => line && arr.indexOf(line) === i,
        );
        return { ok: Boolean(handle), say: merged, formExpose: handle };
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Apply handoffs (shared Conversation, new activeModuleId) then speak the
   * destination module entry in-process — Studio has no Vapi Squad switch.
   */
  private async applyHandoffsWithEntrySpeak(
    runtime: SupervisedConversation,
    actions: OutputAction[],
    say: string[],
  ): Promise<OutputAction[]> {
    let merged = await this.handoffs.applyHandoffs(runtime, actions);
    let guard = 0;
    while (runtime.metadata.moduleNeedsEntrySpeak === true && guard < 4) {
      guard += 1;
      const onSay = this.trackSay(runtime.conversationId, say);
      const entry = await this.supervisor.handleTurn({
        runtime,
        userText: '',
        onSay,
      });
      merged = [
        ...merged,
        ...(await this.handoffs.applyHandoffs(runtime, entry.actions)),
      ];
    }
    return merged;
  }

  private async finishTurnView(
    runtime: SupervisedConversation,
    extra: {
      selectedNodeId?: string;
      selectedClass?: string;
      intentionNames?: string[];
      say: string[];
      actions: OutputAction[];
    },
  ): Promise<StudioTurnView> {
    // Lines are already in `extra.say` for the HTTP response — clear the live
    // buffer so the form poll does not race-duplicate them in the chat UI.
    this.liveSpeech.clear(runtime.conversationId);
    const transferred = extra.actions.some((a) => a.kind === 'transferToHuman');
    const ended =
      transferred || extra.actions.some((a) => a.kind === 'endCall');
    const snap = this.view(runtime.conversationId, extra);
    if (ended) {
      const endReason = transferred ? 'transferred_to_human' : 'bot_ended';
      await this.events.persist(runtime.conversationId, 'STUDIO_END_REASON', {
        reason: endReason,
        source: transferred ? 'transferToHuman_action' : 'endCall_action',
      });
      await this.bootstrap.finalizeEnded(runtime.providerCallId);
      return {
        ...snap,
        status: 'ENDED',
        ended: true,
        endReason,
        // Diagram bookend only — runtime currentNodeId stays on the last real node.
        diagramHighlightNodeId: '__end',
      };
    }
    return snap;
  }

  private view(
    conversationId: string,
    extra: {
      selectedNodeId?: string;
      selectedClass?: string;
      intentionNames?: string[];
      say: string[];
      actions: OutputAction[];
    },
  ): StudioTurnView {
    const runtime = this.registry.getByConversationId(conversationId);
    if (!runtime) {
      throw new NotFoundException('No active studio conversation');
    }
    const vars = runtime.variables as Record<string, unknown>;
    const caller =
      resolveCaller(runtime.metadata) ??
      (typeof vars.callerId === 'string' && vars.callerId
        ? {
            channel: vars.callerChannel === 'phone' ? 'phone' as const : 'web' as const,
            id: String(vars.callerId),
          }
        : null);
    return {
      conversationId: runtime.conversationId,
      providerCallId: runtime.providerCallId,
      status: runtime.status,
      currentNodeId: runtime.currentNodeId,
      normalFlowNodeId: runtime.normalFlowNodeId,
      workflowId:
        typeof runtime.metadata.workflowId === 'string'
          ? runtime.metadata.workflowId
          : null,
      activeModuleId:
        typeof runtime.metadata.activeModuleId === 'string'
          ? runtime.metadata.activeModuleId
          : null,
      selectedNodeId: extra.selectedNodeId,
      selectedClass: extra.selectedClass,
      intentionNames: extra.intentionNames,
      say: extra.say,
      actions: extra.actions,
      memory: { ...runtime.memory },
      variables: { ...runtime.variables },
      caller,
      history: runtime.history,
      portalState: runtime.portalState,
      listenExpectation: runtime.listenExpectation,
      events: this.buffer.list(conversationId),
      formExpose: this.forms.getPending(conversationId),
    };
  }
}

function sanitizeAbOverrides(
  raw: Record<string, string> | undefined,
): Record<string, 'A' | 'B'> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, 'A' | 'B'> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === 'A' || v === 'B') out[k] = v;
  }
  return out;
}

function sanitizeFeatureFlags(
  raw: Record<string, boolean> | undefined,
): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    if (!key) continue;
    out[key] = v === true;
  }
  return out;
}
