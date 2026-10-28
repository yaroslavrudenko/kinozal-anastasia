// The archive slider (▲ / ⏪ ⏩ while watching): a timeline of the programme under the knob. Nothing is
// reloaded while the knob moves; OK opens the archive once, at the chosen moment.
(function () {
  var REPEAT_MS = 450, HALF_HOUR_MS = 1800000, STEP = { short: 30000, mid: 120000, long: 600000, rewind: 300000 };
  var t = 0, lastKey = 0, run = 0, c = null;

  function open() {
    c = Playback.current();
    t = Playback.position(); lastKey = 0; run = 0;
    EPG.ensure(c.id, function () { if (Overlay.mode() === 'scrub') render(); });
    UI.show('scrub', true);
    render();
  }
  function close() { UI.show('scrub', false); }

  function onKey(k, e) {
    e.preventDefault();
    var now = Date.now();
    if (k === K.LEFT || k === K.RIGHT || k === K.REWIND || k === K.FF) {
      // Holding the key repeats it: the step grows from 30 s to 2 min to 10 min.
      run = now - lastKey < REPEAT_MS ? run + 1 : 0;
      lastKey = now;
      var step = run < 6 ? STEP.short : run < 16 ? STEP.mid : STEP.long;
      if (k === K.REWIND || k === K.FF) step = Math.max(step, STEP.rewind);
      t += (k === K.LEFT || k === K.REWIND ? -1 : 1) * step;
    } else if (k === K.UP || k === K.DOWN) {
      var cur = EPG.at(c.id, t);
      if (k === K.UP) { var prev = cur ? EPG.at(c.id, cur.start - 1000) : null; t = prev ? prev.start : t - HALF_HOUR_MS; }
      else t = cur ? cur.stop : t + HALF_HOUR_MS;
    } else if (k === K.ENTER) {
      Overlay.close(); Playback.archive(c, t); return;
    } else if (Keys.isBack(k)) {
      Overlay.close(); return;
    } else return;
    t = Math.max(Catchup.earliest(c, now), Math.min(now, t));
    render();
  }

  function render() {
    var now = Date.now(), p = EPG.at(c.id, t);
    // Without a guide entry the bar spans the hour around the knob.
    var from = p ? p.start : t - HALF_HOUR_MS, to = p ? p.stop : t + HALF_HOUR_MS;
    var pct = function (x) { return Math.max(0, Math.min(100, (x - from) / (to - from) * 100)); };
    var behind = Math.round((now - t) / Util.MIN_MS);
    UI.scrub({
      title: I18n.iso(c.name) + (p ? '  ·  ' + I18n.iso(p.title) : ''),
      time: t >= now - CONFIG.LIVE_SNAP_MS ? I18n.t('sc.live') : hhmmss(new Date(t)),
      start: Util.hhmm(new Date(from)), end: Util.hhmm(new Date(to)),
      delta: behind > 0 ? I18n.t('sc.behind', fmtMin(behind)) : '',
      playedPct: pct(Math.min(now, to)), nowPct: now >= from && now <= to ? pct(now) : null, knobPct: pct(t)
    });
  }
  function hhmmss(d) { return Util.hhmm(d) + ':' + Util.pad2(d.getSeconds()); }
  function fmtMin(m) { return m >= 60 ? I18n.t('sc.hm', Math.floor(m / 60), m % 60) : I18n.t('sc.m', m); }

  Overlay.register('scrub', { open: open, close: close, onKey: onKey, render: render });
}());
