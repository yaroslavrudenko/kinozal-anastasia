// Build-time settings, filled by build.sh from build.local.env (never committed).
// OTT_KEY set -> channels come from the OTT Club API; otherwise PLAYLIST_URL (any M3U) is used.
var CONFIG = {
  OTT_SERVER: 'myott.top',
  OTT_KEY: '__OTT_KEY__',
  PLAYLIST_URL: '__PLAYLIST_URL__',
  EPG_URL: '',                 // empty = use url-tvg from the playlist header
  PLAYLIST_REFRESH_MS: 6 * 3600 * 1000,
  VERSION: '1.5.1',
  BUILD: '__BUILD__',           // filled by build.sh: commit and date
  BUFFER_TIMEOUT_MS: 15000,    // live: stuck in buffering this long -> reconnect
  ARCHIVE_BUFFER_TIMEOUT_MS: 30000,   // archive recordings take longer to open
  LIVE_SNAP_MS: 120000,        // archive within 2 min of live plays live instead
  STALL_TIMEOUT_MS: 8000,      // playing but time not advancing this long -> reconnect
  MAX_BACKOFF_MS: 15000,
  BANNER_MS: 5000,
  NUMBER_ENTRY_MS: 1800,
  ROW_HEIGHT: 72,
  VISIBLE_ROWS: 13
};
