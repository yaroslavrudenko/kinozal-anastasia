// What is playing and from where: one mode, the archive position from the player's media clock (so
// buffering is not counted as watched), pause, going live, and a selection token every command bumps
// (a delayed zap compares it before opening, so it can never override a later choice).
var Playback = (function () {
  var mode = 'idle';           // 'idle' | 'live' | 'archive' | 'paused'
  var ch = null;               // the playing channel's record; stays valid when a refresh drops the channel
  var anchorWallMs = 0, anchorMediaMs = null, frozenMs = 0, pausedAt = 0;   // anchorMediaMs null: until the first frame
  var pipelineLost = false, hiddenMs = null, selection = 0, audioIdx = 0, hooks = {};

  // hooks: { onOpened(ch) } — a new stream started (banner, landing bookkeeping).
  function setHooks(h) { hooks = h; }


  function live(c) {
    selection++;
    ch = c; mode = 'live'; pipelineLost = false; audioIdx = 0;
    Player.open({ url: c.url, archive: false });
    hooks.onOpened(c);
  }

  // Plays channel c's archive from fromMs; near the live edge it plays live instead.
  function archive(c, fromMs) {
    if (!Catchup.supported(c)) { UI.toast(I18n.t('m.noArchiveHere')); return; }
    var now = Date.now();
    fromMs = Math.max(Catchup.earliest(c, now), fromMs);
    // Close to the live edge the archive would only arrive in short pieces: switch to live instead.
    if (fromMs >= now - CONFIG.LIVE_SNAP_MS) { ch = c; goLive(); return; }
    selection++;
    ch = c; mode = 'archive'; pipelineLost = false; audioIdx = 0;
    anchorWallMs = fromMs; anchorMediaMs = null;
    Player.open({ url: archiveUrl(c, fromMs), archive: true });
    hooks.onOpened(c);
  }
  function archiveUrl(c, fromMs) { var p = EPG.at(c.id, fromMs); return Catchup.url(c, fromMs, p ? p.stop - fromMs : 0); }

  // Wall-clock moment on screen.
  function position() {
    if (mode === 'archive') return anchorMediaMs === null ? anchorWallMs : anchorWallMs + (Player.mediaTimeMs() - anchorMediaMs);
    if (mode === 'paused') return frozenMs;
    return Date.now();
  }

  // The player retries a failed archive at the position actually shown, not at the recording start.
  // { url, archive } change together: a live stream resumed after a pause continues as archive.
  function retryTarget() {
    if (mode !== 'archive') return null;
    var pos = Math.max(position(), Catchup.earliest(ch, Date.now()));   // past the window's edge: move forward
    anchorWallMs = pos; anchorMediaMs = null;
    return { url: archiveUrl(ch, pos), archive: true };
  }

  function togglePause() {
    if (!ch) return;
    if (mode === 'paused') { resume(); return; }
    if (mode === 'live' && !Catchup.supported(ch)) { UI.toast(I18n.t('m.noPause')); return; }
    selection++;
    frozenMs = position(); pausedAt = Date.now(); mode = 'paused';
    Player.pause();
    UI.toast(I18n.t('m.paused'), UI.STICKY);
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
    UI.toast(I18n.t('m.live'));
  }

  // The app went to the background (hidden = true) or came back.
  function onVisibility(hidden) {
    if (hidden) {
      if (mode === 'idle' || hiddenMs !== null) return;
      hiddenMs = position();
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

  // A recording's first frame: the clock is anchored to the media time the player reports there. A
  // continuation's stream may start its clock ~50 s in (TV test D2); the requested moment is what shows.
  function onFirstFrame() { if (mode === 'archive' && anchorMediaMs === null) anchorMediaMs = Player.mediaTimeMs(); }

  // RED: the next audio track of the stream (the choice starts over with every new stream).
  function cycleAudio() {
    var tracks = Player.audioTracks();
    if (tracks.length < 2) { UI.toast(tracks.length ? I18n.t('m.soundOne', tracks[0].label) : I18n.t('m.soundOnlyOne')); return; }
    var next = (audioIdx + 1) % tracks.length;
    if (!Player.selectAudio(tracks[next].index)) { UI.toast(I18n.t('m.soundFail')); return; }
    audioIdx = next;
    UI.toast(I18n.t('m.sound', tracks[audioIdx].label));
  }

  // Network lost / restored (TV only): a toast, and a reconnect that resumes where the picture was.
  // Optional: some TVs refuse the listener (error 18 on the owner's TV); that is recorded, never fatal.
  function watchNetwork() {
    try {
      var net = window.webapis && webapis.network;
      if (!net || !net.addNetworkStateChangeListener) return;
      net.addNetworkStateChangeListener(function (v) {
        if (v === net.NetworkState.GATEWAY_CONNECTED) { UI.toast(I18n.t('m.netBack')); Player.reconnect(); Sources.onNetwork(); }
        if (v === net.NetworkState.GATEWAY_DISCONNECTED) UI.toast(I18n.t('m.netDown'), 5000);
      });
    } catch (e) { Diag.note('network', (e && (e.code || e.message)) || String(e)); }
  }

  // A refreshed list holds the playing channel again: its fresher record replaces the old one.
  function adopt(c) { if (ch && c && c.key === ch.key) ch = c; }

  return {
    setHooks: setHooks, live: live, archive: archive, position: position, retryTarget: retryTarget, togglePause: togglePause,
    goLive: goLive, onVisibility: onVisibility, onFirstFrame: onFirstFrame, watchNetwork: watchNetwork, onEnded: onEnded, adopt: adopt, cycleAudio: cycleAudio,
    current: function () { return ch; }, mode: function () { return mode; }, selection: function () { return selection; }
  };
}());
