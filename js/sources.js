// Where the channels come from (OTT Club API or an M3U playlist) and loading them: one request at a
// time, every list downloaded parsed and applied, validated, one retry chain with a growing delay, and a compact
// offline copy written only after the first frame, when the TV is idle. The UI is reached through hooks.
//   hooks: { onApplied(firstLoad), onFatal(text), onNotice(text), onSpinner(on) }
var Sources = (function () {
  var V = 2;                   // offline copy format (1: before 1.9.0, still read)
  var hooks = null, started = false, active = '', req = null, parsing = null, retryTimer = null, retryN = 0;
  var lastKey;                 // key of the channel last remembered (undefined: not read yet)
  var hasList = false, fromSaved = false, firstFrameSeen = false, persistPending = null, xmltvPending = null;
  // The offline copy: the one wanted for the list on screen (null: none wanted), and the downloaded text the copy on
  // disk was written from in this page life (null: none yet — the first list always writes it).
  var copyFor = null, copiedFrom = null;

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

  // No usable source (nothing chosen or built in, or a built-in one a later build no longer has): the source is chosen
  // first. A remembered last channel does not make a source (review 4, F1: it made the app load '' as a playlist).
  function firstLaunch() { return !mode(); }

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
  // Every free playlist as { id: FREE + '<provider>/<playlist>', kind: 'freepl', of (the provider's id), provider, name, url },
  // in the providers' order.
  function freePlaylists() {
    var out = [];
    for (var i = 0; i < CONFIG.FREE_PROVIDERS.length; i++) {
      var p = CONFIG.FREE_PROVIDERS[i];
      for (var j = 0; j < p.playlists.length; j++) out.push({ id: FREE + p.id + '/' + p.playlists[j].id, kind: 'freepl', of: p.id, provider: I18n.t('p.' + p.id), name: I18n.t('pl.' + p.playlists[j].id), url: p.playlists[j].url });
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
    var rows = [{ id: 'ott', kind: 'ott', name: 'OTT Club', ready: OttClub.enabled() }], free = freePlaylists();
    for (var i = 0; i < CONFIG.FREE_PROVIDERS.length; i++) {
      var p = CONFIG.FREE_PROVIDERS[i];
      rows.push({ id: FREE + p.id, kind: 'free', name: I18n.t('p.' + p.id), playlists: free.filter(function (f) { return f.of === p.id; }) });
    }
    var own = userPlaylists();
    for (var j = 0; j < own.length; j++) rows.push({ id: USER + own[j], kind: 'user', name: I18n.ltr(shortName(own[j])), url: own[j] });
    return rows;
  }
  function activeId() {
    var m = mode();
    return m === 'ott' ? 'ott' : m === 'm3u' ? idOfUrl(playlistUrl()) : '';
  }
  // A playlist the viewer typed in (or one an older version or the build set up): listed once, so it can
  // always be come back to; a free one is listed already, and no link is no provider.
  function addUser(url) {
    var own = userPlaylists();
    if (url && !freeByUrl(url) && own.indexOf(url) < 0) { own.push(url); Util.save(OWN_STORE, own); }
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
    // Every list downloaded is parsed and applied: what the provider serves now is what is shown (owner: «актуальные
    // списки каналов и групп», «избыточного кеширования тоже не должно быть»). No validator stands in for the text: a
    // list rewritten with the same length under the same Last-Modified was kept stale by one (review 4, Codex 1).
    req = Net.get({ url: m === 'ott' ? OttClub.sourceUrl() : playlistUrl(), timeoutMs: CONFIG.LIST_TIMEOUT_MS }, function (err, text) {
      req = null;
      if (err) { failed(err); return; }
      parse(m, text, function (result) {
        if (!result) { failed('invalid'); return; }
        retryN = 0;
        fromSaved = false;
        apply(result, m, text);
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
        hooks.onNotice(I18n.t('m.oldList'));
      } else {
        hooks.onSpinner(false);
        hooks.onFatal(err === 'invalid' ? I18n.t('m.listEmpty', Math.round(wait / 1000)) : I18n.t('m.listFail', err, Math.round(wait / 1000)));
      }
    });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { retryTimer = null; load(!hasList); }, wait);
  }

  function apply(result, m, text) {
    var firstLoad = !hasList;
    hasList = true;
    Favs.migrate(result.channels);
    Channels.replace(result.channels);
    Util.idle(function () { Logos.retain(result.channels); });
    hooks.onFatal('');
    // A list from the provider's cache does not count as fresh "now" lines: they are re-read at once.
    if (m === 'ott') {
      EPG.prune(result.channels);
      var cachedAnswer = EPG.setSeeds(result.seeds || Util.dict());
      if (!fromSaved) { if (cachedAnswer) NowLines.cachedList(); else NowLines.loaded(); }
    }
    else guideFrom(result);
    // Every list is applied; its copy is written again only when the text differs, byte for byte, from the one the copy
    // on disk was written from (review 5, N5-2: an unchanged hour rewrote 2.1 M chars to the TV's flash).
    if (!fromSaved) persistPending = copyFor = text === copiedFrom ? null : { m: m, epgUrl: result.epgUrl || '', channels: result.channels, text: text };
    // The same text, held once: the list on screen keeps this download alive (its lines are slices of it), so the
    // text the copy was written from is this one now, not a second 4.9 MB of equal characters (review 6, F3-1). No copy
    // wanted means the texts were equal: one comparison per list, not two (review 7, F5 / R7-P1).
    if (!fromSaved && !copyFor) copiedFrom = text;
    if (firstFrameSeen) afterFirstFrame();
    hooks.onApplied(firstLoad);
  }
  // A playlist's own guide (url-tvg) is handed to the guide with every list it comes with (EPG.load decides whether it is
  // due). A playlist with none (iptv-org) has nothing to read, so its channels are not walked for it (review 4, P4-3).
  function guideFrom(result) {
    if (CONFIG.EPG_URL) return;
    xmltvPending = result.epgUrl ? { url: result.epgUrl, channels: result.channels } : null;
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

  // The offline copy: compact fields only (no descriptions, no subscriber key), one row per channel in list order.
  // Three idle tasks — the rows, their JSON, the write: all in one was a 52–58 ms task at 6× (review 4, P4-1). Each
  // stops when the copy is not wanted any more (review 5, NB-3).
  function persist(p) {
    if (dropped(p)) return;
    var rows = [];
    for (var i = 0; i < p.channels.length; i++) rows.push(row(p.channels[i]));
    Util.idle(function () {
      if (dropped(p)) return;
      var json = JSON.stringify({ v: V, mode: p.m, savedAt: Date.now(), epgUrl: p.epgUrl, channels: rows });
      Util.idle(function () { write(json, p); });
    });
  }
  // Not while a switch is under way (the copy kept would be the source being left), nor once a later list came (its own
  // copy is written, or the one on disk is already its own).
  function dropped(p) { return switching || p !== copyFor; }
  // Too big or over the quota: no copy at all (an older one would be stale); Util.saveJson records why.
  function write(json, p) {
    if (dropped(p)) return;
    copiedFrom = null;
    if (!Util.saveJson('playlistSnap', json, CONFIG.SNAPSHOT_MAX_CHARS)) { Util.remove('playlistSnap'); return; }
    copiedFrom = p.text;
    Util.remove('playlistText');
  }

  // A row of the copy: [key, name ('' unnamed), logo, group id, url ('' for OTT: rebuilt from the id), catchup,
  // catchupSource, catchupDays, il, ua, id]. Its number is its place; trailing empty values are left out; the id
  // too when it is the one in the key (the key always holds it for an M3U channel with one, and for OTT).
  // The group is kept by its id, so a copy written in one interface language reads right in another.
  function row(ch) {
    var r = [ch.key, ch.unnamed ? '' : ch.name, ch.logo, ch.groupId, ch.key.indexOf('ott:') === 0 ? '' : ch.url, ch.catchup, ch.catchupSource,
      ch.catchupDays, ch.il ? 1 : 0, ch.ua ? 1 : 0, ch.id];
    if (idOfKey(ch.key) !== ch.id) return r;      // an id the key does not give (none, or one with a «|»): kept, row in full
    r.pop();
    while (r.length > 1 && !r[r.length - 1]) r.pop();
    return r;
  }
  function fromRow(r, num) {
    return channel({ key: r[0], num: num, id: r.length > 10 ? r[10] : idOfKey(r[0]), name: r[1], logo: r[2], groupId: r[3] || '', url: r[4],
      catchup: r[5], catchupSource: r[6], catchupDays: r[7], il: r[8], ua: r[9] });
  }
  // "m3u:<id>|<group>" or "ott:<id>" -> the id it starts with.
  function idOfKey(key) { var bar = key.indexOf('|'); return key.substring(4, bar < 0 ? key.length : bar); }

  // The last channel: [id, name ('' unnamed), logo, group id, url, catchup, catchupSource, catchupDays, il, ua, key, num]
  // (the format of 1.8: a last channel saved by an older version is read back as it was).
  function pack(ch) {
    return [ch.id, ch.unnamed ? '' : ch.name, ch.logo, ch.groupId, ch.key.indexOf('ott:') === 0 ? '' : ch.url, ch.catchup, ch.catchupSource,
      ch.catchupDays, ch.il ? 1 : 0, ch.ua ? 1 : 0, ch.key, ch.num];
  }
  function unpack(r, num) {
    return channel({ key: r[10], num: num, id: r[0], name: r[1], logo: r[2], groupId: r[3], url: r[4], catchup: r[5], catchupSource: r[6],
      catchupDays: r[7], il: r[8], ua: r[9] });
  }
  // A copy written before 1.9.0 kept the group's translated name («Новостные»): the id is read from the key, with the
  // name shown then telling a repeated entry's «#2» from a group's own. Its entry with no name was saved under the
  // Russian placeholder: it is unnamed again (named in the interface language), as its key says (review 4, F10).
  function unpackV1(r, num) {
    var lc = String(r[1]).toLowerCase(), m3u = String(r[10]).indexOf('m3u:') === 0;
    var ch = unpack(m3u && !r[0] && lc === M3U.KEY_UNNAMED ? r.slice(0, 1).concat([''], r.slice(2)) : r, num);
    var g = m3u ? M3U.groupIdOfKey(r[10], r[0], lc, r[3]) : null;
    ch.groupId = g !== null ? g : r[3] === M3U.KEY_NO_GROUP ? '' : r[3];
    ch.group = I18n.group(ch.groupId);
    return ch;
  }
  function channel(x) {
    var ott = !x.url, name = x.name || I18n.t('m.channel');
    return { key: x.key, num: x.num, id: x.id, name: name, nameLc: String(name).toLowerCase(), unnamed: !x.name, logo: x.logo || '',
      groupId: x.groupId, group: I18n.group(x.groupId), url: ott ? OttClub.streamUrl(x.id) : x.url, catchup: x.catchup || '',
      catchupSource: x.catchupSource || '', catchupDays: x.catchupDays || 0, il: !!x.il, ua: !!x.ua, dead: !ott && M3U.unplayable(x.url) };
  }

  // done(result | null): the offline copy, or the raw list text written by versions before 1.8.
  function savedList(done) {
    var copy = Util.load('playlistSnap');
    if (copy && (copy.v === V || copy.v === 1) && copy.mode === mode() && copy.channels instanceof Array) {
      var channels = [], read = copy.v === V ? fromRow : unpackV1;
      for (var i = 0; i < copy.channels.length; i++) channels.push(read(copy.channels[i], i + 1));
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
    setHooks: setHooks, mode: mode, firstLaunch: firstLaunch, select: select, start: start,
    list: list, activeId: activeId, activeName: function () { var id = activeId(), f = freeBy(function (x) { return x.id === id; }); return f ? f.provider + ' · ' + f.name : id.indexOf(USER) === 0 ? I18n.ltr(shortName(urlOf(id))) : id; }, firstFreeId: function () { return freePlaylists()[0].id; }, idOfUrl: idOfUrl, addUser: addUser, switchTo: switchTo, removeUser: removeUser,
    onFirstFrame: onFirstFrame, rememberLanding: rememberLanding, lastChannel: lastChannel, onNetwork: onNetwork,
    loading: function () { return !!req; }
  };
}());
