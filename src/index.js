#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { BackendManager } from './backend.js'
import { NcmClient } from './client.js'
import { appendMissingInOrder, sameMembers, sameOrder } from './order.js'

const backend = new BackendManager()
const { baseUrl } = await backend.start()
const api = new NcmClient(baseUrl)
const server = new McpServer({ name: 'netease-cloud-music', version: '0.1.0' })

const success = (data) => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
})
const guarded = (handler) => async (args) => {
  try {
    return success(await handler(args))
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] }
  }
}
const idsSchema = z.array(z.union([z.string(), z.number()])).min(1).max(1000)
const csv = (ids) => ids.map(String).join(',')
let nonceCounter = 0
const freshNonce = () => `${Date.now()}-${++nonceCounter}`
const songSummary = (song, privilege = {}) => ({
  id: song.id,
  name: song.name,
  aliases: song.alia || song.alias || [],
  artists: (song.ar || song.artists || []).map((artist) => ({ id: artist.id, name: artist.name })),
  album: song.al ? { id: song.al.id, name: song.al.name } : song.album,
  durationMs: song.dt || song.duration,
  fee: song.fee,
  playable: privilege.st === 0 || privilege.st === undefined,
  privilege,
})
const getCurrentUser = async () => {
  const status = await api.call(`/login/status?readNonce=${Date.now()}`)
  const uid = status.data?.account?.id || status.data?.profile?.userId
  if (!uid) throw new Error('Login cookie is invalid or expired. Run .\\login.ps1 again.')
  return { status, uid }
}
const getAllPlaylists = async (uid) => {
  const playlists = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const page = await api.call(`/user/playlist?uid=${uid}&offset=${offset}&limit=${pageSize}&readNonce=${Date.now()}`, {
      uid, offset, limit: pageSize,
    })
    playlists.push(...(page.playlist || []))
    if (!page.more || !(page.playlist || []).length) break
  }
  return playlists
}
const readPlaylistTrackIds = async (playlistId) => {
  const id = String(playlistId)
  const data = await api.call(`/playlist/detail?id=${id}&readNonce=${freshNonce()}`, { id })
  return (data.playlist?.trackIds || []).map((track) => String(track.id))
}
const setPlaylistOrder = async (playlistId, orderedIds) => api.call(`/song/order/update?noCache=1&writeNonce=${freshNonce()}`, {
  pid: String(playlistId), ids: JSON.stringify(orderedIds.map(String)),
})

server.registerTool('search_songs', {
  description: 'Search NetEase Cloud Music songs. Returns song IDs, names, artists and albums for playlist curation.',
  inputSchema: {
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  },
}, guarded(async ({ query, limit, offset }) => {
  // api-enhanced caches POSTs by route; mirror the search parameters in the
  // URL so different searches cannot reuse the previous query's response.
  const cacheKey = `/cloudsearch?keywords=${encodeURIComponent(query)}&type=1&limit=${limit}&offset=${offset}`
  const data = await api.call(cacheKey, { keywords: query, type: 1, limit, offset }, { authenticated: false })
  const songs = data.result?.songs || []
  return {
    total: data.result?.songCount ?? songs.length,
    songs: songs.map((song) => songSummary(song)),
  }
}))

server.registerTool('get_login_status', {
  description: 'Check the saved NetEase Cloud Music login and return the current account/profile.',
  inputSchema: {},
}, guarded(async () => api.call('/login/status')))

server.registerTool('get_liked_tracks', {
  description: 'Return the complete current NetEase red-heart track ID set for the logged-in user in one call.',
  inputSchema: {},
}, guarded(async () => {
  const { uid } = await getCurrentUser()
  const data = await api.call(`/likelist?uid=${uid}&readNonce=${Date.now()}`, { uid })
  const trackIds = data.ids || []
  return { uid, count: trackIds.length, trackIds }
}))

server.registerTool('get_track_details', {
  description: 'Resolve up to 1,000 stable song IDs in one batch, including credits, album, duration and availability metadata.',
  inputSchema: { songIds: idsSchema },
}, guarded(async ({ songIds }) => {
  const ids = songIds.map(String)
  const data = await api.call(`/song/detail?readNonce=${Date.now()}&ids=${encodeURIComponent(ids.join(','))}`, { ids: ids.join(',') })
  const privileges = new Map((data.privileges || []).map((item) => [String(item.id), item]))
  return { tracks: (data.songs || []).map((song) => songSummary(song, privileges.get(String(song.id)))) }
}))

