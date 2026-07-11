# Agent deployment guide

Use this guide when a user gives an Agent the cloned repository or a GitHub source ZIP.

## Goals

Deploy the local MCP, fetch the official backend, install the three generic skills and leave NetEase authentication to the user through QR login.

## Procedure

1. Confirm the current directory and inspect `AGENTS.md`.
2. Confirm Node.js 18+, Git and pnpm are available.
3. Run `install.ps1` on Windows or `./install.sh` on macOS/Linux.
4. If installation reports an existing skill or MCP with the same name, preserve it and ask before overwriting.
5. Ask the user to run `login.bat`/`login.ps1` (Windows) or `pnpm login` (cross-platform) and scan the QR code.
6. Run `pnpm check`.
7. Start an MCP client smoke test or run `pnpm start` only long enough to confirm the stdio server starts; do not print session contents.
8. Ask the user to restart Codex so newly installed skills and MCP configuration are discovered.

## Backend acquisition

When `.git` exists, initialize the linked repository:

```text
git submodule update --init --recursive
```

GitHub source ZIPs do not contain submodule contents. If `api-enhanced/package.json` is absent and the target directory is empty or absent, clone:

```text
git clone --depth 1 https://github.com/neteasecloudmusicapienhanced/api-enhanced.git api-enhanced
```

Do not copy a private/local backend checkout into this repository.

## Safety

- Never expose `data/session.json` or cookies.
- Never commit user preferences, recommendation state, logs or reports.
- Do not approve unrelated dependency build scripts.
- Do not create recurring automations unless explicitly requested.
- Feedback/audit tasks are read-only with respect to NetEase.
