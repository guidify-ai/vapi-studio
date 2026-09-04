/**
 * Assembled Supervisor runtime — Nest `Supervisor` is a thin DI facade over this.
 * Methods live in focused modules and bind onto one engine object so cascade ↔
 * route ↔ portal can call each other without circular Nest providers.
 */
import type { SupervisorEngine, SupervisorServices } from './supervisor.types';

import * as orchestration from './supervisor-orchestration';
import * as limits from './supervisor-limits';
import * as specialTurns from './supervisor-special-turns';
import * as route from './supervisor-route';
import * as portal from './supervisor-portal';
import * as nodeExec from './supervisor-node-exec';
import * as cascade from './supervisor-cascade';

export type { SupervisorEngine, SupervisorServices } from './supervisor.types';

const methodBags = [
  orchestration,
  limits,
  specialTurns,
  route,
  portal,
  nodeExec,
  cascade,
] as const;

export function createSupervisorEngine(
  services: SupervisorServices,
): SupervisorEngine {
  const engine = { ...services } as SupervisorEngine;
  for (const bag of methodBags) {
    for (const [name, fn] of Object.entries(bag)) {
      if (typeof fn !== 'function') continue;
      (engine as unknown as Record<string, unknown>)[name] = (
        fn as (...args: never[]) => unknown
      ).bind(engine);
    }
  }
  return engine;
}
