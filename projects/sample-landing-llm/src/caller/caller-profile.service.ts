import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallerProfileEntity } from './caller-profile.entity';
import type { CallerChannel } from './caller-identity';
import {
  pickAbVariant,
  type AbVariant,
} from '../conversation/lib/ab-tests';

/** Loose memory bag — planner no longer uses Roofr estimate fields. */
type WorkingMemoryBag = Record<string, any>;

export interface CallerKey {
  channel: CallerChannel;
  callerId: string;
}

/** Snapshot of durable fields we hydrate into working memory. */
export interface CallerProfileSnapshot {
  firstName?: string;
  lastName?: string;
  email?: string;
  contactPhone?: string;
  address?: string;
  formSendConsent?: boolean;
  phoneConfirmed?: boolean;
  greetingAb?: AbVariant;
  contexts: Record<string, unknown>;
  callCount: number;
  lastConversationId?: string;
}

@Injectable()
export class CallerProfileService {
  constructor(
    @InjectRepository(CallerProfileEntity)
    private readonly repo: Repository<CallerProfileEntity>,
  ) {}

  async findByCaller(
    channel: CallerChannel,
    callerId: string,
  ): Promise<CallerProfileEntity | null> {
    return this.repo.findOne({
      where: { channel, callerId },
    });
  }

  toSnapshot(row: CallerProfileEntity): CallerProfileSnapshot {
    const greetingAb =
      row.greetingAb === 'A' || row.greetingAb === 'B'
        ? row.greetingAb
        : undefined;
    return {
      firstName: row.firstName ?? undefined,
      lastName: row.lastName ?? undefined,
      email: row.email ?? undefined,
      contactPhone: row.contactPhone ?? undefined,
      address: row.address ?? undefined,
      formSendConsent:
        row.formSendConsent === null ? undefined : row.formSendConsent,
      phoneConfirmed:
        row.phoneConfirmed === null ? undefined : row.phoneConfirmed,
      greetingAb,
      contexts: { ...(row.contexts ?? {}) },
      callCount: row.callCount,
      lastConversationId: row.lastConversationId ?? undefined,
    };
  }

  /**
   * Hydrate Conversation memory from a durable profile.
   * Does not set returningCallerConfirmed — Acknowledge asks that.
   */
  applyToMemory(
    memory: WorkingMemoryBag,
    snapshot: CallerProfileSnapshot,
  ): void {
    if (snapshot.firstName) {
      memory.firstName = snapshot.firstName;
      memory.callerName = snapshot.firstName;
    }
    if (snapshot.lastName) memory.lastName = snapshot.lastName;
    if (snapshot.email) {
      memory.email = snapshot.email;
      memory.emailConfirmed = true;
    }
    if (snapshot.contactPhone) {
      memory.contactPhone = snapshot.contactPhone;
      memory.phoneConfirmed = snapshot.phoneConfirmed ?? true;
    }
    if (snapshot.address) {
      memory.selectedAddress = snapshot.address;
      memory.addressQuery = snapshot.address;
    }
    // Do not hydrate SMS consent — re-ask every Conversation.
    const ctx = snapshot.contexts ?? {};
    if (typeof ctx.projectTimeline === 'string') {
      memory.projectTimeline = ctx.projectTimeline;
    }
    if (typeof ctx.roofSlope === 'string') {
      memory.roofSlope = ctx.roofSlope;
    }
    if (typeof ctx.callerIntent === 'string') {
      memory.callerIntent = ctx.callerIntent;
    }
    if (snapshot.greetingAb) {
      memory.greetingAb = snapshot.greetingAb;
    }
    // Named identity only — thin AB-only rows must not trigger “calling back” UX.
    memory.returningCaller = Boolean(snapshot.firstName);
    memory.returningCallerConfirmed = undefined;
    memory.callerProfileCallCount = snapshot.callCount;
  }

