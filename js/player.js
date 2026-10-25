// Native Samsung AVPlay (hardware decoding) with a self-healing watchdog; an HTML <video> element off
// the TV, for desktop checks. Every attempt has a generation: a callback of an older attempt does nothing.
//   hooks: { onBuffering(on), onLoading(pct: -1 none), onFirstFrame(), onStable(), onError(n, delayMs), onEnded(),
//            onMutedStart(), retryTarget() -> { url, archive } | null (archive: a fresh URL at the position shown) }
var Player = (function () {
  var av = null, video = null, hooks = null;
  var gen = 0, url = null, archive = false;
  var lastTime = -1, lastTimeAt = 0, bufferingSince = 0, bufferStartAt = 0, mediaMs = 0;
  var firstFrame = false, streakFrom = 0, stable = false, info = '', bufferPct = -1;
  var retries = 0, retryTimer = null, retryPending = false, restartOnPlay = false, paused = false, suspended = false, WATCHDOG_MS = 1000;

  function init(h) {
    hooks = h;
    try { av = (window.webapis && window.webapis.avplay) || null; } catch (e) { av = null; Diag.note('avplay', (e && e.message) || String(e)); }
    video = Util.$('html-player');
    if (!av) HtmlVideo.init(video, {
      current: function (my) { return my === gen; },
      playing: function (t) { if (!firstFrame) advanced(t); },
      waiting: bufferingStarted,
      progress: function () { if (bufferingSince) bufferingSince = Date.now(); },   // <video> reports bytes, not a percentage
      time: function (t) { if (bufferingSince && firstFrame) bufferingEnded(); advanced(t); },
      ended: ended, fail: fail, mutedStart: function () { hooks.onMutedStart(); }
    });
    setInterval(tick, WATCHDOG_MS);
  }

  // o: { url, archive } — archive: a finite recording, slower to prepare, and it ends.
  function open(o) {
    url = o.url;
    archive = !!o.archive;
    retries = 0;
    paused = false;
    suspended = false;
    restartOnPlay = false;
    start();
  }

  function start() {
    clearTimeout(retryTimer);
    retryPending = false;
    var my = ++gen;
    lastTime = -1; lastTimeAt = Date.now(); bufferingSince = Date.now(); bufferStartAt = 0; mediaMs = 0; bufferPct = -1;
    firstFrame = false; streakFrom = 0; stable = false; info = '';
    hooks.onBuffering(true);
    if (av) startAv(my); else HtmlVideo.start(my, url);
  }

  function startAv(my) {
    try { av.stop(); } catch (e) { Diag.count('avStopIgnored'); }
    try { av.close(); } catch (e) { Diag.count('avCloseIgnored'); }
    try {
      av.open(url);
      setting(function () { av.setDisplayRect(0, 0, 1920, 1080); }, 'displayRect');
      setting(function () { av.setDisplayMethod(AvTracks.displayMode()); }, 'displayMode');
      // Start at the best quality the bandwidth allows, and let AVPlay drop to the lowest rendition
      // rather than stall on a weak connection.
      setting(function () { av.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST'); }, 'adaptive');
      setting(function () { av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', CONFIG.BUFFER_PLAY_S); }, 'bufferPlay');
      setting(function () { av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', CONFIG.BUFFER_RESUME_S); }, 'bufferResume');
      av.setListener({
        onbufferingstart: function () { if (my === gen) bufferingStarted(); },
        onbufferingprogress: function (pct) { if (my === gen) bufferingProgress(pct); },
        onbufferingcomplete: function () { if (my === gen) bufferingEnded(); },
        oncurrentplaytime: function (t) { if (my === gen) advanced(t); },
        // A recording that reaches its end is not an error: the app continues with what follows it.
        onstreamcompleted: function () { if (my === gen) ended(my); },
        onerror: function (e) { fail(my, String(e)); },
        onevent: function () {}
      });
      av.prepareAsync(function () {
        if (my !== gen || paused) return;        // paused while preparing: play() starts it later
        try { av.play(); } catch (e) { fail(my, 'play: ' + (e.message || e)); }
      }, function (e) { fail(my, String(e)); });
    } catch (e) {
      fail(my, e.message || String(e));
    }
  }

  function setting(fn, name) { try { fn(); } catch (e) { Diag.count('settingsRejected'); Diag.note('setting.' + name, (e && e.message) || String(e)); } }

  // ---- events shared by both backends ----
  function bufferingStarted() {
    bufferingSince = Date.now(); bufferPct = -1;
    streakFrom = 0; stable = false;      // stability has to be earned again after a rebuffer
    if (firstFrame) { bufferStartAt = Date.now(); Diag.count('rebuffer'); }
    hooks.onBuffering(true);
    hooks.onLoading(-1);
  }
  // Only real progress (a higher percentage) restarts the buffering timeout.
  function bufferingProgress(pct) {
    if (!bufferingSince || !(+pct > bufferPct)) return;
    bufferPct = +pct;
    bufferingSince = Date.now();
    hooks.onLoading(bufferPct);
  }
  function bufferingEnded() {
    if (bufferStartAt) Diag.count('rebufferDone', Date.now() - bufferStartAt);
    bufferingSince = 0; bufferStartAt = 0;
    lastTimeAt = Date.now();             // the stall clock restarts when playback resumes
    hooks.onBuffering(false);
  }
  // t: media time in ms. The first advance after play() is the first frame. STABLE_MS of uninterrupted
  // advancing playback (no rebuffer, no stall, no pause in between) resets the retry backoff.
  function advanced(t) {
    if (t === lastTime) return;
    var now = Date.now();
    if (!streakFrom || now - lastTimeAt > CONFIG.STALL_TIMEOUT_MS) streakFrom = now;
    lastTime = t; lastTimeAt = now; mediaMs = t;
    if (!firstFrame) {
      firstFrame = true; bufferingSince = 0;
      hooks.onBuffering(false);
      info = readInfo();
      if (av) Diag.note('variants', AvTracks.variantCount(av));
      hooks.onFirstFrame();
    } else if (!stable && !bufferingSince && now - streakFrom >= CONFIG.STABLE_MS) {
      stable = true; retries = 0;
      hooks.onStable();
    }
  }
  function ended(my) { if (archive) hooks.onEnded(); else fail(my, 'stream ended'); }

  // Growing delays (Util.backoff): 0.5 s, 1 s, 2 s … up to MAX_BACKOFF_MS, retried forever.
  // A failure while paused waits for play(); nothing reopens behind a pause.
  function fail(my, reason) {
    if (my !== gen) return;
    gen++;                               // every remaining callback of the failed attempt is inert
    var delay = Util.backoff(retries, CONFIG.RETRY_MIN_MS, CONFIG.MAX_BACKOFF_MS);
    retries++;
    Diag.fail({ n: retries, gen: gen, reason: reason, url: url });
    clearTimeout(retryTimer);
    bufferingSince = 0;
    if (paused) { restartOnPlay = true; return; }
    hooks.onError(retries, delay);
    retryPending = true;
    retryTimer = setTimeout(retry, delay);
  }
  // The URL and the mode change together (a live stream resumed after a pause retries as archive).
  function retry() {
    var target = hooks.retryTarget();
    if (target) { url = target.url; archive = target.archive; }
    restartOnPlay = false;
    start();
  }

  function tick() {
    if (!url || paused || suspended || retryPending) return;
    var now = Date.now(), state;
    // An unreadable state is counted as unknown (the buffering timeout still applies). Buffering is timed from
    // its last progress. A player left IDLE/NONE while visible (released by the TV or another app) never plays again.
    if (av) { try { state = av.getState(); } catch (e) { state = ''; Diag.count('getStateFailed'); } } else state = video.paused ? 'PAUSED' : 'PLAYING';
    var limit = archive ? CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS : CONFIG.BUFFER_TIMEOUT_MS, released = !!av && !document.hidden && (state === 'IDLE' || state === 'NONE');
    if (bufferingSince) { if (now - bufferingSince > limit) fail(gen, 'buffering timeout ' + Math.round((now - bufferingSince) / 1000) + ' s'); return; }
    if ((state === 'PLAYING' || released) && now - lastTimeAt > CONFIG.STALL_TIMEOUT_MS) fail(gen, released ? 'player released (' + state + ')' : 'stalled');
  }

  // ---- control ----
  // A pause also holds a pending retry: it runs on play(), not behind the pause.
  function pause() {
    paused = true;
    streakFrom = 0; stable = false;
    if (retryPending) { clearTimeout(retryTimer); retryPending = false; restartOnPlay = true; }
    try { if (av) av.pause(); else HtmlVideo.pause(); } catch (e) { Diag.note('pause', (e && e.message) || String(e)); }
  }
  // Resumes a native pause; a failure goes through the normal retry (archive: at the shown position).
  function play() {
    paused = false;
    lastTimeAt = Date.now();
    if (restartOnPlay) { retry(); return; }
    if (!av) { HtmlVideo.play(); return; }
    try { av.play(); } catch (e) { fail(gen, 'resume: ' + (e.message || e)); }
  }
  // The app goes to the background: the pipeline is released; the app reopens explicitly on return.
  function suspend() {
    suspended = true;
    gen++;                               // callbacks of the suspended attempt are inert
    clearTimeout(retryTimer);
    retryPending = false;
    try { if (av) av.suspend(); else HtmlVideo.pause(); } catch (e) { Diag.note('suspend', (e && e.message) || String(e)); }
  }
  // Network restored: the same path as a retry, so an archive resumes at the position shown.
  function reconnect() { if (url && !paused && !suspended) { retries = 0; retry(); } }
  function mediaTimeMs() { return mediaMs; }

  // Technical line for the banner: read once per attempt at its first frame ('' before it).
  // fresh = true re-reads it (BLUE key, «О программе»: the bitrate may have changed).
  function streamInfo(fresh) {
    if (fresh && firstFrame) info = readInfo();
    return firstFrame ? info : '';
  }
  function readInfo() { return av ? AvTracks.streamInfo(av) : HtmlVideo.info(); }
  function audioTracks() { return av ? AvTracks.audioTracks(av) : []; }
  function selectAudio(index) { return !!av && AvTracks.selectAudio(av, index); }
  function cycleDisplay() { return AvTracks.cycleDisplay(av); }

  return {
    init: init, open: open, pause: pause, play: play, suspend: suspend, reconnect: reconnect,
    mediaTimeMs: mediaTimeMs, streamInfo: streamInfo, audioTracks: audioTracks, selectAudio: selectAudio,
    cycleDisplay: cycleDisplay, unmute: function () { return !av && HtmlVideo.unmute(); }
  };
}());
