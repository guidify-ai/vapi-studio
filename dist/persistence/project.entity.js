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
exports.ProjectEntity = void 0;
const typeorm_1 = require("typeorm");
/**
 * Durable project identity — public ingress UUID for Vapi URLs
 * (`/{projectUuid}/vapi/...`). Apps seed a stable id for local/dev.
 */
let ProjectEntity = class ProjectEntity {
    /** Public ingress UUID (path segment). */
    id;
    slug;
    name;
    createdAt;
};
exports.ProjectEntity = ProjectEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'uuid' }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProjectEntity.prototype, "createdAt", void 0);
exports.ProjectEntity = ProjectEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'projects' })
], ProjectEntity);
//# sourceMappingURL=project.entity.js.map