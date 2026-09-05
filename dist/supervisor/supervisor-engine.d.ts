/**
 * Assembled Supervisor runtime — Nest `Supervisor` is a thin DI facade over this.
 * Methods live in focused modules and bind onto one engine object so cascade ↔
 * route ↔ portal can call each other without circular Nest providers.
 */
import type { SupervisorEngine, SupervisorServices } from './supervisor.types';
export type { SupervisorEngine, SupervisorServices } from './supervisor.types';
export declare function createSupervisorEngine(services: SupervisorServices): SupervisorEngine;
//# sourceMappingURL=supervisor-engine.d.ts.map