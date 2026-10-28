// After a soak (new launch): the Diag counters/notes the soak flushed to storage, plus this launch's state. No URLs.
export default async function (c) {
  const r = await c.ev(`(function(){var raw=localStorage.getItem('diag');var d={};try{d=JSON.parse(raw)||{}}catch(e){}var notes=d.notes||{},n={};for(var k in notes)n[k]=String(notes[k]).replace(/https?:\\/\\/\\S+/g,'<url>').slice(0,120);return {stored:{counters:d.counters,notes:n},state:webapis.avplay.getState(),ch:(Playback.current()||{}).name}})()`);
  c.log('diag', JSON.stringify(r).slice(0, 4000));
}
