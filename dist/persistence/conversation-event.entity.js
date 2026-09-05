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
exports.ConversationEventEntity = void 0;
const typeorm_1 = require("typeorm");
let ConversationEventEntity = class ConversationEventEntity {
    id;
    conversationId;
    type;
    payload;
    createdAt;
};
exports.ConversationEventEntity = ConversationEventEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ConversationEventEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'conversation_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConversationEventEntity.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], ConversationEventEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], ConversationEventEntity.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ConversationEventEntity.prototype, "createdAt", void 0);
exports.ConversationEventEntity = ConversationEventEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'conversation_events' })
], ConversationEventEntity);
//# sourceMappingURL=conversation-event.entity.js.map