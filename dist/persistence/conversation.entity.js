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
exports.ConversationEntity = void 0;
const typeorm_1 = require("typeorm");
let ConversationEntity = class ConversationEntity {
    id;
    /** Owning project (ingress UUID). */
    projectId;
    provider;
    providerCallId;
    status;
    /**
     * Stable caller key for cross-call resume (phone ANI or Studio cookie).
     * Refreshed on checkpoint/finalize when the channel learns the id late.
     */
    callerId;
    runtimeInstanceId;
    metadata;
    createdAt;
    endedAt;
    /** Bumped on every checkpoint / finalize — drives the resume window. */
    lastActivityAt;
    /**
     * Latest durable SupervisedConversation snapshot while ACTIVE (crash recovery).
     * Updated after each Supervisor turn. Cleared / superseded by finalState on end.
     */
    runtimeState;
    finalState;
};
exports.ConversationEntity = ConversationEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ConversationEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'project_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, default: 'vapi' }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_call_id', type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "providerCallId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'ACTIVE' }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        name: 'caller_id',
        type: 'varchar',
        length: 128,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "callerId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'runtime_instance_id',
        type: 'varchar',
        length: 64,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "runtimeInstanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ConversationEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        name: 'last_activity_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "lastActivityAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'runtime_state', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "runtimeState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'final_state', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "finalState", void 0);
exports.ConversationEntity = ConversationEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'conversations' }),
    (0, typeorm_1.Index)('uq_conversations_project_provider_call', ['projectId', 'providerCallId'], {
        unique: true,
    })
], ConversationEntity);
//# sourceMappingURL=conversation.entity.js.map