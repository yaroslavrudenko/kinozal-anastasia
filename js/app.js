// Boot, wiring of the modules' hooks, and the remote-control keys while watching.
(function () {
  var lastBack = 0, guideNoticeShown = false;

  // Optional platform setup: a throw is recorded and boot carries on (a TV refusing one of these calls
  // must never leave the screen black).
  function optional(name, fn) { try { fn(); } catch (e) { Diag.note('boot.' + name, (e && (e.code || e.message)) || String(e)); } }

  // Required steps first, then the list and the saved channel, then the optional platform setup.
  function boot() {
    UI.init();
    Overlay.onBeforeOpen(function () { NumEntry.cancel(); Zap.cancel(); });
    Player.init({
      onBuffering: function (on) { UI.spinner(on); if (on) Playback.quiet(); },
      // The picture is up: the banner with this stream's technical line, at once.
      onFirstFrame: function () {
        UI.spinner(false);
        Zap.onFirstFrame();
        if (!Zap.choosing()) Banner.onFirstFrame();
      },
      onStable: Playback.onStable,
      // The first three retries (≈3.5 s) are silent: a channel switch or a short hiccup is not "no signal".
      onError: function (n, delay) { if (n >= 4) UI.toast('Нет сигнала, переподключаюсь… (' + n + ')', delay + 500); },
      onEnded: Playback.onEnded,
      onMutedStart: function () { UI.toast('Звук включится после любого нажатия или клика', 6000); },
      retryTarget: Playback.retryTarget
    });
    Playback.setHooks({ onOpened: function () { Banner.show(false); }, onBanner: function () { Banner.show(true); } });
    Sources.setHooks({ onApplied: onListApplied, onFatal: UI.fatal, onSpinner: UI.spinner, onGuide: Overlay.refresh,
      onNotice: function (text) { UI.toast(text, 5000); } });
    Health.setHooks({ onSwept: function (checked, removed) {
      Channels.rebuild();
      Overlay.refresh();
      if (removed) UI.toast('Проверено каналов: ' + checked + ', отключены провайдером: ' + removed, 3500);
    } });
    EPG.setHooks({
      onGuide: function () { Banner.onGuide(null); Overlay.refresh(); },
      onXmltvFailed: function () { if (!guideNoticeShown) UI.toast('Программа передач недоступна, повторю позже', 5000); guideNoticeShown = true; }
    });
    document.addEventListener('keydown', function (e) {
      if (Player.unmute()) UI.toast('Звук включён', 1200);
      onKey(e);
    });
    document.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', function () { if (document.hidden) Zap.cancel(); Playback.onVisibility(document.hidden); });
    startSource();
    optional('fit', function () { UI.fitDesktop(); window.addEventListener('resize', UI.fitDesktop); });
    optional('hint', function () {
      UI.toast(window.webapis ? '◀ ▶ — каналы · ▲ — архив · ▼ — программа · OK — меню и поиск' : '← → каналы · ↑ архив · ↓ программа · Enter — меню и поиск', 7000);
    });
    optional('network', Playback.watchNetwork);
    Util.idle(function () { optional('keys', Keys.register); });   // not needed for the first key press
  }

  // The list loads and the saved channel starts (in its own task right after this one), or setup opens.
  function startSource() {
    var mode = Sources.mode();
    if (!mode) { Overlay.open('setup'); return; }
    Sources.start();
    setTimeout(function () {
      var last = Sources.lastChannel();
      if (!Playback.current() && last && last.key.indexOf(mode + ':') === 0 && Channels.adultAllowed(last)) Zap.pick(last);
    }, 0);
  }

  // The list arrived: keep what is playing (with its fresh record), or start the first channel.
  function onListApplied(firstLoad) {
    var cur = Playback.current(), fresh = cur ? Channels.get(cur.key) : null;
    if (fresh) Playback.adopt(fresh);
    if (firstLoad && !Channels.isEligible(fresh)) startFirst();
    Overlay.refresh();
  }
  function startFirst() {
    var legacy = Util.load('lastUrl'), items = Channels.groups()[Channels.allIdx()].items, pickIdx = items[0];
    for (var i = 0; legacy && i < items.length; i++) if (Channels.at(items[i]).url === legacy) pickIdx = items[i];
    if (pickIdx !== undefined) Zap.pick(Channels.at(pickIdx));
  }

  // ---------- keys ----------
  function onKey(e) {
    var k = e.keyCode;
    if (Overlay.onKey(k, e)) return;
    if (Keys.isDigit(k)) { NumEntry.digit(k - K.DIGIT_0); e.preventDefault(); return; }
    if (liveKey(k)) e.preventDefault();
  }

  // Returns true when the key was handled.
  function liveKey(k) {
    var c = Playback.current(), mode = Playback.mode();
    if (k === K.RIGHT || k === K.CH_UP) Zap.step(1);
    else if (k === K.LEFT || k === K.CH_DOWN) Zap.step(-1);
    // ▲ (or ⏪ ⏩) opens the archive slider; ⏪ ⏩ also take a first step.
    else if (k === K.UP || k === K.REWIND || k === K.FF) { if (c) openScrub(c, k); }
    else if (k === K.DOWN) { if (c) Overlay.open('panel'); }
    else if (k === K.INFO) Banner.show(true);
    else if (k === K.ENTER || k === K.CH_LIST) { if (Channels.count()) Overlay.open('menu'); }
    else if (k === K.PLAY_PAUSE || k === K.PAUSE) Playback.togglePause();
    else if (k === K.PLAY) { if (mode === 'paused') Playback.togglePause(); }
    else if (k === K.STOP) { if (c && mode !== 'live') Playback.goLive(); }
    else if (k === K.PREV_CH) Zap.previous();
    else if (k === K.RED) Playback.cycleAudio();
    else if (k === K.GREEN) UI.toast('Экран: ' + Player.cycleDisplay());
    else if (k === K.BLUE) UI.toast(Player.streamInfo(true) || 'Нет данных о потоке', 3000);
    else if (k === K.YELLOW) { if (c) toggleFav(c); }
    else if (Keys.isBack(k)) back(c, mode);
    else return false;
    return true;
  }

  function openScrub(c, k) {
    if (!Catchup.supported(c)) { Banner.show(true); UI.toast('У этого канала нет архива'); return; }
    Overlay.open('scrub');
    if (k !== K.UP) Overlay.onKey(k, { preventDefault: function () {} });
  }

  // YELLOW while watching: the playing channel's favourite; the zap group stays as it was.
  function toggleFav(c) {
    var on = Favs.toggle(c.key);
    Channels.rebuild();
    UI.toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
  }

  function back(c, mode) {
    if (c && mode !== 'live' && mode !== 'idle') { Playback.goLive(); return; }
    if (Date.now() - lastBack < CONFIG.EXIT_CONFIRM_MS) {
      try { tizen.application.getCurrentApplication().exit(); } catch (e) { Diag.note('exit', (e && e.message) || String(e)); }
    }
    lastBack = Date.now();
    UI.toast('Нажмите «Назад» ещё раз для выхода');
  }

  // ---------- mouse (desktop preview; the TV remote never produces clicks) ----------
  function onClick(e) {
    if (Player.unmute()) UI.toast('Звук включён', 1200);
    if (Overlay.mode() === 'setup') return;
    if (Overlay.isNone()) { if (Channels.count()) Overlay.open('menu'); return; }
    var el = e.target;
    while (el && el !== document.body && el.getAttribute && el.getAttribute('data-i') === null) el = el.parentNode;
    if (el && el !== document.body && el.getAttribute) Overlay.onClick(el);
  }

  // Boot runs in its own task after the load event, so the first page layout and the app's start-up
  // are never one long task.
  window.onload = function () { setTimeout(boot, 0); };
}());
