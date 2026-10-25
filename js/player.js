// Native Samsung AVPlay (hardware decoding) with a self-healing watchdog.
// Falls back to an HTML <video> element off the TV, for desktop checks.
var Player = (function () {
  var av = window.webapis && window.webapis.avplay;
  var video = Util.$('html-player');
  var gen = 0;                 // bumps on every open(); stale callbacks compare against it
  var url = null;
  var lastTime = -1, lastTimeAt = 0, bufferingSince = 0;
  var retries = 0, retryTimer = null, retryPending = false;
  var isArchive = false;      // archive playback = a finite recording: slower to prepare, and it ends
  var displayModes = ['PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO', 'PLAYER_DISPLAY_MODE_FULL_SCREEN', 'PLAYER_DISPLAY_MODE_LETTER_BOX'];
  var displayNames = ['Авто', 'Во весь экран', 'С полями'];
  var displayIdx = Util.store('displayIdx') || 0;
  var hooks = { onBuffering: function () {}, onPlaying: function () {}, onError: function () {} };

  if (!av) { video.style.display = 'block'; Util.$('av-player').style.display = 'none'; }

  function setHooks(h) { hooks = h; }

  function play(newUrl) {
    url = newUrl;
    isArchive = /[?&](archive|utc)=/.test(newUrl);
    retries = 0;
    start();
  }

  function start() {
    clearTimeout(retryTimer);
    retryPending = false;
    var my = ++gen;
    lastTime = -1; lastTimeAt = Date.now(); bufferingSince = Date.now();
    hooks.onBuffering(true);
    if (!av) { startHtml(my); return; }
    try { av.stop(); } catch (e) {}
    try { av.close(); } catch (e) {}
    try {
      av.open(url);
      av.setDisplayRect(0, 0, 1920, 1080);
      av.setDisplayMethod(displayModes[displayIdx]);
      // Start adaptive streams at the best quality the bandwidth allows.
      try { av.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST|SKIPBITRATE=LOWEST'); } catch (e) {}
      try { av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 5); } catch (e) {}
      try { av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 10); } catch (e) {}
      av.setListener({
        onbufferingstart: function () { if (my === gen) { bufferingSince = Date.now(); hooks.onBuffering(true); } },
        onbufferingcomplete: function () { if (my === gen) { bufferingSince = 0; hooks.onBuffering(false); } },
        oncurrentplaytime: function (t) { if (my === gen && t !== lastTime) { lastTime = t; lastTimeAt = Date.now(); } },
        // A recording that reaches its end is not an error: the app continues with what follows it.
        onstreamcompleted: function () { if (my === gen) { if (isArchive && hooks.onEnded) hooks.onEnded(); else fail('stream ended'); } },
        onerror: function (e) { if (my === gen) fail(String(e)); },
        onevent: function () {}
      });
      av.prepareAsync(function () {
        if (my !== gen) return;
        av.play();
        ok();
      }, function (e) { if (my === gen) fail(String(e)); });
    } catch (e) {
      fail(e.message || String(e));
    }
  }

  // Off the TV (desktop check): native HLS where the browser has it, otherwise hls.js loaded on demand.
  var hls = null;
  function startHtml(my) {
    video.onplaying = function () { if (my === gen) ok(); };
    video.onwaiting = function () { if (my === gen) { bufferingSince = Date.now(); hooks.onBuffering(true); } };
    video.ontimeupdate = function () { if (my === gen) { bufferingSince = 0; lastTimeAt = Date.now(); } };
    video.onerror = function () { if (my === gen) fail('video error'); };
    if (hls) { hls.destroy(); hls = null; }
    // Desktop Chrome reports native HLS ("maybe") but rejects MPEG-TS segments, so prefer hls.js on MSE.
    if (!window.MediaSource) { video.src = url; safePlay(); return; }
    withHlsJs(function () {
      if (my !== gen) return;
      hls = new window.Hls({ lowLatencyMode: false, maxBufferLength: 30, liveSyncDurationCount: 4 });
      hls.on(window.Hls.Events.ERROR, function (_, d) { if (my === gen && d.fatal) fail(d.details); });
      hls.loadSource(url);
      hls.attachMedia(video);
      safePlay();
    });
  }
  // Browsers refuse to start video with sound before the first click or key press.
  // Start muted instead of waiting forever, and unmute on the viewer's first input.
  function safePlay() {
    var p = video.play();
    if (!p || !p['catch']) return;
    p['catch'](function (e) {
      if (!e || e.name !== 'NotAllowedError') return;
      video.muted = true;
      video.play();
      hooks.onMutedStart();
    });
  }
  function unmute() { if (video.muted) { video.muted = false; return true; } return false; }
  function withHlsJs(cb) {
    if (window.Hls) { cb(); return; }
    var sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
    sc.onload = cb;
    document.head.appendChild(sc);
  }

  function ok() {
    retries = 0; bufferingSince = 0; lastTimeAt = Date.now();
    hooks.onBuffering(false);
    hooks.onPlaying();
  }

  // Exponential backoff: 0.5 s, 1 s, 2 s ... up to MAX_BACKOFF_MS, retried forever.
  function fail(reason) {
    var delay = Math.min(500 * Math.pow(2, retries), CONFIG.MAX_BACKOFF_MS);
    retries++;
    console.log('[player] fail #' + retries + ' gen=' + gen + ' ' + reason);
    // Keep the last 40 failures on the device, so a "no signal" seen by the viewer can be explained later.
    var log = Util.store('failLog') || [];
    log.push(new Date().toISOString() + ' #' + retries + ' ' + reason + ' ' + String(url).replace(/\/stream\/[^/]+\//, '/stream/<key>/'));
    Util.store('failLog', log.slice(-40));
    hooks.onError(reason, retries, delay);
    clearTimeout(retryTimer);
    retryPending = true;
    bufferingSince = 0;
    retryTimer = setTimeout(start, delay);
  }

  function tick() {
    if (!url) return;
    var now = Date.now(), state;
    if (av) { try { state = av.getState(); } catch (e) { return; } } else state = video.paused ? 'PAUSED' : 'PLAYING';
    // While a restart is already scheduled the watchdog stays quiet (otherwise it re-fails every second
    // and the restart never happens).
    if (retryPending) return;
    var limit = isArchive ? CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS : CONFIG.BUFFER_TIMEOUT_MS;
    if (bufferingSince && now - bufferingSince > limit) { fail('buffering timeout ' + Math.round((now - bufferingSince) / 1000) + ' s'); return; }
    if (state === 'PLAYING' && !bufferingSince && now - lastTimeAt > CONFIG.STALL_TIMEOUT_MS) fail('stalled');
  }
  setInterval(tick, 1000);

  function suspend() { try { if (av) av.suspend(); } catch (e) {} }
  function resume() {
    if (!url) return;
    // Tizen reports "visible" right after launch too; a stream that is already playing is left alone.
    try { if (av && av.getState() === 'PLAYING') return; } catch (e) {}
    try { if (av) { av.restore(url, 0, true); lastTimeAt = Date.now(); return; } } catch (e) {}
    start();
  }
  function reconnect() { if (url) { retries = 0; start(); } }

  function audioTracks() {
    if (!av) return [];
    var out = [];
    try {
      var info = av.getTotalTrackInfo();
      for (var i = 0; i < info.length; i++) {
        if (info[i].type !== 'AUDIO') continue;
        var x = {};
        try { x = JSON.parse(info[i].extra_info); } catch (e) {}
        out.push({ index: info[i].index, label: (x.language || 'Дорожка ' + (out.length + 1)) + (x.channels ? ' · ' + x.channels + ' кан.' : '') });
      }
    } catch (e) {}
    return out;
  }
  function selectAudio(index) { try { av.setSelectTrack('AUDIO', index); } catch (e) {} }

  function videoInfo() {
    if (!av) return '';
    try {
      var info = av.getCurrentStreamInfo();
      for (var i = 0; i < info.length; i++) {
        if (info[i].type !== 'VIDEO') continue;
        var x = JSON.parse(info[i].extra_info);
        return x.Width + '×' + x.Height + (x.Bit_rate ? ' · ' + Math.round(x.Bit_rate / 1000) + ' кбит/с' : '');
      }
    } catch (e) {}
    return '';
  }

  function cycleDisplay() {
    displayIdx = (displayIdx + 1) % displayModes.length;
    Util.store('displayIdx', displayIdx);
    try { av.setDisplayMethod(displayModes[displayIdx]); } catch (e) {}
    return displayNames[displayIdx];
  }

  return {
    setHooks: setHooks, play: play, unmute: unmute, reconnect: reconnect, suspend: suspend, resume: resume,
    audioTracks: audioTracks, selectAudio: selectAudio, videoInfo: videoInfo, cycleDisplay: cycleDisplay
  };
}());
