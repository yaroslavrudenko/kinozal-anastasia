// Smoke after an install: version, source, channel restored and playing, language, menu opens and closes.
export default async function (c) {
  const st = `(function(){var p=Playback.current();return {v:CONFIG.VERSION,src:Sources.activeId()==='ott'?'ott':'other',ch:p?p.num+' '+p.name:null,grp:(Channels.groups()[Zap.group()]||{}).name,n:Channels.count(),state:webapis.avplay.getState(),lang:document.documentElement.lang,ov:Overlay.mode(),refreshH:CONFIG.PLAYLIST_REFRESH_MS/3600000}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && s.state === 'PLAYING' && s.n) break; await c.sleep(1000); }
  const t1 = await c.ev('webapis.avplay.getCurrentTime()'); await c.sleep(3000); const t2 = await c.ev('webapis.avplay.getCurrentTime()');
  c.log('state', JSON.stringify(s), 'time advanced', t2 - t1, 'ms in 3 s');
  await c.key(13); await c.sleep(1200); const m = await c.ev(`({ov:Overlay.mode(),groups:Channels.groups().length,focus:(document.querySelector('.focus .t')||{}).textContent})`);
  c.log('menu', JSON.stringify(m));
  await c.key(10009); await c.sleep(800); c.log('after back', JSON.stringify(await c.ev('({ov:Overlay.mode(),state:webapis.avplay.getState()})')));
}
