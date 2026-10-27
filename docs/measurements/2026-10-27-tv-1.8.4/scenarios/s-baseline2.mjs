// Baseline on the installed 1.8.4 (2026-10-27, owner away; only our app is touched, the channel is restored at the end).
// 1) state; 2) localStorage use and quota (probe key written and removed); 3) 90 s passive watch: spinner / AVPlay state;
// 4) four single zaps: key → PLAYING and spinner time; 5) back to the original channel and group; lastCh restored.
export default async function (c) {
  const st = `(function(){var p=Playback.current(),sp=document.getElementById('spinner');return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),src:Sources.activeId(),n:Channels.count(),state:webapis.avplay.getState(),spin:!!sp&&getComputedStyle(sp).visibility!=='hidden'&&getComputedStyle(sp).display!=='none'}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING' && s.n) break; await c.sleep(1000); }
  const orig = s; c.log('start', JSON.stringify({ name: s.name, grp: s.grp, n: s.n, state: s.state, src: String(s.src).replace(/user:.*/, 'user:<url>') }));
  const use = await c.ev(`(function(){var t=0,k=0;for(var i=0;i<localStorage.length;i++){var n=localStorage.key(i);t+=n.length+(localStorage.getItem(n)||'').length;k++}return {keys:k,chars:t,lastList:(localStorage.getItem('lastList')||'').length}})()`);
  c.log('storage use', JSON.stringify(use));
  // passive watch
  let spinOn = 0, spinRuns = 0, prev = false, states = {}; const W = 90000, step = 250;
  for (let t = 0; t < W; t += step) { const x = await c.ev(st); if (x.spin) { spinOn += step; if (!prev) spinRuns++; } prev = x.spin; states[x.state] = (states[x.state] || 0) + 1; await c.sleep(step); }
  c.log('watch 90 s on', orig.name, JSON.stringify({ spinnerVisibleMs: spinOn, spinnerAppearances: spinRuns, stateSamples: states }));
  // zaps
  for (let z = 1; z <= 4; z++) {
    const t0 = await c.key(39); let first = null, spin = 0, last;
    for (let t = 0; t < 15000; t += 100) { await c.sleep(100); last = await c.ev(st); if (last.spin) spin += 100; if (last.state === 'PLAYING' && first === null && t > 300) { first = Date.now() - t0; } if (first !== null && t > first + 1500) break; }
    c.log('zap ' + z, JSON.stringify({ to: last.name, keyToPlayingMs: first, spinnerMs: spin, state: last.state }));
    await c.sleep(3000);
  }
  // restore
  const back = await c.ev(`(function(k,g){var ch=Channels.get(k);if(!ch)return 'channel gone';Zap.pick(ch,g);return 'picked'})(${JSON.stringify(orig.ch)},${orig.grp})`);
  for (let i = 0; i < 20; i++) { s = await c.ev(st); if (s.state === 'PLAYING' && s.ch === orig.ch) break; await c.sleep(1000); }
  await c.sleep(2500);
  const lc = await c.ev(`(function(){var r=Util.load('lastCh');return r&&r[10]})()`);
  c.log('restored', back, JSON.stringify({ name: s.name, grp: s.grp, sameGroup: s.grp === orig.grp, lastChIsOriginal: lc === orig.ch, state: s.state }));
}
