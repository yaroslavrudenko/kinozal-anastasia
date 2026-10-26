// The "now" line of the OTT Club channels shown in the menu or search stays accurate: when a visible row's
// programme ends and nothing after it is known, the channel list is re-read for the "now" lines only (one
// request, parsed when the TV is idle; no list rebuild, no reorder, no guide downloads), a few seconds after
// that end. Never during a zap burst, in the background, or right after a channel starts (except the one re-read
// of a list that came from the provider's cache, at once after it); aborted by a zap.
//   hooks: { onUpdate() }    watch(fn): fn() -> ids of the rows on screen (null: nothing watched)
var NowLines = (function () {
  var req = null, at = 0, timer = null, visible = null, landedAt = 0, hooks = {};
  var asap = false;            // the channel list came from the provider's cache: re-read it now (DEC 2026-10-26 option b)

  function setHooks(h) { hooks = h; }
  function loaded() { at = Date.now(); }                 // the full list just brought fresh "now" lines
  function cancel() { if (req) { req.abort(); req = null; } asap = false; }
  // A channel starting frees the bandwidth for its stream, except from the one re-read of a cached list.
  function landed() { if (!asap) cancel(); landedAt = Date.now(); }
  // Not counted toward the floor: the fresh answer is asked for right away (one request, parsed at idle).
  function cachedList() { at = 0; asap = true; clearTimeout(timer); timer = setTimeout(run, 0); }

  function watch(fn) { visible = fn; clearTimeout(timer); if (fn) arm(); }

  // The next refresh: the earliest end among the visible rows whose next programme is unknown; a row
  // whose programme ended since the last refresh, or that the provider still named after its end (it
  // has not moved on yet, up to NOW_LINGER_MS), is due now; rows it had nothing for wait NOW_MISSING_MS.
  // Any channel's end also counts (one answer refreshes them all), so a row scrolled into view is current.
  function arm() {
    clearTimeout(timer);
    if (!visible) return;
    var now = Date.now(), due = Infinity, ids = visible();
    for (var i = 0; i < ids.length; i++) {
      var p = EPG.at(ids[i], now), end = EPG.knownEnd(ids[i]);
      if (p) { if (!EPG.at(ids[i], p.stop + 1000)) due = Math.min(due, p.stop + CONFIG.NOW_SETTLE_MS); }
      else due = Math.min(due, end > at - CONFIG.NOW_LINGER_MS ? now : at + CONFIG.NOW_MISSING_MS);
    }
    due = Math.min(due, EPG.nextSeedEnd());
    if (due === Infinity) return;
    var when = Math.max(due, at + CONFIG.NOW_MIN_INTERVAL_MS, landedAt + CONFIG.NOW_AFTER_LANDING_MS);
    timer = setTimeout(run, Math.max(0, when - now));
  }

  function run() {
    if (Sources.mode() !== 'ott') return;
    if (document.hidden) return;                          // re-armed when the app is visible again (update)
    if (req || Sources.loading() || Zap.choosing() || (!asap && Date.now() < landedAt + CONFIG.NOW_AFTER_LANDING_MS)) {
      timer = setTimeout(run, CONFIG.NOW_BUSY_RETRY_MS);
      return;
    }
    req = Net.get({ url: EPG.servedCached() ? OttClub.freshUrl() : OttClub.sourceUrl(), timeoutMs: CONFIG.LIST_TIMEOUT_MS }, function (err, text) {
      req = null; asap = false;
      at = Date.now();
      if (err) { arm(); return; }
      Util.idle(function () {
        var seeds = OttClub.seedsOf(text);
        if (seeds) { EPG.setSeeds(seeds); if (hooks.onUpdate) hooks.onUpdate(); }
        arm();
      });
    });
  }

  // Called after each render of the watched list: the rows on screen may have changed.
  function update() { if (visible) arm(); }

  return { setHooks: setHooks, loaded: loaded, cachedList: cachedList, cancel: cancel, landed: landed, watch: watch, update: update };
}());
