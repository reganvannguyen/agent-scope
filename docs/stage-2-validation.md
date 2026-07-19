# Stage 2 validation report

## Baseline and implementation

Before Stage 2, the extension already owned a Codex App Server process and provided account sign-in, thread selection and grouping, streaming root-agent chat, model and collaboration controls, approvals, cancellation, persistence, and a resizable Stage 1 workspace. The baseline is recorded in `stage-2-baseline.md`.

Stage 2 adds four synchronized views: Combined, Agents, Project, and Chat. The extension host remains authoritative and routes each App Server event once into separate conversation, runtime-agent, and project-activity reducers. The webview receives bounded snapshots and renders custom React Flow nodes and edges using Dagre for the runtime hierarchy while preserving saved project positions.

Subagents are created immediately from collaboration items and reconciled through paginated descendant discovery. Missing parents are represented safely as orphans until metadata arrives. Status is derived from authoritative thread state and item lifecycle events; activity is a separate, bounded summary of commands, files, tools, apps, approvals, and failures.

Project maps use schema version 1 and are stored at `.codex-agent-map/project-map.json` by default. Input is validated before use, writes are atomic, invalid external edits retain the last valid map, and the scanner only proposes components from local manifests and well-known directories. Suggestions require review before saving.

Confirmed activity has direct evidence such as a changed file, explicit tool/app identity, or external host. Inferred activity uses evidence such as a command working directory, command text, test target, or configured pattern and is labelled and drawn differently. Active connections become bounded recent trails after completion and expire after the configured duration.

Important additions are under `src/agents`, `src/project-map`, `src/visualization`, `webview-ui/src/components/graph`, `webview-ui/src/components/project-map`, and `webview-ui/src/graph`. The schema is `schemas/project-map.schema.json`. New runtime dependencies are `@xyflow/react`, `@dagrejs/dagre`, and `minimatch`.

## Validation performed

On July 19, 2026, the following commands completed successfully:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm audit --audit-level=moderate`
- `npm pack --dry-run`
- `git diff --check`

Results: 24 test files and 98 tests passed; both TypeScript projects type-checked; ESLint completed with zero warnings; Vite transformed 260 modules and produced the split webview bundle; npm reported zero vulnerabilities; and the package dry-run completed.

An Extension Development Host was launched with VS Code 1.129.1 using the repository's extension-development path, and the host processes remained running. Interactive clicking inside the Codex extension was not automated because the applicable computer-control safety policy prohibits automating Codex extensions. Earlier Phase 1 validation also initialized the installed Codex App Server and exercised account/read, thread/list, and protocol-generation smoke paths.

## Usage

Initialize a map with **Codex Agent Map: Initialize Project Map**, review scanner suggestions or create components manually, then choose **Confirm and Save**. To see live multi-agent activity, open a root thread and ask it to delegate bounded tasks; collaboration events and descendant reconciliation populate the hierarchy. **Codex Agent Map: Run Visualization Demo** exercises the same reducers without contacting Codex or consuming usage, and **Stop Visualization Demo** restores live state.

## Known limitations and incomplete work

- Architecture detection is heuristic and requires user confirmation.
- Runtime subagents are inspection-only; custom-agent delegation, direct subagent messaging, conversation forking, skill views, and `AGENTS.md` visualization are outside Stage 2.
- Collaboration reconciliation depends on the installed App Server's experimental descendant API; live collaboration events and the root graph remain available when it is unsupported.
- Image/file attachments, mentions, a skill picker, and non-Codex providers are not implemented.
- A human should still perform final visual inspection of all four modes, keyboard navigation, drag interactions, map editing, demo transitions, and approval handling in the Extension Development Host before release.
