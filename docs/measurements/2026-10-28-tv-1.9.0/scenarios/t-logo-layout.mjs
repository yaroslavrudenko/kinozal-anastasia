// TV probe (run with tv5/cdp.mjs): the logo box never moves anything. Opens the menu, and for every visible channel row
// records the logo box (width × height) and the name's left edge, by the logo's state: shown, empty (not loaded or
// failed), none (no logo URL). One distinct box size and one distinct name edge across all states = no jump.
//   node <S>/tv5/cdp.mjs <port> <S>/logo-design/t-logo-layout.mjs
export default async function (c) {
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(`({st:webapis.avplay.getState(),n:Channels.count()})`); if (s && s.st === 'PLAYING' && s.n) break; await c.sleep(1000); }
  const key = (k) => c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${k};document.dispatchEvent(e);return 1})()`);
  const snap = `(function(){var rows=document.querySelectorAll('#channels .row'),o={};for(var k=0;k<rows.length;k++){var r=rows[k];if(getComputedStyle(r).visibility==='hidden')continue;
    var img=r.children[1],ch=Channels.byNum(+r.children[0].textContent),b=img.getBoundingClientRect(),t=r.children[2].getBoundingClientRect();
    var st=!ch||!ch.logo?'none':getComputedStyle(img).visibility!=='hidden'&&img.complete&&img.naturalWidth>0?'shown':'empty';
    var key=st+' box '+Math.round(b.width)+'x'+Math.round(b.height)+' name@'+Math.round(t.left);o[key]=(o[key]||0)+1}return o})()`;
  await key(13); await c.sleep(30);
  c.log('at the key (30 ms)', JSON.stringify(await c.ev(snap)));
  await c.sleep(3000);
  c.log('settled', JSON.stringify(await c.ev(snap)));
  for (let i = 0; i < 3; i++) { await key(428); await c.sleep(60); c.log('CH- ' + (i + 1) + ' (60 ms)', JSON.stringify(await c.ev(snap))); }
  await c.sleep(3000);
  c.log('settled', JSON.stringify(await c.ev(snap)));
  for (let i = 0; i < 3; i++) { await key(427); await c.sleep(300); }
  await key(10009); await c.sleep(800);
  c.log('restored', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState()})`)));
}
