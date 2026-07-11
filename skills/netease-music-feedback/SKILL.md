---
name: netease-music-feedback
description: Synchronize likes and feedback for locally registered managed NetEase playlists. Use when the user asks to learn from new likes, explicit ratings or removed recommendations, or for a scheduled read-only feedback sync. Never create or modify NetEase playlists.
---

# NetEase Music Feedback

## Rules

- Read only playlists explicitly registered in ignored local state; never scan arbitrary playlists by name.
- Call `get_recommendation_context` once, then call `get_playlist` only for registered managed playlist IDs.
- Require complete reads. A failed or partial read is not evidence of deletion.
- Treat a newly liked managed recommendation as positive feedback.
- Treat removal of a recommendation from an active managed playlist as negative feedback only when the local baseline proves it was previously present.
- Deleting a whole playlist or removing its tracking marker stops tracking; it is not mass negative feedback.
- Never create, rename, reorder or delete playlists; never add/remove tracks or cancel likes.
- Store state locally without cookies, tokens or passwords.

## Workflow

1. Load the previous ignored state from `data/recommender-state.json` if it exists.
2. Get the current account, complete like IDs and playlist list with `get_recommendation_context`.
3. Read every locally registered active managed playlist completely with `get_playlist`.
4. Compute idempotent like/removal events and update only local state.
5. Report event counts, inactive/missing playlists and authentication/backend failures.
