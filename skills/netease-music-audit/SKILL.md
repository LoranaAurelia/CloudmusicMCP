---
name: netease-music-audit
description: Audit a local NetEase recommendation workflow for duplicate tracks, concentration, stale evidence, feedback drift, managed-playlist state and backend errors. Use for weekly or on-demand audits. It must not modify NetEase data or silently rewrite user preferences.
---

# NetEase Music Audit

1. Back up ignored local recommender state before changing local learned values.
2. Inspect recent recommendation reports, feedback events and managed-playlist baselines.
3. Check stable-ID duplicates, version-family duplicates, artist/album concentration, missing public evidence, stale authentication errors and incomplete playlist reads.
4. Confirm learned values did not overwrite explicit user preferences.
5. Produce a local report with findings, severity, reversible recommendations and one small experiment.
6. Never create or modify a NetEase playlist, track, like or account setting.
