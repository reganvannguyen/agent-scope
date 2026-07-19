import { Background, Controls, MarkerType, MiniMap, ReactFlow, type EdgeTypes, type NodeMouseHandler, type NodeTypes } from '@xyflow/react';
import { useMemo } from 'react';
import type { State } from '../../types';
import { graphElements } from '../../graph/GraphModels';
import { post } from '../../vscode';
import { ActivityEdge, ArchitectureEdge, HierarchyEdge } from './GraphEdges';
import { GraphLegend } from './GraphLegend';
import { AgentNode, ComponentNode } from './GraphNodes';

const nodeTypes: NodeTypes = { agent: AgentNode, component: ComponentNode };
const edgeTypes: EdgeTypes = { architecture: ArchitectureEdge, hierarchy: HierarchyEdge, activity: ActivityEdge };

export function GraphCanvas({ state, mode }: { state: State; mode: 'combined' | 'agents' | 'project' }): React.JSX.Element {
  const elements = useMemo(() => graphElements(state, mode), [state, mode]);
  const edges = elements.edges.map(edge => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed } }));
  const select: NodeMouseHandler = (_event, node) => { const [kind, ...id] = node.id.split(':'); if ((kind === 'agent' || kind === 'component') && id.length > 0) post({ type: 'selectGraphEntity', kind, id: id.join(':') }); };
  return <div className="graph-canvas" aria-label={`${mode} visualization`}><ReactFlow nodes={elements.nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={select} fitView nodesDraggable={mode !== 'agents'} minZoom={0.2} maxZoom={2}><Background /><Controls /><MiniMap pannable zoomable /><GraphLegend /></ReactFlow></div>;
}
