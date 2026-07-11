# MCP tool reference

## Read and discovery

- `get_login_status` — verify the local session.
- `get_recommendation_context` — one-call account, complete liked-track IDs and playlist list.
- `get_liked_tracks` — complete liked-track ID set.
- `list_my_playlists` — paginated playlist list.
- `get_playlist` — complete ordered tracks and IDs, including playlists over 1,000 tracks.
- `search_songs` — catalog search with cache-isolated queries.
- `get_track_details` — batch identity/availability lookup for up to 1,000 IDs.
- `get_artist_releases` — artist album/release discovery.
- `get_similar_tracks` — catalog-neighbor discovery.
- `get_album_tracks` — album metadata and tracks.

## Playlist writes

- `create_playlist` — create a normal/private playlist.
- `create_managed_playlist` — idempotently create/resume a private managed playlist, set a marker, add tracks and verify order.
- `update_playlist` — update supplied name, description or tags.
- `add_tracks_to_playlist` — add missing IDs and preserve the supplied order, repairing batch reversal when safe.
- `remove_tracks_from_playlist` — remove IDs.
- `reorder_playlist_tracks` — replace the complete track order.
- `reorder_my_playlists` — replace the complete personal playlist order.
- `delete_playlist` — permanent deletion requiring `confirm=true`.

Every tool returns JSON text plus structured content. Tool errors use MCP `isError=true` and do not include stored cookies.
