"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferedConversationOutput = void 0;
class BufferedConversationOutput {
    actions = [];
    onSay;
    constructor(onSay) {
        this.onSay = onSay;
    }
    async say(text) {
        this.actions.push({ kind: 'say', text });
        if (this.onSay) {
            await this.onSay(text);
        }
    }
    async sayAndListen(text, options) {
        const action = {
            kind: 'sayAndListen',
            text,
            sayAndListen: options,
        };
        this.actions.push(action);
        if (this.onSay) {
            await this.onSay(text);
        }
        return action;
    }
    async endCall(text) {
        const action = { kind: 'endCall', text };
        this.actions.push(action);
        if (text && this.onSay) {
            await this.onSay(text);
        }
        return action;
    }
    async transferToHuman(destination) {
        const action = { kind: 'transferToHuman', destination };
        this.actions.push(action);
        return action;
    }
    async handoff(input) {
        const to = input.to.trim();
        if (!to) {
            throw new Error('handoff.to is required (workflow module id)');
        }
        const action = {
            kind: 'handoff',
            text: input.text,
            handoffTo: to,
            handoffReason: input.reason,
            handoffPayload: input.payload,
        };
        this.actions.push(action);
        if (input.text && this.onSay) {
            await this.onSay(input.text);
        }
        return action;
    }
    async continueTo(input) {
        const nodeId = input.nodeId.trim();
        if (!nodeId) {
            throw new Error('continueTo.nodeId is required');
        }
        const action = {
            kind: 'continueTo',
            text: input.text,
            continueToNodeId: nodeId,
            handoffReason: input.reason,
        };
        this.actions.push(action);
        if (input.text && this.onSay) {
            await this.onSay(input.text);
        }
        return action;
    }
    async invokeAdvertisedTool(input) {
        const name = input.name?.trim();
        if (!name) {
            throw new Error('invokeAdvertisedTool.name is required (Vapi assistant tool function name)');
        }
        const action = {
            kind: 'toolCall',
            text: input.text,
            toolCall: {
                name,
                arguments: input.arguments ?? {},
            },
        };
        this.actions.push(action);
        if (input.text && this.onSay) {
            await this.onSay(input.text);
        }
        return action;
    }
    async toolCall(input) {
        return this.invokeAdvertisedTool(input);
    }
}
exports.BufferedConversationOutput = BufferedConversationOutput;
//# sourceMappingURL=conversation-output.js.map