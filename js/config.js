// Build-time settings. PLAYLIST_URL is set by the build script from the owner's OTT Club playlist.
var CONFIG = {
  PLAYLIST_URL: '__PLAYLIST_URL__',
  EPG_URL: '',                 // empty = use url-tvg from the playlist header
  PLAYLIST_REFRESH_MS: 6 * 3600 * 1000,
  BUFFER_TIMEOUT_MS: 12000,    // stuck in buffering this long -> reconnect
  STALL_TIMEOUT_MS: 8000,      // playing but time not advancing this long -> reconnect
  MAX_BACKOFF_MS: 15000,
  BANNER_MS: 5000,
  NUMBER_ENTRY_MS: 1800,
  ROW_HEIGHT: 72,
  VISIBLE_ROWS: 13
};
