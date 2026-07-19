# Stage 2 Phase 1 baseline

Recorded on 2026-07-19 before Stage 2 implementation. Tracking issue: #3.

## Stage 1 verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm test`: 15 files and 52 tests passed.
- `npm run build`: passed; the extension host and Webview bundles compiled.
- `npm audit --audit-level=moderate`: zero vulnerabilities.
- Live App Server smoke test: initialization, `account/read`, and `thread/list` succeeded.
- No pre-existing failures were found.

Stage 1 coverage and inspection confirm that threads can be started, previewed, and resumed; root turns and item deltas are reduced into conversation state; turns can be steered or interrupted; approvals and tool user input are registered and resolved; and full authoritative state snapshots are sent to the Webview. Interactive Extension Development Host scenarios remain part of Phase 11 manual QA.

## Authoritative event flow

There is one `AppServerProcess` and one `AppServerClient`. `JsonLineTransport` validates the JSON-line envelope and routes notifications and server requests to `WorkspaceController`. The controller owns the root-thread selection, `TurnService`, `ApprovalService`, and `AppStateStore`. `ConversationReducer` applies matching root-thread notifications, and `CodexWorkspacePanel` publishes state snapshots to the Webview.

Stage 2 must extend this controller-level routing so conversation and visualization state consume the same event once. It must not launch another process or create a visualization-only thread.

## State and placeholders

- Root conversation state is stored in `AppState.selectedThread` and updated by `ConversationReducer`.
- Active turn identity is maintained by `TurnService`.
- Pending approvals are maintained by `ApprovalService` and projected into `AppState`.
- Workspace/UI preferences use VS Code workspace state.
- No graph state, graph dependency, project-map model, or visualization placeholder exists yet.

## Installed protocol surface

The shell Codex version is `codex-cli 0.144.5`. The official OpenAI VS Code extension currently bundles `codex-cli 0.145.0-alpha.18`; Stage 1 can fall back to that executable when the Extension Host cannot resolve `codex` on `PATH`. The experimental TypeScript protocol inspected for this baseline was generated from 0.144.5, and the live smoke test used the bundled executable.

The generated protocol confirms:

- `thread/list` supports mutually exclusive `ancestorThreadId` and `parentThreadId`, pagination, and subagent source filtering.
- `Thread` includes immediate `parentThreadId`, `agentNickname`, `agentRole`, status, CWD, model provider, source, and timestamps.
- Source kinds include `subAgent`, `subAgentReview`, `subAgentCompact`, `subAgentThreadSpawn`, and `subAgentOther`.
- Active flags are `waitingOnApproval` and `waitingOnUserInput`.
- Collaboration items are named `collabAgentToolCall`; tools are `spawnAgent`, `sendInput`, `resumeAgent`, `wait`, and `closeAgent`.
- Collaboration items expose `senderThreadId`, `receiverThreadIds`, delegated `prompt`, requested model/effort, and per-agent states. The installed protocol does not expose a separate `newThreadId`; spawn receivers are the child IDs.
- Item lifecycle notifications carry `threadId` and `turnId`, allowing routing to root or descendant agents.
- Safe `thread/read`, `thread/turns/list`, and `thread/items/list` request surfaces are available for recovery without resuming child threads.

These exact installed names take precedence over older examples in the Stage 2 specification.
