// Q1 TV acceptance (DEC-2026-10-26-now-refresh-2 + 60 s re-read). Network cuts are simulated inside the app:
// list requests (/api/channel_now) fail; the stream is untouched.
export default async function (c, args) {
  const MIN = 60000, total = +(args[0] || 60);
  for (let i = 0; i < 100; i++) { if ((await c.ev("typeof NowLines!=='undefined'&&Channels.count()>0")) === true) break; await c.sleep(300); }
  await c.sleep(5000);
  await c.ev(`(function(){window.__acc={log:[],cut:false};var g=Net.get;Net.get=function(o,cb){if(/channel_now/.test(o.url)){__acc.log.push({t:Date.now(),fresh:/[?]t=/.test(o.url),cut:__acc.cut});if(__acc.cut){var t=setTimeout(function(){cb(new Error('simulated cut'))},500);return {abort:function(){clearTimeout(t)}};}}return g.apply(this,arguments);};return 1})()`);
  const rows = () => c.ev(`JSON.stringify([].slice.call(document.querySelectorAll('#guide .row')).filter(function(r){return r.offsetWidth>0&&getComputedStyle(r).visibility==='visible'&&r.parentElement&&/channels/.test(r.parentElement.id+' '+r.parentElement.className)}).map(function(r){var t=r.querySelector('.t'),s=r.querySelector('.s');return [(t||{}).textContent||'',(s||{}).textContent||'']}))`);
  const st = () => c.ev("JSON.stringify({ov:Overlay.isNone()?'none':'open',av:(function(){try{return webapis.avplay.getState()}catch(e){return 'ERR'}})(),media:Player.mediaTimeMs(),reb:(Diag.snapshot().counters.rebuffer||0),fails:Diag.snapshot().recent.length,build:CONFIG.BUILD})");
  const log = async () => JSON.parse(await c.ev('JSON.stringify(__acc.log)'));
  const s0 = JSON.parse(await st()); c.log('START', JSON.stringify(s0));
  // open the menu (ENTER), wait for it
  await c.key(13); await c.sleep(2500);
  // TV3: fast page flipping
  const n0 = (await log()).length; const k0 = Date.now();
  for (let i = 0; i < 15; i++) { await c.key(428); await c.sleep(200); }
  const lastKey = Date.now(); const during = (await log()).slice(n0).filter((r) => r.t < lastKey).length;
  await c.sleep(6000);
  const after = (await log()).slice(n0).filter((r) => r.t >= lastKey).map((r) => (r.t - lastKey) + 'ms' + (r.fresh ? ' fresh' : ' PLAIN'));
  const r3 = JSON.parse(await rows());
  c.log('TV3 flip: requests while keys repeated', during, '· after the last key', JSON.stringify(after), '· rows', r3.length, '· empty', r3.filter((x) => !x[1]).length);
  // TV2/4/5/6: menu open `total` min, cuts at 10–12 and 25–45 min
  const t0 = Date.now(), n1 = (await log()).length;
  let maxEmpty = 0, samples = 0, emptySamples = 0, firstMark = null, marksAt = [], recovery = null, cutEnd = null, prevMarked = 0;
  const cuts = [[10, 12], [25, 45]];
  for (let s = 30; s <= total * 60; s += 30) {
    await c.sleep(Math.max(0, t0 + s * 1000 - Date.now()));
    const m = s / 60, cut = cuts.some(([a, b]) => m > a && m <= b);
    const was = await c.ev('__acc.cut'); if (cut !== was) { await c.ev('__acc.cut=' + cut); c.log(cut ? 'CUT start' : 'CUT end', 'at +' + m + ' min'); if (!cut) { cutEnd = Date.now(); recovery = null; } }
    const r = JSON.parse(await rows()), sNow = JSON.parse(await st());
    const empty = r.filter((x) => !x[1]).length, marked = r.filter((x) => x[1].indexOf('(шла до ') >= 0).length;
    samples++; if (empty) emptySamples++; maxEmpty = Math.max(maxEmpty, empty);
    if (marked && !firstMark) firstMark = '+' + m + ' min';
    if (cutEnd && prevMarked && !marked && recovery === null) recovery = Math.round((Date.now() - cutEnd) / 1000) + ' s after the cut ended (sampled every 30 s)';
    prevMarked = marked;
    if (s % 300 === 0 || marked || empty || cut !== was) c.log('+' + m + ' min', 'overlay', sNow.ov, 'av', sNow.av, 'rows', r.length, 'empty', empty, 'marked', marked, marked ? JSON.stringify(r.filter((x) => x[1].indexOf('(шла до ') >= 0).slice(0, 2)) : '', 'rebuffers', sNow.reb);
    if (sNow.ov !== 'open') { c.log('MENU CLOSED by itself at +' + m + ' min'); break; }
  }
  await c.ev('__acc.cut=false');
  const L = (await log()).slice(n1), healthy = L.filter((x) => !x.cut);
  const gaps = healthy.slice(1).map((x, i) => Math.round((x.t - healthy[i].t) / 1000));
  const s1 = JSON.parse(await st());
  c.log('TV2 requests in', total, 'min:', L.length, '(healthy', healthy.length, '· during cuts', L.length - healthy.length, ') · plain (not ?t=)', L.filter((x) => !x.fresh).length, '· healthy gaps s min/max', Math.min(...gaps), Math.max(...gaps), '· per hour (healthy minutes only)', Math.round(healthy.length / ((total - 22) / 60)));
  c.log('TV4/TV5 empty rows: max', maxEmpty, 'in', emptySamples, 'of', samples, 'samples · first «шла до» mark', firstMark, '· marks gone', recovery);
  c.log('TV6 rebuffers before', s0.reb, 'after', s1.reb, '· player', s1.av, '· media advanced', Math.round((s1.media - s0.media) / 1000), 's · failure-log lines', s0.fails, '→', s1.fails);
  await c.key(10009); await c.sleep(500);
  c.log('END', JSON.stringify(JSON.parse(await st())));
}
