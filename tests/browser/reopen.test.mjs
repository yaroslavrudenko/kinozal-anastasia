// Reopening a list on an oversized row (iteration 5): the menu, the search results and the programme
// panel always show a row taller than the screen from its TOP when they (re)open — a scroll position left
// over from the last visit never hides its first lines.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, visibleRange, columnView, LONG, K } from './app-page.mjs';

const CHANNELS = 45;
const PLAYING_ID = '1021';                                  // «Channel 9»: pinned first, so it plays at launch
const NOW_MARK = 'Длинная ночь кино:';
const PROG_MARK = 'Марафон архива:';
const giant = (mark) => mark + ' ' + Array.from({ length: 8 }, () => [LONG.ru, LONG.ua, LONG.he].join(' ')).join(' ');
let app, page, key, settle, closeAll;

before(async () => {
  const now = Date.now();
  const data = longData(CHANNELS, now, (c) => { if (c.ch_id === PLAYING_ID) c.name = giant(NOW_MARK); });
  const guide = (id) => {
    const g = JSON.parse(longGuide(id, now));
    if (id === PLAYING_ID) g.epg_data.forEach((p) => { if (p.time * 1000 <= now && now < p.time_to * 1000) p.name = giant(PROG_MARK); });
    return JSON.stringify(g);
  };
  app = await openApp({ data, guide });
  ({ page, key, settle, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

async function presses(code, n) { for (let i = 0; i < n; i++) { await key(code); await settle(); } }
// Presses ▼ until the oversized row shows something other than its top; true when it did.
async function scrollIntoRow(column, mark) {
  for (let i = 0; i < 8; i++) {
    await key(K.DOWN); await settle();
    const r = await visibleRange(page, column, mark);
    if (r && r.from > 2) return true;
  }
  return false;
}
function assertTop(r, where) {
  assert.ok(r, where + ': the oversized row is not shown');
  assert.ok(r.height > 1000, where + ': the fixture row is only ' + Math.round(r.height) + ' px');
  assert.ok(r.from <= 2, where + ': opened ' + Math.round(r.from) + ' px into the row instead of at its top');
}

test('reopen: the menu reopens on the oversized playing row at its TOP after closing with the cursor low', async () => {
  await closeAll();
  await key(K.ENTER); await settle();
  assertTop(await visibleRange(page, 'channels', NOW_MARK), 'first open');
  assert.ok(await scrollIntoRow('channels', NOW_MARK), 'could not scroll within the oversized row');
  await presses(K.DOWN, 40);                                // through it and well below
  assert.ok((await columnView(page, 'channels')).focusText.indexOf(NOW_MARK) < 0, 'the cursor did not move below the row');
  await presses(K.BACK, 1);
  await key(K.ENTER); await settle();
  assertTop(await visibleRange(page, 'channels', NOW_MARK), 'reopened menu');
  await closeAll();
});

test('reopen: search shows an oversized result at its TOP when it is opened again', async () => {
  await closeAll();
  const openSearch = async () => {
    await key(K.ENTER); await settle(); await key(K.LEFT); await settle();
    await presses(K.UP, 12);
    await key(K.RIGHT); await settle();
    await page.evaluate((q) => { const i = document.getElementById('search-input'); i.value = q; i.dispatchEvent(new Event('input')); }, 'channel 9');
    await settle();
    await key(K.DOWN); await settle();                     // into the results
  };
  await openSearch();
  assertTop(await visibleRange(page, 'search-list', NOW_MARK), 'first search');
  assert.ok(await scrollIntoRow('search-list', NOW_MARK), 'could not scroll within the oversized search result');
  await presses(K.BACK, 2);                                 // results → field → channel menu
  await closeAll();
  await openSearch();
  assertTop(await visibleRange(page, 'search-list', NOW_MARK), 'search opened again');
  await closeAll();
});

test('reopen: the programme panel shows an oversized programme at its TOP when it is opened again', async () => {
  await closeAll();
  // The guide is loaded first (INFO): with no picture in this headless run, no first frame loads it.
  await key(K.INFO); await new Promise((r) => setTimeout(r, 800));
  await key(K.DOWN); await new Promise((r) => setTimeout(r, 500));
  assertTop(await visibleRange(page, 'p-list', PROG_MARK), 'first panel');
  assert.ok(await scrollIntoRow('p-list', PROG_MARK), 'could not scroll within the oversized programme');
  await presses(K.DOWN, 10);
  await presses(K.BACK, 1);
  await key(K.DOWN); await new Promise((r) => setTimeout(r, 500));
  assertTop(await visibleRange(page, 'p-list', PROG_MARK), 'panel opened again');
  await closeAll();
});
