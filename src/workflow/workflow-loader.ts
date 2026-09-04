import { readFileSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { parse as parseYaml } from 'yaml';

export type WorkflowModuleKind = 'studio' | 'vapi';

export interface WorkflowModuleDefinition {
  id: string;
  /** Vapi Squad member assistantName (handoff destination). */
  assistantName: string;
  kind: WorkflowModuleKind;
  /** Relative to CONFIG_DIR when kind === 'studio'. */
  flowFile?: string;
  entryNode?: string;
  /** Module ids this member may hand off to (documents Squad handoff rules). */
  handoffTo?: string[];
  description?: string;
}

export interface WorkflowDefinition {
  version: number;
  id: string;
  /** Module that owns the opening greeting. */
  entryModuleId: string;
  modules: Record<string, WorkflowModuleDefinition>;
}

interface RawWorkflowFile {
  version?: number;
  workflow: {
    id: string;
    entryModule: string;
  };
  modules: Record<
    string,
    {
      assistantName: string;
      kind?: WorkflowModuleKind;
      flowFile?: string;
      entryNode?: string;
      handoffTo?: string[];
      description?: string;
    }
  >;
}

@Injectable()
export class WorkflowLoader {
  private workflow: WorkflowDefinition | null = null;

  public loadFromFile(path: string): WorkflowDefinition {
    const raw = parseYaml(readFileSync(path, 'utf8')) as RawWorkflowFile;
    return this.loadFromObject(raw);
  }

  public loadFromObject(raw: RawWorkflowFile): WorkflowDefinition {
    if (!raw?.workflow?.id || !raw?.workflow?.entryModule || !raw?.modules) {
      throw new Error('Invalid workflow schema object');
    }
    const modules: Record<string, WorkflowModuleDefinition> = {};
    for (const [id, def] of Object.entries(raw.modules)) {
      const rawKind = (def.kind ?? (def.flowFile ? 'studio' : 'vapi')) as string;
      const kind: WorkflowModuleKind =
        rawKind === 'studio' ? 'studio' : 'vapi';
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
      throw new Error(
        `Workflow entryModule "${raw.workflow.entryModule}" missing`,
      );
    }
    this.workflow = {
      version: raw.version ?? 1,
      id: raw.workflow.id,
      entryModuleId: raw.workflow.entryModule,
      modules,
    };
    return this.workflow;
  }

  public getWorkflow(): WorkflowDefinition {
    if (!this.workflow) {
      throw new Error('Workflow not loaded');
    }
    return this.workflow;
  }

  public hasWorkflow(): boolean {
    return this.workflow !== null;
  }

  public getModule(moduleId: string): WorkflowModuleDefinition {
    const wf = this.getWorkflow();
    const mod = wf.modules[moduleId];
    if (!mod) {
      throw new Error(`Unknown workflow module "${moduleId}"`);
    }
    return mod;
  }

  public resolveAssistantName(moduleId: string): string {
    return this.getModule(moduleId).assistantName;
  }

  /** Map Vapi assistantName → module id (first match). */
  public findModuleIdByAssistantName(assistantName: string): string | null {
    if (!this.workflow) return null;
    const needle = assistantName.trim();
    for (const mod of Object.values(this.workflow.modules)) {
      if (mod.assistantName === needle) return mod.id;
    }
    return null;
  }
}
