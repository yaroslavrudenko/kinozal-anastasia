// TV probe (run with tv5/cdp.mjs): logos after an app restart (Page.reload, the HTTP cache kept).
//   node <S>/tv5/cdp.mjs <port> <S>/logo-design/t-logos-restart.mjs <label>
// Run it twice per build: label "within-hour" right after t-logos.mjs (the logos were fetched < 1 h ago; OTT Club sends
// Cache-Control: max-age=3600, private + ETag), and label "after-hour" again 61+ minutes later (revalidation: 304s).
// Counts every image request from the reload on — boot (incl. the menu laid out ahead at the first frame), the first
// menu opening, two CH- pages — by how it was answered: network 200, 304, fromDiskCache, memory. And the first
// opening's blank-row frames. Picks no channel; the reload restarts the stream (the app's own restore).
export default async function (c, args) {
  const label = (args && args[0]) || 'run';
  const net = { req: {}, order: [] };
  c.on((m) => {
    const p = m.params || {};
    if (m.method === 'Network.requestWillBeSent' && p.type !== 'XHR' && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(p.request.url)) { net.req[p.requestId] = { f: p.request.url.replace(/^.*\//, ''), how: 'pending' }; net.order.push(p.requestId); }
    if (m.method === 'Network.requestServedFromCache' && net.req[p.requestId]) net.req[p.requestId].how = 'memory';
    if (m.method === 'Network.responseReceived' && net.req[p.requestId]) net.req[p.requestId].how = p.response.fromDiskCache ? 'disk' : String(p.response.status);
    if (m.method === 'Network.loadingFailed' && net.req[p.requestId]) net.req[p.requestId].how = 'failed';
  });
  await c.call('Network.enable'); await c.call('Page.enable');
  const count = (from) => { const how = {}; for (const id of net.order.slice(from)) how[net.req[id].how] = (how[net.req[id].how] || 0) + 1; return { n: net.order.length - from, how }; };
  await c.call('Page.reload', { ignoreCache: false });
  let s; for (let i = 0; i < 90; i++) { await c.sleep(1000); s = await c.ev(`({st:webapis.avplay.getState(),n:Channels.count(),v:CONFIG.VERSION})`); if (s && s.st === 'PLAYING' && s.n) break; }
  await c.sleep(6000);   // the menu is laid out ahead at the first frame (idle)
  c.log(label, 'boot', JSON.stringify(s), 'image requests through boot + menu laid out', JSON.stringify(count(0)));
  const n1 = net.order.length;
  await c.ev(`(function(){window.__F={on:true,fb:0,maxB:0,frames:0};function t(){if(__F.on){var rows=document.querySelectorAll('#channels .row'),b=0;for(var k=0;k<rows.length;k++){var r=rows[k];if(getComputedStyle(r).visibility==='hidden')continue;var ch=Channels.byNum(+r.children[0].textContent),img=r.children[1];if(!ch||!ch.logo)continue;if(!(getComputedStyle(img).visibility!=='hidden'&&img.complete&&img.naturalWidth>0&&img.getAttribute('src')===ch.logo))b++}__F.frames++;if(b)__F.fb++;if(b>__F.maxB)__F.maxB=b;requestAnimationFrame(t)}}
    var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=13;document.dispatchEvent(e);requestAnimationFrame(t);return 1})()`);
  await c.sleep(3000);
  const f = await c.ev(`(function(){__F.on=false;return {frames:__F.frames,framesWithBlankRow:__F.fb,maxBlankRows:__F.maxB}})()`);
  c.log(label, 'first menu opening', JSON.stringify({ ...count(n1), ...f }));
  const n2 = net.order.length;
  for (let i = 0; i < 2; i++) { await c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=428;document.dispatchEvent(e);return 1})()`); await c.sleep(1500); }
  c.log(label, 'CH- x2 (1.5 s apart)', JSON.stringify(count(n2)));
  await c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=10009;document.dispatchEvent(e);return 1})()`);
  await c.sleep(800);
  c.log(label, 'restored', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState(),ch:(Playback.current()||{}).num})`)));
  await c.call('Network.disable');
}
