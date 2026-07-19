import type { Edge, Node } from '@xyflow/react';
import type { State, Visualization } from '../types';
import { layoutAgents } from './Layout';

export interface AgentNodeData extends Record<string, unknown> { label: string; status: string; activity: string; isRoot: boolean }
export interface ComponentNodeData extends Record<string, unknown> { label: string; componentType: string; activity: string; activeAgents: number }

export function graphElements(state: State): { nodes: Node[]; edges: Edge[] } {
  const visualization = state.visualization ?? fallbackVisualization(state);
  const allAgents = Object.values(visualization.agents);
  const completed = allAgents.filter(agent => !agent.isRoot && agent.status === 'completed');
  const display = state.completedAgentDisplay ?? 'collapse';
  const visibleAgents = display === 'show' ? allAgents : allAgents.filter(agent => agent.isRoot || agent.status !== 'completed');
  const agentNodes: Node<AgentNodeData>[] = visibleAgents.map(agent => ({ id: `agent:${agent.threadId}`, type: 'agent', position: { x: 0, y: 0 }, data: { label: agent.isRoot ? 'Main Agent' : agent.displayName, status: agent.status, activity: agent.currentActivity?.label ?? agent.delegatedTask ?? 'No current activity', isRoot: agent.isRoot }, ariaLabel: `${agent.isRoot ? 'Main Agent' : agent.displayName}, ${agent.status}` }));
  if (display === 'collapse' && completed.length > 0) agentNodes.push({ id: 'agent:completed-summary', type: 'agent', position: { x: 0, y: 0 }, selectable: false, data: { label: `Completed Agents (${String(completed.length)})`, status: 'completed', activity: 'Select Show in settings to inspect all', isRoot: false } });
  const visibleIds = new Set(agentNodes.map(node => node.id));
  const hierarchy: Edge[] = Object.values(visualization.hierarchyEdges).filter(edge => visibleIds.has(`agent:${edge.parentThreadId}`) && visibleIds.has(`agent:${edge.childThreadId}`)).map(edge => ({ id: edge.id, source: `agent:${edge.parentThreadId}`, target: `agent:${edge.childThreadId}`, type: 'hierarchy', label: 'delegated' }));
  if (display === 'collapse' && completed.length > 0) { const root = allAgents.find(agent => agent.isRoot); if (root !== undefined) hierarchy.push({ id: 'hierarchy:completed-summary', source: `agent:${root.threadId}`, target: 'agent:completed-summary', type: 'hierarchy', label: 'completed' }); }
  const laidOutAgents = layoutAgents(agentNodes, hierarchy);
  const projectNodes: Node<ComponentNodeData>[] = (visualization.projectMap?.components ?? []).map(component => {
    const runtime = visualization.componentRuntime[component.id] ?? { activeActivityTypes: [], activeAgentIds: [] };
    return { id: `component:${component.id}`, type: 'component', position: { x: component.position.x + 620, y: component.position.y }, data: { label: component.name, componentType: component.type, activity: runtime.activeActivityTypes.join(' · ') || 'Idle', activeAgents: runtime.activeAgentIds.length }, ariaLabel: `${component.name}, ${component.type}` };
  });
  const architecture: Edge[] = (visualization.projectMap?.edges ?? []).map(edge => ({ id: `architecture:${edge.id}`, source: `component:${edge.source}`, target: `component:${edge.target}`, type: 'architecture', label: edge.label }));
  const activity: Edge[] = Object.values(visualization.connections).map(edge => ({ id: edge.id, source: `agent:${edge.agentThreadId}`, target: `component:${edge.componentId}`, type: 'activity', label: edge.activityType, data: { confidence: edge.confidence, state: edge.state }, animated: edge.state === 'current' }));
  return { nodes: [...laidOutAgents, ...projectNodes], edges: [...architecture, ...hierarchy, ...activity] };
}

function fallbackVisualization(state: State): Visualization {
  const thread = state.selectedThread;
  return { agents: thread === undefined ? {} : { [thread.id]: { threadId: thread.id, parentThreadId: null, displayName: thread.title, role: null, delegatedTask: null, status: thread.status === 'active' ? 'thinking' : 'idle', currentActivity: null, recentActivities: [], activeSince: null, completedAt: null, error: null, isRoot: true, cwd: thread.cwd, model: thread.model ?? null } }, hierarchyEdges: {}, connections: {}, componentRuntime: {}, unmappedActivityCount: 0, demo: false };
}
