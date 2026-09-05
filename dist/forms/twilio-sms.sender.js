"use strict";
/**
 * Optional Twilio REST sender — loads peer package `twilio` only for live sends.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkTwilioSmsSender = exports.DryRunTwilioSmsSender = void 0;
exports.createTwilioSmsSender = createTwilioSmsSender;
const module_1 = require("module");
class DryRunTwilioSmsSender {
    async send(input) {
        return {
            sid: `dryrun_${Date.now()}`,
            dryRun: true,
            to: input.to,
            body: input.body,
        };
    }
}
exports.DryRunTwilioSmsSender = DryRunTwilioSmsSender;
function loadTwilioFactory() {
    try {
        const require = (0, module_1.createRequire)(__filename);
        const mod = require('twilio');
        const factory = typeof mod === 'function'
            ? mod
            : typeof mod === 'object' &&
                mod !== null &&
                typeof mod.default === 'function'
                ? (mod.default)
                : null;
        if (!factory) {
            throw new Error('twilio module did not export a client factory');
        }
        return factory;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Install optional peer dependency "twilio" for live SMS sendout (${message})`);
    }
}
class SdkTwilioSmsSender {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(input) {
        const create = loadTwilioFactory();
        const client = create(this.config.accountSid, this.config.authToken);
        const params = {
            to: input.to,
            body: input.body,
        };
        if (this.config.messagingServiceSid) {
            params.messagingServiceSid = this.config.messagingServiceSid;
        }
        else if (this.config.fromNumber) {
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
exports.SdkTwilioSmsSender = SdkTwilioSmsSender;
function createTwilioSmsSender(config) {
    if (config.dryRun) {
        return new DryRunTwilioSmsSender();
    }
    return new SdkTwilioSmsSender(config);
}
//# sourceMappingURL=twilio-sms.sender.js.map