server.registerTool('get_recommendation_context', {
  description: 'Efficient recommender bootstrap: one tool call returns authenticated account, the complete red-heart ID set, and the complete current playlist list.',
  inputSchema: {},
}, guarded(async () => {
  const { status, uid } = await getCurrentUser()
  const [likes, playlists] = await Promise.all([
    api.call(`/likelist?uid=${uid}&readNonce=${Date.now()}`, { uid }),
    getAllPlaylists(uid),
  ])
  return {
    account: { uid, nickname: status.data?.profile?.nickname || null },
    likedTrackIds: likes.ids || [],
    playlists: playlists.map((item) => ({
      id: item.id, name: item.name, description: item.description || '', trackCount: item.trackCount,
      subscribed: item.subscribed, privacy: item.privacy,
    })),
  }
}))

server.registerTool('get_artist_releases', {
  description: 'Get an artist album/release page for followed-artist refresh and candidate discovery.',
  inputSchema: {
    artistId: z.union([z.string(), z.number()]),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  },
}, guarded(async ({ artistId, limit, offset }) => {
  const id = String(artistId)
  const data = await api.call(`/artist/album?id=${id}&limit=${limit}&offset=${offset}&readNonce=${Date.now()}`, { id, limit, offset })
  return {
    more: data.more,
    releases: (data.hotAlbums || []).map((album) => ({ id: album.id, name: album.name, artist: album.artist?.name, publishTime: album.publishTime, size: album.size, type: album.type })),
  }
}))

server.registerTool('get_similar_tracks', {
  description: 'Get catalog-neighbor tracks for discovery only; this is not genre evidence.',
  inputSchema: { songId: z.union([z.string(), z.number()]), limit: z.number().int().min(1).max(100).default(50) },
}, guarded(async ({ songId, limit }) => {
  const id = String(songId)
  const data = await api.call(`/simi/song?id=${id}&limit=${limit}&readNonce=${Date.now()}`, { id, limit })
  return { songs: (data.songs || []).map((song) => songSummary(song)) }
}))

server.registerTool('get_album_tracks', {
  description: 'Get a complete album track list for album-based candidate expansion.',
  inputSchema: { albumId: z.union([z.string(), z.number()]) },
}, guarded(async ({ albumId }) => {
  const id = String(albumId)
  const data = await api.call(`/album?id=${id}&readNonce=${Date.now()}`, { id })
  return { album: data.album ? { id: data.album.id, name: data.album.name, artist: data.album.artist?.name } : null, songs: (data.songs || []).map((song) => songSummary(song)) }
}))

server.registerTool('list_my_playlists', {
  description: 'List playlists owned or subscribed to by the logged-in user.',
  inputSchema: {
    limit: z.number().int().min(1).max(1000).default(100),
    offset: z.number().int().min(0).default(0),
  },
}, guarded(async ({ limit, offset }) => {
  const { uid } = await getCurrentUser()
  const data = await api.call(`/user/playlist?uid=${uid}&offset=${offset}&limit=${limit}&readNonce=${Date.now()}`, { uid, limit, offset })
  return {
    uid,
    more: data.more,
    playlists: (data.playlist || []).map((item) => ({
      id: item.id, name: item.name, trackCount: item.trackCount,
      subscribed: item.subscribed, privacy: item.privacy, description: item.description,
    })),
  }
}))

server.registerTool('get_playlist', {
  description: 'Get playlist metadata and its complete current ordered track list, including playlists with more than 1,000 songs.',
  inputSchema: { playlistId: z.union([z.string(), z.number()]) },
}, guarded(async ({ playlistId }) => {
  const readNonce = Date.now()
  const data = await api.call(`/playlist/detail?readNonce=${readNonce}`, { id: String(playlistId) })
  const playlist = data.playlist || {}
  const tracks = []
  const pageSize = 1000
  for (let offset = 0; offset < (playlist.trackCount || 0); offset += pageSize) {
    // Keep pagination in the URL as well as the body: api-enhanced's cache
    // keys POST bodies too coarsely, while the query string preserves pages.
    const page = await api.call(
      `/playlist/track/all?offset=${offset}&limit=${pageSize}&readNonce=${readNonce}`,
      { id: String(playlistId), offset, limit: pageSize },
    )
    tracks.push(...(page.songs || []))
    if (!(page.songs || []).length) break
  }
  return {
    id: playlist.id, name: playlist.name, description: playlist.description,
    trackCount: playlist.trackCount, returnedTrackCount: tracks.length,
    creator: playlist.creator?.nickname,
    tracks: tracks.map((song) => ({
      id: song.id, name: song.name,
      artists: (song.ar || []).map((artist) => artist.name),
      album: song.al?.name,
    })),
    trackIds: (playlist.trackIds || []).map((track) => track.id),
  }
}))

