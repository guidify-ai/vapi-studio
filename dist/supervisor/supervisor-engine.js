"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupervisorEngine = createSupervisorEngine;
const orchestration = __importStar(require("./supervisor-orchestration"));
const limits = __importStar(require("./supervisor-limits"));
const specialTurns = __importStar(require("./supervisor-special-turns"));
const route = __importStar(require("./supervisor-route"));
const portal = __importStar(require("./supervisor-portal"));
const nodeExec = __importStar(require("./supervisor-node-exec"));
const cascade = __importStar(require("./supervisor-cascade"));
const methodBags = [
    orchestration,
    limits,
    specialTurns,
    route,
    portal,
    nodeExec,
    cascade,
];
function createSupervisorEngine(services) {
    const engine = { ...services };
    for (const bag of methodBags) {
        for (const [name, fn] of Object.entries(bag)) {
            if (typeof fn !== 'function')
                continue;
            engine[name] = fn.bind(engine);
        }
    }
    return engine;
}
//# sourceMappingURL=supervisor-engine.js.map