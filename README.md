# Codex Agent Map

Codex Agent Map is a VS Code extension that provides a complete root-agent Codex conversation client in an editor tab. Stage 1 focuses on reliable Codex conversations; visual agent hierarchy and project architecture mapping are planned for Stage 2.

## Stage 1 features

- Owns one `codex app-server` process for the extension-host lifetime.
- Detects and verifies the configured Codex executable.
- Uses the App Server initialization handshake over newline-delimited JSON on stdin/stdout.
- Reuses existing Codex/ChatGPT authentication and can start browser sign-in when needed.
- Discovers models, supported reasoning efforts, and collaboration modes dynamically.
- Creates, lists, previews, resumes, and restores workspace threads.
- Displays complete stored history without resuming a thread.
- Streams agent messages, plans, commands, file changes, diffs, tools, warnings, and errors.
- Sends guidance to an active turn with `turn/steer` and stops with `turn/interrupt`.
- Handles command, file-change, permission, and tool-input requests without automatic approval.
- Persists lightweight UI preferences while leaving conversation persistence to Codex.

This extension is its own Codex client. It does not modify or depend on private APIs from OpenAI's official Codex extension, and it does not live-sync with a currently active turn in that extension.

## Requirements

- VS Code 1.96 or newer
- Node.js 20 or newer for development
- A working Codex CLI/App Server executable
- A ChatGPT account supported by Codex

Install Codex CLI if it is not already available, then verify it:

```text
codex --version
```

By default, the extension launches `codex app-server`. Set `codexAgentMap.codexPath` to an explicit executable when more than one Codex installation is on `PATH` or when detection fails. The extension uses Node's `shell: false` executable resolution, which can differ from PowerShell alias resolution on Windows.

## Development

```text
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Open this repository in VS Code and press F5. The included launch configuration builds the extension and opens an Extension Development Host. In that host, run **Codex Agent Map: Open Workspace** from the Command Palette.

## Using the client

### Connect and sign in

Opening the workspace starts one App Server process in the selected workspace directory. The header shows connection and account state. If authentication is required, select **Sign in with ChatGPT** and finish the flow in the browser. Tokens and credentials are never shown or persisted by the extension.

### Start or resume a thread

Select **New thread**, type a prompt, and select **Send**. Recent threads for the current workspace appear in the collapsible sidebar. Selecting a stored thread previews its complete history without taking control; select **Resume thread** before sending a follow-up.

A warning appears before resuming a thread whose runtime status is active:

> This thread may be active in another Codex client. Controlling one thread from multiple clients at the same time can cause confusing behavior.

One thread should be actively controlled by one client at a time.

### Model, reasoning, and Plan mode

The composer selectors come from App Server rather than hardcoded model names. Changing the model updates its reasoning-effort options. Plan mode is enabled only when `collaborationMode/list` exposes it. Selectors are locked during an active turn and apply to the next turn.

### Steer and interrupt

While Codex is working, the composer becomes an additional-guidance input and uses `turn/steer`; it does not create an overlapping turn. **Stop** sends `turn/interrupt`. The UI remains in **Stopping…** until App Server reports the authoritative final turn status.

### Approvals and input

Approval cards show the associated command, file change, permissions, or tool question. Only server-supported decisions are sent, using the original server request ID. Privileged actions are never automatically approved. Permission grants cannot exceed what the server requested.

## Privacy and persistence

Codex is the authoritative conversation store. The extension persists only lightweight workspace/UI state such as the last thread ID, selected model and effort, mode, sidebar preference, and unsent draft.

It does not persist full prompts, agent responses, raw command output, diffs, tokens, environment variables, approval payloads, or hidden reasoning. Raw hidden reasoning is never displayed; only server-provided reasoning summaries may be shown. Logs omit full prompts and responses.

## Security

- The Webview has a restrictive Content Security Policy and locally bundled scripts/styles.
- Markdown is sanitized before rendering.
- All Webview messages use validated discriminated unions.
- Model, effort, mode, thread, turn, approval, and path inputs are checked in the extension host.
- File-opening actions are restricted to paths inside the active workspace.
- The Webview has no direct process or filesystem access.

## Troubleshooting

### Codex executable not found

Run **Codex Agent Map: Choose Codex Executable**, select the desired binary, and reconnect. Check **Codex Agent Map** in the Output panel for sanitized details.

### Connected but signed out

Use **Sign in with ChatGPT**. If another Codex interface is already authenticated, App Server normally reuses that account.

### Plan mode is unavailable

Plan mode is disabled when the installed App Server does not expose `collaborationMode/list`. Upgrade Codex and reconnect.

### A stream disconnected

The visible conversation remains as stale state. Use **Reconnect**; the extension will not automatically restart a turn.

### Multiple Codex versions on Windows

PowerShell can resolve an npm `codex.ps1` while Node resolves a later `codex.exe` on `PATH`. Set `codexAgentMap.codexPath` explicitly when exact version selection matters.

## Known limitations

- Image and generic file attachments, mentions, and a skill picker are not part of Stage 1.
- Subagent visualization, custom-agent delegation, and project mapping are not part of Stage 1.
- Conversation forking and non-Codex providers are not implemented.
- Command output and diffs are bounded previews, not a terminal emulator or full diff editor.
- The client cannot take over or live-synchronize a turn currently controlled by another client.
- Collaboration modes depend on the installed App Server's experimental API.

## Stage 2 roadmap

Stage 2 will build on the Stage 1 state/event boundaries to add agent hierarchy visualization and a stable project architecture map, without replacing the root-agent client.

## Protocol references

Versioned TypeScript protocol references live under `.protocol-reference/`. They were generated with:

```text
codex app-server generate-ts --experimental --out <versioned-directory>
```

The repository records the initial npm CLI reference (`0.144.5`) and the exact VS Code-bundled runtime reference used during final smoke testing (`0.145.0-alpha.18`).
