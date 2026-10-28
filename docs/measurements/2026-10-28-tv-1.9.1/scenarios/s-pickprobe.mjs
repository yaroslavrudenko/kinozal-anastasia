// Pick → playing, split into its parts (1.8.4: 1149 ms once; 1.9.0: 1136–1386). Run on the owner's start state:
// node $S/tv5/cdp.mjs <port> $S/perf-degradation/s-pickprobe.mjs [nowant]
// Three round trips inside the playing channel's group: menu → ▼ → OK (the next channel), 4 s, menu → ▲ → OK (back).
// It ends on the channel and group it started on (asserted). Per pick, page clock, ms from the OK key:
//   keyJs (the keydown handler: Overlay.close + Zap.pick + Player.open + AVPlay stop/close/open/prepareAsync calls),
//   r2 (2nd frame), each AVPlay call's start and duration, prepared (prepareAsync success), play() call,
//   READY / PLAYING (state polled every 20 ms), the first frame (Player's onFirstFrame hook via Banner/Zap), spinner off.
const K = { UP: 38, DOWN: 40, ENTER: 13 };
const INSTALL = `(function () {
  if (window.__R) return 'had';
  var R = window.__R = { on: false, t0: 0, ev: [], restore: [] }, oSI = window.setInterval, oCI = window.clearInterval;
  function now() { return performance.now(); }
  function rel() { return Math.round((now() - R.t0) * 10) / 10; }
  function wrap(obj, name, label, cbArg) {
    if (!obj || typeof obj[name] !== 'function') return 'no ' + label;
    var f = obj[name];
    try {
      obj[name] = function () {
        if (!R.on) return f.apply(this, arguments);
        var a = Array.prototype.slice.call(arguments), s = rel(), t = now();
        if (cbArg !== undefined && typeof a[cbArg] === 'function') { var cb = a[cbArg]; a[cbArg] = function () { R.ev.push([label + '.ok', rel(), 0]); return cb.apply(this, arguments); }; }
        try { return f.apply(this, a); } finally { R.ev.push([label, s, Math.round((now() - t) * 10) / 10]); }
      };
      if (obj[name] === f) return 'not assignable ' + label;
      R.restore.push(function () { obj[name] = f; });
      return 'ok';
    } catch (e) { return 'failed ' + label + ': ' + e; }
  }
  var w = [wrap(Zap, 'pick', 'Zap.pick'), wrap(Player, 'open', 'Player.open'), wrap(Overlay, 'close', 'Overlay.close'), wrap(UI, 'banner', 'UI.banner'),
    wrap(Playback, 'onFirstFrame', 'Playback.onFirstFrame')];
  var av = window.webapis && webapis.avplay;
  if (av) w.push(wrap(av, 'stop', 'av.stop'), wrap(av, 'close', 'av.close'), wrap(av, 'open', 'av.open'), wrap(av, 'prepareAsync', 'av.prepareAsync', 0), wrap(av, 'play', 'av.play'));
  R.wraps = w;
  var sp = document.getElementById('spinner');
  window.__pick = function (code) {
    R.ev = []; R.t0 = now(); R.on = true; R.done = false;
    var last = av ? av.getState() : '', spin = sp.className.indexOf('hidden') < 0;
    var poll = oSI.call(window, function () {
      var s = av ? av.getState() : 'DESKTOP', on = sp.className.indexOf('hidden') < 0;
      if (s !== last) { R.ev.push(['state ' + s, rel(), 0]); last = s; }
      if (on !== spin) { R.ev.push([on ? 'spinner on' : 'spinner off', rel(), 0]); spin = on; }
      if ((s === 'PLAYING' && !on && rel() > 300) || rel() > 15000) { oCI.call(window, poll); R.on = false; R.done = true; }
    }, 20);
    var e = document.createEvent('Event'); e.initEvent('keydown', true, true); e.keyCode = code;
    var t = now(); document.dispatchEvent(e); R.keyJs = Math.round((now() - t) * 10) / 10;
    requestAnimationFrame(function () { requestAnimationFrame(function () { R.r2 = Math.round((now() - t) * 10) / 10; }); });
    return 1;
  };
  window.__pickResult = function () { return R.done ? { keyJs: R.keyJs, r2: R.r2, ev: R.ev } : null; };
  window.__pickUnwrap = function () { while (R.restore.length) R.restore.pop()(); delete window.__R; delete window.__pick; delete window.__pickResult; delete window.__pickUnwrap; return 'restored'; };
  return w.join(',');
})()`;

export default async function (c, args) {
  const opt = new Set(args || []);
  const st = `(function(){var p=Playback.current();return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),lang:window.I18n?I18n.code():'(1.8.4: none)',state:window.webapis?webapis.avplay.getState():'DESKTOP',mode:Overlay.mode()}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING') break; await c.sleep(1000); }
  const orig = s; c.log('start', JSON.stringify(orig));
  if (orig.mode !== 'none' || orig.state !== 'PLAYING') { c.log('ABORT: not playing with no overlay'); return; }
  await c.sleep(4000);
  if (opt.has('nowant')) await c.ev('(function(){if(!window.Logos)return 0;window.__w=Logos.want;Logos.want=function(){};return 1})()');
  c.log('install', await c.ev(INSTALL));
  const key = (code) => c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${code};document.dispatchEvent(e);return 1})()`);
  const one = async (label, step) => {
    await key(K.ENTER); await c.sleep(900);                 // menu opens on the playing channel
    await key(step); await c.sleep(600);
    await c.ev(`__pick(${K.ENTER})`);
    let r = null; for (let i = 0; i < 200 && !r; i++) { await c.sleep(100); r = await c.ev('__pickResult()'); }
    const now = await c.ev(st);
    const first = (re) => { const e = r && r.ev.find((x) => re.test(x[0])); return e ? e[1] : null; };
    c.log(label.padEnd(18), JSON.stringify({ to: now.name, keyJs: r && r.keyJs, r2: r && r.r2, playerOpen: first(/^Player\.open$/), prepared: first(/prepareAsync\.ok/),
      ready: first(/state READY/), playing: first(/state PLAYING/), spinnerOff: first(/spinner off/), firstFrame: first(/onFirstFrame/), timeline: r && r.ev.map((x) => `${x[0]}@${x[1]}${x[2] ? '+' + x[2] : ''}`).join(' · ') }));
    await c.sleep(4000);
  };
  for (let i = 1; i <= 3; i++) { await one(`pick ▼ #${i}`, K.DOWN); await one(`pick ▲ back #${i}`, K.UP); }
  c.log('unwrap', await c.ev('window.__pickUnwrap ? __pickUnwrap() : "none"'));
  if (opt.has('nowant')) await c.ev('(function(){if(!window.__w)return 0;Logos.want=window.__w;delete window.__w;return 1})()');
  let end = await c.ev(st);
  if (end.ch !== orig.ch) {                                   // a pick that failed half-way: put the owner's channel back
    await c.ev(`(function(k,g){var ch=Channels.get(k);if(ch)Zap.pick(ch,g);return 1})(${JSON.stringify(orig.ch)},${orig.grp})`);
    for (let i = 0; i < 20; i++) { end = await c.ev(st); if (end.state === 'PLAYING' && end.ch === orig.ch) break; await c.sleep(1000); }
  }
  c.log('restored', JSON.stringify({ name: end.name, sameChannel: end.ch === orig.ch, sameGroup: end.grp === orig.grp, lang: end.lang, state: end.state, mode: end.mode }));
}
