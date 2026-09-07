export type FlowDiagramNodeData = {
  label: string;
  className: string;
  intentions: string;
  kind: string;
  lane: string;
  moduleId?: string;
  assistantName?: string;
  realNodeId?: string;
  isCurrent?: boolean;
  isDim?: boolean;
};

export type FlowDiagramGraph = {
  flowId: string;
  start: string;
  entryModuleId: string;
  workflowId: string;
  assistants: Array<{
    moduleId: string;
    assistantName: string;
    description?: string;
    handoffTo: string[];
  }>;
  lanes: Array<{ id: string; label: string; moduleId?: string }>;
  nodes: Array<{
    id: string;
    type?: string;
    data: FlowDiagramNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    animated?: boolean;
    lane?: string;
    style?: Record<string, string | number>;
  }>;
};

export type StudioTurnView = {
  conversationId: string;
  providerCallId: string;
  status: string;
  currentNodeId: string | null;
  normalFlowNodeId: string | null;
  workflowId?: string | null;
  activeModuleId?: string | null;
  selectedNodeId?: string;
  say: string[];
  actions: Array<{ kind: string; text?: string; toolCall?: { name: string } }>;
  memory: Record<string, unknown>;
  variables: Record<string, unknown>;
  formExpose?: FormExposeHandle | null;
  ended?: boolean;
  diagramHighlightNodeId?: string | null;
};

export type FormFieldSpec = {
  name: string;
  label: string;
  type: 'string' | 'email' | 'tel' | 'textarea';
  required?: boolean;
  placeholder?: string;
};

export type FormExposeHandle = {
  exposeId: string;
  formId: number;
  conversationId: string;
  fields: FormFieldSpec[];
  createdAt: string;
};

export type StudioPresetsCatalog = {
  afterHours: { id: string; label: string; description: string };
  abTests: Array<{
    id: string;
    label: string;
    variants: Array<'A' | 'B'>;
    description: string;
  }>;
  featureFlags: Array<{
    id: string;
    label: string;
    description: string;
    defaultEnabled: boolean;
  }>;
};
