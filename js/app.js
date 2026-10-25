// State machine and remote-control handling.
(function () {
  var K = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACK_DESKTOP: 8,
    CH_UP: 427, CH_DOWN: 428, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
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
    guideOpen: false, focus: 'channels',          // 'groups' | 'channels' | 'programs'
    groupIdx: 0, chCursor: 0, progCursor: 0, dayOffset: 0,
    archiveStart: 0, playStartedAt: 0,            // archiveStart 0 = live
    pausedAt: 0,
    seekTarget: 0, seekTimer: null,
    num: '', numTimer: null, lastBack: 0
  };

  // ---------- boot ----------
  function boot() {
    UI.init();
    registerKeys();
    Player.setHooks({
      onBuffering: function (on) { UI.spinner(on); },
      onPlaying: function () { UI.spinner(false); },
      onError: function (reason, n, delay) {
        if (n >= 2) UI.toast('Нет сигнала, переподключаюсь… (' + n + ')', delay + 500);
      }
    });
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) Player.suspend(); else Player.resume();
    });
    watchNetwork();
    if (OttClub.enabled()) EPG.setLoader(OttClub.guide);
    var cached = Util.store('playlistText');
    if (cached) apply(cached);
    loadPlaylist(!cached);
    setInterval(function () { loadPlaylist(false); }, CONFIG.PLAYLIST_REFRESH_MS);
  }

  // Two sources: the OTT Club API (when a subscriber key is built in) or any M3U playlist.
  function parseSource(text) {
    if (OttClub.enabled()) return OttClub.parse(text);
    return text.indexOf('#EXTINF') >= 0 ? M3U.parse(text) : null;
  }

  function loadPlaylist(blocking) {
    if (blocking) UI.spinner(true);
    Util.get(OttClub.enabled() ? OttClub.sourceUrl() : CONFIG.PLAYLIST_URL, 20000, function (text) {
      if (!parseSource(text)) { if (blocking) UI.fatal('Список каналов пуст или недоступен.'); return; }
      try { localStorage.setItem('playlistText', JSON.stringify(text)); } catch (e) {}
      apply(text);
    }, function (err) {
      if (blocking) { UI.spinner(false); UI.fatal('Не удалось загрузить плейлист (' + err + '). Повтор через 10 с.'); setTimeout(function () { loadPlaylist(true); }, 10000); }
    });
  }

  function apply(text) {
    var firstLoad = !all.length;
    var playingUrl = s.playing >= 0 ? all[s.playing].url : Util.store('lastUrl');
    var parsed = parseSource(text);
    if (!parsed) return;
    all = parsed.channels;
    groups = parsed.groups;
    rebuildFavGroup();
    UI.fatal('');
    var wanted = {};
    for (var i = 0; i < all.length; i++) if (all[i].id) wanted[all[i].id] = true;
    EPG.load(CONFIG.EPG_URL || parsed.epgUrl, wanted, function () { if (s.guideOpen) renderGuide(); });
    var idx = indexOfUrl(playingUrl);
    if (firstLoad) tune(idx >= 0 ? idx : 0);
    else s.playing = idx;
  }

  function rebuildFavGroup() {
    if (groups.length && groups[1] && groups[1].fav) groups.splice(1, 1);
    var items = [];
    for (var i = 0; i < all.length; i++) if (favs[all[i].url]) items.push(i);
    if (items.length) groups.splice(1, 0, { name: '★ Избранное', items: items, fav: true });
  }

  function indexOfUrl(u) {
    for (var i = 0; i < all.length; i++) if (all[i].url === u) return i;
    return -1;
  }

  // ---------- playback ----------
  function tune(idx) {
    if (idx < 0 || idx >= all.length) return;
    if (s.playing !== idx) s.previous = s.playing;
    s.playing = idx;
    s.archiveStart = 0; s.pausedAt = 0;
    Util.store('lastUrl', all[idx].url);
    Player.play(all[idx].url);
    s.playStartedAt = Date.now();
    showBanner();
  }

  function playArchive(fromMs) {
    var ch = all[s.playing];
    if (!Catchup.supported(ch)) { UI.toast('Для этого канала архив недоступен'); return; }
    var minMs = Date.now() - (ch.catchupDays || 7) * 86400000;
    fromMs = Math.max(minMs, fromMs);
    if (fromMs >= Date.now() - 15000) { tune(s.playing); UI.toast('Прямой эфир'); return; }
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

  // Seeking accumulates key presses for 700 ms and then reopens once, so ten presses cost one request.
  function seek(deltaMs) {
    var ch = all[s.playing];
    if (!Catchup.supported(ch)) { UI.toast('Перемотка недоступна: у канала нет архива'); return; }
    s.seekTarget = (s.seekTarget || position()) + deltaMs;
    if (s.seekTarget > Date.now()) s.seekTarget = Date.now();
    var behind = Math.round((Date.now() - s.seekTarget) / 60000);
    UI.toast((deltaMs < 0 ? '⏪ ' : '⏩ ') + Util.hhmm(new Date(s.seekTarget)) + (behind > 0 ? '  (−' + fmtMin(behind) + ')' : '  прямой эфир'), 1500);
    clearTimeout(s.seekTimer);
    s.seekTimer = setTimeout(function () {
      var t = s.seekTarget; s.seekTarget = 0;
      playArchive(t);
    }, 700);
  }

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
    var vi = Player.videoInfo();
    UI.banner(ch, line1, line2, progress, [extra, vi].filter(Boolean).join('  ·  '));
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
    if (at < 0) { s.groupIdx = 0; at = s.playing; }
    s.chCursor = Math.max(0, at);
    s.dayOffset = 0; s.progCursor = 0;
    UI.hideBanner();
    UI.guide(true);
    renderGuide();
  }
  function closeGuide() { s.guideOpen = false; UI.guide(false); }

  function cursorChannel() { var g = groups[s.groupIdx]; return g ? all[g.items[s.chCursor]] : null; }

  function dayPrograms() {
    var ch = cursorChannel();
    return ch ? EPG.day(ch.id, s.dayOffset) : [];
  }

  function renderGuide() {
    var g = groups[s.groupIdx];
    if (!g) return;
    UI.groups(groups, s.groupIdx, s.focus === 'groups');
    UI.channels(g.items, s.chCursor, s.focus === 'channels', all, s.playing, favs);
    var ch = cursorChannel();
    if (ch) EPG.ensure(ch.id, function () { if (s.guideOpen && cursorChannel() === ch) renderGuide(); });
    var list = dayPrograms();
    if (s.focus !== 'programs') s.progCursor = currentProgIndex(list);
    var dayName = s.dayOffset === 0 ? 'Сегодня' : s.dayOffset === -1 ? 'Вчера' : dateName(s.dayOffset);
    var arch = ch && Catchup.supported(ch);
    UI.programs((ch ? ch.name : '') + ' — ' + dayName + (arch ? '' : '  (без архива)'),
      list.length ? list : [{ start: Date.now(), stop: Date.now(), title: EPG.isReady() ? 'Нет программы' : 'Программа загружается…' }],
      s.progCursor, s.focus === 'programs', Date.now(), arch);
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
      case K.CH_UP: if (s.focus === 'programs') day(1); else move(-CONFIG.VISIBLE_ROWS); break;
      case K.CH_DOWN: if (s.focus === 'programs') day(-1); else move(CONFIG.VISIBLE_ROWS); break;
      case K.LEFT:
        s.focus = s.focus === 'programs' ? 'channels' : 'groups'; break;
      case K.RIGHT:
        s.focus = s.focus === 'groups' ? 'channels' : 'programs';
        if (s.focus === 'programs') s.progCursor = currentProgIndex(dayPrograms());
        break;
      case K.ENTER:
        if (s.focus === 'groups') { s.focus = 'channels'; s.chCursor = 0; break; }
        if (s.focus === 'channels') { closeGuide(); tune(g.items[s.chCursor]); return; }
        playProgram(); return;
      case K.YELLOW: toggleFav(); break;
      case K.BACK: case K.BACK_DESKTOP: case K.CH_LIST: closeGuide(); return;
      default: return;
    }
    renderGuide();
  }

  function move(d) {
    if (s.focus === 'groups') {
      s.groupIdx = clamp(s.groupIdx + d, groups.length); s.chCursor = 0;
    } else if (s.focus === 'channels') {
      s.chCursor = clamp(s.chCursor + d, groups[s.groupIdx].items.length);
      s.dayOffset = 0;
    } else {
      s.progCursor = clamp(s.progCursor + d, dayPrograms().length);
    }
  }

  function day(d) {
    var ch = cursorChannel();
    var maxBack = -(ch && ch.catchupDays ? ch.catchupDays : 7);
    s.dayOffset = Math.max(maxBack, Math.min(1, s.dayOffset + d));
    s.progCursor = 0;
  }

  function clamp(v, n) { return Math.max(0, Math.min(n - 1, v)); }

  function playProgram() {
    var list = dayPrograms(), p = list[s.progCursor];
    var idx = groups[s.groupIdx].items[s.chCursor];
    if (!p) return;
    var now = Date.now();
    if (p.start > now) { UI.toast('Передача ещё не началась'); return; }
    closeGuide();
    if (s.playing !== idx) { s.previous = s.playing; s.playing = idx; Util.store('lastUrl', all[idx].url); }
    if (p.stop > now && !Catchup.supported(all[idx])) { tune(idx); return; }
    playArchive(p.start);
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

  // ---------- live keys ----------
  function onKey(e) {
    var k = e.keyCode;
    if (s.guideOpen) { guideKey(k); e.preventDefault(); return; }
    if (k >= 48 && k <= 57) { digit(k - 48); return; }
    var g = groups[0];
    switch (k) {
      case K.UP: case K.CH_UP: tune(next(1)); break;
      case K.DOWN: case K.CH_DOWN: tune(next(-1)); break;
      case K.ENTER: case K.CH_LIST: openGuide(); break;
      case K.INFO: showBanner(); break;
      case K.LEFT: seek(-30000); break;
      case K.RIGHT: if (s.archiveStart) seek(30000); else showBanner(); break;
      case K.REWIND: seek(-300000); break;
      case K.FF: if (s.archiveStart) seek(300000); break;
      case K.PLAY_PAUSE: case K.PAUSE: togglePause(); break;
      case K.PLAY: if (s.pausedAt) togglePause(); break;
      case K.STOP: if (s.archiveStart) { tune(s.playing); UI.toast('Прямой эфир'); } break;
      case K.PREV_CH: if (s.previous >= 0) tune(s.previous); break;
      case K.RED: cycleAudio(); break;
      case K.GREEN: UI.toast('Экран: ' + Player.cycleDisplay()); break;
      case K.BLUE: UI.toast(Player.videoInfo() || 'Нет данных о потоке', 3000); break;
      case K.YELLOW:
        s.groupIdx = 0; s.chCursor = s.playing; toggleFav(); break;
      case K.BACK: case K.BACK_DESKTOP:
        if (s.archiveStart) { tune(s.playing); UI.toast('Прямой эфир'); break; }
        if (Date.now() - s.lastBack < 2000) { try { tizen.application.getCurrentApplication().exit(); } catch (x) {} }
        s.lastBack = Date.now(); UI.toast('Нажмите «Назад» ещё раз для выхода'); break;
      default: return;
    }
    if (g) e.preventDefault();
  }

  function next(d) {
    // Channel up/down walks the group the viewer last browsed, so favourites zap only favourites.
    var items = groups[s.groupIdx] && groups[s.groupIdx].items.indexOf(s.playing) >= 0 ? groups[s.groupIdx].items : groups[0].items;
    var at = items.indexOf(s.playing);
    return items[(at + d + items.length) % items.length];
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
