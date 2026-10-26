// Build-time settings and every tuning number of the app (SSOT). build.sh fills the three '__…__'
// placeholders from build.local.env (never committed).
// OTT_KEY set -> channels come from the OTT Club API; otherwise PLAYLIST_URL (any M3U) is used.
var CONFIG = {
  OTT_SERVER: 'myott.top',
  OTT_SCHEME: 'http',          // the provider serves keys and streams over http; https is unverified on the TV
  OTT_KEY: '__OTT_KEY__',
  PLAYLIST_URL: '__PLAYLIST_URL__',
  EPG_URL: '',                 // empty = use url-tvg from the playlist header
  VERSION: '1.7.0',            // must equal config.xml's version
  BUILD: '__BUILD__',          // filled by build.sh: commit and date

  // channel list
  PLAYLIST_REFRESH_MS: 6 * 3600 * 1000,
  LIST_TIMEOUT_MS: 20000,
  LIST_RETRY_MIN_MS: 10000,
  LIST_RETRY_MAX_MS: 300000,
  SNAPSHOT_MAX_CHARS: 2500000, // offline copy of the list; bigger lists are not kept
  KEY_CHECK_TIMEOUT_MS: 15000,
  NOW_SETTLE_MS: 0,            // a visible row's "now" is re-read this long after its programme ends
  NOW_MIN_INTERVAL_MS: 60000,  // never two "now" refreshes closer than this
  NOW_MISSING_MS: 300000,      // rows the provider had no current programme for are re-asked at most this often
  NOW_STALE_MS: 60000,         // an answer naming a show that ended this long before it arrived came from a stale cache
  NOW_LINGER_MS: 900000,       // the provider still names an ended programme up to this long (seen: 7+ min at 03:00)
  NOW_AFTER_LANDING_MS: 5000,
  NOW_BUSY_RETRY_MS: 1000,
  OVERLAY_QUIET_MS: 1500,      // background data redraws an open menu only after this long without a key     // a refresh held back (zap, list loading) is tried again after this  // no refresh this soon after a channel starts (the stream has the bandwidth)
  GUIDE_KEEP_AFTER_EVICT: 3,   // programmes kept (from now on) when a full guide leaves the cache

  // per-channel guide (OTT Club) and XMLTV (M3U)
  ARCHIVE_DAYS: 7,
  ARCHIVE_EDGE_MARGIN_MS: 600000,   // nothing older than ARCHIVE_DAYS minus this is opened (or retried)
  ARCHIVE_SPAN_MS: 14400000,        // one archive request covers at most 4 h (OTT Club answers 404 past 24–48 h); the player continues
  GUIDE_TIMEOUT_MS: 15000,
  GUIDE_FRESH_MS: 3600000,
  GUIDE_RETRY_MIN_MS: 30000,
  GUIDE_RETRY_MAX_MS: 600000,
  GUIDE_CACHE_CHANNELS: 24,    // full guides kept in memory; older ones fall back to the "now" line
  XMLTV_TIMEOUT_MS: 60000,
  XMLTV_MAX_BYTES: 30 * 1024 * 1024,
  XMLTV_REFRESH_MS: 12 * 3600 * 1000,
  XMLTV_RETRY_MIN_MS: 60000,
  XMLTV_RETRY_MAX_MS: 30 * 60000,
  SLICE_MS: 8,                 // longest piece of parsing per task, so a key press never waits

  // channel health (dead streams)
  PROBE_TIMEOUT_MS: 8000,
  PROBE_MAX_BYTES: 65536,      // a master playlist is a few KB; anything bigger is not read to the end
  HEALTH_PERIOD_MS: 6 * 3600 * 1000,
  HEALTH_CONCURRENCY: 2,
  HEALTH_START_AFTER_STABLE_MS: 60000,

  // player
  BUFFER_PLAY_S: 5,
  BUFFER_RESUME_S: 10,
  BUFFER_TIMEOUT_MS: 15000,    // live: stuck in buffering this long (no progress) -> reconnect
  ARCHIVE_BUFFER_TIMEOUT_MS: 30000,   // archive recordings take longer to open
  STALL_TIMEOUT_MS: 8000,      // playing but time not advancing this long -> reconnect
  RETRY_MIN_MS: 500,
  MAX_BACKOFF_MS: 15000,
  STABLE_MS: 20000,            // the retry backoff resets only after this much advancing playback
  LIVE_SNAP_MS: 120000,        // archive within 2 min of live plays live instead
  HLS_JS_URL: 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js',
  HLS_JS_SRI: 'sha384-9v3HcdYrO3D+OPDTjZ40RXocgE4GtXVCd3/mCS62JsM93JXgI1afJVuwjFvsu6ni',

  // zapping and screens
  ZAP_SETTLE_MS: 350,          // inside a burst of presses only the channel stopped on is opened
  ZAP_IDLE_MS: 1000,           // a press this long after the previous one opens at once
  ZAP_BUSY_MS: 3000,
  LANDING_SAVE_MS: 1000,       // a channel is remembered once it has played this long
  BANNER_MS: 5000,
  TECH_LINE_MS: 5000,          // the stream's technical line shows this long after a channel opens
  TECH_POLL_MS: 500,           // re-read while the player has not described the stream yet
  TECH_WAIT_MS: 15000,         // «…» waits this long for the player's description; the TECH_LINE_MS window starts when it arrives
  TOAST_MS: 2500,
  NUMBER_ENTRY_MS: 1800,
  EXIT_CONFIRM_MS: 2000,
  VISIBLE_ROWS: 13,
  SEARCH_ROWS: 9,
  SEARCH_LIMIT: 60,
  DIAG_FLUSH_MS: 30000,
  DIAG_LOG_LINES: 40
};
