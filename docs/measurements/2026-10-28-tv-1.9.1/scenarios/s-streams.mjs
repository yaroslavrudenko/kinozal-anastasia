// Streams batch (1.9.1) TV probe: channel zaps (◀▶ single presses, not bursts) inside «Кино» and «Израиль», measured on ONE
// clock — the TV page's Date.now() — so no TV↔Mac skew (review3 F-M1) and no sample counting (F-M2).
//   node $S/tv5/cdp.mjs <port> $S/streams-tree-probe/s-streams.mjs [n=8] [gap=8000] [groups=Кино,Израиль]
//        [bitrate=HIGHEST|AVERAGE|LOWEST] [noclose=1] [buftimeout=10] [freeze=1] [longarch=1]
// Flag overrides are set on CONFIG for the run (read at each open) and restored at the end, as are the start channel and
// its group (asserted). Per zap, ms from the key press (page clock):
//   name   — the banner title shows the new channel and an animation frame has run after it (≈ painted)
//   play   — AVPlay state PLAYING (polled every 20 ms in the page)   · move — playback time advancing (≈ picture)
//   spin   — big spinner (#spinner) visible time inside the zap window (MutationObserver), and how many times it showed
//   marks  — Diag S-0 timeline of the attempt (start, stop, close, open, setup, prepare, prepareCalled, prepared, play,
//            bufStart, bufDone, firstTime, ffRead0, ffRead1, banner …) relative to the key
// Nothing reads or prints the OTT key: stream URLs are not touched.
const INSTALL = `(function () {
  if (window.__ZS) return 'had';
  var Z = window.__ZS = { spin: { on: false, since: 0, total: 0, count: 0 }, cur: null, done: [] };
  var sp = document.getElementById('spinner'), title = document.getElementById('b-title');
  function spinUpd() {
    var on = sp.className.indexOf('hidden') < 0, t = Date.now(), s = Z.spin;
    if (on && !s.on) { s.on = true; s.since = t; s.count++; } else if (!on && s.on) { s.on = false; s.total += t - s.since; }
  }
  spinUpd();
  Z.spinObs = new MutationObserver(spinUpd); Z.spinObs.observe(sp, { attributes: true, attributeFilter: ['class'] });
  Z.titleObs = new MutationObserver(function () {
    var z = Z.cur;
    if (!z || z.name !== null || title.textContent.indexOf(z.want) < 0) return;
    z.name = -1;
    requestAnimationFrame(function () { z.name = Date.now() - z.t0; });
  });
  Z.titleObs.observe(title, { childList: true, characterData: true, subtree: true });
  function spinNow() { return Z.spin.total + (Z.spin.on ? Date.now() - Z.spin.since : 0); }
  // One zap: key, then poll until the time moves and 1 s more has passed (or 15 s).
  window.__zap = function (code, want) {
    var av = webapis.avplay, z = Z.cur = Z.lastZ = { want: want, t0: Date.now(), name: null, play: null, move: null, t1: null, spin0: spinNow(), shows0: Z.spin.count, done: false };
    var e = document.createEvent('Event'); e.initEvent('keydown', true, true); e.keyCode = code; document.dispatchEvent(e);
    z.keyJs = Date.now() - z.t0;
    var poll = setInterval(function () {
      var t = Date.now() - z.t0, s = '', ct = -1;
      try { s = av.getState(); ct = av.getCurrentTime(); } catch (err) {}
      if (z.play === null && s === 'PLAYING' && t > 50) { z.play = t; z.t1 = ct; }
      if (z.play !== null && z.move === null && ct > z.t1) z.move = t;
      if ((z.move !== null && t - z.move > 1000) || t > 15000) {
        clearInterval(poll);
        z.spinMs = spinNow() - z.spin0; z.spinShows = Z.spin.count - z.shows0;
        var a = Diag.snapshot().attempts, last = a[a.length - 1], rel = {};
        if (last) for (var k in last.marks) if (last.marks[k] >= z.t0 - 50) rel[k] = last.marks[k] - z.t0;
        z.marks = rel; z.done = true; Z.cur = null;
      }
    }, 20);
    return 1;
  };
  window.__zapResult = function () { var z = Z.lastZ; return z && z.done ? z : null; };
  window.__zapUninstall = function () { Z.spinObs.disconnect(); Z.titleObs.disconnect(); delete window.__ZS; delete window.__zap; delete window.__zapResult; delete window.__zapUninstall; return 'removed'; };
  return 'ok';
})()`;

const FLAGS = { bitrate: ['START_BITRATE', (v) => JSON.stringify(v)], noclose: ['AV_REUSE_NO_CLOSE', (v) => String(v === '1')],
  buftimeout: ['AV_BUFFERING_TIMEOUT_S', (v) => (v === 'null' ? 'null' : String(+v))], freeze: ['FREEZE_AS_BUFFERING', (v) => String(v === '1')],
  longarch: ['ARCHIVE_LONG_CONTINUATION', (v) => String(v === '1')] };
const median = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const p90 = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : null; };

