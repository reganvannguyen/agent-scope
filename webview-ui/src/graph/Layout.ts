import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

export function layoutAgents(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({})); graph.setGraph({ rankdir: 'TB', nodesep: 45, ranksep: 80 });
  for (const node of nodes) graph.setNode(node.id, { width: 220, height: 100 });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  return nodes.map(node => { const point = graph.node(node.id) as { x: number; y: number } | undefined; return point === undefined ? node : { ...node, position: { x: point.x - 110, y: point.y - 50 } }; });
}
