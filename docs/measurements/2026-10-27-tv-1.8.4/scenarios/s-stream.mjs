// Stream run (owner 2026-10-27: «После перейти к работе со стримом»; buffering itself stays, the viewer must not keep
// seeing the spinner). Six channels from different groups: pick → PLAYING, first media time, spinner time; then 30 s
// watching each: AVPlay buffering events (listener wrapped), spinner time. Then archive: ▲ scrub, ◀ ×4, OK → archive
// playing; then back to live. Original channel and group restored. No URLs or keys are printed.
const K = { LEFT: 37, UP: 38, ENTER: 13, BACK: 10009 };
export default async function (c) {
  const st = `(function(){var p=Playback.current(),sp=document.getElementById('spinner');return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),state:webapis.avplay.getState(),mode:Playback.mode(),ov:Overlay.mode(),spin:!!sp&&getComputedStyle(sp).visibility!=='hidden'&&getComputedStyle(sp).display!=='none',t:webapis.avplay.getCurrentTime()}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING') break; await c.sleep(1000); }
  const orig = s; c.log('start', orig.name, 'group', orig.grp);
  await c.ev(`(function(){ window.__B = { buf: 0, bufMs: 0, bs: 0 }; var av = webapis.avplay;
    if (!av.__wrapped2) { var o = av.setListener.bind(av); av.setListener = function (l) { var w = {}; Object.keys(l).forEach(function (k) { w[k] = function (a, b) {
      if (k === 'onbufferingstart') { __B.buf++; __B.bs = Date.now(); } if (k === 'onbufferingcomplete' && __B.bs) { __B.bufMs += Date.now() - __B.bs; __B.bs = 0; } return l[k](a, b); }; }); return o(w); }; av.__wrapped2 = true; }
    return 1; })()`);
  const pick = await c.ev(`(function(){var gs=Channels.groups(),out=[],want=['Израиль','Украина','Новостные','Кино','Детские','Спорт'];
    for(var w=0;w<want.length;w++)for(var g=0;g<gs.length;g++)if(gs[g].name===want[w]&&gs[g].items.length){var it=gs[g].items[Math.min(1,gs[g].items.length-1)];out.push([Channels.at(it).key,g,gs[g].name]);break}return out})()`);
  for (const [key, g, gname] of pick) {
    await c.ev(`__B.buf=0;__B.bufMs=0;1`);
    const t0 = Date.now(); await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(key)}),${g});return 1})()`);
    let play = null, media = null, spin = 0, x;
    for (let t = 0; t < 20000; t += 100) { await c.sleep(100); x = await c.ev(st); if (x.spin) spin += 100; if (play === null && x.state === 'PLAYING' && t > 300) play = Date.now() - t0; if (play !== null && media === null && x.t > 0) media = Date.now() - t0; if (media !== null && !x.spin) break; }
    const startBuf = await c.ev('__B.buf');
    let spinWatch = 0; for (let t = 0; t < 30000; t += 250) { await c.sleep(250); const y = await c.ev(st); if (y.spin) spinWatch += 250; }
    const b = await c.ev('({buf:__B.buf,bufMs:__B.bufMs})');
    c.log(('stream ' + gname).padEnd(18), JSON.stringify({ ch: x.name, toPlayingMs: play, toPictureMs: media, spinnerAtStartMs: spin, bufferingEventsAtStart: startBuf, watch30s: { spinnerMs: spinWatch, bufferingEvents: b.buf - startBuf, bufferingMs: b.bufMs }, state: x.state }));
  }
  // archive on the original channel
  await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(orig.ch)}),${orig.grp});return 1})()`);
  for (let i = 0; i < 20; i++) { s = await c.ev(st); if (s.state === 'PLAYING' && s.ch === orig.ch) break; await c.sleep(1000); }
  await c.sleep(4000);
  await c.key(K.UP); await c.sleep(800);
  for (let i = 0; i < 4; i++) { await c.key(K.LEFT); await c.sleep(400); }
  await c.sleep(600);
  const ta = Date.now(); await c.key(K.ENTER); let ap = null, am = null, aspin = 0, a;
  for (let t = 0; t < 20000; t += 100) { await c.sleep(100); a = await c.ev(st); if (a.spin) aspin += 100; if (ap === null && a.state === 'PLAYING' && a.mode !== 'live' && t > 300) ap = Date.now() - ta; if (ap !== null && am === null && a.t > 0) am = Date.now() - ta; if (am !== null && !a.spin) break; }
  c.log('archive start'.padEnd(18), JSON.stringify({ ch: a.name, mode: a.mode, toPlayingMs: ap, toPictureMs: am, spinnerMs: aspin, state: a.state }));
  await c.sleep(5000);
  // back to live: pick the channel again (live)
  const tl = Date.now(); await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(orig.ch)}),${orig.grp});return 1})()`); let lp = null;
  for (let t = 0; t < 20000; t += 100) { await c.sleep(100); s = await c.ev(st); if (s.state === 'PLAYING' && s.mode === 'live' && t > 300) { lp = Date.now() - tl; break; } }
  await c.sleep(2500);
  const lc = await c.ev(`(function(){var r=Util.load('lastCh');return r&&r[10]})()`);
  c.log('back to live'.padEnd(18), JSON.stringify({ toPlayingMs: lp, name: s.name, mode: s.mode, sameGroup: s.grp === orig.grp, lastChIsOriginal: lc === orig.ch }));
}
