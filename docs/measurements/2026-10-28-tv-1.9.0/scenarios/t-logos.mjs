// TV probe (run with tv5/cdp.mjs): logo flicker, image requests by source and menu key latency, per phase.
//   node <S>/tv5/cdp.mjs <port> <S>/logo-design/t-logos.mjs <label>        (label: before | after)
// Needs the app PLAYING on its normal list. Picks no channel; ends with the menu closed (state printed).
// Per phase: requests the page started for images (Network.requestWillBeSent), how each was answered (network /
// fromDiskCache / 304), memory-cache hits (Network.requestServedFromCache), and per animation frame the visible
// channel rows whose channel has a logo but none painted ("blank"), rows painting another channel's picture
// ("wrong"), rows that lost a painted logo while still showing the same channel ("vanished"); key -> second frame.
// Logo URLs are logged by file name only (myott.top/images/<n>.png carries no key).
export default async function (c, args) {
  const label = (args && args[0]) || 'run';
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(`({st:webapis.avplay.getState(),n:Channels.count(),v:CONFIG.VERSION})`); if (s && s.st === 'PLAYING' && s.n) break; await c.sleep(1000); }
  c.log('label', label, 'version', s && s.v, 'state', s && s.st, 'channels', s && s.n);
  const net = { req: {}, order: [] };
  c.on((m) => {
    const p = m.params || {};
    if (m.method === 'Network.requestWillBeSent' && p.type !== 'XHR' && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(p.request.url)) { net.req[p.requestId] = { f: p.request.url.replace(/^.*\//, ''), how: 'pending' }; net.order.push(p.requestId); }
    if (m.method === 'Network.requestServedFromCache' && net.req[p.requestId]) net.req[p.requestId].how = 'memory';
    if (m.method === 'Network.responseReceived' && net.req[p.requestId]) net.req[p.requestId].how = p.response.fromDiskCache ? 'disk' : String(p.response.status);
    if (m.method === 'Network.loadingFailed' && net.req[p.requestId]) net.req[p.requestId].how = 'failed';
  });
  await c.call('Network.enable');
  await c.ev(`(function(){
    window.__L = { on: false, frames: 0, fb: 0, maxB: 0, wrong: 0, vanish: 0, prev: {} };
    function tick() {
      var L = __L;
      if (L.on) {
        var rows = document.querySelectorAll('#channels .row'), b = 0, guideHidden = document.getElementById('guide').className.indexOf('hidden') >= 0;
        for (var k = 0; k < rows.length && !guideHidden; k++) {
          var r = rows[k]; if (getComputedStyle(r).visibility === 'hidden') continue;
          var ch = Channels.byNum(+r.children[0].textContent), img = r.children[1];
          if (!ch || !ch.logo) continue;
          var painted = getComputedStyle(img).visibility !== 'hidden' && !!img.getAttribute('src') && img.complete && img.naturalWidth > 0;
          var st = painted && img.getAttribute('src') === ch.logo ? 'ok' : painted ? 'wrong' : 'blank';
          if (st === 'blank') b++; if (st === 'wrong') L.wrong++;
          if (L.prev[k] && L.prev[k][0] === ch.num && L.prev[k][1] === 'ok' && st !== 'ok') L.vanish++;
          L.prev[k] = [ch.num, st];
        }
        L.frames++; if (b) L.fb++; if (b > L.maxB) L.maxB = b;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    window.__key = function (code) { window.__res = null; var t0 = performance.now(); var e = document.createEvent('Event'); e.initEvent('keydown', true, true); e.keyCode = code; document.dispatchEvent(e);
      requestAnimationFrame(function () { requestAnimationFrame(function () { window.__res = Math.round(performance.now() - t0); }); }); return 1; };
    return 1; })()`);
  const press = async (k) => { await c.ev(`__key(${k})`); for (let i = 0; i < 100; i++) { const r = await c.ev('window.__res'); if (typeof r === 'number') return r; await c.sleep(10); } return null; };
  const phase = async (name, fn, settle) => {
    const n0 = net.order.length;
    await c.ev(`(function(){var L=__L;L.on=true;L.frames=0;L.fb=0;L.maxB=0;L.wrong=0;L.vanish=0;L.prev={};return 1})()`);
    const keys = await fn();
    await c.sleep(settle);
    const f = await c.ev(`(function(){var L=__L;L.on=false;return {frames:L.frames,framesWithBlankRow:L.fb,maxBlankRows:L.maxB,wrongRowFrames:L.wrong,vanished:L.vanish}})()`);
    const ids = net.order.slice(n0), how = {};
    for (const id of ids) how[net.req[id].how] = (how[net.req[id].how] || 0) + 1;
    c.log(name.padEnd(44), JSON.stringify({ imgRequests: ids.length, how, ...f, keyMs: keys, files: ids.map((id) => net.req[id].f).join(',').slice(0, 300) }));
  };
  const K = { ENTER: 13, BACK: 10009, DOWN: 40, CH_UP: 427, CH_DOWN: 428 };
  const seq = async (codes, gap) => { const t = []; for (const k of codes) { t.push(await press(k)); await c.sleep(gap); } return t.join(' '); };
  await phase('1 open menu', async () => seq([K.ENTER], 0), 4000);
  await phase('2 CH- x3 then CH+ x3, 250 ms (owner case)', async () => seq([K.CH_DOWN, K.CH_DOWN, K.CH_DOWN, K.CH_UP, K.CH_UP, K.CH_UP], 250), 3000);
  await phase('3 the same again (all pages seen)', async () => seq([K.CH_DOWN, K.CH_DOWN, K.CH_DOWN, K.CH_UP, K.CH_UP, K.CH_UP], 250), 3000);
  await phase('4 single CH- after rest', async () => seq([K.CH_DOWN], 0), 2500);
  await phase('5 CH+ back', async () => seq([K.CH_UP], 0), 2500);
  await phase('6 down x12, 150 ms', async () => seq(Array(12).fill(K.DOWN), 150), 2500);
  await phase('7 close + reopen', async () => { await press(K.BACK); await c.sleep(800); return seq([K.ENTER], 0); }, 2500);
  await press(K.BACK); await c.sleep(800);
  c.log('restored', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState(),ch:(Playback.current()||{}).num})`)));
  await c.call('Network.disable');
}
