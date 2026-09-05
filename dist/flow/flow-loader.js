"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowLoader = exports.CONDITION_GOTO_PREFIX = void 0;
exports.conditionGotoIntention = conditionGotoIntention;
exports.parseConditionGotoNodeId = parseConditionGotoNodeId;
const fs_1 = require("fs");
const common_1 = require("@nestjs/common");
const yaml_1 = require("yaml");
const conversation_history_1 = require("../conversation/conversation-history");
const condition_1 = require("./condition");
/** Synthetic intention → execute a node by id (condition transitions / goto). */
exports.CONDITION_GOTO_PREFIX = 'studio.goto.';
function conditionGotoIntention(nodeId) {
    return `${exports.CONDITION_GOTO_PREFIX}${nodeId}`;
}
function parseConditionGotoNodeId(intention) {
    if (!intention.startsWith(exports.CONDITION_GOTO_PREFIX))
        return null;
    const id = intention.slice(exports.CONDITION_GOTO_PREFIX.length);
    return id.length > 0 ? id : null;
}
let FlowLoader = class FlowLoader {
    flow = null;
    loadFromFile(path) {
        const raw = (0, yaml_1.parse)((0, fs_1.readFileSync)(path, 'utf8'));
        return this.loadFromObject(raw);
    }
    loadFromObject(raw) {
        if (!raw?.flow?.id || !raw?.flow?.start || !raw?.nodes) {
            throw new Error('Invalid flow schema object');
        }
        const nodes = {};
        for (const [id, def] of Object.entries(raw.nodes)) {
            nodes[id] = {
                id,
                class: def.class,
                intentions: def.intentions ?? [],
                portal: def.portal,
                priority: def.priority,
                terminal: def.terminal,
            };
        }
        if (!nodes[raw.flow.start]) {
            throw new Error(`Flow start node "${raw.flow.start}" missing`);
        }
        const transitions = [];
        for (const [index, rawT] of (raw.transitions ?? []).entries()) {
            const id = (rawT.id ?? `transition_${index}`).trim();
            const to = String(rawT.to ?? '').trim();
            if (!to || !nodes[to]) {
                throw new Error(`Flow transition "${id}" targets unknown node "${to}"`);
            }
            const when = String(rawT.when ?? '').trim();
            if (!when) {
                throw new Error(`Flow transition "${id}" is missing when`);
            }
            let test;
            try {
                test = (0, condition_1.compileCondition)(when);
            }
            catch (error) {
                throw new Error(`Flow transition "${id}" has invalid when "${when}": ${error instanceof Error ? error.message : String(error)}`);
            }
            const fromList = rawT.from
                ? (Array.isArray(rawT.from) ? rawT.from : [rawT.from]).map((s) => String(s).trim())
                : undefined;
            if (fromList) {
                for (const fromId of fromList) {
                    if (!nodes[fromId]) {
                        throw new Error(`Flow transition "${id}" from unknown node "${fromId}"`);
                    }
                }
            }
            transitions.push({
                id,
                from: fromList,
                to,
                when,
                force: rawT.force === true,
                priority: rawT.priority,
                reason: rawT.reason,
                test,
            });
        }
        this.flow = {
            version: raw.version ?? 1,
            id: raw.flow.id,
            start: raw.flow.start,
            nodes,
            transitions,
        };
        return this.flow;
    }
    getFlow() {
        if (!this.flow) {
            throw new Error('Flow not loaded');
        }
        return this.flow;
    }
    nodesForIntention(intention) {
        const flow = this.getFlow();
        const gotoId = parseConditionGotoNodeId(intention);
        if (gotoId) {
            const node = flow.nodes[gotoId];
            return node ? [node] : [];
        }
        const matches = Object.values(flow.nodes).filter((n) => n.intentions.includes(intention));
        return matches.sort((a, b) => {
            const pa = a.priority ?? conversation_history_1.DEFAULT_INTENTION_PRIORITY;
            const pb = b.priority ?? conversation_history_1.DEFAULT_INTENTION_PRIORITY;
            if (pb !== pa)
                return pb - pa;
            return a.id.localeCompare(b.id);
        });
    }
    /** All intention names declared on portal nodes. */
    portalIntentionNames() {
        const flow = this.getFlow();
        const names = new Set();
        for (const node of Object.values(flow.nodes)) {
            if (!node.portal)
                continue;
            for (const name of node.intentions) {
                names.add(name);
            }
        }
        return [...names];
    }
    /** All intention names on non-portal nodes. */
    normalIntentionNames() {
        const flow = this.getFlow();
        const names = new Set();
        for (const node of Object.values(flow.nodes)) {
            if (node.portal)
                continue;
            for (const name of node.intentions) {
                names.add(name);
            }
        }
        return [...names];
    }
    /**
     * Condition transitions whose `when` is true for this runtime snapshot.
     * Skips when current node is already `to`, or `from` does not include current.
     */
    matchingConditionTransitions(input, opts) {
        const flow = this.getFlow();
        const current = input.currentNodeId ?? null;
        const ctx = {
            memory: input.memory,
            variables: input.variables,
        };
        const out = [];
        for (const t of flow.transitions) {
            if (opts?.force === true && t.force !== true)
                continue;
            if (opts?.force === false && t.force === true)
                continue;
            if (current === t.to)
                continue;
            if (t.from && t.from.length > 0) {
                if (!current || !t.from.includes(current))
                    continue;
            }
            if (!t.test(ctx))
                continue;
            out.push(t);
        }
        return out;
    }
};
exports.FlowLoader = FlowLoader;
exports.FlowLoader = FlowLoader = __decorate([
    (0, common_1.Injectable)()
], FlowLoader);
//# sourceMappingURL=flow-loader.js.map