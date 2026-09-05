"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowLoader = void 0;
const fs_1 = require("fs");
const common_1 = require("@nestjs/common");
const yaml_1 = require("yaml");
let WorkflowLoader = class WorkflowLoader {
    workflow = null;
    loadFromFile(path) {
        const raw = (0, yaml_1.parse)((0, fs_1.readFileSync)(path, 'utf8'));
        return this.loadFromObject(raw);
    }
    loadFromObject(raw) {
        if (!raw?.workflow?.id || !raw?.workflow?.entryModule || !raw?.modules) {
            throw new Error('Invalid workflow schema object');
        }
        const modules = {};
        for (const [id, def] of Object.entries(raw.modules)) {
            const rawKind = (def.kind ?? (def.flowFile ? 'studio' : 'vapi'));
            const kind = rawKind === 'studio' ? 'studio' : 'vapi';
            if (kind === 'studio' && !def.flowFile) {
                throw new Error(`Workflow module "${id}" kind=studio requires flowFile`);
            }
            modules[id] = {
                id,
                assistantName: def.assistantName,
                kind,
                flowFile: def.flowFile,
                entryNode: def.entryNode,
                handoffTo: def.handoffTo,
                description: def.description,
            };
        }
        if (!modules[raw.workflow.entryModule]) {
            throw new Error(`Workflow entryModule "${raw.workflow.entryModule}" missing`);
        }
        this.workflow = {
            version: raw.version ?? 1,
            id: raw.workflow.id,
            entryModuleId: raw.workflow.entryModule,
            modules,
        };
        return this.workflow;
    }
    getWorkflow() {
        if (!this.workflow) {
            throw new Error('Workflow not loaded');
        }
        return this.workflow;
    }
    hasWorkflow() {
        return this.workflow !== null;
    }
    getModule(moduleId) {
        const wf = this.getWorkflow();
        const mod = wf.modules[moduleId];
        if (!mod) {
            throw new Error(`Unknown workflow module "${moduleId}"`);
        }
        return mod;
    }
    resolveAssistantName(moduleId) {
        return this.getModule(moduleId).assistantName;
    }
    /** Map Vapi assistantName → module id (first match). */
    findModuleIdByAssistantName(assistantName) {
        if (!this.workflow)
            return null;
        const needle = assistantName.trim();
        for (const mod of Object.values(this.workflow.modules)) {
            if (mod.assistantName === needle)
                return mod.id;
        }
        return null;
    }
};
exports.WorkflowLoader = WorkflowLoader;
exports.WorkflowLoader = WorkflowLoader = __decorate([
    (0, common_1.Injectable)()
], WorkflowLoader);
//# sourceMappingURL=workflow-loader.js.map