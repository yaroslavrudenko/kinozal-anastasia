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

  // Makes `id` the source the app starts on (no restart: switchTo does that).
  function select(id) {
    if (id === 'ott') Util.save('sourceMode', 'ott');
    else { Util.save('playlistUrl', urlOf(id)); Util.save('sourceMode', 'm3u'); }
    forgetCopy();
  }
  function forgetCopy() { Util.remove('playlistSnap'); Util.remove('playlistText'); }

  // «Провайдеры»: OTT Club, the free provider (CONFIG.FREE_PROVIDERS) and the viewer's own providers (M3U links).
  // Ids: 'ott' · FREE + <id> · USER + <url>. Only the viewer's own can be removed.
  var FREE = 'free:', USER = 'user:', OWN_STORE = 'userPlaylists', PER_SOURCE = 'lastBySource';
  var switching = false;       // a switch is under way: the page is about to start again on the new source
  function userPlaylists() { var l = Util.load(OWN_STORE); return l instanceof Array ? l : []; }
  // Every free playlist as { id: FREE + '<provider>/<playlist>', name, url }, in the providers' order.
  function freePlaylists() {
    var out = [];
    for (var i = 0; i < CONFIG.FREE_PROVIDERS.length; i++) {
      var p = CONFIG.FREE_PROVIDERS[i];
      for (var j = 0; j < p.playlists.length; j++) out.push({ id: FREE + p.id + '/' + p.playlists[j].id, provider: p.name, name: p.playlists[j].name, url: p.playlists[j].url });
    }
    return out;
  }
  function freeBy(test) { var l = freePlaylists(); for (var i = 0; i < l.length; i++) if (test(l[i])) return l[i]; return null; }
  function freeByUrl(url) { return freeBy(function (f) { return f.url === url; }); }
  function idOfUrl(url) { var f = freeByUrl(url); return f ? f.id : USER + url; }
  function urlOf(id) {
    if (id.indexOf(USER) === 0) return id.substring(USER.length);
    var f = freeBy(function (x) { return x.id === id; });
    return f ? f.url : '';
  }
  // "https://host/path/name.m3u?token" -> "host · name": the token is never shown.
  function shortName(url) {
    var m = /^\w+:\/\/([^\/?#]+)([^?#]*)/.exec(url) || [];
    var last = (m[2] || '').split('/').filter(Boolean).pop() || '';
    return (m[1] || url) + (last ? ' · ' + last.replace(/\.m3u8?$/i, '') : '');
  }
  function list() {
    var rows = [{ id: 'ott', kind: 'ott', name: 'OTT Club', ready: OttClub.enabled() }];
    for (var i = 0; i < CONFIG.FREE_PROVIDERS.length; i++) {
      var p = CONFIG.FREE_PROVIDERS[i], pls = [];
      for (var j = 0; j < p.playlists.length; j++) pls.push({ id: FREE + p.id + '/' + p.playlists[j].id, kind: 'freepl', name: p.playlists[j].name, url: p.playlists[j].url });
      rows.push({ id: FREE + p.id, kind: 'free', name: p.name, playlists: pls });
    }
    var own = userPlaylists();
    for (var j = 0; j < own.length; j++) rows.push({ id: USER + own[j], kind: 'user', name: shortName(own[j]), url: own[j] });
    return rows;
  }
  function activeId() {
    var m = mode();
    return m === 'ott' ? 'ott' : m === 'm3u' ? idOfUrl(playlistUrl()) : '';
  }
  // A playlist the viewer typed in (or one an older version or the build set up): listed once, so it can
  // always be come back to; a free one is listed already.
  function addUser(url) {
    var own = userPlaylists();
    if (!freeByUrl(url) && own.indexOf(url) < 0) { own.push(url); Util.save(OWN_STORE, own); }
  }
  // The one way to change the source: the position in the source being left is kept (each source has its
  // own last channel and group; owner: the app always opens the last source, group and channel), the new
  // source gets its own back, and the app starts again on it. Once per page life: a second OK before the
  // restart would otherwise save the new source's empty position over the old one.
  function switchTo(id) {
    if (switching) return;
    switching = true;
    var saved = Util.load(PER_SOURCE) || {}, from = activeId();
    if (from && (from.indexOf(USER) !== 0 || userPlaylists().indexOf(urlOf(from)) >= 0)) {
      saved[from] = { ch: Util.load('lastCh'), url: Util.load('lastUrl'), group: Util.load(Zap.GROUP_STORE) };
    }
    var back = saved[id] || {};
    Util.save(PER_SOURCE, saved);
    restore('lastCh', back.ch);
    restore('lastUrl', back.url);
    restore(Zap.GROUP_STORE, back.group);
    select(id);
    // In its own task, so a message shown just before the switch is painted first.
    setTimeout(function () { window.location.reload(); }, CONFIG.SWITCH_PAINT_MS);
  }
  function restore(key, value) { if (value == null) Util.remove(key); else Util.save(key, value); }
  // Removes one of the viewer's own playlists and its saved position; the one being watched gives way to
  // OTT Club (or the first free playlist).
  function removeUser(url) {
    Util.save(OWN_STORE, userPlaylists().filter(function (u) { return u !== url; }));
    var saved = Util.load(PER_SOURCE);
    if (saved && saved[USER + url]) { delete saved[USER + url]; Util.save(PER_SOURCE, saved); }
    if (activeId() === USER + url) switchTo(OttClub.enabled() ? 'ott' : freePlaylists()[0].id);
  }

  // Idempotent: a second call (double submit on the setup screen) starts nothing.
  function start() {
    if (started) return;
    started = true;
    active = mode();
    if (active === 'ott') EPG.setLoader(OttClub.guide);
    else addUser(playlistUrl());   // a playlist set up before «Провайдеры» existed is listed there too
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
    setHooks: setHooks, mode: mode, select: select, start: start,
    list: list, activeId: activeId, activeName: function () { var id = activeId(), f = freeBy(function (x) { return x.id === id; }); return f ? f.provider + ' · ' + f.name : id.indexOf(USER) === 0 ? shortName(urlOf(id)) : id; }, firstFreeId: function () { return freePlaylists()[0].id; }, idOfUrl: idOfUrl, addUser: addUser, switchTo: switchTo, removeUser: removeUser,
    onFirstFrame: onFirstFrame, rememberLanding: rememberLanding, lastChannel: lastChannel, onNetwork: onNetwork,
    loading: function () { return !!req; }
  };
}());
