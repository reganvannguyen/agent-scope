import type { Edge, Node } from '@xyflow/react';
import type { State, Visualization } from '../types';
import { layoutAgents } from './Layout';

export interface AgentNodeData extends Record<string, unknown> { label: string; status: string; activity: string; isRoot: boolean }
export interface ComponentNodeData extends Record<string, unknown> { label: string; componentType: string; activity: string; activeAgents: number }

export function graphElements(state: State, mode: 'combined' | 'agents' | 'project'): { nodes: Node[]; edges: Edge[] } {
  const visualization = state.visualization ?? fallbackVisualization(state);
  const showAgents = mode !== 'project'; const showProject = mode !== 'agents';
  const agentNodes: Node<AgentNodeData>[] = showAgents ? Object.values(visualization.agents).map(agent => ({ id: `agent:${agent.threadId}`, type: 'agent', position: { x: 0, y: 0 }, data: { label: agent.isRoot ? 'Main Agent' : agent.displayName, status: agent.status, activity: agent.currentActivity?.label ?? agent.delegatedTask ?? 'No current activity', isRoot: agent.isRoot }, ariaLabel: `${agent.isRoot ? 'Main Agent' : agent.displayName}, ${agent.status}` })) : [];
  const hierarchy: Edge[] = showAgents ? Object.values(visualization.hierarchyEdges).map(edge => ({ id: edge.id, source: `agent:${edge.parentThreadId}`, target: `agent:${edge.childThreadId}`, type: 'hierarchy', label: 'delegated' })) : [];
  const laidOutAgents = layoutAgents(agentNodes, hierarchy);
  const projectOffset = mode === 'combined' ? 620 : 0;
  const projectNodes: Node<ComponentNodeData>[] = showProject ? (visualization.projectMap?.components ?? []).map(component => { const runtime = visualization.componentRuntime[component.id]; return { id: `component:${component.id}`, type: 'component', position: { x: component.position.x + projectOffset, y: component.position.y }, data: { label: component.name, componentType: component.type, activity: runtime.activeActivityTypes.join(' · ') || 'Idle', activeAgents: runtime.activeAgentIds.length }, ariaLabel: `${component.name}, ${component.type}` }; }) : [];
  const architecture: Edge[] = showProject ? (visualization.projectMap?.edges ?? []).map(edge => ({ id: `architecture:${edge.id}`, source: `component:${edge.source}`, target: `component:${edge.target}`, type: 'architecture', label: edge.label })) : [];
  const activity: Edge[] = mode === 'combined' ? Object.values(visualization.connections).map(edge => ({ id: edge.id, source: `agent:${edge.agentThreadId}`, target: `component:${edge.componentId}`, type: 'activity', label: edge.activityType, data: { confidence: edge.confidence, state: edge.state }, animated: edge.state === 'current' })) : [];
  return { nodes: [...laidOutAgents, ...projectNodes], edges: [...architecture, ...hierarchy, ...activity] };
}

function fallbackVisualization(state: State): Visualization {
  const thread = state.selectedThread;
  return { agents: thread === undefined ? {} : { [thread.id]: { threadId: thread.id, parentThreadId: null, displayName: thread.title, role: null, delegatedTask: null, status: thread.status === 'active' ? 'thinking' : 'idle', currentActivity: null, recentActivities: [], activeSince: null, completedAt: null, error: null, isRoot: true, cwd: thread.cwd, model: thread.model ?? null } }, hierarchyEdges: {}, connections: {}, componentRuntime: {}, demo: false };
}
