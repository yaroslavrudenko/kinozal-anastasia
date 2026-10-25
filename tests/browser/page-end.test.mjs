// Page-down at the end of a list (iteration 6): when the last rows are already on screen, CH+ / PG+ keeps
// the page as it is — no collapse to a single row with empty space below — and repeated presses keep it
// stable; page-up still turns back. Menu channel column and search results, with long wrapped rows.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, columnView, K } from './app-page.mjs';

const CHANNELS = 45;
const PG_UP = 33;
let app, page, key, settle, closeAll;

before(async () => {
  const now = Date.now();
  app = await openApp({ data: longData(CHANNELS, now), guide: (id) => longGuide(id, now) });
  ({ page, key, settle, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

async function look(column) { return (await columnView(page, column)).fully.map(Number); }

// Pages down until the list's last channel `lastNum` is on the page, then presses page-down 3 more
// times; returns the page at the end and after each extra press, then one page-up.
async function pageToEnd(column, lastNum) {
  let p = await look(column);
  for (let i = 0; i < 30 && p.indexOf(lastNum) < 0; i++) { await key(K.PG_DOWN); await settle(); p = await look(column); }
  assert.ok(p.indexOf(lastNum) >= 0, 'never reached the end of the list: ' + p.join(','));
  const extra = [];
  for (let i = 0; i < 3; i++) { await key(K.PG_DOWN); await settle(); extra.push(await look(column)); }
  await key(PG_UP); await settle();
  return { end: p, extra, up: await look(column) };
}
function assertStable(r, where) {
  assert.ok(r.end.length > 1, where + ': the last page holds only ' + r.end.length + ' row');
  r.extra.forEach((p, i) => assert.deepEqual(p, r.end, where + ': page-down #' + (i + 1) + ' at the end changed the page'));
  assert.ok(r.up.length > 1 && Math.min(...r.up) < Math.min(...r.end), where + ': page-up did not turn back: ' + r.up.join(','));
}

test('page end: in the menu, page-down with the last channels on screen keeps the page (stable on repeat), page-up still works', async () => {
  await closeAll();
  await key(K.ENTER); await settle();
  assertStable(await pageToEnd('channels', CHANNELS), 'menu');
  await closeAll();
});

test('page end: in search results, page-down with the last results on screen keeps the page, page-up still works', async () => {
  await closeAll();
  await key(K.ENTER); await settle(); await key(K.LEFT); await settle();
  for (let i = 0; i < 12; i++) await key(K.UP);
  await key(K.RIGHT); await settle();
  await page.evaluate(() => { const i = document.getElementById('search-input'); i.value = ''; i.dispatchEvent(new Event('input')); });
  await settle();
  await key(K.DOWN); await settle();                       // into the results (all 45 channels)
  assert.ok((await look('search-list')).length > 1, 'search shows no results');
  assertStable(await pageToEnd('search-list', CHANNELS), 'search');
  await closeAll();
});
