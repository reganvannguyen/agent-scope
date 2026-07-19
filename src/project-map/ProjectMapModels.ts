export type ProjectComponentType = 'frontend' | 'backend' | 'service' | 'mcp' | 'database' | 'cache' | 'queue' | 'storage' | 'external' | 'tests' | 'shared' | 'infrastructure' | 'other';
export interface ProjectPosition { x: number; y: number }
export interface CommandMatcher { pattern: string }
export interface ToolMatcher { server?: string; serverPattern?: string; toolPattern?: string; appName?: string }
export interface ProjectComponent {
  id: string; name: string; type: ProjectComponentType; description?: string; paths: string[];
  commandMatchers?: CommandMatcher[]; toolMatchers?: ToolMatcher[]; domainMatchers?: string[];
  tags?: string[]; metadata?: Record<string, unknown>; position: ProjectPosition; collapsed?: boolean;
}
export interface ArchitectureEdge { id: string; source: string; target: string; type: string; label?: string }
export interface ProjectMap { schemaVersion: 1; project: { name: string }; components: ProjectComponent[]; edges: ArchitectureEdge[] }
export interface ProjectMapValidation { map?: ProjectMap; errors: string[] }