  /** Wipe preloaded identity so a rejected returning match can recollect. */
  clearIdentityFromMemory(memory: WorkingMemoryBag): void {
    delete memory.firstName;
    delete memory.lastName;
    delete memory.callerName;
    delete memory.email;
    delete memory.emailConfirmed;
    delete memory.contactPhone;
    delete memory.phoneConfirmed;
    delete memory.phoneConfirmAsked;
    delete memory.smsPhoneDestinationAsked;
    delete memory.smsAwaitingPhoneDigits;
    delete memory.selectedAddress;
    delete memory.addressQuery;
    delete memory.selectedAddressId;
    delete memory.formSendConsent;
    delete memory.formSendConsentAsked;
    delete memory.projectTimeline;
    delete memory.roofSlope;
    delete memory.existingVsNewAsked;
    delete memory.profileDataVerified;
    delete memory.profileVerifyAsked;
    delete memory.identityFormReceived;
    memory.returningCaller = true;
    memory.returningCallerConfirmed = false;
  }

  contextsFromMemory(memory: WorkingMemoryBag): Record<string, unknown> {
    const contexts: Record<string, unknown> = {};
    if (memory.projectTimeline) contexts.projectTimeline = memory.projectTimeline;
    if (memory.roofSlope) contexts.roofSlope = memory.roofSlope;
    if (memory.callerIntent) contexts.callerIntent = memory.callerIntent;
    if (memory.wantsAppointment !== undefined) {
      contexts.wantsAppointment = memory.wantsAppointment;
    }
    if (memory.wantsInstantEstimate !== undefined) {
      contexts.wantsInstantEstimate = memory.wantsInstantEstimate;
    }
    return contexts;
  }

  /**
   * Sticky greeting A/B for this caller. Creates a thin profile row if needed.
   * `registered` = first time this caller was assigned a variant.
   */
  async ensureGreetingAb(
    key: CallerKey,
  ): Promise<{ variant: AbVariant; registered: boolean }> {
    let row = await this.findByCaller(key.channel, key.callerId);
    if (row?.greetingAb === 'A' || row?.greetingAb === 'B') {
      return { variant: row.greetingAb, registered: false };
    }
    const variant = pickAbVariant();
    if (!row) {
      row = this.repo.create({
        channel: key.channel,
        callerId: key.callerId,
        callCount: 0,
        contexts: {},
        greetingAb: variant,
      });
    } else {
      row.greetingAb = variant;
    }
    await this.repo.save(row);
    return { variant, registered: true };
  }

  /**
   * Upsert durable caller fields from Conversation memory.
   * No-op when there is nothing useful to persist yet.
   */
  async upsertFromMemory(
    key: CallerKey,
    memory: WorkingMemoryBag,
    conversationId: string | null,
  ): Promise<CallerProfileEntity | null> {
    const hasIdentity = Boolean(
      memory.firstName ||
        memory.lastName ||
        memory.email ||
        memory.contactPhone ||
        memory.selectedAddress ||
        memory.formSendConsent !== undefined,
    );
    if (!hasIdentity) return null;

    let row = await this.findByCaller(key.channel, key.callerId);
    if (!row) {
      row = this.repo.create({
        channel: key.channel,
        callerId: key.callerId,
        callCount: 0,
        contexts: {},
      });
    }

    if (memory.firstName) row.firstName = memory.firstName;
    if (memory.lastName) row.lastName = memory.lastName;
    if (memory.email) row.email = memory.email;
    if (memory.contactPhone) row.contactPhone = memory.contactPhone;
    if (memory.selectedAddress) row.address = memory.selectedAddress;
    if (memory.formSendConsent !== undefined) {
      row.formSendConsent = memory.formSendConsent;
    }
    if (memory.phoneConfirmed !== undefined) {
      row.phoneConfirmed = memory.phoneConfirmed;
    }
    if (memory.greetingAb === 'A' || memory.greetingAb === 'B') {
      row.greetingAb = memory.greetingAb;
    }

    row.contexts = {
      ...(row.contexts ?? {}),
      ...this.contextsFromMemory(memory),
    };
    if (conversationId) {
      row.lastConversationId = conversationId;
    }
    // Count this Conversation once when we first save after preload / new.
    if (!memory.callerProfileCountedForSave) {
      row.callCount = (row.callCount ?? 0) + 1;
      memory.callerProfileCountedForSave = true;
    }

    return this.repo.save(row);
  }
}
