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
exports.ProjectRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const project_entity_1 = require("./project.entity");
let ProjectRepository = class ProjectRepository {
    projects;
    constructor(projects) {
        this.projects = projects;
    }
    findById(id) {
        return this.projects.findOne({ where: { id } });
    }
    findBySlug(slug) {
        return this.projects.findOne({ where: { slug } });
    }
    /**
     * Idempotent seed for local/dev — always the same UUID so Vapi URLs stay stable.
     */
    async upsert(input) {
        const existing = await this.findById(input.id);
        if (existing) {
            let dirty = false;
            if (existing.slug !== input.slug) {
                existing.slug = input.slug;
                dirty = true;
            }
            if (existing.name !== input.name) {
                existing.name = input.name;
                dirty = true;
            }
            if (dirty) {
                return this.projects.save(existing);
            }
            return existing;
        }
        const bySlug = await this.findBySlug(input.slug);
        if (bySlug && bySlug.id !== input.id) {
            throw new Error(`Project slug "${input.slug}" already registered as ${bySlug.id}; cannot upsert ${input.id}`);
        }
        const row = this.projects.create({
            id: input.id,
            slug: input.slug,
            name: input.name,
        });
        return this.projects.save(row);
    }
};
exports.ProjectRepository = ProjectRepository;
exports.ProjectRepository = ProjectRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProjectRepository);
//# sourceMappingURL=project.repository.js.map