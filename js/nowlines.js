// The "now" line of the OTT Club channels shown in the menu or search stays accurate (DEC-2026-10-26-now-refresh-2):
//  - a row on screen whose next programme is known here (a full or kept guide) turns over at its end by a
//    redraw alone, with no request;
//  - only the rows on screen ask the provider: a row whose programme ended since the last fresh answer that
//    NAMED it was asked for is due at once (an answer that leaves a row out confirms nothing for it); one the
//    provider still named after its end is re-asked NOW_RECHECK_MS after that answer, for as long as it keeps
//    naming it; one it had nothing for, NOW_MISSING_MS after it. While a menu or search is open the list is
//    also re-read NOW_MISSING_MS after the last attempt (best effort, under the same gates);
//  - a row lingering on an ended programme is redrawn when the linger ends (its «(шла до HH:MM)» mark), with
//    no request, so a long outage marks it on time;
//  - a refresh is one request for the provider-fresh list (?t=), parsed when the TV is idle (no list rebuild,
//    no reorder, no guide downloads). A failed, empty or unusable answer changes nothing and is retried
//    NOW_RECHECK_MS later (due then, not merely allowed);
//  - gates: NOW_MIN_INTERVAL_MS after the previous answer, NOW_QUIET_MS after the last redraw (keys),
//    NOW_AFTER_LANDING_MS after a channel starts; never during a zap burst or a list load, never in the
//    background; a zap aborts it. The one exception: a launch list from the provider's cache is re-read at once.
//   hooks: { onUpdate() }    watch(fn): fn() -> ids of the rows on screen (null: nothing watched)
var NowLines = (function () {
  var req = null, timer = null, flipTimer = null, visible = null, hooks = {};
  var at = 0;                  // when the last answer (or failure) came: the floor counts from it
  var sampled = Util.dict();   // id -> when the last usable fresh answer naming it was asked for (the launch list is not one)
  var retryAfter = 0;          // after a failed, empty or unusable answer: the next request is due then, not before
  var landedAt = 0, renderAt = 0;
  var asap = false;            // the channel list came from the provider's cache: re-read it now (DEC 2026-10-26 option b)

  function setHooks(h) { hooks = h; }
  function loaded() { at = Date.now(); sampled = Util.dict(); }   // the full list just brought "now" lines (not a fresh sample)
  function cancel() { if (req) { req.abort(); req = null; } asap = false; }
  // A channel starting frees the bandwidth for its stream, except from the one re-read of a cached list.
  function landed() { if (!asap) cancel(); landedAt = Date.now(); arm(); }
  // Not counted toward the floor: the fresh answer is asked for right away (one request, parsed at idle).
  function cachedList() { at = 0; asap = true; arm(); }

  function watch(fn) { visible = fn; arm(); }

  // The earliest moment a refresh may be sent.
  function gate() {
    return Math.max(at + CONFIG.NOW_MIN_INTERVAL_MS, renderAt + CONFIG.NOW_QUIET_MS, landedAt + CONFIG.NOW_AFTER_LANDING_MS, retryAfter);
  }

  // One governor for every refresh: the earliest moment a row on screen needs the provider, and the earliest
  // moment one turns over by itself.
  function arm() {
    clearTimeout(timer); clearTimeout(flipTimer); timer = flipTimer = null;
    if (asap && !req) timer = setTimeout(run, 0);
    if (!visible) return;
    var now = Date.now(), due = Infinity, flip = Infinity, ids = visible();
    for (var i = 0; i < ids.length; i++) {
      var p = EPG.at(ids[i], now), end = EPG.knownEnd(ids[i]);
      if (p) { if (EPG.at(ids[i], p.stop + 1000)) flip = Math.min(flip, p.stop); else due = Math.min(due, p.stop + CONFIG.NOW_SETTLE_MS); }
      else if (end > now) flip = Math.min(flip, EPG.nextStart(ids[i], now) || Infinity);   // known only from later on: the provider's gap
      else { due = Math.min(due, ended(ids[i], end, now)); flip = Math.min(flip, EPG.lingerEnd(ids[i], now) || Infinity); }
    }
    if (flip < Infinity) flipTimer = setTimeout(flipRows, Math.max(0, flip - now));
    if (asap || req) return;                               // its answer re-arms
    due = Math.min(due, at + CONFIG.NOW_MISSING_MS);       // the open menu's maintenance re-read
    if (retryAfter) due = Math.min(due, retryAfter);       // a failed answer is asked again then
    timer = setTimeout(run, Math.max(0, Math.max(due, gate()) - now));
  }

  // A row with nothing on air: when it needs the provider (its last known programme ended at `end`; 0: none).
  function ended(id, end, now) {
    if (!end) return at + CONFIG.NOW_MISSING_MS;                         // the provider had nothing for it
    if (end > (sampled[id] || 0)) return now;                             // ended since a fresh answer last named it
    return at + CONFIG.NOW_RECHECK_MS;                                    // the provider still names the ended show
  }

  // A row whose next programme is known turns over with no request (the redraw re-arms).
  function flipRows() { flipTimer = null; if (!document.hidden && hooks.onUpdate) hooks.onUpdate(); }

  function run() {
    timer = null;
    if (Sources.mode() !== 'ott') return;
    if (document.hidden) return;                          // re-armed when the app is visible again (update)
    if (!asap && Date.now() < gate()) { arm(); return; }  // a key or a channel start came after it was armed
    if (req || Sources.loading() || Zap.choosing()) { timer = setTimeout(run, CONFIG.NOW_BUSY_RETRY_MS); return; }
    var sent = Date.now();
    req = Net.get({ url: OttClub.freshUrl(), timeoutMs: CONFIG.LIST_TIMEOUT_MS }, function (err, text) {
      req = null; asap = false;
      at = Date.now();
      if (err) { failed(); return; }
      Util.idle(function () {
        var seeds = OttClub.seedsOf(text);
        if (!seeds) { failed(); return; }
        EPG.setSeeds(seeds); retryAfter = 0;
        for (var id in seeds) sampled[id] = sent;           // only the channels it named are confirmed
        if (hooks.onUpdate) hooks.onUpdate();
        arm();
      });
    });
  }
  // Nothing changes; the rows keep what they show and the provider is asked again later.
  function failed() { retryAfter = Date.now() + CONFIG.NOW_RECHECK_MS; arm(); }

  // Called after each render of the watched list: the rows on screen may have changed.
  function update() { renderAt = Date.now(); arm(); }

  return { setHooks: setHooks, loaded: loaded, cachedList: cachedList, cancel: cancel, landed: landed, watch: watch, update: update };
}());
