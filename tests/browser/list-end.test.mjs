// The list-end line (owner, 2026-10-26: «неизвестно, он кончается на этой странице или нет … кажется, что список
// и заканчивается, а дальше есть каналы внизу»). Under the menu's channel column and under the search results:
// «▼ ещё N каналов · CH− — дальше» while rows remain below the page — N = the rows after the last one completely
// visible — and «Конец списка» once the last row is on screen. Here, in a real engine at 1920×1080: the count
// matches the rows actually on screen on every page; the line overlaps no row and not the hint; a page of
// one-line rows still holds 13; the line is gone with the menu.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, f, K } from './app-page.mjs';

const CHANNELS = 45;
let app, page, press, closeAll;

before(async () => {
  const now = Date.now();
  app = await openApp({ data: longData(CHANNELS, now), guide: (id) => longGuide(id, now) });
  ({ page, press, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

// One look at a list column and its list-end line: the list indexes of the rows completely visible (inside
// every clipping ancestor), the line's text, and the boxes of the line, of every visible row and of the hint.
function look(listId, moreId, hintSel) {
  return page.evaluate((listId, moreId, hintSel) => {
    const col = document.getElementById(listId), more = document.getElementById(moreId);
    let clip = { top: 0, bottom: window.innerHeight };
    for (let a = col; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect();
      clip = { top: Math.max(clip.top, r.top), bottom: Math.min(clip.bottom, r.bottom) };
    }
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
    const rows = Array.from(col.children).filter((r) => getComputedStyle(r).visibility !== 'hidden');
    const fully = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.height > 0 && b.top >= clip.top - 1 && b.bottom <= clip.bottom + 1; })
      .map((r) => +r.getAttribute('data-i'));
    return { fully, text: more.textContent, visible: getComputedStyle(more).visibility === 'visible' && more.getBoundingClientRect().height > 0,
      more: box(more), rows: rows.map((r) => ({ i: r.getAttribute('data-i'), ...box(r) })), hint: box(document.querySelector(hintSel)) };
  }, listId, moreId, hintSel);
}
const expected = (total, v) => {
  const n = total - (Math.max(...v.fully) + 1);
  return n > 0 ? new RegExp('^▼ ещё ' + n + ' канал(а|ов)? · CH− — дальше$') : /^Конец списка$/;
};
const overlaps = (a, b) => a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5 && a.left < b.right && b.left < a.right;
function assertPlaced(v, where) {
  assert.ok(v.visible, where + ': the list-end line is not visible');
  for (const r of v.rows) assert.ok(!overlaps(v.more, r), where + ': the line overlaps row ' + r.i + ' ' + JSON.stringify([v.more, r]));
  assert.ok(!overlaps(v.more, v.hint), where + ': the line overlaps the hint ' + JSON.stringify([v.more, v.hint]));
  assert.ok(v.more.bottom - v.more.top < 40, where + ': the line wrapped or grew: ' + (v.more.bottom - v.more.top) + ' px');
}
// Pages down with CH− until the page stops changing; checks the line on every page. Returns the pages seen.
async function pageDown(listId, moreId, hintSel, total) {
  const pages = [];
  for (let i = 0; i < 30; i++) {
    const v = await look(listId, moreId, hintSel);
    assert.match(v.text, expected(total, v), 'page ' + v.fully.join(','));
    assertPlaced(v, listId + ' page ' + (i + 1));
    pages.push(v);
    if (pages.length > 1 && v.fully.join() === pages[pages.length - 2].fully.join()) break;
    await press(K.PG_DOWN);
  }
  return pages;
}

test('list end: a long group says «▼ ещё N каналов» with N = the rows below the page, and «Конец списка» on the last page', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT, K.UP, K.UP);
  for (let i = 0; i < 12; i++) await press(K.UP);
  await press(K.DOWN, K.RIGHT);                                     // «Все каналы» (second group row), its first channel
  const pages = await pageDown('channels', 'channels-more', '#guide .hint', CHANNELS);
  assert.ok(pages.length >= 3, 'too few pages: ' + pages.length);
  assert.match(pages[0].text, /^▼ ещё \d+ канал/, 'the first page of 45 channels does not say more follow');
  assert.equal(pages[pages.length - 1].text, 'Конец списка');
  assert.ok(pages[pages.length - 1].fully.indexOf(CHANNELS - 1) >= 0, 'the last page does not show the last channel');
});

test('list end: a group that fits one page says «Конец списка» at once', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT);
  const groups = await page.evaluate(() => Array.from(document.querySelectorAll('#groups .grow')).filter((r) => getComputedStyle(r).visibility !== 'hidden')
    .map((r) => ({ i: +r.getAttribute('data-i'), t: r.children[2].textContent, n: +r.children[3].textContent })));
  const cur = await page.evaluate(() => +document.querySelector('#groups .focus').getAttribute('data-i'));
  const small = groups.find((g) => g.n > 0 && g.n <= 6);
  assert.ok(small, 'no short group in the fixture: ' + JSON.stringify(groups));
  for (let i = 0; i < Math.abs(small.i - cur); i++) await press(small.i > cur ? K.DOWN : K.UP);
  await press(K.RIGHT);
  const v = await look('channels', 'channels-more', '#guide .hint');
  assert.equal(v.fully.length, small.n, 'the short group «' + small.t + '» is not completely on one page');
  assert.equal(v.text, 'Конец списка');
  assertPlaced(v, 'short group');
});

test('list end: search results carry their own count and end the same way', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT);
  for (let i = 0; i < 12; i++) await press(K.UP);
  await press(K.RIGHT);
  await page.evaluate(() => { const i = document.getElementById('search-input'); i.value = ''; i.dispatchEvent(new Event('input')); });
  await app.settle();
  await press(K.DOWN);                                              // into the results
  const pages = await pageDown('search-list', 'search-more', '.search-hint', CHANNELS);
  assert.match(pages[0].text, /^▼ ещё \d+ канал/);
  assert.equal(pages[pages.length - 1].text, 'Конец списка');
});

test('list end: with one-line rows a page still holds 13 channels and the line says «▼ ещё 32 канала»', async () => {
  const now = Date.now();
  const data = JSON.parse(f.ottChannelList(CHANNELS, { now, padChars: 0 }).body);
  Object.values(data).forEach((c) => { c.name = 'Новости'; });
  const one = await openApp({ data, guide: (id) => longGuide(id, now) });
  try {
    await one.press(K.ENTER, K.LEFT);
    for (let i = 0; i < 12; i++) await one.press(K.UP);
    await one.press(K.DOWN, K.RIGHT);
    const prev = page; page = one.page;
    try {
      const v = await look('channels', 'channels-more', '#guide .hint');
      assert.equal(v.fully.length, 13, 'one-line rows on a page: ' + v.fully.length);
      assert.equal(v.text, '▼ ещё 32 канала · CH− — дальше');
      assertPlaced(v, 'one-line rows');
    } finally { page = prev; }
  } finally { await one.close(); }
});

test('list end: after a channel is picked the line is not visible', async () => {
  await closeAll();
  await press(K.ENTER);
  assert.ok((await look('channels', 'channels-more', '#guide .hint')).visible, 'the line is not shown in the open menu');
  await press(K.DOWN, K.ENTER);
  await new Promise((r) => setTimeout(r, 300));
  const v = await look('channels', 'channels-more', '#guide .hint');
  assert.equal(v.visible, false, 'the list-end line stays on the picture after the pick');
  assert.equal(await page.evaluate(() => document.getElementById('channels-more').style.visibility), '', 'the line must not carry an inline visibility');
});