server.registerTool('create_playlist', {
  description: 'Create a normal or private playlist for the logged-in user.',
  inputSchema: {
    name: z.string().min(1).max(40),
    private: z.boolean().default(false),
  },
}, guarded(({ name, private: isPrivate }) => api.call(
  `/playlist/create?noCache=1&writeNonce=${freshNonce()}`,
  { name, privacy: isPrivate ? 10 : 0 },
)))

server.registerTool('create_managed_playlist', {
  description: 'Create or resume one private managed recommendation playlist, set its idempotency marker, and add all supplied song IDs in one MCP operation.',
  inputSchema: {
    requestId: z.string().min(1).max(80),
    direction: z.string().min(1).max(24),
    label: z.string().min(1).max(20).default('Curated'),
    summary: z.string().max(500).default(''),
    songIds: idsSchema,
  },
}, guarded(async ({ requestId, direction, label, summary, songIds }) => {
  const { uid } = await getCurrentUser()
  const marker = `cloudmusic-rec:${requestId}`
  const description = `[CLOUDMUSIC-MANAGED] ${marker}${summary ? `\n${summary}` : ''}`
  const playlists = await getAllPlaylists(uid)
  let playlist = playlists.find((item) => (item.description || '').includes(marker))
  let created = false
  if (!playlist) {
    const date = new Date().toISOString().slice(0, 10)
    const result = await api.call(
      `/playlist/create?noCache=1&writeNonce=${freshNonce()}`,
      { name: `✦⟳ ${label} · ${date} · ${direction}`, privacy: 10 },
    )
    const id = result.playlist?.id || result.id
    if (!id) throw new Error('Playlist creation succeeded without a playlist ID.')
    playlist = { id }
    created = true
    await api.call(`/playlist/desc/update?id=${id}&noCache=1&writeNonce=${freshNonce()}`, { id: String(id), desc: description })
  }
  const beforeIds = await readPlaylistTrackIds(playlist.id)
  const existingIds = new Set(beforeIds)
  const missingIds = songIds.map(String).filter((id) => !existingIds.has(id))
  if (missingIds.length) {
    const tracks = missingIds.join(',')
    await api.call(`/playlist/tracks?op=add&pid=${playlist.id}&tracks=${encodeURIComponent(tracks)}&noCache=1&writeNonce=${freshNonce()}`, {
      op: 'add', pid: String(playlist.id), tracks,
    })
  }
  const expectedIds = songIds.map(String)
  let observedIds = await readPlaylistTrackIds(playlist.id)
  let orderRepaired = false
  let orderVerified = sameOrder(observedIds, expectedIds)
  if (!orderVerified && sameMembers(observedIds, expectedIds)) {
    await setPlaylistOrder(playlist.id, expectedIds)
    orderRepaired = true
    observedIds = await readPlaylistTrackIds(playlist.id)
    orderVerified = sameOrder(observedIds, expectedIds)
  }
  return {
    playlistId: playlist.id, created, requestId, addedTrackIds: missingIds,
    alreadyPresentTrackIds: expectedIds.filter((id) => existingIds.has(id)),
    expectedTrackIds: expectedIds, observedTrackIds: observedIds,
    orderRepaired, orderVerified,
    orderWarning: orderVerified ? null : 'Playlist contains missing or extra tracks; automatic full-order repair was not applied.',
  }
}))

server.registerTool('update_playlist', {
  description: 'Update any supplied playlist fields; omitted fields are left unchanged.',
  inputSchema: {
    playlistId: z.union([z.string(), z.number()]),
    name: z.string().min(1).max(40).optional(),
    description: z.string().max(1000).optional(),
    tags: z.array(z.string()).max(3).optional(),
  },
}, guarded(async ({ playlistId, name, description, tags }) => {
  if (name === undefined && description === undefined && tags === undefined) {
    throw new Error('Supply at least one of: name, description, tags')
  }
  const id = String(playlistId)
  const updates = []
  if (name !== undefined) updates.push(['name', await api.call(`/playlist/name/update?noCache=1&writeNonce=${freshNonce()}`, { id, name })])
  if (description !== undefined) updates.push(['description', await api.call(`/playlist/desc/update?noCache=1&writeNonce=${freshNonce()}`, { id, desc: description })])
  if (tags !== undefined) updates.push(['tags', await api.call(`/playlist/tags/update?noCache=1&writeNonce=${freshNonce()}`, { id, tags: tags.join(';') })])
  return Object.fromEntries(updates)
}))

