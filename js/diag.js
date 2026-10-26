// Diagnostics: the redacted playback failure log (localStorage "failLog", read and reset by the TV
// scripts), counters and notes ("diag"). Written at most every DIAG_FLUSH_MS, when the TV is idle.
var Diag = (function () {
  var pending = [];            // failLog lines not yet written
  var recent = [];             // the same lines, kept in memory for snapshot()
  var counters = {}, notes = {};
  var flushTimer = null;

  // scheme://host/path only: no user:password, no query; credentials inside the path are masked:
  // the OTT key in /stream/<key>/ and the user/password of /live|movie|series|timeshift/<user>/<pass>/.
  function redact(url) {
    var m = /^([a-z][a-z0-9+.-]*:\/\/)(?:[^@\/?#]*@)?([^?#]*)/i.exec(String(url || ''));
    if (!m) return '';
    return (m[1] + m[2]).replace(/\/stream\/[^\/]+\//, '/stream/<key>/')
      .replace(/\/(live|movie|series|timeshift)\/[^\/]+\/[^\/]+\//, '/$1/<user>/<pass>/');
  }

  // The archive moment a URL asks for (OTT Club archive=, shift utc=), or '': the query is dropped by
  // redact(), and without this a failed recording looked like a failed live stream (TV run: /147.m3u8).
  function archiveOf(url) {
    var m = /[?&](?:archive|utc)=(\d{9,})/.exec(String(url || ''));
    return m ? ' (archive from ' + new Date(+m[1] * 1000).toISOString() + ')' : '';
  }

  // f: { n, gen, reason, url } of one failed playback attempt.
  function fail(f) {
    var line = new Date().toISOString() + ' #' + f.n + ' ' + f.reason + ' ' + redact(f.url) + archiveOf(f.url);
    console.log('[player] fail #' + f.n + ' gen=' + f.gen + ' ' + f.reason);
    pending.push(line);
    recent.push(line);
    if (recent.length > CONFIG.DIAG_LOG_LINES) recent.shift();
    schedule();
  }

  function count(name, ms) {
    counters[name] = (counters[name] || 0) + 1;
    if (ms) counters[name + 'Ms'] = (counters[name + 'Ms'] || 0) + ms;
    schedule();
  }
  function note(name, value) { notes[name] = value; schedule(); }

  function schedule() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { Util.idle(flush); }, CONFIG.DIAG_FLUSH_MS);
  }

  // One read-merge-write of failLog: re-read first, so a reset to [] by the TV scripts is kept.
  function flush() {
    flushTimer = null;
    if (pending.length) {
      var log = Util.load('failLog');
      Util.save('failLog', (log instanceof Array ? log : []).concat(pending).slice(-CONFIG.DIAG_LOG_LINES));
      pending = [];
    }
    Util.save('diag', { counters: counters, notes: notes });
  }

  function snapshot() { return { counters: counters, notes: notes, recent: recent.slice() }; }

  // snapshot() is read from the Tizen inspector console (TV checks TV-4 and TV-9).
  return { fail: fail, count: count, note: note, snapshot: snapshot };
}());
