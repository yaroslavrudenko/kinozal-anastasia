// On-air truth on the TV: menu «now» lines and the banner's programme vs the guide data at this moment, and a live
// programme change (the line must flip to the next programme within ~75 s of the boundary). Restores the start state.
export default async function (c, args) {
  const waitMax = +(args[0] || 600) * 1000;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(`({st:webapis.avplay.getState(),n:Channels.count()})`); if (s && s.st === 'PLAYING' && s.n) break; await c.sleep(1000); }
  const start = await c.ev(`({key:(Playback.current()||{}).key,name:(Playback.current()||{}).name})`);
  const check = `(function(){var clean=function(t){return String(t||'').replace(/[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]/g,'').trim()};
    var now=Date.now(),rows=document.querySelectorAll('#channels > .row'),out={rows:0,withGuide:0,match:0,stale:0,mismatch:[],noGuide:0,soon:[]};
    for(var i=0;i<rows.length;i++){var r=rows[i];if(r.offsetParent===null)continue;var num=+clean(r.children[0].textContent);if(!num)continue;out.rows++;
      var ch=Channels.byNum(num);if(!ch){continue}var sh=EPG.shown(ch.id,now),txt=clean(r.children[3].textContent);
      if(!sh){out.noGuide++;if(txt)out.mismatch.push(num+' no guide but «'+txt.slice(0,40)+'»');continue}
      out.withGuide++;var exp=clean(sh.ended?EPG.label(sh):sh.p.title);
      if(txt===exp)out.match++;else out.mismatch.push(num+' row «'+txt.slice(0,40)+'» vs guide «'+exp.slice(0,40)+'»');
      if(!sh.ended&&(sh.p.start>now||sh.p.stop<=now))out.stale++;
      if(!sh.ended&&sh.p.stop-now<waitMaxMs&&sh.p.stop>now)out.soon.push({num:num,stopIn:Math.round((sh.p.stop-now)/1000),title:clean(sh.p.title).slice(0,40)});}
    return out})()`.replace('waitMaxMs', String(waitMax));
  await c.key(13); await c.sleep(2500);
  const a = await c.ev(check);
  c.log('menu now-lines', JSON.stringify(a));
  const b = await c.ev(`(function(){var clean=function(t){return String(t||'').replace(/[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]/g,'').trim()};var p=Playback.current(),sh=p&&EPG.shown(p.id,Date.now());return {ch:p&&p.name,guide:sh?clean(sh.ended?EPG.label(sh):sh.p.title):null,banner:clean(document.getElementById('b-now').textContent)}})()`);
  c.log('banner (as last drawn)', JSON.stringify(b));
  const soon = (a.soon || []).sort((x, y) => x.stopIn - y.stopIn)[0];
  if (soon) {
    c.log('waiting for the programme change on', soon.num, soon.title, 'in', soon.stopIn, 's (+75 s)');
    const t0 = Date.now(); while (Date.now() - t0 < (soon.stopIn + 75) * 1000) { await c.sleep(15000); await c.ev('1'); }
    const after = await c.ev(check);
    const row = await c.ev(`(function(){var rows=document.querySelectorAll('#channels > .row');for(var i=0;i<rows.length;i++){if(+rows[i].children[0].textContent.trim()===${soon.num})return rows[i].children[3].textContent.replace(/[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]/g,'').trim()}return null})()`);
    c.log('after the boundary', JSON.stringify({ num: soon.num, before: soon.title, rowNow: row, check: { rows: after.rows, match: after.match, stale: after.stale, mismatch: after.mismatch } }));
  } else c.log('no programme on the visible page ends within', waitMax / 1000, 's');
  await c.key(10009); await c.sleep(800);
  c.log('restored', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState(),ch:(Playback.current()||{}).name,same:(Playback.current()||{}).key===${JSON.stringify(start.key)}})`)));
}
