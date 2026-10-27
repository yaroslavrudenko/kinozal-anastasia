// Build-time settings and every tuning number of the app (SSOT). build.sh fills the three '__…__'
// placeholders from build.local.env (never committed).
// OTT_KEY set -> channels come from the OTT Club API; otherwise PLAYLIST_URL (any M3U) is used.
var CONFIG = {
  OTT_SERVER: 'myott.top',
  OTT_SCHEME: 'http',          // the provider serves keys and streams over http; https is unverified on the TV
  OTT_KEY: '__OTT_KEY__',
  PLAYLIST_URL: '__PLAYLIST_URL__',
  EPG_URL: '',                 // empty = use url-tvg from the playlist header
  VERSION: '1.8.4',            // must equal config.xml's version
  BUILD: '__BUILD__',          // filled by build.sh: commit and date
  // «📡 Провайдеры» (owner, 2026-10-27: a source is a provider; inside it the channels are grouped as the
  // provider gives them; a provider that gives separate playlists is a source of playlists): OTT Club (key),
  // the free iptv-org provider with its playlists (its whole public list first, ~11 000 channels; it can never
  // be removed) and the viewer's own providers (an M3U link each).
  FREE_PROVIDERS: [
    { id: 'iptvorg', name: 'iptv-org — бесплатные каналы', playlists: [
      { id: 'all', name: 'Весь список — каналы со всего мира', url: 'https://iptv-org.github.io/iptv/index.m3u' },
      { id: 'il', name: 'Израиль', url: 'https://iptv-org.github.io/iptv/countries/il.m3u' },
      { id: 'ua', name: 'Украина', url: 'https://iptv-org.github.io/iptv/countries/ua.m3u' },
      { id: 'rus', name: 'На русском языке', url: 'https://iptv-org.github.io/iptv/languages/rus.m3u' },
      { id: 'eng', name: 'На английском — CNN, Bloomberg, DW, France 24, Euronews…', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u' },
      { id: 'news', name: 'Новости', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
      { id: 'kids', name: 'Детские', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
      { id: 'music', name: 'Музыка', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
      { id: 'movies', name: 'Кино', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
      { id: 'documentary', name: 'Познавательные', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
      { id: 'sports', name: 'Спорт', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' }
    ] }
  ],

  // channel list
  PLAYLIST_REFRESH_MS: 6 * 3600 * 1000,
  SWITCH_PAINT_MS: 300,        // «Провайдеры»: the switch message is painted before the app starts again
  LIST_TIMEOUT_MS: 20000,
  LIST_RETRY_MIN_MS: 10000,
  LIST_RETRY_MAX_MS: 300000,
  SNAPSHOT_MAX_CHARS: 2500000, // offline copy of the list; bigger lists are not kept
  // "now" lines (DEC-2026-10-26-now-refresh-2)
  NOW_SETTLE_MS: 1000,         // a visible row's "now" is re-read this long after its programme ends
  NOW_MIN_INTERVAL_MS: 10000,  // from one "now" answer (or failure) to the next request
  NOW_RECHECK_MS: 60000,       // an ended show the provider still named, or a failed answer, is re-asked after this
  NOW_QUIET_MS: 1000,          // no "now" request until the menu has not been redrawn (keys) for this long
  NOW_OPEN_REREAD_MS: 60000,  // while a menu or search is open the whole list is re-read this often, so a row scrolled into view is never older (owner 2026-10-26: accuracy over the 5-min saving)
  NOW_MISSING_MS: 300000,      // rows the provider had nothing for, and the open menu's whole list, are re-asked after this
  NOW_STALE_MS: 60000,         // an answer naming a show that ended this long before it arrived came from a stale cache
  NOW_LINGER_MS: 900000,       // the provider still names an ended programme up to this long (seen: 7+ min at 03:00)
  NOW_AFTER_LANDING_MS: 5000,  // no refresh this soon after a channel starts (the stream has the bandwidth)
  NOW_BUSY_RETRY_MS: 1000,     // a refresh held back (zap, list loading) is tried again after this
  OVERLAY_QUIET_MS: 1500,      // background data redraws an open menu only after this long without a key
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
