// State machine and remote-control handling.
(function () {
  var K = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACK_DESKTOP: 8,
    CH_UP: 427, CH_DOWN: 428, PG_UP: 33, PG_DOWN: 34, F: 70, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
    PLAY_PAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, REWIND: 412, FF: 417, INFO: 457, CH_LIST: 10073,
    PREV_CH: 10190
  };
  var MEDIA_KEYS = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown',
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward', 'Info',
    'ChannelList', 'PreviousChannel', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  var all = [], groups = [];
  var favs = Util.store('favs') || {};
  var s = {
    playing: -1, previous: -1,
    guideOpen: false, focus: 'channels',          // 'groups' | 'channels'
    groupIdx: 0, chCursor: 0,
    archiveStart: 0, playStartedAt: 0,            // archiveStart 0 = live
    pausedAt: 0,
    seekTarget: 0, seekTimer: null,
    num: '', numTimer: null, lastBack: 0
  };

  // ---------- boot ----------
  // ---------- «О программе» (last row of the channel menu) ----------
  function openAbout() {
    closeGuide();
    s.about = true;
    var build = CONFIG.BUILD.indexOf('__') === 0 ? 'локальная' : CONFIG.BUILD;
    var model = s.tvModel || '', ua = navigator.userAgent;
    var tizen = (/Tizen\s*([\d.]+)/.exec(ua) || [])[1];
    var chromium = (/Chrome\/([\d]+)/.exec(ua) || [])[1];
    var alive = 0, dead = 0;
    for (var i = 0; i < all.length; i++) if (all[i].dead) dead++; else alive++;
    var rows = [
      ['Версия', CONFIG.VERSION],
      ['Сборка', build],
      ['Телевизор', (model || 'Samsung') + (tizen ? ' · Tizen ' + tizen : '') + (chromium ? ' · веб-движок Chromium ' + chromium : '')],
      ['Плеер', window.webapis ? 'аппаратный Samsung AVPlay' : 'браузер (hls.js)'],
      ['Источник каналов', OttClub.enabled() ? 'OTT Club (' + CONFIG.OTT_SERVER + ')' : 'M3U-плейлист'],
      ['Каналы', alive + ' доступно' + (dead ? ', ' + dead + ' отключены провайдером' : '') + ' · групп: ' + (groups.length - 2)],
      ['Архив', '7 дней · перемотка ползунком (▲)'],
      ['Сейчас', (all[s.playing] ? all[s.playing].name + ' · ' : '') + (Player.videoInfo() || 'нет данных о потоке')],
      ['Буфер', 'старт ' + 5 + ' с · после подгрузки 10 с · переподключение через ' + CONFIG.BUFFER_TIMEOUT_MS / 1000 + ' с (архив ' + CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS / 1000 + ' с)']
    ];
    var html = '';
    for (var r = 0; r < rows.length; r++) html += '<div class="about-row"><span class="about-k">' + Util.esc(rows[r][0]) + '</span><span class="about-v">' + Util.esc(rows[r][1]) + '</span></div>';
    Util.$('about-table').innerHTML = html;
    Util.show(Util.$('about'), true);
  }
  function closeAbout() { s.about = false; Util.show(Util.$('about'), false); openGuide(); }

  // Desktop check only: fit the 1920×1080 TV layout into the browser window.
  function fitDesktop() {
    if (window.webapis) return;
    var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transformOrigin = '0 0';
    document.body.style.transform = 'scale(' + k + ')';
  }

  function boot() {
    fitDesktop();
    window.addEventListener('resize', fitDesktop);
    UI.init();
    registerKeys();
    Player.setHooks({
      onBuffering: function (on) { UI.spinner(on); },
      // Once the picture is up, show the banner again with the stream's technical details.
      onPlaying: function () {
        UI.spinner(false);
        setTimeout(function () { if (!s.guideOpen && !s.scrub && !s.panel && !s.search) showBanner(); }, 1200);
      },
      onError: function (reason, n, delay) {
        // The first three retries (≈3.5 s) are silent: a channel switch or a short hiccup is not "no signal".
        if (n >= 4) UI.toast('Нет сигнала, переподключаюсь… (' + n + ')', delay + 500);
      },
      // End of an archive recording: carry on from that moment (the next show), or live if it is now.
      onEnded: function () { playArchive(position()); },
      onMutedStart: function () { UI.toast('Звук включится после любого нажатия или клика', 6000); }
    });
    document.addEventListener('keydown', function (e) {
      if (Player.unmute()) UI.toast('Звук включён', 1200);
      onKey(e);
    });
    document.addEventListener('click', onClick);
    UI.toast(window.webapis ? '◀ ▶ — каналы · ▲ — архив · ▼ — программа · OK — меню и поиск' : '← → каналы · ↑ архив · ↓ программа · Enter — меню и поиск', 7000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) Player.suspend(); else Player.resume();
    });
    watchNetwork();
    // The TV's own local API names the model (no extra privilege needed); used on «О программе».
    if (window.webapis) Util.get('http://127.0.0.1:8001/api/v2/', 5000, function (t) {
      try { var d = JSON.parse(t).device; s.tvModel = 'Samsung ' + d.modelName + (d.networkType ? ' · сеть ' + (d.networkType === 'wireless' ? 'Wi‑Fi' : 'кабель') : ''); } catch (e) {}
    }, function () {});
    if (OttClub.enabled() || playlistUrl()) startSources(); else showSetup();
  }

  function startSources() {
    if (OttClub.enabled()) EPG.setLoader(OttClub.guide);
    // Always start from the provider's current list. The saved copy is only a fallback
    // when the server does not answer, so a stale list is never shown while the network works.
    loadPlaylist(true);
    setInterval(function () { loadPlaylist(false); }, CONFIG.PLAYLIST_REFRESH_MS);
  }

  function playlistUrl() {
    return Util.store('playlistUrl') || (CONFIG.PLAYLIST_URL.indexOf('__') !== 0 ? CONFIG.PLAYLIST_URL : '');
  }

  // ---------- first run: key or playlist link ----------
  function showSetup() {
    s.setup = true;
    Util.show(Util.$('setup'), true);
    setTimeout(function () { Util.$('key-input').focus(); }, 300);
  }

  function submitSetup() {
    var text = Util.$('key-input').value;
    var err = Util.$('setup-err');
    var key = OttClub.extractKey(text);
    if (key) {
      err.textContent = 'Проверяю ключ…';
      OttClub.checkKey(key, function (ok) {
        if (!ok) { err.textContent = 'Ключ не подошёл. Проверьте и вставьте ещё раз.'; return; }
        OttClub.saveKey(key);
        finishSetup();
      });
    } else if (/^https?:\/\//.test(text)) {
      Util.store('playlistUrl', text.replace(/^\s+|\s+$/g, ''));
      finishSetup();
    } else {
      err.textContent = 'Это не похоже на ключ или ссылку.';
    }
  }

  // Blue in the guide: enter a different key. The current one stays until a new one passes the check.
  function changeKey() {
    Util.$('key-input').value = '';
    Util.$('setup-err').textContent = 'Сейчас используется сохранённый ключ. Введите новый или нажмите «Назад».';
    s.changingKey = true;
    showSetup();
  }

  function finishSetup() {
    if (s.changingKey) { s.changingKey = false; window.location.reload(); return; }
    s.setup = false;
    Util.$('key-input').blur();
    Util.show(Util.$('setup'), false);
    try { localStorage.removeItem('playlistText'); } catch (e) {}
    startSources();
  }

  // Two sources: the OTT Club API (when a subscriber key is built in) or any M3U playlist.
  function parseSource(text) {
    if (OttClub.enabled()) return OttClub.parse(text);
    return text.indexOf('#EXTINF') >= 0 ? M3U.parse(text) : null;
  }

  function loadPlaylist(blocking) {
    if (blocking) UI.spinner(true);
    Util.get(OttClub.enabled() ? OttClub.sourceUrl() : playlistUrl(), 20000, function (text) {
      if (!parseSource(text)) { if (blocking) UI.fatal('Список каналов пуст или недоступен.'); return; }
      try { localStorage.setItem('playlistText', JSON.stringify(text)); } catch (e) {}
      s.fromSaved = false;
      apply(text);
    }, function (err) {
      if (!blocking && !s.fromSaved) return;
      if (!all.length) {
        var saved = Util.store('playlistText');
        if (saved) { s.fromSaved = true; apply(saved); UI.toast('Сервер не ответил — показан последний список, обновлю автоматически', 5000); }
        else { UI.spinner(false); UI.fatal('Не удалось загрузить список каналов (' + err + '). Повтор через 10 с.'); }
      }
      // Keep retrying until a fresh list arrives (silently once something is on screen).
      setTimeout(function () { loadPlaylist(!all.length); }, 10000);
    });
  }

  function apply(text) {
    var firstLoad = !all.length;
    var playingUrl = s.playing >= 0 ? all[s.playing].url : Util.store('lastUrl');
    var parsed = parseSource(text);
    if (!parsed) return;
    all = parsed.channels;
    // Until this launch's check finishes, hide what the previous check found removed.
    rebuildGroups();
    UI.fatal('');
    // Let the first channel take the whole bandwidth; check the rest 15 s later.
    clearTimeout(s.healthTimer);
    s.healthTimer = setTimeout(healthCheck, 15000);
    var wanted = {};
    for (var i = 0; i < all.length; i++) if (all[i].id) wanted[all[i].id] = true;
    EPG.load(CONFIG.EPG_URL || parsed.epgUrl, wanted, function () { if (s.guideOpen) renderGuide(); });
    var idx = indexOfUrl(playingUrl);
    if (firstLoad) tune(idx >= 0 ? idx : 0);
    else s.playing = idx;
  }

  function rebuildGroups() {
    groups = M3U.groupsOf(all, function (c) { return !c.dead; });
    addPinnedGroups();
    rebuildFavGroup();
    groups.unshift({ name: '🔍 Поиск', items: [], search: true });
    groups.push({ name: 'ℹ О программе', items: [], about: true });
    s.groupIdx = clamp(s.groupIdx, groups.length);
    if (groups[s.groupIdx]) s.chCursor = clamp(s.chCursor, groups[s.groupIdx].items.length);
  }

  // Every launch (and every list refresh) re-checks every channel, 4 at a time, ~0.1 s each:
  // channels the provider removed disappear, channels it restored come back. Nothing stale survives.
  function healthCheck() {
    var list = all, next = 0, active = 0, removed = 0;
    function pump() {
      while (active < 4 && next < list.length) check(list[next++]);
      if (active === 0 && next >= list.length) finish();
    }
    function check(ch) {
      active++;
      Util.get(ch.url, 8000, function (text) {
        ch.dead = isDeadPlaylist(text);
        if (ch.dead) removed++;
        active--; pump();
      }, function () { active--; pump(); });   // a network error is not proof of removal: keep the channel
    }
    function finish() {
      if (list !== all) return;                // a newer list arrived meanwhile; its own check wins
      rebuildGroups();
      if (s.guideOpen) renderGuide();
      if (removed) UI.toast('Проверено каналов: ' + list.length + ', отключены провайдером: ' + removed, 3500);
    }
    pump();
  }

  function isDeadPlaylist(text) {
    return text.indexOf('/system/') >= 0 ||
      (text.indexOf('#EXT-X-STREAM-INF') >= 0 && text.indexOf('RESOLUTION=') < 0 && text.indexOf('avc1') < 0 && text.indexOf('hvc1') < 0);
  }

  // Extra groups shown right after "All channels" (the channels also stay in their own group).
  // Order inside: the number in the channel name first (Channel 9, 11, 12 ...), then the rest.
  function addPinnedGroups() {
    for (var p = 0; p < ORDER.PINNED.length; p++) {
      var pin = ORDER.PINNED[p], items = [];
      for (var i = 0; i < all.length; i++) if (!all[i].dead && all[i].name.indexOf(pin.match) >= 0) items.push(i);
      items.sort(function (a, b) { return nameNumber(all[a].name) - nameNumber(all[b].name) || a - b; });
      if (items.length) groups.splice(allIdx() + 1 + p, 0, { name: pin.name, items: items });
    }
  }
  function nameNumber(name) { var m = /\b(\d{1,3})\b/.exec(name); return m ? +m[1] : 1000; }

  function rebuildFavGroup() {
    for (var g = groups.length - 1; g >= 0; g--) if (groups[g].fav) groups.splice(g, 1);
    var after = allIdx() + 1;
    var items = [];
    for (var i = 0; i < all.length; i++) if (favs[all[i].url]) items.push(i);
    if (items.length) groups.splice(after, 0, { name: '★ Избранное', items: items, fav: true });
  }

  function allIdx() {
    for (var g = 0; g < groups.length; g++) if (groups[g].all) return g;
    return 0;
  }

  function indexOfUrl(u) {
    for (var i = 0; i < all.length; i++) if (all[i].url === u) return i;
    return -1;
  }

  // ---------- playback ----------
  // dir: +1/-1 when zapping (a dead channel is skipped in that direction), 0 for a direct pick.
  function tune(idx, dir) {
    if (idx < 0 || idx >= all.length) return;
    var ch = all[idx];
    // The channel already on screen (live) is not reopened: OK on it just closes the menu.
    if (idx === s.playing && !s.archiveStart && !s.pausedAt) { showBanner(); return; }
    if (ch.dead) {
      if (dir) { tune(nextFrom(idx, dir), dir); return; }
      UI.toast('Канал «' + ch.name + '» отключён провайдером');
      return;
    }
    checkAlive(ch, function () {
      if (all[s.playing] !== ch) return;
      UI.toast('Канал «' + ch.name + '» отключён провайдером', 3500);
      if (dir) tune(nextFrom(idx, dir), dir);
    });
    if (s.playing !== idx) s.previous = s.playing;
    s.playing = idx;
    s.archiveStart = 0; s.pausedAt = 0;
    Util.store('lastUrl', all[idx].url);
    // Fast zapping shows each name at once but opens only the channel the viewer stops on.
    clearTimeout(s.zapTimer);
    if (dir) s.zapTimer = setTimeout(function () { Player.play(ch.url); }, 350);
    else Player.play(ch.url);
    s.playStartedAt = Date.now();
    showBanner();
  }

  // A removed channel still answers, but with the provider's "/system/" placeholder clip or an
  // audio-only stub. One 0.1 s request runs alongside playback start, so a live channel loses nothing.
  function checkAlive(ch, onDead) {
    Util.get(ch.url, 8000, function (text) {
      if (isDeadPlaylist(text)) { ch.dead = true; rebuildGroups(); onDead(); }
    }, function () {});
  }

  function playArchive(fromMs) {
    var ch = all[s.playing];
    if (!Catchup.supported(ch)) { UI.toast('Для этого канала архив недоступен'); return; }
    var minMs = Date.now() - (ch.catchupDays || 7) * 86400000;
    fromMs = Math.max(minMs, fromMs);
    // Close to the live edge the archive would only arrive in short pieces: switch to live instead.
    if (fromMs >= Date.now() - CONFIG.LIVE_SNAP_MS) { tune(s.playing); UI.toast('Прямой эфир'); return; }
    var p = EPG.at(ch.id, fromMs);
    s.archiveStart = fromMs; s.pausedAt = 0;
    Player.play(Catchup.url(ch, fromMs, p ? p.stop - fromMs : 0));
    s.playStartedAt = Date.now();
    showBanner();
  }

  // Wall-clock moment currently on screen.
  function position() {
    if (!s.archiveStart) return Date.now();
    return s.archiveStart + ((s.pausedAt || Date.now()) - s.playStartedAt);
  }

  // ---------- archive scrubber (▼ while watching) ----------
  // A timeline of the programme under the knob. Nothing is reloaded while the knob moves;
  // OK opens the archive once, at the chosen moment.
  function openScrub() {
    var ch = all[s.playing];
    if (!ch) return;
    if (!Catchup.supported(ch)) { showBanner(); UI.toast('У этого канала нет архива'); return; }
    EPG.ensure(ch.id, function () { if (s.scrub) renderScrub(); });
    s.scrub = { t: position(), lastKey: 0, run: 0 };
    UI.hideBanner();
    Util.show(Util.$('scrub'), true);
    renderScrub();
  }
  function closeScrub() { s.scrub = null; Util.show(Util.$('scrub'), false); }

  function scrubKey(k) {
    var sc = s.scrub, ch = all[s.playing], now = Date.now();
    var minT = now - (ch.catchupDays || 7) * 86400000;
    if (k === K.LEFT || k === K.RIGHT || k === K.REWIND || k === K.FF) {
      // Holding the key repeats it: the step grows from 30 s to 2 min to 10 min.
      sc.run = now - sc.lastKey < 450 ? sc.run + 1 : 0;
      sc.lastKey = now;
      var step = sc.run < 6 ? 30000 : sc.run < 16 ? 120000 : 600000;
      if (k === K.REWIND || k === K.FF) step = Math.max(step, 300000);
      sc.t += (k === K.LEFT || k === K.REWIND ? -1 : 1) * step;
    } else if (k === K.UP || k === K.DOWN) {
      var cur = EPG.at(ch.id, sc.t);
      if (k === K.UP) { var prev = cur ? EPG.at(ch.id, cur.start - 1000) : null; sc.t = prev ? prev.start : sc.t - 1800000; }
      else sc.t = cur ? cur.stop : sc.t + 1800000;
    } else if (k === K.ENTER) {
      var t = sc.t; closeScrub(); playArchive(t); return;
    } else if (k === K.BACK || k === K.BACK_DESKTOP) {
      closeScrub(); return;
    } else return;
    sc.t = Math.max(minT, Math.min(now, sc.t));
    renderScrub();
  }

  function renderScrub() {
    var sc = s.scrub, ch = all[s.playing], now = Date.now();
    if (!sc || !ch) return;
    var p = EPG.at(ch.id, sc.t);
    // Without a guide entry the bar spans the hour around the knob.
    var from = p ? p.start : sc.t - 1800000, to = p ? p.stop : sc.t + 1800000;
    var pct = function (x) { return Math.max(0, Math.min(100, (x - from) / (to - from) * 100)) + '%'; };
    Util.$('s-title').textContent = ch.name + (p ? '  ·  ' + p.title : '');
    Util.$('s-time').textContent = sc.t >= now - CONFIG.LIVE_SNAP_MS ? 'прямой эфир' : hhmmss(new Date(sc.t));
    Util.$('s-start').textContent = Util.hhmm(new Date(from));
    Util.$('s-end').textContent = Util.hhmm(new Date(to));
    var behind = Math.round((now - sc.t) / 60000);
    Util.$('s-delta').textContent = behind > 0 ? '−' + fmtMin(behind) + ' от эфира' : '';
    Util.$('s-played').style.width = pct(Math.min(now, to));
    Util.$('s-now').style.left = pct(now);
    Util.$('s-now').style.display = now >= from && now <= to ? 'block' : 'none';
    Util.$('s-knob').style.left = pct(sc.t);
  }
  function hhmmss(d) { var s2 = d.getSeconds(); return Util.hhmm(d) + ':' + (s2 < 10 ? '0' : '') + s2; }

  function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин' : m + ' мин'; }

  function togglePause() {
    var ch = all[s.playing];
    if (!s.pausedAt) {
      if (!s.archiveStart && !Catchup.supported(ch)) { UI.toast('Пауза недоступна: у канала нет архива'); return; }
      if (!s.archiveStart) { s.archiveStart = Date.now(); s.playStartedAt = Date.now(); }
      s.pausedAt = Date.now();
      Player.suspend();
      UI.toast('⏸ Пауза', 100000000);
    } else {
      var resumeAt = position();
      s.pausedAt = 0;
      UI.toast('▶', 800);
      playArchive(resumeAt);
    }
  }

  function showBanner() {
    var ch = all[s.playing];
    if (!ch) return;
    EPG.ensure(ch.id, function () { if (all[s.playing] === ch && !s.guideOpen) showBanner(); });
    var t = position();
    var cur = EPG.at(ch.id, t), next = cur ? EPG.at(ch.id, cur.stop + 1000) : null;
    var line1 = cur ? Util.hhmm(new Date(cur.start)) + '–' + Util.hhmm(new Date(cur.stop)) + '  ' + cur.title : '';
    var line2 = next ? 'Далее ' + Util.hhmm(new Date(next.start)) + '  ' + next.title : '';
    var progress = cur ? (t - cur.start) / (cur.stop - cur.start) * 100 : 0;
    var extra = s.archiveStart ? 'Архив · ' + Util.hhmm(new Date(t)) : '';
    UI.banner(ch, line1, line2, progress, extra, Player.videoInfo());
  }

  function watchNetwork() {
    try {
      webapis.network.addNetworkStateChangeListener(function (v) {
        if (v === webapis.network.NetworkState.GATEWAY_CONNECTED) { UI.toast('Сеть восстановлена'); Player.reconnect(); }
        if (v === webapis.network.NetworkState.GATEWAY_DISCONNECTED) UI.toast('Нет сети', 5000);
      });
    } catch (e) {}
  }

  // ---------- guide ----------
  function openGuide() {
    s.guideOpen = true;
    s.focus = 'channels';
    var g = groups[s.groupIdx];
    var at = g ? g.items.indexOf(s.playing) : -1;
    if (at < 0) { s.groupIdx = allIdx(); at = Math.max(0, groups[s.groupIdx].items.indexOf(s.playing)); }
    s.chCursor = Math.max(0, at);
    UI.hideBanner();
    UI.guide(true);
    renderGuide();
  }
  function closeGuide() { s.guideOpen = false; UI.guide(false); }

  function cursorChannel() { var g = groups[s.groupIdx]; return g ? all[g.items[s.chCursor]] : null; }

  function renderGuide() {
    var g = groups[s.groupIdx];
    if (!g) return;
    UI.groups(groups, s.groupIdx, s.focus === 'groups');
    UI.channels(g.items, s.chCursor, s.focus === 'channels', all, s.playing, favs);
  }

  function currentProgIndex(list) {
    var now = Date.now();
    for (var i = 0; i < list.length; i++) if (list[i].stop > now) return i;
    return Math.max(0, list.length - 1);
  }

  function dateName(off) {
    var d = new Date(Date.now() + off * 86400000);
    return ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1);
  }

  function guideKey(k) {
    var g = groups[s.groupIdx];
    switch (k) {
      case K.UP: move(-1); break;
      case K.DOWN: move(1); break;
      case K.CH_UP: case K.PG_UP: move(-CONFIG.VISIBLE_ROWS); break;
      case K.CH_DOWN: case K.PG_DOWN: move(CONFIG.VISIBLE_ROWS); break;
      case K.LEFT: s.focus = 'groups'; break;
      case K.RIGHT:
        if (s.focus === 'groups' && g.search) { openSearch(); return; }
        if (s.focus === 'groups' && g.about) { openAbout(); return; }
        s.focus = 'channels';
        break;
      case K.ENTER:
        if (s.focus === 'groups' && g.search) { openSearch(); return; }
        if (s.focus === 'groups' && g.about) { openAbout(); return; }
        if (s.focus === 'groups') { s.focus = 'channels'; s.chCursor = 0; break; }
        closeGuide(); tune(g.items[s.chCursor]); return;
      case K.YELLOW: case K.F: case K.PLAY_PAUSE: toggleFav(); break;
      case K.BLUE: closeGuide(); changeKey(); return;
      case K.BACK: case K.BACK_DESKTOP: case K.CH_LIST: closeGuide(); return;
      default: return;
    }
    renderGuide();
  }

  function move(d) {
    if (s.focus === 'groups') {
      s.groupIdx = clamp(s.groupIdx + d, groups.length); s.chCursor = 0;
    } else {
      s.chCursor = clamp(s.chCursor + d, groups[s.groupIdx].items.length);
    }
  }

  function clamp(v, n) { return Math.max(0, Math.min(n - 1, v)); }

  // ---------- programme panel (▼ while watching) ----------
  // Over the video, without the channel menu: ▲▼ shows, ◀ ▶ days, OK watches (archive or live).
  function openPanel() {
    var ch = all[s.playing];
    if (!ch) return;
    s.panel = { day: 0, cursor: -1 };
    UI.hideBanner();
    Util.show(Util.$('prog'), true);
    EPG.ensure(ch.id, function () { if (s.panel) renderPanel(); });
    renderPanel();
  }
  function closePanel() { s.panel = null; Util.show(Util.$('prog'), false); }

  function panelList() { var ch = all[s.playing]; return ch ? EPG.day(ch.id, s.panel.day) : []; }

  function renderPanel() {
    var ch = all[s.playing], list = panelList();
    if (s.panel.cursor < 0 || s.panel.cursor >= list.length) s.panel.cursor = s.panel.day === 0 ? currentProgIndex(list) : 0;
    var dayName = s.panel.day === 0 ? 'Сегодня' : s.panel.day === -1 ? 'Вчера' : s.panel.day === 1 ? 'Завтра' : dateName(s.panel.day);
    UI.panel(ch.name + ' — ' + dayName,
      list.length ? list : [{ start: Date.now(), stop: Date.now(), title: 'Программа загружается…' }],
      s.panel.cursor, Date.now(), Catchup.supported(ch));
  }

  function panelKey(k) {
    var ch = all[s.playing], list = panelList();
    var maxBack = -(ch.catchupDays || 7);
    if (k === K.UP) s.panel.cursor = Math.max(0, s.panel.cursor - 1);
    else if (k === K.DOWN) s.panel.cursor = Math.min(list.length - 1, s.panel.cursor + 1);
    else if (k === K.LEFT || k === K.CH_DOWN || k === K.PG_DOWN) { s.panel.day = Math.max(maxBack, s.panel.day - 1); s.panel.cursor = -1; }
    else if (k === K.RIGHT || k === K.CH_UP || k === K.PG_UP) { s.panel.day = Math.min(1, s.panel.day + 1); s.panel.cursor = -1; }
    else if (k === K.ENTER) {
      var p = list[s.panel.cursor], now = Date.now();
      if (!p) return;
      if (p.start > now) { UI.toast('Передача ещё не началась'); return; }
      closePanel();
      if (p.stop > now && !Catchup.supported(ch)) { tune(s.playing); return; }
      playArchive(p.start);
      return;
    } else if (k === K.BACK || k === K.BACK_DESKTOP) { closePanel(); return; }
    else return;
    renderPanel();
  }

  // ---------- search (first row of the channel menu) ----------
  function openSearch() {
    closeGuide();
    s.search = { results: [], cursor: 0, inList: false };
    var input = Util.$('search-input');
    input.value = '';
    Util.show(Util.$('search'), true);
    input.oninput = function () { s.search.cursor = 0; filterSearch(); };
    filterSearch();
    setTimeout(function () { input.focus(); }, 200);
  }
  function closeSearch() { s.search = null; Util.$('search-input').blur(); Util.show(Util.$('search'), false); }

  // Case-insensitive match on the name; digits also match the channel number.
  function filterSearch() {
    var q = Util.$('search-input').value.replace(/^\s+|\s+$/g, '').toLowerCase(), out = [];
    for (var i = 0; i < all.length && out.length < 60; i++) {
      var ch = all[i];
      if (ch.dead) continue;
      if (!q || ch.name.toLowerCase().indexOf(q) >= 0 || String(ch.num) === q) out.push(i);
    }
    s.search.results = out;
    s.search.cursor = Math.min(s.search.cursor, Math.max(0, out.length - 1));
    UI.searchResults(out, s.search.cursor, s.search.inList, all);
  }

  function searchKey(k, e) {
    var sr = s.search, input = Util.$('search-input');
    if (!sr.inList) {
      // Typing goes to the field; OK / Done / ▼ moves into the results.
      if (k === 13 || k === 65376 || k === K.DOWN) {
        e.preventDefault();
        if (sr.results.length) { sr.inList = true; input.blur(); UI.searchResults(sr.results, sr.cursor, true, all); }
      } else if (k === K.BACK || k === 27) { e.preventDefault(); closeSearch(); openGuide(); }
      return;
    }
    e.preventDefault();
    if (k === K.UP) {
      if (sr.cursor === 0) { sr.inList = false; input.focus(); } else sr.cursor--;
    } else if (k === K.DOWN) sr.cursor = Math.min(sr.results.length - 1, sr.cursor + 1);
    else if (k === K.ENTER) { var idx = sr.results[sr.cursor]; closeSearch(); tune(idx); return; }
    else if (k === K.BACK || k === K.BACK_DESKTOP) { sr.inList = false; input.focus(); }
    UI.searchResults(sr.results, sr.cursor, sr.inList, all);
  }

  function toggleFav() {
    var ch = cursorChannel();
    if (!ch) return;
    if (favs[ch.url]) delete favs[ch.url]; else favs[ch.url] = true;
    Util.store('favs', favs);
    var keepUrl = ch.url, keepGroup = groups[s.groupIdx].name;
    rebuildFavGroup();
    for (var i = 0; i < groups.length; i++) if (groups[i].name === keepGroup) s.groupIdx = i;
    s.groupIdx = clamp(s.groupIdx, groups.length);
    var at = groups[s.groupIdx].items.indexOf(indexOfUrl(keepUrl));
    s.chCursor = at >= 0 ? at : clamp(s.chCursor, groups[s.groupIdx].items.length);
    UI.toast(favs[keepUrl] ? 'Добавлено в избранное' : 'Убрано из избранного');
  }

  // ---------- mouse (desktop preview; the TV remote never produces clicks) ----------
  function onClick(e) {
    if (Player.unmute()) UI.toast('Звук включён', 1200);
    if (s.setup) return;
    if (!s.guideOpen) { openGuide(); return; }
    var el = e.target;
    while (el && el !== document.body && el.getAttribute && el.getAttribute('data-i') === null) el = el.parentNode;
    if (!el || el === document.body || !el.getAttribute) return;
    var i = +el.getAttribute('data-i'), col = el.parentNode.id;
    if (col === 'groups') { s.focus = 'groups'; s.groupIdx = i; s.chCursor = 0; renderGuide(); return; }
    if (col === 'channels') { s.focus = 'channels'; s.chCursor = i; guideKey(K.ENTER); }
  }

  // ---------- live keys ----------
  function onKey(e) {
    var k = e.keyCode;
    if (s.setup) {
      // 13 = Enter, 65376 = "Done" on the Tizen on-screen keyboard
      if (k === 13 || k === 65376) { e.preventDefault(); submitSetup(); }
      if ((k === K.BACK || k === 27) && s.changingKey) {
        s.changingKey = false; s.setup = false;
        Util.$('key-input').blur();
        Util.show(Util.$('setup'), false);
      }
      return;
    }
    if (s.about) { if (k === K.BACK || k === K.BACK_DESKTOP || k === K.ENTER || k === 27) { e.preventDefault(); closeAbout(); } return; }
    if (s.search) { searchKey(k, e); return; }
    if (s.panel) { panelKey(k); e.preventDefault(); return; }
    if (s.scrub) { scrubKey(k); e.preventDefault(); return; }
    if (s.guideOpen) { guideKey(k); e.preventDefault(); return; }
    if (k >= 48 && k <= 57) { digit(k - 48); return; }
    var g = groups[0];
    switch (k) {
      // ◀ ▶ (and CH−/CH+) zap; ▲ (or ⏪ ⏩) opens the archive slider; ▼ shows this channel's programme.
      case K.RIGHT: case K.CH_UP: tune(next(1), 1); break;
      case K.LEFT: case K.CH_DOWN: tune(next(-1), -1); break;
      case K.UP: case K.REWIND: case K.FF: openScrub(); if (s.scrub && k !== K.UP) scrubKey(k); break;
      case K.DOWN: openPanel(); break;
      case K.INFO: showBanner(); break;
      case K.ENTER: case K.CH_LIST: openGuide(); break;
      case K.PLAY_PAUSE: case K.PAUSE: togglePause(); break;
      case K.PLAY: if (s.pausedAt) togglePause(); break;
      case K.STOP: if (s.archiveStart) { tune(s.playing); UI.toast('Прямой эфир'); } break;
      case K.PREV_CH: if (s.previous >= 0) tune(s.previous); break;
      case K.RED: cycleAudio(); break;
      case K.GREEN: UI.toast('Экран: ' + Player.cycleDisplay()); break;
      case K.BLUE: UI.toast(Player.videoInfo() || 'Нет данных о потоке', 3000); break;
      case K.YELLOW:
        s.groupIdx = allIdx(); s.chCursor = Math.max(0, groups[s.groupIdx].items.indexOf(s.playing)); toggleFav(); break;
      case K.BACK: case K.BACK_DESKTOP:
        if (s.archiveStart) { tune(s.playing); UI.toast('Прямой эфир'); break; }
        if (Date.now() - s.lastBack < 2000) { try { tizen.application.getCurrentApplication().exit(); } catch (x) {} }
        s.lastBack = Date.now(); UI.toast('Нажмите «Назад» ещё раз для выхода'); break;
      default: return;
    }
    if (g) e.preventDefault();
  }

  function next(d) { return nextFrom(s.playing, d); }

  // Channel up/down walks the group the viewer last browsed, so favourites zap only favourites.
  // Known-dead channels are stepped over; the loop is bounded by the group size.
  function nextFrom(from, d) {
    var items = groups[s.groupIdx] && groups[s.groupIdx].items.indexOf(from) >= 0 ? groups[s.groupIdx].items : groups[allIdx()].items;
    var at = items.indexOf(from);
    for (var i = 1; i <= items.length; i++) {
      var cand = items[(at + d * i + items.length * i) % items.length];
      if (!all[cand].dead) return cand;
    }
    return from;
  }

  var audioIdx = 0;
  function cycleAudio() {
    var tracks = Player.audioTracks();
    if (tracks.length < 2) { UI.toast(tracks.length ? 'Звук: ' + tracks[0].label + ' (одна дорожка)' : 'Звук: одна дорожка'); return; }
    audioIdx = (audioIdx + 1) % tracks.length;
    Player.selectAudio(tracks[audioIdx].index);
    UI.toast('Звук: ' + tracks[audioIdx].label);
  }

  function digit(d) {
    s.num = (s.num + d).substr(0, 4);
    UI.numEntry(s.num);
    clearTimeout(s.numTimer);
    s.numTimer = setTimeout(function () {
      var n = parseInt(s.num, 10); s.num = ''; UI.numEntry('');
      if (n >= 1 && n <= all.length) tune(n - 1); else UI.toast('Нет канала ' + n);
    }, CONFIG.NUMBER_ENTRY_MS);
  }

  function registerKeys() {
    try {
      var supported = tizen.tvinputdevice.getSupportedKeys().map(function (x) { return x.name; });
      for (var i = 0; i < MEDIA_KEYS.length; i++) {
        if (supported.indexOf(MEDIA_KEYS[i]) >= 0) tizen.tvinputdevice.registerKey(MEDIA_KEYS[i]);
      }
    } catch (e) {}
  }

  window.onload = boot;
}());
