# Changelog

## Unreleased

- Group recent threads by workspace, prioritize the open project, sort each group by recent activity, and place Resume Thread at the end of the conversation.

- Complete Stage 1 root-agent Codex client.
- Add owned App Server lifecycle, JSON-line transport, initialization, recovery, and sanitized logging.
- Add ChatGPT account/login, dynamic models, reasoning efforts, and collaboration modes.
- Add thread preview/resume/restoration and real-time turn, plan, command, file, diff, and tool activity.
- Add steering, interruption, approvals, permission requests, and tool user input.
- Add a secure responsive editor-tab Webview with sanitized Markdown and accessible controls.
- Add strict TypeScript validation and unit/integration coverage for protocol, state, services, controls, and Webview boundaries.
- Fall back to the Codex executable bundled with the official OpenAI VS Code extension when `codex` is absent from the Extension Host's `PATH`.
- Add a draggable, keyboard-accessible divider that resizes and persists the Recent Threads panel width.
- Add a resizable persisted composer, sticky thread controls, hidden panel scrollbars, bottom-aligned thread selection, and discardable unsent local threads.
