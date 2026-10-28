// Boot, wiring of the modules' hooks, and the remote-control keys while watching.
(function () {
  var lastBack = 0, guideNoticeShown = false, failures = 0;

  // Optional platform setup: a throw is recorded and boot carries on (a TV refusing one of these calls
  // must never leave the screen black).
  function optional(name, fn) { try { fn(); } catch (e) { Diag.note('boot.' + name, (e && (e.code || e.message)) || String(e)); } }

  // Required steps first, then the list and the saved channel, then the optional platform setup.
  function boot() {
    UI.init();
    I18n.apply();                      // the interface language (RU by default) and its writing direction
    Overlay.onBeforeOpen(function () { NumEntry.cancel(); Zap.cancel(); });
    Player.init({
      // The state line on the banner while there is no picture (not over a zap burst's preview), at once; the big spinner
      // only when the wait is long (streamSpinner).
      onBuffering: function (on, phase) { streamSpinner(on, phase); if (!on) Banner.resumed(); else { if (!Zap.choosing()) Banner.connecting(); } },
      onLoading: function (pct) { if (!Zap.choosing()) Banner.loading(pct); },
      // The picture is up: the banner with this stream's technical line, at once.
      onFirstFrame: function () {
        UI.spinner(false); Playback.onFirstFrame();
        Zap.onFirstFrame(); Util.idle(prepareMenu);   // menu laid out ahead, hidden
        if (!Zap.choosing()) Banner.onFirstFrame();
      },
      // The first three retries (≈3.5 s) are silent (a channel switch or a short hiccup is not "no signal"); none over a menu.
      // From the fourth, «no signal»: the menu is laid out ahead now (it would be at the first frame), so the viewer
      // reaching for it finds it ready. During the silent retries the stream keeps the bandwidth (logos) and the thread
      // (layout) to itself (review 4, P4-2).
      // The backoff wait shows no spinner: the banner says «Нет сигнала — повтор через N с» (review3 S-6).
      onError: function (n, delay) {
        failures = n;
        UI.spinner(false);
        if (n >= CONFIG.NO_SIGNAL_AFTER) { if (Overlay.isNone()) UI.toast(I18n.t('m.noSignal', n), delay + 500); Util.idle(prepareMenu); }
        if (!Zap.choosing()) Banner.retrying(n, delay);
      },
      onEnded: Playback.onEnded,
      onMutedStart: function () { UI.toast(I18n.t('m.soundAfterKey'), 6000); },
      onFrozen: function (on) { streamSpinner(on, 'rebuffer'); },
      retryTarget: Playback.retryTarget
    });
    Playback.setHooks({ onOpened: function () { Banner.show(false); Diag.mark('banner'); }, onBanner: function () { Banner.show(true); },
      onUnplayable: function () { UI.spinner(false); UI.toast(I18n.t('m.unplayable'), 5000); } });
    NowLines.setHooks({ onUpdate: Overlay.refreshQuiet });
    Sources.setHooks({ onApplied: onListApplied, onFatal: UI.fatal, onSpinner: UI.spinner, onGuide: Overlay.refresh,
      onNotice: function (text) { UI.toast(text, 5000); } });
    EPG.setHooks({
      onGuide: function () { Banner.onGuide(null); Overlay.refresh(); },
      onXmltvFailed: function () { if (!guideNoticeShown) UI.toast(I18n.t('m.guideDown'), 5000); guideNoticeShown = true; }
    });
    document.addEventListener('keydown', function (e) {
      Diag.key();
      if (Player.unmute()) UI.toast(I18n.t('m.soundOn'), 1200);
      onKey(e);
    });
    document.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', onVisibility);
    var chosen = startSource();
    optional('fit', function () { UI.fitDesktop(); window.addEventListener('resize', UI.fitDesktop); });
    optional('hint', function () {
      if (chosen) UI.toast(I18n.t(window.webapis ? 'h.first' : 'h.firstDesktop'), 7000);
    });
    optional('network', Playback.watchNetwork);
    optional('keys', Keys.register);   // right away: CH± and digits pressed in the first seconds must work
  }

  // At the first frame Zap has started Logos already; at the 4th failed attempt no picture competes for the network, so
  // the menu laid out ahead gets its page's logos too (fix batch 8 kept them waiting for a picture that never came).
  function prepareMenu() { if (Channels.count()) Logos.start(); Overlay.prepare('menu'); }

  // The big centre spinner of a stream (review3 S-1, S-6; owner 2026-10-27: the viewer must not keep seeing it, buffering
  // stays): an open shows it once buffering lasted SPINNER_GRACE_START_MS, a rebuffer SPINNER_GRACE_REBUFFER_MS; it goes
  // at once when playback moves. A retry after NO_SIGNAL_AFTER failures in a row shows none: «no signal» stays static.
  function streamSpinner(on, phase) {
    if (!on) { UI.spinner(false); return; }
    if (phase === 'open') failures = 0;
    if (phase === 'open' || phase === 'retry') {
      UI.spinner(false);
      if (failures < CONFIG.NO_SIGNAL_AFTER) UI.spinnerAfter(CONFIG.SPINNER_GRACE_START_MS);
    } else if (phase === 'rebuffer') UI.spinnerAfter(CONFIG.SPINNER_GRACE_REBUFFER_MS);
  }

  // The list loads and the saved channel starts (in its own task right after this one). With no source (a first launch:
  // nothing chosen or built in; or a source built into an older build only) «📡 Провайдеры» opens to choose it, with
  // nothing playing behind it (owner, 2026-10-27: «А если я первый раз установил плеер и запустил — мне он должен
  // предложить выбрать источник»); the choice starts the app on it, and from then on it opens the last source, group
  // and channel. false: the source is being chosen.
  function startSource() {
    if (Sources.firstLaunch()) { Overlay.open('sources', { first: true }); return false; }
    var mode = Sources.mode();
    Sources.start();
    setTimeout(function () {
      var last = Sources.lastChannel();
      if (!Playback.current() && last && last.key.indexOf(mode + ':') === 0 && Channels.adultAllowed(last)) Zap.pick(last);
    }, 0);
    return true;
  }

  // The list arrived: keep what is playing (with its fresh record), or start the first channel.
  function onListApplied(firstLoad) {
    var cur = Playback.current(), fresh = cur ? Channels.get(cur.key) : null;
    if (fresh) Playback.adopt(fresh);
    Zap.onListApplied();
    if (firstLoad && !Channels.isEligible(fresh)) startFirst();
    Overlay.refresh();
  }
  function startFirst() {
    var legacy = Util.load('lastUrl'), items = Channels.groups()[Channels.allIdx()].items, pickIdx = items[0];
    for (var i = 0; legacy && i < items.length; i++) if (Channels.at(items[i]).url === legacy) pickIdx = items[i];
    if (pickIdx !== undefined) Zap.pick(Channels.at(pickIdx));
  }

  function onVisibility() { if (document.hidden) { Zap.cancel(); NowLines.cancel(); } else NowLines.update(); Playback.onVisibility(document.hidden); }

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
    else if (k === K.GREEN) UI.toast(I18n.t('m.screen', Player.cycleDisplay()));
    else if (k === K.BLUE) UI.toast(Player.streamInfo(true) || I18n.t('m.noStreamInfo'), 3000);
    else if (k === K.YELLOW) { if (c) ChannelView.toggleFav(c); }   // the playing channel's favourite; the zap group stays
    else if (Keys.isBack(k)) back(c, mode);
    else return false;
    return true;
  }

  function openScrub(c, k) {
    if (!Catchup.supported(c)) { Banner.show(true); UI.toast(I18n.t('m.noArchive')); return; }
    Overlay.open('scrub');
    if (k !== K.UP) Overlay.onKey(k, { preventDefault: function () {} });
  }

  function back(c, mode) {
    if (c && mode !== 'live' && mode !== 'idle') { Playback.goLive(); return; }
    if (Date.now() - lastBack < CONFIG.EXIT_CONFIRM_MS) {
      try { tizen.application.getCurrentApplication().exit(); } catch (e) { Diag.note('exit', (e && e.message) || String(e)); }
    }
    lastBack = Date.now();
    UI.toast(I18n.t('m.backAgain'));
  }

  // ---------- mouse (desktop preview; the TV remote never produces clicks) ----------
  function onClick(e) {
    if (Player.unmute()) UI.toast(I18n.t('m.soundOn'), 1200);
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
