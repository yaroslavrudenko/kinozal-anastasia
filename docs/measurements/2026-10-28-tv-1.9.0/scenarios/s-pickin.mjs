// Pick channel args[0] inside the group whose name starts with args[1] (the menu's own path: Zap.pick), wait until it plays.
export default async function (c, args) {
  const r = await c.ev(`(function(){var gs=Channels.groups(),gi=-1;for(var i=0;i<gs.length;i++)if(String(gs[i].name).indexOf(${JSON.stringify(args[1])})===0){gi=i;break}var ch=Channels.byNum(${+args[0]});if(gi<0||!ch)return {err:'not found',gi:gi};Zap.pick(ch,gi);return {gi:gi}})()`);
  let s; for (let i = 0; i < 30; i++) { await c.sleep(500); s = await c.ev(`({st:webapis.avplay.getState(),ch:(Playback.current()||{}).num+' '+(Playback.current()||{}).name,grp:(Channels.groups()[Zap.group()]||{}).name})`); if (s && s.st === 'PLAYING' && s.ch.indexOf(args[0] + ' ') === 0) break; }
  c.log('picked', JSON.stringify(r), JSON.stringify(s));
}
