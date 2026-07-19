import type { AgentActivityType, AgentStatus, ThreadRuntimeStatus } from './AgentModels';

const activityStatuses: Record<AgentActivityType, AgentStatus> = {
  thinking: 'thinking', planning: 'planning', reading: 'reading', editing: 'editing', testing: 'testing',
  command: 'running-command', tool: 'using-tool', web: 'searching-web', delegating: 'delegating',
  waiting: 'waiting-agent', responding: 'thinking', other: 'thinking'
};

export function activityStatus(type: AgentActivityType): AgentStatus { return activityStatuses[type]; }

export function mapThreadStatus(status: ThreadRuntimeStatus, activeFlags: string[], isRoot: boolean, completedChild = false): AgentStatus {
  if (status === 'systemError') return 'failed';
  if (activeFlags.includes('waitingOnApproval')) return 'waiting-approval';
  if (activeFlags.includes('waitingOnUserInput')) return 'waiting-input';
  if (status === 'active') return 'thinking';
  if (status === 'notLoaded') return isRoot ? 'idle' : completedChild ? 'completed' : 'disconnected';
  if (isRoot) return 'idle';
  return completedChild ? 'completed' : 'idle';
}

export function statusPriority(status: AgentStatus): number {
  if (status === 'failed') return 110;
  if (status === 'waiting-approval') return 100;
  if (status === 'waiting-input') return 90;
  if (status === 'interrupted') return 80;
  if (['planning', 'reading', 'editing', 'testing', 'running-command', 'using-tool', 'searching-web', 'delegating', 'waiting-agent', 'thinking'].includes(status)) return 70;
  if (status === 'completed') return 50;
  if (status === 'idle') return 40;
  if (status === 'disconnected') return 10;
  return 20;
}

export function higherPriority(left: AgentStatus, right: AgentStatus): AgentStatus {
  return statusPriority(left) >= statusPriority(right) ? left : right;
}
