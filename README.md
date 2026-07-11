# CloudmusicMCP

A local stdio MCP server for searching NetEase Cloud Music and safely managing playlists. It starts the linked `api-enhanced` backend automatically and includes three optional, generic Codex skills for curation, feedback synchronization and audits.

This repository contains no account cookie, listening history, liked-track export, recommendation state or personal taste profile.

Playlist writes are cache-safe: the installer patches the linked upstream backend so a
NetEase business error returned as HTTP 200 cannot be replayed from its two-minute cache.

## Quick start

Clone with the backend submodule:

```powershell
git clone --recurse-submodules https://github.com/LoranaAurelia/CloudmusicMCP.git
cd CloudmusicMCP
.\install.ps1
.\login.bat
```

If you downloaded GitHub's source ZIP, extract it and run `install.ps1`; the installer fetches the official backend repository when submodule content is absent.

- User instructions: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- Agent deployment instructions: [docs/AGENT_DEPLOYMENT.md](docs/AGENT_DEPLOYMENT.md)
- MCP tools: [docs/MCP_TOOL_REFERENCE.md](docs/MCP_TOOL_REFERENCE.md)
- Security and privacy: [SECURITY.md](SECURITY.md)

## Repository layout

```text
api-enhanced/    Git submodule pointing to the upstream backend
src/             MCP server and backend lifecycle
scripts/         QR login and manual backend control
skills/          Generic Codex skills
config/          Empty recommender preference template
docs/            User and Agent documentation
```

The wrapper is MIT licensed. The linked backend keeps its own upstream license and history.
