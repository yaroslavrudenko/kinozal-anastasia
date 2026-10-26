// Where the channels come from (OTT Club API or an M3U playlist) and loading them: one request at a
// time, parsed once, validated, one retry chain with a growing delay, and a compact offline copy written
// only after the first frame, when the TV is idle. The UI is reached through hooks.
//   hooks: { onApplied(firstLoad), onFatal(text), onNotice(text), onSpinner(on) }
var Sources = (function () {
  var V = 1;                   // offline copy format
  var hooks = null, started = false, active = '', req = null, parsing = null, retryTimer = null, retryN = 0;
  var lastKey;                 // key of the channel last remembered (undefined: not read yet)
  var hasList = false, fromSaved = false, firstFrameSeen = false, persistPending = null, xmltvPending = null;

  function setHooks(h) { hooks = h; }

  function playlistUrl() {
    return Util.load('playlistUrl') || (CONFIG.PLAYLIST_URL.indexOf('__') !== 0 ? CONFIG.PLAYLIST_URL : '');
  }
  // 'ott' | 'm3u' | '' (nothing configured: setup)
  function mode() {
    if (active) return active;
    var m = Util.load('sourceMode');
    if (m === 'ott' && OttClub.enabled()) return 'ott';
    if (m === 'm3u' && playlistUrl()) return 'm3u';
    return OttClub.enabled() ? 'ott' : playlistUrl() ? 'm3u' : '';
  }

  function setOtt(key) { OttClub.saveKey(key); Util.save('sourceMode', 'ott'); forgetCopy(); }
  function setM3u(url) { Util.save('playlistUrl', url); Util.save('sourceMode', 'm3u'); forgetCopy(); }
  function forgetCopy() { Util.remove('playlistSnap'); Util.remove('playlistText'); }

  // Idempotent: a second call (double submit on the setup screen) starts nothing.
  function start() {
    if (started) return;
    started = true;
    active = mode();
    if (active === 'ott') EPG.setLoader(OttClub.guide);
    // A fixed guide URL does not depend on the list: it starts at the first frame, in parallel with it.
    if (active === 'm3u' && CONFIG.EPG_URL) xmltvPending = { url: CONFIG.EPG_URL, channels: null };
    load(true);
    setInterval(function () { if (!retryTimer) load(false); }, CONFIG.PLAYLIST_REFRESH_MS);
  }

  function load(blocking) {
    if (req) req.abort();
    NowLines.cancel();
    if (parsing) parsing.cancel();
    if (blocking) hooks.onSpinner(true);
    var m = mode();
    req = Net.get({ url: m === 'ott' ? OttClub.sourceUrl() : playlistUrl(), timeoutMs: CONFIG.LIST_TIMEOUT_MS }, function (err, text) {
      req = null;
      if (err) { failed(err); return; }
      parse(m, text, function (result) {
        if (!result) { failed('invalid'); return; }
        retryN = 0;
        fromSaved = false;
        apply(result, m);
      });
    });
  }

  function parse(m, text, done) {
    if (m === 'ott') { done(OttClub.parse(text)); return; }
    parsing = M3U.parse(text, function (r) { parsing = null; done(r); });
  }

  // A garbage answer takes the same path as a network error. With a fresh list on screen a refresh
  // failure waits for the next refresh; otherwise the saved copy is shown and the load retried.
  function failed(err) {
    if (hasList && !fromSaved) return;
    var wait = Util.backoff(retryN++, CONFIG.LIST_RETRY_MIN_MS, CONFIG.LIST_RETRY_MAX_MS);
    if (!hasList) savedList(function (saved) {
      if (hasList) return;                 // a fresh list arrived while the saved one was read
      if (saved) {
        fromSaved = true;
        apply(saved, mode());
        hooks.onNotice('Сервер не ответил — показан последний список, обновлю автоматически');
      } else {
        hooks.onSpinner(false);
        hooks.onFatal(err === 'invalid' ? 'Список каналов пуст или недоступен. Повтор через ' + Math.round(wait / 1000) + ' с.'
          : 'Не удалось загрузить список каналов (' + err + '). Повтор через ' + Math.round(wait / 1000) + ' с.');
      }
    });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { retryTimer = null; load(!hasList); }, wait);
  }

  function apply(result, m) {
    var firstLoad = !hasList;
    hasList = true;
    Health.markDead(result.channels);
    Favs.migrate(result.channels);
    Channels.replace(result.channels);
    hooks.onFatal('');
    // A list from the provider's cache does not count as fresh "now" lines: they are re-read at once.
    if (m === 'ott') {
      EPG.prune(result.channels);
      var cachedAnswer = EPG.setSeeds(result.seeds || Util.dict());
      if (!fromSaved) { if (cachedAnswer) NowLines.cachedList(); else NowLines.loaded(); }
    }
    else if (!CONFIG.EPG_URL) xmltvPending = { url: result.epgUrl, channels: result.channels };
    if (!fromSaved) persistPending = { m: m, epgUrl: result.epgUrl || '', channels: result.channels };
    Health.schedule(result.channels, m);
    if (firstFrameSeen) afterFirstFrame();
    hooks.onApplied(firstLoad);
  }

  // The network is back: a list shown from the offline copy (no "now" lines) is loaded at once.
  function onNetwork() {
    if (!fromSaved || req) return;
    clearTimeout(retryTimer);
    retryTimer = null;
    load(false);
  }

  // Called on every first frame: the stream had the bandwidth first, now the guide and the offline copy.
  function onFirstFrame() { firstFrameSeen = true; afterFirstFrame(); }
  function afterFirstFrame() {
    if (xmltvPending) {
      var x = xmltvPending, wanted = Util.dict();
      xmltvPending = null;
      for (var i = 0; x.channels && i < x.channels.length; i++) if (x.channels[i].id) wanted[x.channels[i].id] = true;
      EPG.load(x.url, x.channels ? wanted : null, function () { if (hooks.onGuide) hooks.onGuide(); });
    }
    if (persistPending) {
      var p = persistPending;
      persistPending = null;
      Util.idle(function () { persist(p); });
    }
  }

  // The offline copy: compact fields only (no descriptions, no subscriber key).
  function persist(p) {
    var rows = [];
    for (var i = 0; i < p.channels.length; i++) rows.push(pack(p.channels[i]));
    var copy = { v: V, mode: p.m, savedAt: Date.now(), epgUrl: p.epgUrl, channels: rows };
    // Too big or over the quota: no copy at all (an older one would be stale); Util.save records why.
    if (!Util.save('playlistSnap', copy, CONFIG.SNAPSHOT_MAX_CHARS)) { Util.remove('playlistSnap'); return; }
    Util.remove('playlistText');
  }

  // [id, name, logo, group, url ('' for OTT: rebuilt from the key), catchup, catchupSource, catchupDays, il, ua, key, num]
  function pack(ch) {
    return [ch.id, ch.name, ch.logo, ch.group, ch.key.indexOf('ott:') === 0 ? '' : ch.url, ch.catchup, ch.catchupSource,
      ch.catchupDays, ch.il ? 1 : 0, ch.ua ? 1 : 0, ch.key, ch.num];
  }
  function unpack(r, num) {
    var ott = !r[4];
    return { key: r[10], num: num, id: r[0], name: r[1], nameLc: String(r[1]).toLowerCase(), logo: r[2], group: r[3],
      url: ott ? OttClub.streamUrl(r[0]) : r[4], catchup: r[5], catchupSource: r[6], catchupDays: r[7],
      il: !!r[8], ua: !!r[9], dead: false };
  }

  // done(result | null): the offline copy, or the raw list text written by versions before 1.8.
  function savedList(done) {
    var copy = Util.load('playlistSnap');
    if (copy && copy.v === V && copy.mode === mode() && copy.channels instanceof Array) {
      var channels = [];
      for (var i = 0; i < copy.channels.length; i++) channels.push(unpack(copy.channels[i], i + 1));
      done(channels.length ? { channels: channels, seeds: Util.dict(), epgUrl: copy.epgUrl } : null);
      return;
    }
    var text = Util.load('playlistText');
    if (typeof text !== 'string') done(null); else parse(mode(), text, done);
  }

  // The channel being watched, remembered for the next launch (lastUrl: what the TV scripts read).
  function rememberLanding(ch) {
    if (lastKey === undefined) { var last = Util.load('lastCh'); lastKey = last instanceof Array ? last[10] : null; }
    if (lastKey === ch.key) return;
    lastKey = ch.key;
    Util.save('lastCh', pack(ch));
    Util.save('lastUrl', ch.url);
  }
  function lastChannel() {
    var r = Util.load('lastCh');
    return r instanceof Array && r.length === 12 ? unpack(r, r[11]) : null;
  }

  return {
    setHooks: setHooks, mode: mode, setOtt: setOtt, setM3u: setM3u, start: start,
    onFirstFrame: onFirstFrame, rememberLanding: rememberLanding, lastChannel: lastChannel, onNetwork: onNetwork,
    loading: function () { return !!req; }
  };
}());
