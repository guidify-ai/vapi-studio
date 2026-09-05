"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisedConversationRegistry = void 0;
const common_1 = require("@nestjs/common");
let SupervisedConversationRegistry = class SupervisedConversationRegistry {
    byProviderCallId = new Map();
    byConversationId = new Map();
    set(runtime) {
        this.byProviderCallId.set(runtime.providerCallId, runtime);
        this.byConversationId.set(runtime.conversationId, runtime);
    }
    getByProviderCallId(providerCallId) {
        return this.byProviderCallId.get(providerCallId);
    }
    getByConversationId(conversationId) {
        return this.byConversationId.get(conversationId);
    }
    delete(providerCallId) {
        const runtime = this.byProviderCallId.get(providerCallId);
        if (!runtime) {
            return;
        }
        this.byProviderCallId.delete(providerCallId);
        this.byConversationId.delete(runtime.conversationId);
    }
    has(providerCallId) {
        return this.byProviderCallId.has(providerCallId);
    }
    size() {
        return this.byProviderCallId.size;
    }
    /** All live runtimes (crash restore / disaster status). */
    list() {
        return [...this.byProviderCallId.values()];
    }
};
exports.SupervisedConversationRegistry = SupervisedConversationRegistry;
exports.SupervisedConversationRegistry = SupervisedConversationRegistry = __decorate([
    (0, common_1.Injectable)()
], SupervisedConversationRegistry);
//# sourceMappingURL=supervised-conversation.registry.js.map