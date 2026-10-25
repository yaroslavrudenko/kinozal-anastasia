// The desktop backend of Player: an HTML <video>, with hls.js for HLS where the browser has MSE.
//   HtmlVideo.init(video, ev) — ev: { current(my) -> bool, playing(t), waiting(), progress(), time(t),
//                                     ended(my), fail(my, reason), mutedStart() }
var HtmlVideo = (function () {
  var video = null, ev = null, hls = null, loading = null;

  // Shows the <video> layer instead of AVPlay's and preloads hls.js (no extra hop at the first play).
  function init(v, events) {
    video = v; ev = events;
    video.style.display = 'block';
    Util.$('av-player').style.display = 'none';
    if (window.MediaSource) Util.idle(function () { withHlsJs(function () {}); });
  }

  function start(my, src) {
    video.onplaying = function () { if (ev.current(my)) ev.playing(video.currentTime * 1000); };
    video.onwaiting = function () { if (ev.current(my)) ev.waiting(); };
    video.onprogress = function () { if (ev.current(my)) ev.progress(); };
    video.ontimeupdate = function () { if (ev.current(my)) ev.time(video.currentTime * 1000); };
    video.onended = function () { if (ev.current(my)) ev.ended(my); };
    video.onerror = function () { ev.fail(my, 'video error'); };
    if (hls) { hls.destroy(); hls = null; }
    // Desktop Chrome reports native HLS ("maybe") but rejects MPEG-TS segments, so HLS goes through hls.js.
    if (!/\.m3u8(\?|$)/i.test(src) || !window.MediaSource) { video.src = src; play(); return; }
    withHlsJs(function (ok) {
      if (!ev.current(my)) return;
      if (!ok) { ev.fail(my, 'hls.js not loaded'); return; }
      hls = new window.Hls({ lowLatencyMode: false, maxBufferLength: 30, liveSyncDurationCount: 4 });
      hls.on(window.Hls.Events.ERROR, function (_, d) { if (d.fatal) ev.fail(my, d.details); });
      hls.loadSource(src);
      hls.attachMedia(video);
      play();
    });
  }

  // Browsers refuse to start video with sound before the first click or key press.
  // Start muted instead of waiting forever, and unmute on the viewer's first input.
  function play() {
    var p = video.play();
    if (!p || !p['catch']) return;
    p['catch'](function (e) {
      if (!e || e.name !== 'NotAllowedError') return;
      video.muted = true;
      var again = video.play();
      if (again && again['catch']) again['catch'](function (x) { Diag.note('mutedPlay', (x && x.name) || 'error'); });
      ev.mutedStart();
    });
  }
  function pause() { video.pause(); }
  function unmute() { if (video && video.muted) { video.muted = false; return true; } return false; }

  // One load at a time, with the pinned file's integrity hash; every waiting attempt is told the outcome.
  function withHlsJs(cb) {
    if (window.Hls) { cb(true); return; }
    if (loading) { loading.push(cb); return; }
    loading = [cb];
    var sc = document.createElement('script');
    sc.src = CONFIG.HLS_JS_URL;
    sc.integrity = CONFIG.HLS_JS_SRI;
    sc.crossOrigin = 'anonymous';
    sc.onload = function () { settle(true); };
    sc.onerror = function () { if (sc.parentNode) sc.parentNode.removeChild(sc); settle(false); };
    document.head.appendChild(sc);
  }
  function settle(ok) { var subs = loading; loading = null; for (var i = 0; i < subs.length; i++) subs[i](ok); }

  function info() {
    if (!video.videoWidth) return '';
    var lvl = hls && hls.levels && hls.levels[hls.currentLevel];
    return video.videoWidth + '×' + video.videoHeight + (lvl && lvl.bitrate ? ' · ' + AvTracks.mbps(lvl.bitrate) : '');
  }

  return { init: init, start: start, play: play, pause: pause, unmute: unmute, info: info };
}());
