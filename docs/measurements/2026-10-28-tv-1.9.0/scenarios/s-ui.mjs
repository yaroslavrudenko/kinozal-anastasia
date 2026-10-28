// TV-only layout checks (batch 3): menu toast vs the hint band, ⚙ icon focused vs unfocused, JS heap. Restores the start state.
export default async function (c) {
  const R = (sel) => `(function(e){if(!e)return null;var r=e.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),r:Math.round(r.right)}})(${sel})`;
  const mem = () => c.ev(`(performance.memory?{usedMB:+(performance.memory.usedJSHeapSize/1048576).toFixed(1),totalMB:+(performance.memory.totalJSHeapSize/1048576).toFixed(1),limitMB:+(performance.memory.jsHeapSizeLimit/1048576).toFixed(0)}:null)`);
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(`({st:webapis.avplay.getState(),n:Channels.count(),ch:(Playback.current()||{}).name})`); if (s && s.st === 'PLAYING' && s.n) break; await c.sleep(1000); }
  c.log('start', JSON.stringify(s), 'heap', JSON.stringify(await mem()));
  await c.key(13); await c.sleep(1500);
  c.log('hint band', JSON.stringify(await c.ev(R(`document.querySelector('#guide .hint')||document.querySelector('.hint:not(.hidden)')`))));
  // a one-line toast over the open menu, and a long one
  await c.ev(`UI.toast(I18n.t('fav.added')||'Добавлено в избранное', 3000)`); await c.sleep(300);
  c.log('toast 1-line', JSON.stringify(await c.ev(R(`document.getElementById('toast')`))), JSON.stringify(await c.ev(`document.getElementById('toast').textContent`)));
  await c.ev(`UI.toast('Не удалось загрузить список каналов от провайдера: сервер не ответил вовремя, попробуем ещё раз через минуту, а пока показываем сохранённую копию списка', 3000)`); await c.sleep(300);
  c.log('toast long', JSON.stringify(await c.ev(R(`document.getElementById('toast')`))));
  c.log('last row', JSON.stringify(await c.ev(R(`(function(){var a=document.querySelectorAll('#channels .row, #channels > *');return a[a.length-1]})()`))));
  await c.sleep(3200);
  // ⚙ focused vs unfocused: go to groups, walk to the last group (Settings), read the icon box
  await c.key(37); await c.sleep(400);
  const icon = `(function(){var rows=document.querySelectorAll('#groups > *');for(var i=0;i<rows.length;i++){if(rows[i].textContent.indexOf('⚙')>=0){var ic=rows[i].querySelector('.t > i')||rows[i].querySelector('i');var r=(ic||rows[i]).getBoundingClientRect();return {focus:rows[i].className.indexOf('focus')>=0,l:+r.left.toFixed(1),r:+r.right.toFixed(1),font:getComputedStyle(ic||rows[i]).fontFamily.slice(0,60)}}}return null})()`;
  c.log('gear unfocused', JSON.stringify(await c.ev(icon)));
  for (let i = 0; i < 20; i++) { const f = await c.ev(icon); if (f && f.focus) break; await c.key(40); await c.sleep(150); }
  await c.sleep(400);
  c.log('gear focused', JSON.stringify(await c.ev(icon)));
  c.log('heap after menu', JSON.stringify(await mem()));
  await c.key(10009); await c.sleep(800);
  c.log('restored', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState(),ch:(Playback.current()||{}).name})`)));
}
