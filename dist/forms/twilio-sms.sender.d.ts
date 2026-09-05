/**
 * Optional Twilio REST sender — loads peer package `twilio` only for live sends.
 */
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
export declare class DryRunTwilioSmsSender implements TwilioSmsSender {
    send(input: TwilioSmsSendInput): Promise<TwilioSmsSendResult>;
}
export declare class SdkTwilioSmsSender implements TwilioSmsSender {
    private readonly config;
    constructor(config: TwilioSmsConfig);
    send(input: TwilioSmsSendInput): Promise<TwilioSmsSendResult>;
}
export declare function createTwilioSmsSender(config: TwilioSmsConfig): TwilioSmsSender;
//# sourceMappingURL=twilio-sms.sender.d.ts.map