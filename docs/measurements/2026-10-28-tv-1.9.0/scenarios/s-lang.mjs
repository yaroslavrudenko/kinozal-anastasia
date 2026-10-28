// The language list on the TV: Settings → «🌐» row → OK → list (4 names, one edge, current marked) → Back → nothing changed.
export default async function (c) {
  const lang0 = await c.ev('document.documentElement.lang');
  await c.ev(`Overlay.open('about')`); await c.sleep(800);
  const rowsTxt = () => c.ev(`(function(){var o=document.querySelector('#about');var f=o&&o.querySelector('.focus');return {ov:Overlay.mode(),focus:f?f.textContent.replace(/\\s+/g,' ').trim().slice(0,80):null}})()`);
  let r = await rowsTxt(); c.log('settings', JSON.stringify(r));
  for (let i = 0; i < 8 && !(r.focus || '').includes('🌐'); i++) { await c.key(40); await c.sleep(250); r = await rowsTxt(); }
  c.log('on language row', JSON.stringify(r));
  const t0 = await c.key(13); await c.sleep(600);
  const list = await c.ev(`(function(){var o=document.getElementById('lang');if(!o||o.className.indexOf('hidden')>=0)return {shown:false,ov:Overlay.mode()};var rows=o.querySelectorAll('.src-t'),out=[];for(var i=0;i<rows.length;i++){var b=rows[i].getBoundingClientRect(),x=rows[i].querySelector('[dir]')||rows[i];var xb=x.getBoundingClientRect();out.push({t:rows[i].textContent.trim(),l:Math.round(xb.left),r:Math.round(xb.right),dir:x.getAttribute('dir')})}var f=o.querySelector('.focus');return {shown:true,ov:Overlay.mode(),rows:out,focus:f?f.textContent.trim():null}})()`);
  c.log('language list', JSON.stringify(list));
  await c.key(40); await c.sleep(300); await c.key(10009); await c.sleep(600);
  c.log('after Back', JSON.stringify(await c.ev(`({ov:Overlay.mode(),lang:document.documentElement.lang,same:document.documentElement.lang===${JSON.stringify(lang0)}})`)));
  await c.key(10009); await c.sleep(600);
  c.log('closed', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState()})`)));
}
