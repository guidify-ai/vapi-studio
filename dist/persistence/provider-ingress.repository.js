"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderIngressRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const provider_ingress_entity_1 = require("./provider-ingress.entity");
const REDACT_HEADER_KEYS = new Set([
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
]);
function sanitizeHeaders(headers) {
    const out = {};
    if (!headers) {
        return out;
    }
    for (const [key, value] of Object.entries(headers)) {
        if (REDACT_HEADER_KEYS.has(key.toLowerCase())) {
            out[key] = '[REDACTED]';
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
let ProviderIngressRepository = class ProviderIngressRepository {
    rows;
    constructor(rows) {
        this.rows = rows;
    }
    async record(input) {
        const row = this.rows.create({
            projectId: input.projectId ?? null,
            channel: input.channel ?? 'vapi',
            kind: input.kind,
            providerCallId: input.providerCallId ?? null,
            messageType: input.messageType ?? null,
            method: input.method ?? 'POST',
            path: input.path,
            headers: sanitizeHeaders(input.headers),
            body: input.body ?? {},
            responseStatus: input.responseStatus ?? null,
            responseBody: input.responseBody ?? null,
        });
        return this.rows.save(row);
    }
    async setResponse(id, responseStatus, responseBody) {
        await this.rows.update({ id }, {
            responseStatus,
            responseBody: (responseBody ?? null),
        });
    }
};
exports.ProviderIngressRepository = ProviderIngressRepository;
exports.ProviderIngressRepository = ProviderIngressRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(provider_ingress_entity_1.ProviderIngressEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProviderIngressRepository);
//# sourceMappingURL=provider-ingress.repository.js.map