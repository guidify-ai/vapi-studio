"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopFormDisposeAdapter = void 0;
const common_1 = require("@nestjs/common");
/**
 * Default dispose — phone / unknown channels cannot show a Studio modal.
 * FormsService treats dispose failure / missing ACK as deliver timeout so
 * Nodes can fall back to voice collection.
 */
let NoopFormDisposeAdapter = class NoopFormDisposeAdapter {
    id = 'noop';
    branch = 'unavailable';
    async dispose(_payload) {
        // Intentionally no-op: nothing to show; ACK will never arrive.
    }
};
exports.NoopFormDisposeAdapter = NoopFormDisposeAdapter;
exports.NoopFormDisposeAdapter = NoopFormDisposeAdapter = __decorate([
    (0, common_1.Injectable)()
], NoopFormDisposeAdapter);
//# sourceMappingURL=noop-form-dispose.adapter.js.map