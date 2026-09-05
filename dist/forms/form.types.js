"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormChannelUnavailableError = exports.FormFilloutTimeoutError = exports.FormDeliverTimeoutError = void 0;
class FormDeliverTimeoutError extends Error {
    exposeId;
    conversationId;
    code = 'FORM_DELIVER_TIMEOUT';
    constructor(exposeId, conversationId) {
        super(`Form expose ${exposeId} was not acknowledged within the delivery window`);
        this.exposeId = exposeId;
        this.conversationId = conversationId;
        this.name = 'FormDeliverTimeoutError';
    }
}
exports.FormDeliverTimeoutError = FormDeliverTimeoutError;
class FormFilloutTimeoutError extends Error {
    exposeId;
    conversationId;
    code = 'FORM_FILLOUT_TIMEOUT';
    constructor(exposeId, conversationId) {
        super(`Form expose ${exposeId} fillout timed out`);
        this.exposeId = exposeId;
        this.conversationId = conversationId;
        this.name = 'FormFilloutTimeoutError';
    }
}
exports.FormFilloutTimeoutError = FormFilloutTimeoutError;
class FormChannelUnavailableError extends Error {
    code = 'FORM_CHANNEL_UNAVAILABLE';
    constructor(message = 'No form dispose adapter can deliver on this channel') {
        super(message);
        this.name = 'FormChannelUnavailableError';
    }
}
exports.FormChannelUnavailableError = FormChannelUnavailableError;
//# sourceMappingURL=form.types.js.map