import { useEffect, useState } from 'react';
import type { ArchitectureEdge, ProjectComponent, State } from '../../types';
import { post } from '../../vscode';

const componentTypes = ['frontend', 'backend', 'service', 'mcp', 'database', 'cache', 'queue', 'storage', 'external', 'tests', 'shared', 'infrastructure', 'other'];
const noSuggestions: NonNullable<State['projectSuggestions']> = [];
interface DraftComponent extends ProjectComponent { accepted: boolean; evidence: string[]; confidence: string }
interface DraftEdge extends ArchitectureEdge { confidence?: string; evidence?: string[] }

export function ProjectMapSetup({ state }: { state: State }): React.JSX.Element {
  const suggestions = state.projectSuggestions ?? noSuggestions;
  const existing = state.visualization?.projectMap;
  const [components, setComponents] = useState<DraftComponent[]>([]);
  const [edges, setEdges] = useState<DraftEdge[]>([]);
  const sourceKey = JSON.stringify({ suggestions, edgeSuggestions: state.projectEdgeSuggestions ?? [], existing });

  useEffect(() => {
    const source = JSON.parse(sourceKey) as { suggestions: NonNullable<State['projectSuggestions']>; edgeSuggestions: NonNullable<State['projectEdgeSuggestions']>; existing?: NonNullable<State['visualization']>['projectMap'] };
    const values = source.suggestions.length > 0
      ? source.suggestions.map((item, index) => ({ ...item, accepted: true, position: { x: 120 + (index % 3) * 280, y: 100 + Math.floor(index / 3) * 180 } }))
      : (source.existing?.components ?? []).map(item => ({ ...item, accepted: true, evidence: [], confidence: 'configured' }));
    setComponents(values);
    setEdges(source.suggestions.length > 0 ? source.edgeSuggestions : (source.existing?.edges ?? []));
  }, [sourceKey]);

  const update = (index: number, patch: Partial<DraftComponent>): void => setComponents(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, ...patch } : value));
  const accepted = components.filter(item => item.accepted);
  const save = (): void => post({ type: 'saveProjectMap', map: { schemaVersion: 1, project: { name: existing?.project.name ?? 'Project' }, components: accepted.map(persistedComponent), edges: edges.filter(edge => accepted.some(item => item.id === edge.source) && accepted.some(item => item.id === edge.target)).map(persistedEdge) } });

  return <section className="map-setup" aria-label="Project map setup">
    <header><div><h2>Review project architecture</h2><p>Components and connections are heuristic. Confirm and edit them before saving.</p></div><button onClick={() => post({ type: 'scanProjectMap' })}>Suggest Components &amp; Connections</button></header>
    <div className="suggestions">{components.map((component, index) => <article className="suggestion" key={`${component.id}:${String(index)}`}><label><input type="checkbox" checked={component.accepted} onChange={event => update(index, { accepted: event.target.checked })} /> Include</label><label>Name<input value={component.name} onChange={event => update(index, { name: event.target.value })} /></label><label>Type<select value={component.type} onChange={event => update(index, { type: event.target.value })}>{componentTypes.map(type => <option value={type} key={type}>{type}</option>)}</select></label><label>Paths<textarea value={component.paths.join('\n')} onChange={event => update(index, { paths: event.target.value.split(/\r?\n/u).filter(Boolean) })} /></label><small>{component.confidence} confidence</small>{component.evidence.map(value => <small key={value}>• {value}</small>)}</article>)}</div>
    <div className="map-editor-actions"><button onClick={() => setComponents(values => [...values, { id: `component-${String(values.length + 1)}`, name: 'New Component', type: 'other', paths: [], position: { x: 120 + values.length * 40, y: 120 + values.length * 30 }, accepted: true, evidence: [], confidence: 'manual' }])}>Add Component</button><button disabled={accepted.length < 2} onClick={() => { const source = accepted[0]; const target = accepted[1]; setEdges(values => [...values, { id: `${source.id}-${target.id}-${String(values.length + 1)}`, source: source.id, target: target.id, type: 'request' }]); }}>Add Edge</button><button onClick={save}>Confirm and Save</button></div>
    {edges.map((edge, index) => <div className="edge-editor" key={edge.id}><select value={edge.source} onChange={event => setEdges(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, source: event.target.value } : value))}>{accepted.map(item => <option key={item.id}>{item.id}</option>)}</select><span>→</span><select value={edge.target} onChange={event => setEdges(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, target: event.target.value } : value))}>{accepted.map(item => <option key={item.id}>{item.id}</option>)}</select><input aria-label="Edge label" placeholder="Label" value={edge.label ?? ''} onChange={event => setEdges(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, label: event.target.value } : value))} />{edge.confidence ? <small title={edge.evidence?.join('\n')}>{edge.confidence} suggestion</small> : null}<button onClick={() => setEdges(values => values.filter((_, itemIndex) => itemIndex !== index))}>Delete</button></div>)}
  </section>;
}

function persistedComponent(value: DraftComponent): ProjectComponent { return { id: value.id, name: value.name, type: value.type, paths: value.paths, position: value.position, ...(value.description === undefined ? {} : { description: value.description }) }; }
function persistedEdge(value: DraftEdge): ArchitectureEdge { return { id: value.id, source: value.source, target: value.target, type: value.type, ...(value.label === undefined ? {} : { label: value.label }) }; }
