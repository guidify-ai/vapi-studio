/**
 * Studio Task Queue — work counterpart to CallTurnQueue.
 *
 * Dispatch I/O as wait (block the node turn) or async (return immediately;
 * speech phrase pool still buffers user talk). Dedupe by key while a task is
 * pending/running. Later nodes can `require` a prior async task (postponed debt).
 *
 * The queue is conversation-scoped (stored on SupervisedConversation.metadata)
 * so async work survives node transitions.
 */

import { randomUUID } from 'crypto';
import type { EventService } from '../events/event.service';
import type { SupervisedConversation } from '../conversation/supervised-conversation';

/** Runtime metadata key for the conversation-scoped task queue. */
export const STUDIO_TASK_QUEUE_META = '__studioTaskQueue';

export const STUDIO_TASK_EVENTS = {
  TASK_ENQUEUED: 'TASK_ENQUEUED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',
  TASK_DEDUPED: 'TASK_DEDUPED',
  /** A later node is waiting on a previously dispatched task. */
  TASK_AWAITED: 'TASK_AWAITED',
} as const;

export type StudioTaskMode = 'wait' | 'async';

export type StudioTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface StudioTaskSpec<TResult = unknown> {
  kind: string;
  run: () => Promise<TResult>;
  /**
   * Stable key for dedupe + cross-node `require`.
   * While pending/running, same key returns the existing handle.
   * After complete/fail, `require(key)` still resolves that result until a
   * new dispatch overwrites the key.
   */
  dedupeKey?: string;
  mode?: StudioTaskMode;
  payload?: Record<string, unknown>;
}

export interface StudioTaskHandle<TResult = unknown> {
  taskId: string;
  kind: string;
  dedupeKey?: string;
  mode: StudioTaskMode;
  status: StudioTaskStatus;
  /** Resolves when the task finishes (success or throw). */
  result: Promise<TResult>;
}

export type StudioTaskRequireRef =
  | string
  | { taskId?: string; dedupeKey?: string };

export interface StudioTasksApi {
  dispatch: <TResult = unknown>(
    spec: StudioTaskSpec<TResult>,
  ) => Promise<StudioTaskHandle<TResult>>;
  get: (taskId: string) => StudioTaskHandle | undefined;
  getByKey: (dedupeKey: string) => StudioTaskHandle | undefined;
  /** Await a previously dispatched task by id. */
  await: <TResult = unknown>(taskId: string) => Promise<TResult>;
  /**
   * Dependency / postponed debt: wait for a task started earlier (often async
   * in a previous node). Pass `dedupeKey` and/or `taskId`.
   */
  require: <TResult = unknown>(ref: StudioTaskRequireRef) => Promise<TResult>;
}

