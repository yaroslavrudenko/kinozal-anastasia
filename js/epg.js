// Programme guide store and its loading policy. Two sources:
//   OTT Club: a "now" seed per channel from the channel list, plus a full guide (7 days back, 24 h ahead)
//     fetched per channel on demand (setLoader). At most GUIDE_CACHE_CHANNELS full guides are kept; a
//     failed or malformed answer keeps what was there and is retried with a growing delay.
//   M3U: one XMLTV file (load), parsed by XMLTV in slices; only listed channels and the archive window.
// Lookups are binary searches; indexAt is the one definition of "the programme at moment t".
var EPG = (function () {
  var seeds = Util.dict();     // id -> [one programme] (the "now" line of the channel list)
  var full = Util.dict();      // id -> sorted [{ start, stop, title }]
  var fullAt = Util.dict();    // id -> when the full guide arrived
  var lru = [];                // ids of per-channel full guides, most recent last
  var pending = Util.dict();   // id -> { handle, subs: [] }
  var fails = Util.dict();     // id -> { n, until }
  var loader = null, focusId = null, retryTimer = null, hooks = {};
  var xml = { url: '', okAt: 0, handle: null, parse: null, done: null, n: 0, timer: null, gen: 0 };

  function setHooks(h) { hooks = h; }
  function setLoader(fn) { loader = fn; }
  function setSeeds(map) { seeds = map; }

  // A full guide first; otherwise the short list kept from an evicted guide when it still covers now
  // (it also knows what comes next), else the channel list's "now" line.
  var kept = Util.dict();      // id -> the few programmes from now on, kept when a full guide is evicted
  function list(id) {
    if (full[id]) return full[id];
    var k = kept[id];
    if (k && k.length && k[k.length - 1].stop > Date.now()) return k;
    return seeds[id] || k || [];
  }
  // When the last programme known for the channel ends (0: none known).
  function knownEnd(id) { var l = list(id); return l.length ? l[l.length - 1].stop : 0; }

  // First index whose programme has not ended at t (list.length when all have ended).
  function indexAt(l, t) {
    var lo = 0, hi = l.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (l[mid].stop > t) hi = mid; else lo = mid + 1; }
    return lo;
  }

  // The programme on air at moment t, or null.
  function at(id, t) {
    var l = list(id), i = indexAt(l, t);
    return i < l.length && l[i].start <= t ? l[i] : null;
  }
  // { cur, next }: next only when it follows the current one directly.
  function nowNext(id, t) {
    var cur = at(id, t);
    return { cur: cur, next: cur ? at(id, cur.stop + 1000) : null };
  }
  // Programmes overlapping one calendar day (0 = today, -1 = yesterday ...), DST-safe: one that started
  // before midnight and is still on comes first, with its real start. The programme panel shows the
  // full guide (or the channel list's "now" line until it arrives), not the few lines kept after eviction.
  function day(id, offset) {
    var l = full[id] || seeds[id] || [], from = Util.addDays(Util.dayStart(Date.now()), offset), to = Util.addDays(from, 1);
    var out = [];
    for (var i = indexAt(l, from); i < l.length && l[i].start < to; i++) out.push(l[i]);
    return out;
  }

  // Makes sure the full guide of `id` is loaded. cb(err): null when the guide arrived; an error when the
  // request failed, or soon after the call when no request is possible ('cooldown' after a failure,
  // 'none' with no guide source at all). A fresh guide makes no request and no callback.
  function ensure(id, cb) {
    if (!id) return;
    if (!loader) { if (!xml.handle && !xml.parse) later(cb, 'none'); return; }   // XMLTV on its way: wait for it
    if (pending[id]) { if (cb) pending[id].subs.push(cb); return; }
    if (full[id] && Date.now() - fullAt[id] < CONFIG.GUIDE_FRESH_MS) return;
    if (fails[id] && Date.now() < fails[id].until) { later(cb, 'cooldown'); return; }
    var p = pending[id] = { handle: null, subs: cb ? [cb] : [] };
    p.handle = loader(id, function (err, l) {
      if (pending[id] !== p) return;
      delete pending[id];
      if (err) failed(id); else stored(id, l);
      for (var i = 0; i < p.subs.length; i++) p.subs[i](err || null);
    });
  }

  function later(cb, err) { if (cb) setTimeout(function () { cb(err); }, 0); }

  // Sorted on arrival: every lookup is a binary search over start/stop order.
  function stored(id, l) {
    full[id] = l.slice().sort(function (a, b) { return a.start - b.start; });
    fullAt[id] = Date.now();
    delete fails[id];
    var at_ = lru.indexOf(id);
    if (at_ >= 0) lru.splice(at_, 1);
    lru.push(id);
    for (var i = 0; lru.length > CONFIG.GUIDE_CACHE_CHANNELS && i < lru.length; ) {
      if (lru[i] === focusId) { i++; continue; }          // the watched channel is never evicted
      var old = lru.splice(i, 1)[0], from = indexAt(full[old], Date.now());
      kept[old] = full[old].slice(from, from + CONFIG.GUIDE_KEEP_AFTER_EVICT);   // a few bytes: now and next
      delete full[old]; delete fullAt[old];
    }
  }

  // Keeps the seed / older guide. The watched channel is retried after the cool-down by itself.
  function failed(id) {
    var f = fails[id] || (fails[id] = { n: 0, until: 0 });
    var wait = Util.backoff(f.n++, CONFIG.GUIDE_RETRY_MIN_MS, CONFIG.GUIDE_RETRY_MAX_MS);
    f.until = Date.now() + wait;
    if (id !== focusId) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () {
      if (id === focusId) ensure(id, function (err) { if (!err && hooks.onGuide) hooks.onGuide(id); });
    }, wait);
  }

  // The viewer settled on `id`: every other guide still loading is dropped (silently, no cool-down).
  function cancelExcept(id) {
    if (focusId !== id) clearTimeout(retryTimer);
    focusId = id;
    for (var k in pending) {
      if (k === id) continue;
      var p = pending[k];
      delete pending[k];
      if (p.handle) p.handle.abort();
      for (var i = 0; i < p.subs.length; i++) p.subs[i]('aborted');
    }
  }

  // XMLTV (M3U playlists). done(err) runs once per call; a newer call supersedes an older one.
  function load(url, wanted, done) {
    if (!url) return;
    var my = ++xml.gen;
    finishXml('superseded');
    clearTimeout(xml.timer);
    xml.done = done || null;
    if (url === xml.url && Date.now() - xml.okAt < CONFIG.XMLTV_REFRESH_MS) { finishXml(null); return; }
    xml.handle = Net.get({ url: url, timeoutMs: CONFIG.XMLTV_TIMEOUT_MS, maxBytes: CONFIG.XMLTV_MAX_BYTES }, function (err, text) {
      xml.handle = null;
      if (err) { xmlFailed(url, wanted, err); return; }
      var now = Date.now();
      xml.parse = XMLTV.parse({ text: text, wanted: wanted, from: now - CONFIG.ARCHIVE_DAYS * Util.DAY_MS, to: now + Util.DAY_MS },
        function (byId) {
          xml.parse = null;
          if (my !== xml.gen) return;
          var any = false;
          for (var id in byId) { full[id] = byId[id]; any = true; }
          if (!any) { xmlFailed(url, wanted, 'empty'); return; }
          xml.url = url; xml.okAt = Date.now(); xml.n = 0;
          finishXml(null);
        });
    });
  }

  function finishXml(err) {
    if (xml.handle) { xml.handle.abort(); xml.handle = null; }
    if (xml.parse) { xml.parse.cancel(); xml.parse = null; }
    var d = xml.done;
    xml.done = null;
    if (d) d(err);
  }

  function xmlFailed(url, wanted, err) {
    var wait = Util.backoff(xml.n++, CONFIG.XMLTV_RETRY_MIN_MS, CONFIG.XMLTV_RETRY_MAX_MS);
    var done = xml.done;
    finishXml(err);
    if (hooks.onXmltvFailed) hooks.onXmltvFailed(err);
    var gen = xml.gen;
    xml.timer = setTimeout(function () { if (gen === xml.gen) load(url, wanted, done); }, wait);
  }

  return {
    setHooks: setHooks, setLoader: setLoader, setSeeds: setSeeds, knownEnd: knownEnd, ensure: ensure, cancelExcept: cancelExcept,
    load: load, at: at, nowNext: nowNext, day: day, indexAt: indexAt
  };
}());
