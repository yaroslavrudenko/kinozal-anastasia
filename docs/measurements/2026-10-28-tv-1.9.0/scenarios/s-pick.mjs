// Pick a channel by number with the remote's digits (args[0]) and wait until it plays.
export default async function (c, args) {
  const num = String(args[0]);
  for (const d of num) { await c.key(48 + +d); await c.sleep(200); }
  let s; for (let i = 0; i < 30; i++) { await c.sleep(500); s = await c.ev(`({st:webapis.avplay.getState(),ch:(Playback.current()||{}).num+' '+(Playback.current()||{}).name,grp:(Channels.groups()[Zap.group()]||{}).name})`); if (s && s.st === 'PLAYING' && s.ch.indexOf(num + ' ') === 0) break; }
  c.log('picked', JSON.stringify(s));
}
