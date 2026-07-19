import { Background, Controls, MarkerType, ReactFlow, useNodesState, type EdgeTypes, type Node, type NodeMouseHandler, type NodeTypes } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { State } from '../../types';
import { graphElements } from '../../graph/GraphModels';
import { post } from '../../vscode';
import { GraphDetailsPanel } from '../details/GraphDetailsPanel';
import { ActivityEdge, ArchitectureEdge, HierarchyEdge } from './GraphEdges';
import { GraphLegend } from './GraphLegend';
import { AgentNode, ComponentNode } from './GraphNodes';

const nodeTypes: NodeTypes = { agent: AgentNode, component: ComponentNode };
const edgeTypes: EdgeTypes = { architecture: ArchitectureEdge, hierarchy: HierarchyEdge, activity: ActivityEdge };

export function GraphCanvas({ state }: { state: State; mode: 'combined' | 'agents' | 'project' }): React.JSX.Element {
  const elements = useMemo(() => graphElements(state), [state]);
  const [nodes, setNodes, onNodesChange] = useNodesState(elements.nodes);
  const [anchor, setAnchor] = useState<{ left: number; top: number }>();
  const canvas = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const edges = elements.edges.map(edge => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed } }));

  useEffect(() => {
    setNodes(current => reconcileNodes(current, elements.nodes));
  }, [elements.nodes, setNodes]);

  useEffect(() => {
    const dismiss = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element) || popup.current?.contains(target) === true || target.closest('.react-flow__node') !== null) return;
      setAnchor(undefined); post({ type: 'clearGraphSelection' });
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  const select: NodeMouseHandler = (event, node) => {
    const [kind, ...id] = node.id.split(':');
    if ((kind !== 'agent' && kind !== 'component') || id.length === 0) return;
    const bounds = canvas.current?.getBoundingClientRect();
    if (bounds !== undefined) setAnchor({ left: Math.min(event.clientX - bounds.left + 14, Math.max(12, bounds.width - 334)), top: Math.min(event.clientY - bounds.top + 14, Math.max(12, bounds.height - 280)) });
    post({ type: 'selectGraphEntity', kind, id: id.join(':') });
  };

  return <div ref={canvas} className="graph-canvas" aria-label="Agents and project visualization"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onNodeClick={select} fitView nodesDraggable minZoom={0.2} maxZoom={2}><Background /><Controls /><GraphLegend /></ReactFlow>{anchor !== undefined && state.selectedGraphEntity !== undefined ? <div ref={popup} className="node-popup-anchor" style={anchor}><GraphDetailsPanel state={state} /></div> : null}</div>;
}

function reconcileNodes(current: Node[], incoming: Node[]): Node[] {
  const positions = new Map(current.map(node => [node.id, node.position]));
  return incoming.map(node => ({ ...node, position: positions.get(node.id) ?? node.position }));
}
