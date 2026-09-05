"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultConversationEntry = exports.CONVERSATION_ENTRY_POINT = void 0;
exports.CONVERSATION_ENTRY_POINT = Symbol('CONVERSATION_ENTRY_POINT');
class DefaultConversationEntry {
    createVariables() {
        return {};
    }
    async beforeEach(_ctx) {
        // no-op
    }
    async afterEach(_ctx) {
        // no-op
    }
}
exports.DefaultConversationEntry = DefaultConversationEntry;
//# sourceMappingURL=conversation-entry.js.map