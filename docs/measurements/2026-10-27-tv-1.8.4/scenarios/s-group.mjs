// Кино channels and high-bitrate channels (owner 2026-10-27: «Попробуй каналы с большим битрейтом», «каналы с Кино — с
// ними в основном проблемы были»). Per channel: pick → PLAYING → playback time moving; spinner; video resolution and
// bitrate from AVPlay stream info; 20 s watch: buffering events, spinner, freezes (PLAYING but the playback time not
// moving for ≥ 2 s). The screen itself is not seen: «moving» means AVPlay's playback time advances. Original restored.
export default async function (c, args) {
  const watchMs = +(args[0] || 20000), maxN = +(args[1] || 40), GROUP = args[2] || 'Кино';
  const st = `(function(){var p=Playback.current(),sp=document.getElementById('spinner');return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),state:webapis.avplay.getState(),spin:!!sp&&getComputedStyle(sp).visibility!=='hidden'&&getComputedStyle(sp).display!=='none',t:webapis.avplay.getCurrentTime()}})()`;
  const info = `(function(){try{var v=webapis.avplay.getCurrentStreamInfo().filter(function(x){return x.type==='VIDEO'})[0];var e=v?JSON.parse(v.extra_info):{};return {w:e.Width,h:e.Height,br:e.Bit_rate,fps:e.Framerate}}catch(err){return {err:String(err).slice(0,60)}}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING') break; await c.sleep(1000); }
  const orig = s; c.log('start', orig.name, 'group', orig.grp);
  await c.ev(`(function(){ window.__B = { buf: 0, bufMs: 0, bs: 0 }; var av = webapis.avplay;
    if (!av.__wrapped2) { var o = av.setListener.bind(av); av.setListener = function (l) { var w = {}; Object.keys(l).forEach(function (k) { w[k] = function (a, b) {
      if (k === 'onbufferingstart') { __B.buf++; __B.bs = Date.now(); } if (k === 'onbufferingcomplete' && __B.bs) { __B.bufMs += Date.now() - __B.bs; __B.bs = 0; } return l[k](a, b); }; }); return o(w); }; av.__wrapped2 = true; }
    return 1; })()`);
  const list = await c.ev(`(function(){var gs=Channels.groups(),g=-1;for(var i=0;i<gs.length;i++)if(g<0&&gs[i].name.indexOf(${JSON.stringify(GROUP)})===0)g=i;if(g<0)return [];return gs[g].items.slice(0,${maxN}).map(function(it){return [Channels.at(it).key,g]})})()`);
  c.log(GROUP + ' channels to test', list.length);
  const rows = [];
  for (const [key, g] of list) {
    await c.ev('__B.buf=0;__B.bufMs=0;1');
    const t0 = Date.now(); await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(key)}),${g});return 1})()`);
    let play = null, moving = null, spin = 0, x, t1 = null;
    for (let t = 0; t < 20000; t += 100) { await c.sleep(100); x = await c.ev(st); if (x.spin) spin += 100; if (play === null && x.state === 'PLAYING' && t > 300) { play = Date.now() - t0; t1 = x.t; } if (play !== null && moving === null && x.t > t1) moving = Date.now() - t0; if (moving !== null && !x.spin) break; }
    const bStart = await c.ev('__B.buf');
    let spinW = 0, freezes = 0, frozenMs = 0, lastT = x.t, stillMs = 0;
    for (let t = 0; t < watchMs; t += 250) { await c.sleep(250); const y = await c.ev(st); if (y.spin) spinW += 250;
      if (y.state === 'PLAYING' && y.t === lastT) { stillMs += 250; if (stillMs === 2000) freezes++; if (stillMs >= 2000) frozenMs += 250; } else stillMs = 0; lastT = y.t; }
    const b = await c.ev('({buf:__B.buf,bufMs:__B.bufMs})'), v = await c.ev(info);
    const r = { ch: x.name, res: v.w ? v.w + 'x' + v.h : v.err || '?', kbps: v.br ? Math.round(v.br / 1000) : null, toPlayingMs: play, toMovingMs: moving, spinnerStartMs: spin, watch: { spinnerMs: spinW, bufEvents: b.buf - bStart, bufMs: b.bufMs, freezes, frozenMs }, state: x.state };
    rows.push(r); c.log(JSON.stringify(r));
  }
  // summary sorted by bitrate
  rows.sort((a, b) => (b.kbps || 0) - (a.kbps || 0));
  c.log('TOP by bitrate', JSON.stringify(rows.slice(0, 5).map((r) => r.ch + ' ' + r.kbps + 'kbps ' + r.res)));
  const bad = rows.filter((r) => r.toMovingMs === null || r.watch.spinnerMs > 0 || r.watch.freezes > 0 || r.watch.bufEvents > 0 || r.state !== 'PLAYING');
  c.log('problems', bad.length, JSON.stringify(bad.map((r) => r.ch)));
  await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(orig.ch)}),${orig.grp});return 1})()`);
  for (let i = 0; i < 20; i++) { s = await c.ev(st); if (s.state === 'PLAYING' && s.ch === orig.ch) break; await c.sleep(1000); }
  await c.sleep(2500);
  const lc = await c.ev(`(function(){var r=Util.load('lastCh');return r&&r[10]})()`);
  c.log('restored', JSON.stringify({ name: s.name, sameGroup: s.grp === orig.grp, lastChIsOriginal: lc === orig.ch }));
}
