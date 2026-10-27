// Archive with the slider (owner 2026-10-27: «проверь архивы и с прокруткой истории назад слайдером»). On the current
// channel (it must have an archive): ▲ opens the slider, ◀ steps back (single presses: 30 s; held: 30 s → 2 min → 10 min),
// ▲ jumps to the previous programme; OK starts the archive there. Per case: target time on the slider, key → PLAYING →
// playback time moving, spinner, the archive position actually reached vs the target (seconds), a 15 s watch
// (buffering, freezes: PLAYING but time not moving ≥ 2 s). Then back to live. The screen itself is not seen.
const K = { LEFT: 37, RIGHT: 39, UP: 38, ENTER: 13, BACK: 10009 };
export default async function (c) {
  const st = `(function(){var p=Playback.current(),sp=document.getElementById('spinner');return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),state:webapis.avplay.getState(),mode:Playback.mode(),ov:Overlay.mode(),spin:!!sp&&getComputedStyle(sp).visibility!=='hidden'&&getComputedStyle(sp).display!=='none',t:webapis.avplay.getCurrentTime(),pos:Playback.position(),days:p?p.catchupDays:0}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING') break; await c.sleep(1000); }
  const orig = s; c.log('start', orig.name, 'group', orig.grp, 'archive days', orig.days);
  await c.ev(`(function(){ window.__B = { buf: 0, bufMs: 0, bs: 0 }; var av = webapis.avplay;
    if (!av.__wrapped2) { var o = av.setListener.bind(av); av.setListener = function (l) { var w = {}; Object.keys(l).forEach(function (k) { w[k] = function (a, b) {
      if (k === 'onbufferingstart') { __B.buf++; __B.bs = Date.now(); } if (k === 'onbufferingcomplete' && __B.bs) { __B.bufMs += Date.now() - __B.bs; __B.bs = 0; } return l[k](a, b); }; }); return o(w); }; av.__wrapped2 = true; }
    return 1; })()`);
  const sliderTarget = async () => {
    const txt = await c.ev(`(document.getElementById('s-time')||{}).textContent`);
    const m = /(\d\d):(\d\d):(\d\d)/.exec(txt || ''); if (!m) return { txt, ms: null };
    const d = new Date(await c.ev('Date.now()')); d.setHours(+m[1], +m[2], +m[3], 0); let ms = d.getTime();
    if (ms > (await c.ev('Date.now()')) + 60000) ms -= 86400000;
    return { txt, ms, delta: await c.ev(`(document.getElementById('s-delta')||{}).textContent`), title: await c.ev(`(document.getElementById('s-title')||{}).textContent`) };
  };
  const run = async (name, keys, gapMs) => {
    await c.key(K.UP); await c.sleep(900);
    for (const k of keys) { await c.key(k); await c.sleep(gapMs); }
    await c.sleep(700);
    const tg = await sliderTarget();
    await c.ev('__B.buf=0;__B.bufMs=0;1');
    const t0 = Date.now(); await c.key(K.ENTER);
    let play = null, moving = null, spin = 0, x, t1 = null;
    for (let t = 0; t < 25000; t += 100) { await c.sleep(100); x = await c.ev(st); if (x.spin) spin += 100; if (play === null && x.state === 'PLAYING' && x.mode === 'archive' && t > 300) { play = Date.now() - t0; t1 = x.t; } if (play !== null && moving === null && x.t > t1) moving = Date.now() - t0; if (moving !== null && !x.spin) break; }
    const bS = await c.ev('__B.buf');
    let spinW = 0, freezes = 0, lastT = x.t, still = 0;
    for (let t = 0; t < 15000; t += 250) { await c.sleep(250); const y = await c.ev(st); if (y.spin) spinW += 250; if (y.state === 'PLAYING' && y.t === lastT) { still += 250; if (still === 2000) freezes++; } else still = 0; lastT = y.t; }
    const y = await c.ev(st), b = await c.ev('({buf:__B.buf,bufMs:__B.bufMs})');
    const playedS = moving ? (Date.now() - (t0 + moving)) / 1000 : 0;
    const offsetS = tg.ms && y.mode === 'archive' ? Math.round((y.pos - tg.ms) / 1000 - playedS) : null;
    c.log(name.padEnd(30), JSON.stringify({ slider: tg.txt, behind: tg.delta, programme: (tg.title || '').split('·').pop().trim().slice(0, 40), toPlayingMs: play, toMovingMs: moving, spinnerStartMs: spin,
      positionVsTargetS: offsetS, watch15s: { spinnerMs: spinW, bufEvents: b.buf - bS, bufMs: b.bufMs, freezes }, mode: y.mode, state: y.state }));
  };
  await run('◀ ×3 (≈1.5 min back)', [K.LEFT, K.LEFT, K.LEFT], 600);
  await run('◀ held ×20 (≈1 h back)', Array(20).fill(K.LEFT), 200);
  await run('▲ previous programme ×2', [K.UP, K.UP], 700);
  await run('◀ held ×60 (≈8 h back)', Array(60).fill(K.LEFT), 200);
  await run('in archive: ▶ ×4 forward', [K.RIGHT, K.RIGHT, K.RIGHT, K.RIGHT], 600);
  // back to live
  const tl = Date.now(); await c.ev(`(function(){Zap.pick(Channels.get(${JSON.stringify(orig.ch)}),${orig.grp});return 1})()`); let lp = null;
  for (let t = 0; t < 20000; t += 100) { await c.sleep(100); s = await c.ev(st); if (s.state === 'PLAYING' && s.mode === 'live' && t > 300) { lp = Date.now() - tl; break; } }
  await c.sleep(2500);
  const lc = await c.ev(`(function(){var r=Util.load('lastCh');return r&&r[10]})()`);
  c.log('back to live', JSON.stringify({ toPlayingMs: lp, name: s.name, mode: s.mode, sameGroup: s.grp === orig.grp, lastChIsOriginal: lc === orig.ch }));
}
