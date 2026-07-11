# Security and privacy

- Authentication uses NetEase QR login; the MCP does not require a plaintext password.
- The session cookie is stored locally in `data/session.json` with restricted file mode where supported and is ignored by Git.
- Never attach session files, logs or screenshots containing cookies to issues.
- The backend binds to `127.0.0.1` by default.
- The repository contains no telemetry and no automatic recommendation schedule.
- Report security issues privately to the repository owner rather than publishing credentials or exploit details.
