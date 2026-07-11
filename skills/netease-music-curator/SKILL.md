---
name: netease-music-curator
description: Recommend NetEase Cloud Music tracks and create a private managed playlist only when the current user explicitly asks for recommendations or a playlist. Use the Cloudmusic MCP for login, likes, catalog identity and playlist writes, and public web sources for track-level style verification. Never run automatically.
---

# NetEase Music Curator

## Rules

- Run only from an explicit current-chat recommendation request.
- Read `config/recommender.example.json` and `data/recommender-config.json` when present. Current-request constraints override saved preferences.
- Use `get_recommendation_context` once at startup instead of separate login, likes and playlist-list calls.
- Treat liked tracks as deduplication/prior evidence, not proof that every similar track is wanted.
- Search with `search_songs`; resolve finalists in batches with `get_track_details`.
- Verify requested style at track or release level using public sources. Platform tags and comments are discovery signals, not sufficient evidence.
- Do not claim to have heard audio unless an actual audio-analysis tool was used.
- Reject unavailable, ambiguous, duplicate and insufficiently verified candidates. Return fewer tracks rather than lower standards.
- After selection is validated, use `create_managed_playlist` once with a stable `requestId`; do not repeat create/add calls after it succeeds.
- Preserve the intended ordered song IDs before any write. Require `orderVerified=true` from `create_managed_playlist`; if it is false, read the complete playlist, repair only that managed playlist with `reorder_playlist_tracks`, and verify again before reporting success.
- Never delete playlists, remove tracks, cancel likes or change unrelated playlists.

## Workflow

1. Parse count, style, mood, vocal, structure, included/excluded artists and version policy from the current message.
2. Call `get_recommendation_context` and stop with a re-login instruction on authentication failure.
3. Build a varied candidate pool from exact searches, liked-track credits, album expansion, similar tracks and followed artists when supplied by the user.
4. Batch-resolve candidate IDs with `get_track_details`; remove liked, unavailable and duplicate recordings unless the request permits them.
5. Open public sources for each finalist and record specific evidence supporting the requested style.
6. Select a diverse set with no unexplained artist/album concentration.
7. Call `create_managed_playlist` with `requestId`, `direction`, optional `label`, summary and ordered song IDs.
8. Report playlist ID, actual added tracks, verification sources, uncertainties and any partial failure.

Keep private listening data in ignored `data/`, `work/` or `reports/` paths only.