type InternalTask = {
  handle: StudioTaskHandle;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export class StudioTaskQueue {
  private readonly byId: Map<string, InternalTask> = new Map();
  /** Latest task id for each dedupe key (kept after complete/fail for require). */
  private readonly byDedupe: Map<string, string> = new Map();

  public constructor(
    private readonly events?: EventService,
    private readonly meta?: {
      conversationId?: string;
      runtimeInstanceId?: string;
      nodeId?: string;
    },
  ) {}

  public api(): StudioTasksApi {
    return {
      dispatch: (spec) => this.dispatch(spec),
      get: (taskId) => this.byId.get(taskId)?.handle,
      getByKey: (dedupeKey) => {
        const id = this.byDedupe.get(dedupeKey.trim());
        return id ? this.byId.get(id)?.handle : undefined;
      },
      await: (taskId) => this.require({ taskId }),
      require: (ref) => this.require(ref),
    };
  }

  public async dispatch<TResult>(
    spec: StudioTaskSpec<TResult>,
  ): Promise<StudioTaskHandle<TResult>> {
    const mode: StudioTaskMode = spec.mode ?? 'wait';
    const dedupeKey = spec.dedupeKey?.trim() || undefined;

    if (dedupeKey) {
      const existingId = this.byDedupe.get(dedupeKey);
      if (existingId) {
        const existing = this.byId.get(existingId);
        if (
          existing &&
          (existing.handle.status === 'pending' ||
            existing.handle.status === 'running')
        ) {
          await this.emit(STUDIO_TASK_EVENTS.TASK_DEDUPED, {
            taskId: existing.handle.taskId,
            kind: existing.handle.kind,
            dedupeKey,
            mode: existing.handle.mode,
            status: existing.handle.status,
          });
          return existing.handle as StudioTaskHandle<TResult>;
        }
      }
    }

    const taskId = randomUUID();
    let resolve!: (value: unknown) => void;
    let reject!: (err: unknown) => void;
    const result = new Promise<TResult>((res, rej) => {
      resolve = (v) => res(v as TResult);
      reject = rej;
    });

    const handle: StudioTaskHandle<TResult> = {
      taskId,
      kind: spec.kind,
      dedupeKey,
      mode,
      status: 'pending',
      result,
    };

    const entry: InternalTask = {
      handle: handle as StudioTaskHandle,
      resolve,
      reject,
    };
    this.byId.set(taskId, entry);
    if (dedupeKey) this.byDedupe.set(dedupeKey, taskId);

    await this.emit(STUDIO_TASK_EVENTS.TASK_ENQUEUED, {
      taskId,
      kind: spec.kind,
      dedupeKey: dedupeKey ?? null,
      mode,
      payload: spec.payload ?? null,
      nodeId: this.meta?.nodeId ?? null,
    });

    const runWork = async () => {
      handle.status = 'running';
      entry.handle.status = 'running';
      const started = Date.now();
      await this.emit(STUDIO_TASK_EVENTS.TASK_STARTED, {
        taskId,
        kind: spec.kind,
        dedupeKey: dedupeKey ?? null,
        mode,
      });
      try {
        const value = await spec.run();
        handle.status = 'completed';
        entry.handle.status = 'completed';
        resolve(value);
        await this.emit(STUDIO_TASK_EVENTS.TASK_COMPLETED, {
          taskId,
          kind: spec.kind,
          dedupeKey: dedupeKey ?? null,
          mode,
          durationMs: Date.now() - started,
        });
        return value;
      } catch (err) {
        handle.status = 'failed';
        entry.handle.status = 'failed';
        const reason = err instanceof Error ? err.message : String(err);
        reject(err);
        await this.emit(STUDIO_TASK_EVENTS.TASK_FAILED, {
          taskId,
          kind: spec.kind,
          dedupeKey: dedupeKey ?? null,
          mode,
          durationMs: Date.now() - started,
          reason,
        });
        throw err;
      }
    };

    if (mode === 'wait') {
      await runWork();
      return handle;
    }

    void runWork().catch(() => undefined);
    return handle;
  }

  public async require<TResult>(ref: StudioTaskRequireRef): Promise<TResult> {
    const taskId =
      typeof ref === 'string'
        ? this.resolveRefToTaskId(ref)
        : this.resolveRefToTaskId(ref.taskId, ref.dedupeKey);
    const entry = this.byId.get(taskId);
    if (!entry) {
      throw new Error(`Unknown studio task (require): ${taskId}`);
    }

    const waiting =
      entry.handle.status === 'pending' || entry.handle.status === 'running';
    if (waiting) {
      await this.emit(STUDIO_TASK_EVENTS.TASK_AWAITED, {
        taskId: entry.handle.taskId,
        kind: entry.handle.kind,
        dedupeKey: entry.handle.dedupeKey ?? null,
        status: entry.handle.status,
        nodeId: this.meta?.nodeId ?? null,
      });
    }

    return entry.handle.result as Promise<TResult>;
  }

  private resolveRefToTaskId(taskId?: string, dedupeKey?: string): string {
    const id = typeof taskId === 'string' ? taskId.trim() : '';
    if (id && this.byId.has(id)) return id;
    const key = typeof dedupeKey === 'string' ? dedupeKey.trim() : '';
    // Plain string ref: treat as dedupeKey first, then taskId.
    if (!key && id) {
      const byKey = this.byDedupe.get(id);
      if (byKey) return byKey;
      if (this.byId.has(id)) return id;
      throw new Error(`Unknown studio task ref: ${id}`);
    }
    if (key) {
      const byKey = this.byDedupe.get(key);
      if (byKey) return byKey;
      throw new Error(`Unknown studio task dedupeKey: ${key}`);
    }
    throw new Error('require() needs taskId or dedupeKey');
  }

  private async emit(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.events || !this.meta?.conversationId) return;
    await this.events.persist(this.meta.conversationId, type, {
      ...payload,
      runtimeInstanceId: this.meta.runtimeInstanceId ?? null,
    });
  }
}

/** Get or create the conversation-scoped queue on the runtime. */
export function studioTaskQueueForRuntime(
  runtime: SupervisedConversation,
  events?: EventService,
): StudioTaskQueue {
  const existing = runtime.metadata[STUDIO_TASK_QUEUE_META];
  if (existing instanceof StudioTaskQueue) {
    return existing;
  }
  const queue = new StudioTaskQueue(events, {
    conversationId: runtime.conversationId,
    runtimeInstanceId: runtime.runtimeInstanceId,
  });
  runtime.metadata[STUDIO_TASK_QUEUE_META] = queue;
  return queue;
}

/** Build a tasks API bound to the conversation-scoped queue. */
export function createStudioTasksApi(input: {
  events?: EventService;
  conversationId?: string;
  runtimeInstanceId?: string;
  nodeId?: string;
  runtime?: SupervisedConversation;
  /** Optional shared queue so async tasks survive across turns. */
  queue?: StudioTaskQueue;
}): StudioTasksApi {
  const queue =
    input.queue ??
    (input.runtime
      ? studioTaskQueueForRuntime(input.runtime, input.events)
      : new StudioTaskQueue(input.events, {
          conversationId: input.conversationId,
          runtimeInstanceId: input.runtimeInstanceId,
          nodeId: input.nodeId,
        }));
  return queue.api();
}
