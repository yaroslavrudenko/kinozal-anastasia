// Logo flicker on the TV: open the menu, let logos settle, page down 3 and back up 3, record per animation frame how many
// visible channel rows show no logo, and how many image requests were made. Restores the start state.
export default async function (c) {
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(`({st:webapis.avplay.getState(),n:Channels.count()})`); if (s && s.st === 'PLAYING' && s.n) break; await c.sleep(1000); }
  await c.key(13); await c.sleep(4000);
  const snap = `(function(){var rows=document.querySelectorAll('#channels > *'),vis=0,blank=0,ids=[];for(var i=0;i<rows.length;i++){var r=rows[i];if(r.offsetParent===null||r.className.indexOf('hidden')>=0)continue;var img=r.querySelector('img');vis++;var ok=img&&img.getAttribute('src')&&img.complete&&img.naturalWidth>0&&getComputedStyle(img).visibility!=='hidden';if(!ok)blank++;ids.push(ok?1:0)}return {vis:vis,blank:blank,map:ids.join('')}})()`;
  c.log('settled', JSON.stringify(await c.ev(snap)));
  await c.ev(`(function(){window.__LG={frames:[],req0:performance.getEntriesByType('resource').filter(function(e){return e.initiatorType==='img'}).length,run:true};var f=function(){if(!__LG.run)return;var s=${snap};__LG.frames.push(s.blank);requestAnimationFrame(f)};requestAnimationFrame(f);return 1})()`);
  for (const k of [428, 428, 428]) { await c.key(k); await c.sleep(250); }   // CH- page down ×3
  for (const k of [427, 427, 427]) { await c.key(k); await c.sleep(250); }   // CH+ page up ×3 (back where we were)
  await c.sleep(3000);
  const r = await c.ev(`(function(){__LG.run=false;var req=performance.getEntriesByType('resource').filter(function(e){return e.initiatorType==='img'}).length-__LG.req0;var fr=__LG.frames,mx=0,bad=0;for(var i=0;i<fr.length;i++){if(fr[i]>mx)mx=fr[i];if(fr[i]>0)bad++}return {frames:fr.length,framesWithBlankRows:bad,maxBlankRows:mx,imgRequests:req}})()`);
  c.log('flick down 3 + up 3', JSON.stringify(r));
  c.log('after', JSON.stringify(await c.ev(snap)));
  await c.key(10009); await c.sleep(800);
  c.log('restored', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState(),ch:(Playback.current()||{}).name})`)));
}
