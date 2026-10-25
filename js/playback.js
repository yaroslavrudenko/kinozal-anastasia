// What is playing and from where: one mode, the archive position from the player's media clock (so
// buffering is not counted as watched), pause, going live, and a selection token every command bumps
// (a delayed zap compares it before opening, so it can never override a later choice).
var Playback = (function () {
  var mode = 'idle';           // 'idle' | 'live' | 'archive' | 'paused'
  var ch = null;               // the playing channel's record; stays valid when a refresh drops the channel
  var anchorWallMs = 0, anchorMediaMs = 0, frozenMs = 0, pausedAt = 0;
  var pipelineLost = false, hiddenMs = null, selection = 0, audioIdx = 0, hooks = {}, healthTimer = null;

  // hooks: { onOpened(ch) } — a new stream started (banner, landing bookkeeping).
  function setHooks(h) { hooks = h; }

  // The background channel check runs only behind steady playback: every change of what plays, a pause,
  // the background and any rebuffer stop it; onStable (STABLE_MS of advancing playback) re-arms it.
  function quiet() { clearTimeout(healthTimer); healthTimer = null; Health.setReady(false); }
  function onStable() {
    clearTimeout(healthTimer);
    healthTimer = setTimeout(function () { if (mode === 'live' || mode === 'archive') Health.setReady(true); }, CONFIG.HEALTH_START_AFTER_STABLE_MS);
  }

  function live(c) {
    quiet();
    selection++;
    ch = c; mode = 'live'; pipelineLost = false; audioIdx = 0;
    Player.open({ url: c.url, archive: false });
    hooks.onOpened(c);
  }

  // Plays channel c's archive from fromMs; near the live edge it plays live instead.
  function archive(c, fromMs) {
    if (!Catchup.supported(c)) { UI.toast('Для этого канала архив недоступен'); return; }
    var now = Date.now();
    fromMs = Math.max(Catchup.earliest(c, now), fromMs);
    // Close to the live edge the archive would only arrive in short pieces: switch to live instead.
    if (fromMs >= now - CONFIG.LIVE_SNAP_MS) { ch = c; goLive(); return; }
    quiet();
    selection++;
    ch = c; mode = 'archive'; pipelineLost = false; audioIdx = 0;
    anchorWallMs = fromMs; anchorMediaMs = 0;
    Player.open({ url: archiveUrl(c, fromMs), archive: true });
    hooks.onOpened(c);
  }
  function archiveUrl(c, fromMs) { var p = EPG.at(c.id, fromMs); return Catchup.url(c, fromMs, p ? p.stop - fromMs : 0); }

  // Wall-clock moment on screen.
  function position() {
    if (mode === 'archive') return anchorWallMs + (Player.mediaTimeMs() - anchorMediaMs);
    if (mode === 'paused') return frozenMs;
    return Date.now();
  }

  // The player retries a failed archive at the position actually shown, not at the recording start.
  // { url, archive } change together: a live stream resumed after a pause continues as archive.
  function retryTarget() {
    if (mode !== 'archive') return null;
    var pos = position();
    anchorWallMs = pos; anchorMediaMs = 0;
    return { url: archiveUrl(ch, pos), archive: true };
  }

  function togglePause() {
    if (!ch) return;
    if (mode === 'paused') { resume(); return; }
    if (mode === 'live' && !Catchup.supported(ch)) { UI.toast('Пауза недоступна: у канала нет архива'); return; }
    quiet();
    selection++;
    frozenMs = position(); pausedAt = Date.now(); mode = 'paused';
    Player.pause();
    UI.toast('⏸ Пауза', UI.STICKY);
  }

  // A short pause resumes in place (the native pipeline kept the picture); a long one, or one whose
  // pipeline was released (Home), reopens the archive at the paused moment.
  function resume() {
    UI.toast('▶', 800);
    if (pipelineLost || Date.now() - pausedAt >= CONFIG.LIVE_SNAP_MS) { archive(ch, frozenMs); return; }
    selection++;
    mode = 'archive';
    anchorWallMs = frozenMs; anchorMediaMs = Player.mediaTimeMs();
    Player.play();
  }

  // The single home of "back to live": STOP, BACK in the archive, the slider at the live edge.
  function goLive() {
    if (mode !== 'live') live(ch); else if (hooks.onBanner) hooks.onBanner();
    UI.toast('Прямой эфир');
  }

  // The app went to the background (hidden = true) or came back.
  function onVisibility(hidden) {
    if (hidden) {
      if (mode === 'idle' || hiddenMs !== null) return;
      hiddenMs = position();
      quiet();
      selection++;                       // nothing pending (a zap, a probe) acts while in the background
      if (mode === 'paused') pipelineLost = true;
      Player.suspend();
      return;
    }
    if (hiddenMs === null) return;       // Tizen reports "visible" right after launch too
    var at = hiddenMs;
    hiddenMs = null;
    if (mode === 'paused') return;       // stays paused; resuming reopens at the paused moment
    if (mode === 'live') live(ch); else archive(ch, at);
  }

  // End of an archive recording: carry on from that moment (the next show), or live if it is now.
  function onEnded() { archive(ch, position()); }

  // RED: the next audio track of the stream (the choice starts over with every new stream).
  function cycleAudio() {
    var tracks = Player.audioTracks();
    if (tracks.length < 2) { UI.toast(tracks.length ? 'Звук: ' + tracks[0].label + ' (одна дорожка)' : 'Звук: одна дорожка'); return; }
    var next = (audioIdx + 1) % tracks.length;
    if (!Player.selectAudio(tracks[next].index)) { UI.toast('Звук: не удалось переключить дорожку'); return; }
    audioIdx = next;
    UI.toast('Звук: ' + tracks[audioIdx].label);
  }

  // Network lost / restored (TV only): a toast, and a reconnect that resumes where the picture was.
  // Optional: some TVs refuse the listener (error 18 on the owner's TV); that is recorded, never fatal.
  function watchNetwork() {
    try {
      var net = window.webapis && webapis.network;
      if (!net || !net.addNetworkStateChangeListener) return;
      net.addNetworkStateChangeListener(function (v) {
        if (v === net.NetworkState.GATEWAY_CONNECTED) { UI.toast('Сеть восстановлена'); Player.reconnect(); }
        if (v === net.NetworkState.GATEWAY_DISCONNECTED) UI.toast('Нет сети', 5000);
      });
    } catch (e) { Diag.note('network', (e && (e.code || e.message)) || String(e)); }
  }

  // A refreshed list holds the playing channel again: its fresher record replaces the old one.
  function adopt(c) { if (ch && c && c.key === ch.key) ch = c; }

  return {
    setHooks: setHooks, live: live, archive: archive, position: position, retryTarget: retryTarget, togglePause: togglePause,
    goLive: goLive, onVisibility: onVisibility, quiet: quiet, onStable: onStable, watchNetwork: watchNetwork, onEnded: onEnded, adopt: adopt, cycleAudio: cycleAudio,
    current: function () { return ch; }, mode: function () { return mode; }, selection: function () { return selection; }
  };
}());
