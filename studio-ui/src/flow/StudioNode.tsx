import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { FlowDiagramNodeData } from './types';

function StudioNodeInner({ data }: NodeProps<Node<FlowDiagramNodeData>>) {
  const cls = [
    'rf-node',
    data.kind || 'normal',
    data.isCurrent ? 'current' : '',
    data.isDim ? 'assistant-dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <Handle type="target" position={Position.Left} />
      {data.assistantName ? (
        <div className="rf-node-asst">{data.assistantName}</div>
      ) : null}
      <div className="rf-node-title">{data.label}</div>
      <div className="rf-node-sub">{data.className}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const StudioNode = memo(StudioNodeInner);
