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
    modules: Record<string, {
        assistantName: string;
        kind?: WorkflowModuleKind;
        flowFile?: string;
        entryNode?: string;
        handoffTo?: string[];
        description?: string;
    }>;
}
export declare class WorkflowLoader {
    private workflow;
    loadFromFile(path: string): WorkflowDefinition;
    loadFromObject(raw: RawWorkflowFile): WorkflowDefinition;
    getWorkflow(): WorkflowDefinition;
    hasWorkflow(): boolean;
    getModule(moduleId: string): WorkflowModuleDefinition;
    resolveAssistantName(moduleId: string): string;
    /** Map Vapi assistantName → module id (first match). */
    findModuleIdByAssistantName(assistantName: string): string | null;
}
export {};
//# sourceMappingURL=workflow-loader.d.ts.map