server.registerTool('add_tracks_to_playlist', {
  description: 'Add song IDs to the end of a playlist in the exact supplied order; automatically detect and repair NetEase batch-order reversal.',
  inputSchema: { playlistId: z.union([z.string(), z.number()]), songIds: idsSchema },
}, guarded(async ({ playlistId, songIds }) => {
  const pid = String(playlistId)
  const beforeIds = await readPlaylistTrackIds(pid)
  const beforeSet = new Set(beforeIds)
  const missingIds = songIds.map(String).filter((id) => !beforeSet.has(id))
  if (!missingIds.length) return { playlistId: pid, addedTrackIds: [], expectedTrackIds: beforeIds, observedTrackIds: beforeIds, orderRepaired: false, orderVerified: true }
  const tracks = csv(missingIds)
  // /playlist/track/add is for video playlists. Music playlists use /playlist/tracks.
  await api.call(`/playlist/tracks?op=add&pid=${encodeURIComponent(pid)}&tracks=${encodeURIComponent(tracks)}&noCache=1&writeNonce=${freshNonce()}`, {
    op: 'add', pid, tracks,
  })
  const expectedIds = appendMissingInOrder(beforeIds, missingIds)
  let observedIds = await readPlaylistTrackIds(pid)
  let orderRepaired = false
  if (!sameOrder(observedIds, expectedIds) && sameMembers(observedIds, expectedIds)) {
    await setPlaylistOrder(pid, expectedIds)
    orderRepaired = true
    observedIds = await readPlaylistTrackIds(pid)
  }
  return { playlistId: pid, addedTrackIds: missingIds, expectedTrackIds: expectedIds, observedTrackIds: observedIds, orderRepaired, orderVerified: sameOrder(observedIds, expectedIds) }
}))

server.registerTool('remove_tracks_from_playlist', {
  description: 'Remove one or more song IDs from a playlist.',
  inputSchema: { playlistId: z.union([z.string(), z.number()]), songIds: idsSchema },
}, guarded(({ playlistId, songIds }) => {
  const pid = String(playlistId)
  const tracks = csv(songIds)
  return api.call(`/playlist/tracks?op=del&pid=${encodeURIComponent(pid)}&tracks=${encodeURIComponent(tracks)}&noCache=1&writeNonce=${freshNonce()}`, {
    op: 'del', pid, tracks,
  })
}))

server.registerTool('reorder_playlist_tracks', {
  description: 'Replace the song order in one playlist. Pass the complete ordered song-ID list.',
  inputSchema: { playlistId: z.union([z.string(), z.number()]), orderedSongIds: idsSchema },
}, guarded(({ playlistId, orderedSongIds }) => setPlaylistOrder(playlistId, orderedSongIds)))

server.registerTool('reorder_my_playlists', {
  description: 'Reorder the logged-in user playlist list. Pass the complete ordered playlist-ID list.',
  inputSchema: { orderedPlaylistIds: idsSchema },
}, guarded(({ orderedPlaylistIds }) => api.call(`/playlist/order/update?noCache=1&writeNonce=${freshNonce()}`, {
  ids: JSON.stringify(orderedPlaylistIds.map(String)),
})))

server.registerTool('delete_playlist', {
  description: 'Permanently delete a playlist owned by the logged-in user. Requires confirm=true.',
  inputSchema: {
    playlistId: z.union([z.string(), z.number()]),
    confirm: z.literal(true).describe('Must be true to confirm permanent deletion'),
  },
}, guarded(({ playlistId }) => api.call(`/playlist/delete?noCache=1&writeNonce=${freshNonce()}`, { id: String(playlistId) })))

const shutdown = async () => {
  await backend.stop()
  process.exit(0)
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
process.once('exit', () => { void backend.stop() })

await server.connect(new StdioServerTransport())
console.error(`NetEase Cloud Music MCP ready; backend=${baseUrl}`)