export default async function (c, args) {
  const opt = Object.fromEntries((args || []).map((a) => a.split('=')));
  const n = +(opt.n || 8), gap = +(opt.gap || 8000), groups = (opt.groups || 'Кино,Израиль').split(',');
  const st = `(function(){var p=Playback.current();return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),state:webapis.avplay.getState(),mode:Overlay.mode()}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING') break; await c.sleep(1000); }
  const orig = s; c.log('start', JSON.stringify(orig));
  if (orig.mode !== 'none' || orig.state !== 'PLAYING') { c.log('ABORT: not playing with no overlay'); return; }
  if (!(await c.ev('!!(window.Diag && Diag.mark && Diag.snapshot().attempts)'))) { c.log('ABORT: this build has no Diag S-0 marks (needs 1.9.1 streams)'); return; }
  // Flags: saved, set for the run, restored at the end.
  const saved = {};
  for (const [k, [name, lit]] of Object.entries(FLAGS)) {
    if (opt[k] === undefined) continue;
    saved[name] = await c.ev(`JSON.stringify(CONFIG.${name})`);
    await c.ev(`(function(){CONFIG.${name} = ${lit(opt[k])};return 1})()`);
  }
  c.log('flags', JSON.stringify(await c.ev('({START_BITRATE:CONFIG.START_BITRATE,AV_REUSE_NO_CLOSE:CONFIG.AV_REUSE_NO_CLOSE,AV_BUFFERING_TIMEOUT_S:CONFIG.AV_BUFFERING_TIMEOUT_S,FREEZE_AS_BUFFERING:CONFIG.FREEZE_AS_BUFFERING,ARCHIVE_LONG_CONTINUATION:CONFIG.ARCHIVE_LONG_CONTINUATION})')));
  c.log('install', await c.ev(INSTALL));
  const all = [];
  for (const G of groups) {
    const g = await c.ev(`(function(){var gs=Channels.groups();for(var i=0;i<gs.length;i++)if(gs[i].name.indexOf(${JSON.stringify(G)})>=0)return {i:i,first:Channels.at(gs[i].items[0]).key,size:gs[i].items.length};return null})()`);
    if (!g) { c.log('group not found', G); continue; }
    await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(g.first)}),${g.i});return 1})()`);
    await c.sleep(gap);
    const rows = [];
    for (let i = 0; i < Math.min(n, g.size - 1); i++) {
      const want = await c.ev(`(function(){var k=Channels.nextVisible(Playback.current().key,1,Zap.group());return k?Channels.get(k).name:''})()`);
      await c.ev(`__zap(39, ${JSON.stringify(want)})`);
      let r = null; for (let k = 0; k < 200 && !r; k++) { await c.sleep(100); r = await c.ev('__zapResult()'); }
      const row = r ? { g: G, to: want, keyJs: r.keyJs, name: r.name, play: r.play, move: r.move, spin: r.spinMs, spinShows: r.spinShows, marks: r.marks } : { g: G, to: want, timeout: true };
      rows.push(row); all.push(row); c.log(JSON.stringify(row));
      await c.sleep(Math.max(0, gap - 1000));
    }
    c.log('SUMMARY ' + G, JSON.stringify({ n: rows.length, nameMed: median(rows.map((r) => r.name)), playMed: median(rows.map((r) => r.play)),
      moveMed: median(rows.map((r) => r.move)), moveP90: p90(rows.map((r) => r.move)), spinTotal: rows.reduce((a, r) => a + (r.spin || 0), 0),
      spinShows: rows.reduce((a, r) => a + (r.spinShows || 0), 0), stopMed: median(rows.map((r) => r.marks && r.marks.close - r.marks.stop)),
      closeMed: median(rows.map((r) => r.marks && r.marks.open - r.marks.close)), openSetupMed: median(rows.map((r) => r.marks && r.marks.prepareCalled - r.marks.open)) }));
  }
  c.log('ALL', JSON.stringify({ n: all.length, moveMed: median(all.map((r) => r.move)), moveP90: p90(all.map((r) => r.move)), nameMed: median(all.map((r) => r.name)),
    spinShows: all.reduce((a, r) => a + (r.spinShows || 0), 0) }));
  c.log('uninstall', await c.ev('window.__zapUninstall ? __zapUninstall() : "none"'));
  for (const [name, json] of Object.entries(saved)) await c.ev(`(function(){CONFIG.${name} = ${json === undefined ? 'undefined' : json};return 1})()`);
  let end = await c.ev(st);
  if (end.ch !== orig.ch || end.grp !== orig.grp) {
    await c.ev(`(function(k,g){var ch=Channels.get(k);if(ch)Zap.pick(ch,g);return 1})(${JSON.stringify(orig.ch)},${orig.grp})`);
    for (let i = 0; i < 20; i++) { end = await c.ev(st); if (end.state === 'PLAYING' && end.ch === orig.ch) break; await c.sleep(1000); }
  }
  await c.sleep(2500);
  const lc = await c.ev(`(function(){var r=Util.load('lastCh');return r&&r[10]})()`);
  c.log('restored', JSON.stringify({ name: end.name, sameChannel: end.ch === orig.ch, sameGroup: end.grp === orig.grp, lastChIsOriginal: lc === orig.ch,
    flagsRestored: JSON.stringify(Object.keys(saved)) }));
}
