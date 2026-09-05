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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderIngressEntity = void 0;
const typeorm_1 = require("typeorm");
let ProviderIngressEntity = class ProviderIngressEntity {
    id;
    /** Owning project (ingress UUID); null for legacy/unscoped writes. */
    projectId;
    channel;
    /** webhook | custom-llm */
    kind;
    providerCallId;
    messageType;
    method;
    path;
    headers;
    body;
    responseStatus;
    responseBody;
    createdAt;
};
exports.ProviderIngressEntity = ProviderIngressEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProviderIngressEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'project_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'vapi' }),
    __metadata("design:type", String)
], ProviderIngressEntity.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], ProviderIngressEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'provider_call_id', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "providerCallId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'message_type', type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "messageType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'POST' }),
    __metadata("design:type", String)
], ProviderIngressEntity.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 256 }),
    __metadata("design:type", String)
], ProviderIngressEntity.prototype, "path", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "headers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_status', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "responseStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_body', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ProviderIngressEntity.prototype, "responseBody", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProviderIngressEntity.prototype, "createdAt", void 0);
exports.ProviderIngressEntity = ProviderIngressEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'provider_ingress' })
], ProviderIngressEntity);
//# sourceMappingURL=provider-ingress.entity.js.map