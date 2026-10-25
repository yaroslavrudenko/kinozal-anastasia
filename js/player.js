// Native Samsung AVPlay (hardware decoding) with a self-healing watchdog.
// Falls back to an HTML <video> element off the TV, for desktop checks.
var Player = (function () {
  var av = window.webapis && window.webapis.avplay;
  var video = Util.$('html-player');
  var gen = 0;                 // bumps on every open(); stale callbacks compare against it
  var url = null;
  var lastTime = -1, lastTimeAt = 0, bufferingSince = 0;
  var retries = 0, retryTimer = null;
  var displayModes = ['PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO', 'PLAYER_DISPLAY_MODE_FULL_SCREEN', 'PLAYER_DISPLAY_MODE_LETTER_BOX'];
  var displayNames = ['Авто', 'Во весь экран', 'С полями'];
  var displayIdx = Util.store('displayIdx') || 0;
  var hooks = { onBuffering: function () {}, onPlaying: function () {}, onError: function () {} };

  if (!av) { video.style.display = 'block'; Util.$('av-player').style.display = 'none'; }

  function setHooks(h) { hooks = h; }

  function play(newUrl) {
    url = newUrl;
    retries = 0;
    start();
  }

  function start() {
    clearTimeout(retryTimer);
    var my = ++gen;
    lastTime = -1; lastTimeAt = Date.now(); bufferingSince = Date.now();
    hooks.onBuffering(true);
    if (!av) {
      video.src = url;
      video.onplaying = function () { if (my === gen) ok(); };
      video.onerror = function () { if (my === gen) fail('video error'); };
      video.play();
      return;
    }
    try { av.stop(); } catch (e) {}
    try { av.close(); } catch (e) {}
    try {
      av.open(url);
      av.setDisplayRect(0, 0, 1920, 1080);
      av.setDisplayMethod(displayModes[displayIdx]);
      // Start adaptive streams at the best quality the bandwidth allows.
      try { av.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST|SKIPBITRATE=LOWEST'); } catch (e) {}
      try { av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 3); } catch (e) {}
      try { av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 6); } catch (e) {}
      av.setListener({
        onbufferingstart: function () { if (my === gen) { bufferingSince = Date.now(); hooks.onBuffering(true); } },
        onbufferingcomplete: function () { if (my === gen) { bufferingSince = 0; hooks.onBuffering(false); } },
        oncurrentplaytime: function (t) { if (my === gen && t !== lastTime) { lastTime = t; lastTimeAt = Date.now(); } },
        onstreamcompleted: function () { if (my === gen) fail('stream ended'); },
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

  function ok() {
    retries = 0; bufferingSince = 0; lastTimeAt = Date.now();
    hooks.onBuffering(false);
    hooks.onPlaying();
  }

  // Exponential backoff: 0.5 s, 1 s, 2 s ... up to MAX_BACKOFF_MS, retried forever.
  function fail(reason) {
    var delay = Math.min(500 * Math.pow(2, retries), CONFIG.MAX_BACKOFF_MS);
    retries++;
    hooks.onError(reason, retries, delay);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(start, delay);
  }

  function tick() {
    if (!url || !av) return;
    var now = Date.now(), state;
    try { state = av.getState(); } catch (e) { return; }
    if (bufferingSince && now - bufferingSince > CONFIG.BUFFER_TIMEOUT_MS) { fail('buffering timeout'); return; }
    if (state === 'PLAYING' && !bufferingSince && now - lastTimeAt > CONFIG.STALL_TIMEOUT_MS) fail('stalled');
  }
  setInterval(tick, 1000);

  function suspend() { try { if (av) av.suspend(); } catch (e) {} }
  function resume() {
    if (!url) return;
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
    setHooks: setHooks, play: play, reconnect: reconnect, suspend: suspend, resume: resume,
    audioTracks: audioTracks, selectAudio: selectAudio, videoInfo: videoInfo, cycleDisplay: cycleDisplay
  };
}());
