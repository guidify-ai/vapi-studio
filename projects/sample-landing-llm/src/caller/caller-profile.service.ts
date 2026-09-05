import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallerProfileEntity } from './caller-profile.entity';
import type { CallerChannel } from './caller-identity';

/** Loose memory bag — planner memory fields. */
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
      contexts: { ...(row.contexts ?? {}) },
      callCount: row.callCount,
      lastConversationId: row.lastConversationId ?? undefined,
    };
  }

  /**
   * Hydrate Conversation memory from a durable profile.
   * Planner intake already seeds contact from LP — this is optional CRM hydrate.
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
        memory.formSendConsent !== undefined ||
        memory.contactName ||
        memory.contactEmail,
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
    if (memory.contactName && !row.firstName) {
      row.firstName = String(memory.contactName).trim().split(/\s+/)[0];
    }
    if (memory.lastName) row.lastName = memory.lastName;
    if (memory.email) row.email = memory.email;
    if (memory.contactEmail && !row.email) row.email = memory.contactEmail;
    if (memory.contactPhone) row.contactPhone = memory.contactPhone;
    if (memory.selectedAddress) row.address = memory.selectedAddress;
    if (memory.formSendConsent !== undefined) {
      row.formSendConsent = memory.formSendConsent;
    }
    if (memory.phoneConfirmed !== undefined) {
      row.phoneConfirmed = memory.phoneConfirmed;
    }

    row.contexts = {
      ...(row.contexts ?? {}),
      ...this.contextsFromMemory(memory),
    };
    if (conversationId) {
      row.lastConversationId = conversationId;
    }
    if (!memory.callerProfileCountedForSave) {
      row.callCount = (row.callCount ?? 0) + 1;
      memory.callerProfileCountedForSave = true;
    }

    return this.repo.save(row);
  }
}
