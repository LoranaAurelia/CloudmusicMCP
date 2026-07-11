# Agent instructions

This is the clean public CloudmusicMCP distribution. Never invent or request plaintext NetEase passwords. Use the QR login script and keep `data/session.json` private.

For deployment, read and follow `docs/AGENT_DEPLOYMENT.md`. For user-facing behavior, read `docs/USER_GUIDE.md`. For tool contracts, read `docs/MCP_TOOL_REFERENCE.md`.

Important constraints:

- Initialize `api-enhanced` as the upstream Git submodule. If this source came from a GitHub ZIP, clone the upstream repository into that directory rather than copying another local checkout.
- Use pnpm and low dependency-install concurrency.
- Do not commit `data/`, logs, reports, work files, cookies or taste configuration.
- Do not create scheduled recommendations. The curator skill runs only from an explicit current-chat request.
- Feedback and audit skills must not mutate NetEase playlists or likes.
- Preserve requested song order. Batch-add endpoints may reverse display order; use the MCP's returned `orderVerified` field and verify before reporting success.
- Do not modify or vendor the upstream backend unless the user explicitly asks.
