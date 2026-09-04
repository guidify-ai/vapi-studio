/**
 * Optional Twilio REST sender — loads peer package `twilio` only for live sends.
 */

import { createRequire } from 'module';
import type { TwilioSmsConfig } from './twilio-sms.env';

export interface TwilioSmsSendInput {
  to: string;
  body: string;
}

export interface TwilioSmsSendResult {
  sid: string;
  dryRun: boolean;
  to: string;
  body: string;
}

export interface TwilioSmsSender {
  send(input: TwilioSmsSendInput): Promise<TwilioSmsSendResult>;
}

export class DryRunTwilioSmsSender implements TwilioSmsSender {
  public async send(input: TwilioSmsSendInput): Promise<TwilioSmsSendResult> {
    return {
      sid: `dryrun_${Date.now()}`,
      dryRun: true,
      to: input.to,
      body: input.body,
    };
  }
}

type TwilioFactory = (
  accountSid: string,
  authToken: string,
) => {
  messages: {
    create(params: Record<string, string>): Promise<{ sid: string }>;
  };
};

function loadTwilioFactory(): TwilioFactory {
  try {
    const require = createRequire(__filename);
    const mod: unknown = require('twilio');
    const factory =
      typeof mod === 'function'
        ? (mod as TwilioFactory)
        : typeof mod === 'object' &&
            mod !== null &&
            typeof (mod as { default?: unknown }).default === 'function'
          ? ((mod as { default: TwilioFactory }).default)
          : null;
    if (!factory) {
      throw new Error('twilio module did not export a client factory');
    }
    return factory;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Install optional peer dependency "twilio" for live SMS sendout (${message})`,
    );
  }
}

export class SdkTwilioSmsSender implements TwilioSmsSender {
  public constructor(private readonly config: TwilioSmsConfig) {}

  public async send(input: TwilioSmsSendInput): Promise<TwilioSmsSendResult> {
    const create = loadTwilioFactory();
    const client = create(this.config.accountSid, this.config.authToken);
    const params: Record<string, string> = {
      to: input.to,
      body: input.body,
    };
    if (this.config.messagingServiceSid) {
      params.messagingServiceSid = this.config.messagingServiceSid;
    } else if (this.config.fromNumber) {
      params.from = this.config.fromNumber;
    }
    const message = await client.messages.create(params);
    return {
      sid: message.sid,
      dryRun: false,
      to: input.to,
      body: input.body,
    };
  }
}

export function createTwilioSmsSender(
  config: TwilioSmsConfig,
): TwilioSmsSender {
  if (config.dryRun) {
    return new DryRunTwilioSmsSender();
  }
  return new SdkTwilioSmsSender(config);
}
