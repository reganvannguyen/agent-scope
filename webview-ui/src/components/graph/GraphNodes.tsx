import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AgentNodeData, ComponentNodeData } from '../../graph/GraphModels';

export function AgentNode({ data, selected }: NodeProps): React.JSX.Element {
  const value = data as AgentNodeData;
  return <div className={`graph-node agent-node ${value.isRoot ? 'root-agent' : ''} ${selected ? 'selected' : ''}`} tabIndex={0} role="button" aria-label={`${value.label}, ${value.status}`}><Handle type="target" position={Position.Top} /><div className="node-kind">{value.isRoot ? '★ Main Agent' : 'Agent'}</div><strong>{value.label}</strong><span className={`node-status status-${value.status}`}>{value.status}</span><small>{value.activity}</small><Handle type="source" position={Position.Bottom} /></div>;
}
export function ComponentNode({ data, selected }: NodeProps): React.JSX.Element {
  const value = data as ComponentNodeData;
  return <div className={`graph-node component-node type-${value.componentType} ${selected ? 'selected' : ''}`} tabIndex={0} role="button" aria-label={`${value.label}, ${value.componentType}`}><Handle type="target" position={Position.Left} /><div className="node-kind">{icon(value.componentType)} {value.componentType}</div><strong>{value.label}</strong><span>{value.activity}</span><small>{value.activeAgents === 0 ? 'No active agents' : `${String(value.activeAgents)} agent(s) active`}</small><Handle type="source" position={Position.Right} /></div>;
}
function icon(type: string): string { return type === 'database' ? '▱' : type === 'cache' ? '▤' : type === 'external' ? '◎' : type === 'tests' ? '✓' : type === 'infrastructure' ? '◇' : '▣'; }
