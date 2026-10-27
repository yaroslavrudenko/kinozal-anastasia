// Full navigation run (owner 2026-10-27: «начинать нужно с простой навигации по меню и переключением групп и каналов …
// замерить время и проверить производительность»). Each remote key is dispatched inside the page; the time is from the
// key to the second animation frame after it (the screen showing the result). A rAF loop records the longest frame gap
// (a pause of the picture/UI) per phase; XHRs are counted per phase. Original channel and group are restored at the end.
const K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, CH_UP: 427, CH_DOWN: 428 };
export default async function (c) {
  const st = `(function(){var p=Playback.current();return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),state:webapis.avplay.getState(),mode:Overlay.mode()}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING') break; await c.sleep(1000); }
  const orig = s; c.log('start', orig.name, 'group', orig.grp);
  await c.sleep(4000);
  await c.ev(`(function(){
    window.__N = { gaps: [], maxGap: 0, last: 0, xhr: 0 };
    (function loop(t){ if (__N.last) { var g = t - __N.last; if (g > __N.maxGap) __N.maxGap = g; } __N.last = t; requestAnimationFrame(loop); })(0);
    var o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(){ __N.xhr++; return o.apply(this, arguments); };
    window.__key = function (code) { window.__res = null; var t0 = performance.now(); var e = document.createEvent('Event'); e.initEvent('keydown', true, true); e.keyCode = code; document.dispatchEvent(e);
      requestAnimationFrame(function () { requestAnimationFrame(function () { window.__res = Math.round(performance.now() - t0); }); }); return 1; };
    return 'ok'; })()`);
  const press = async (k) => { await c.ev(`__key(${k})`); for (let i = 0; i < 100; i++) { const r = await c.ev('window.__res'); if (typeof r === 'number') return r; await c.sleep(20); } return null; };
  const phase = async (name, keys, pause = 350) => {
    await c.ev('__N.maxGap=0; __N.xhr0=__N.xhr; 1');
    const ms = [];
    for (const k of keys) { ms.push(await press(k)); await c.sleep(pause); }
    const g = await c.ev('({gap:Math.round(__N.maxGap),xhr:__N.xhr-__N.xhr0,mode:Overlay.mode(),focus:(document.querySelector(".focus .t")||{}).textContent})');
    const sorted = ms.slice().sort((a, b) => a - b);
    c.log(name.padEnd(34), JSON.stringify({ keys: ms.length, medianMs: sorted[Math.floor(sorted.length / 2)], maxMs: sorted[sorted.length - 1], all: ms.join(' '), longestFrameGapMs: g.gap, requests: g.xhr, mode: g.mode, focus: (g.focus || '').slice(0, 40) }));
  };
  await phase('open menu (OK)', [K.ENTER], 800);
  await phase('channels ▼ ×12', Array(12).fill(K.DOWN));
  await phase('channels ▲ ×6', Array(6).fill(K.UP));
  await phase('channels CH− page ×5', Array(5).fill(K.CH_DOWN), 600);
  await phase('channels CH+ page ×5', Array(5).fill(K.CH_UP), 600);
  await phase('to groups (◀)', [K.LEFT]);
  const ng = await c.ev('Channels.groups().length');
  await phase('groups ▼ through all (' + ng + ')', Array(ng - 1).fill(K.DOWN), 400);
  await phase('groups ▲ back ×' + (ng - 1), Array(ng - 1).fill(K.UP), 300);
  await phase('group ▼ ×2 + into channels (▶)', [K.DOWN, K.DOWN, K.RIGHT], 500);
  await phase('channels ▼ ×3', [K.DOWN, K.DOWN, K.DOWN]);
  // pick a channel: OK → menu closes → stream plays
  const t0 = Date.now(); const close = await press(K.ENTER); let play = null;
  for (let t = 0; t < 15000; t += 100) { await c.sleep(100); const x = await c.ev(st); if (x.state === 'PLAYING' && t > 400) { play = Date.now() - t0; break; } }
  const picked = await c.ev(st);
  c.log('pick channel (OK)'.padEnd(34), JSON.stringify({ menuClosedMs: close, keyToPlayingMs: play, now: picked.name, group: picked.grp }));
  await c.sleep(3000);
  await phase('reopen menu (OK)', [K.ENTER], 800);
  await phase('close menu (Back)', [K.BACK], 600);
  // restore
  await c.ev(`(function(k,g){var ch=Channels.get(k);if(ch)Zap.pick(ch,g);return 1})(${JSON.stringify(orig.ch)},${orig.grp})`);
  for (let i = 0; i < 20; i++) { s = await c.ev(st); if (s.state === 'PLAYING' && s.ch === orig.ch) break; await c.sleep(1000); }
  await c.sleep(2500);
  const lc = await c.ev(`(function(){var r=Util.load('lastCh');return r&&r[10]})()`);
  c.log('restored', JSON.stringify({ name: s.name, sameGroup: s.grp === orig.grp, lastChIsOriginal: lc === orig.ch, state: s.state, mode: s.mode }));
}
