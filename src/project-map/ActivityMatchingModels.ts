export type MatchConfidence = 'confirmed' | 'inferred';
export type ProjectActivityType = 'reading' | 'editing' | 'testing' | 'running-command' | 'using-tool' | 'calling-api' | 'waiting' | 'other';
export type MatchingEvidence =
  | { type: 'file-change'; path: string }
  | { type: 'command-cwd'; cwd: string }
  | { type: 'command-path'; path: string }
  | { type: 'tool-call'; server: string | null; tool: string }
  | { type: 'network-target'; host: string; protocol: string | null }
  | { type: 'configured-command-matcher'; matcher: string };
export interface ComponentMatch { componentId: string; confidence: MatchConfidence; activityType: ProjectActivityType; primary: boolean; evidence: MatchingEvidence[] }
