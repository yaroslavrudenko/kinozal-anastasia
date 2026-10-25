// Text fits on screen (owner, 2026-10-25, translated): "Everything must fit: the programme name in the
// channel list wraps to a new line instead of being truncated; the on-air description wraps; in the
// archive menu nothing is truncated."
//
// Real layout needs a real engine: the app runs in headless Chrome (see app-page.mjs) with long Russian,
// Ukrainian and Hebrew channel names and programme titles.
// Run: tests/run.sh --browser
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, columnView, LONG, LONG_NAMES, TITLES, K } from './app-page.mjs';

const CHANNELS = 45;
let app, page, press, key, settle, closeAll;

before(async () => {
  const now = Date.now();
  app = await openApp({ data: longData(CHANNELS, now), guide: (id) => longGuide(id, now) });
  ({ page, press, key, settle, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

// For each element matching `selector` (visible ones): its text and whether any of it is cut off —
// by itself (scroll size beyond its box, ellipsis, line clamp, nowrap) or by a clipping ancestor.
function inspect(selector) {
  return page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const rowHidden = el.closest('[style*="visibility: hidden"]');
      if (rowHidden || el.offsetParent === null || !el.textContent) continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const why = [];
      if (el.scrollWidth > el.clientWidth + 1) why.push('scrollWidth ' + el.scrollWidth + ' > ' + el.clientWidth);
      if (el.scrollHeight > el.clientHeight + 1) why.push('scrollHeight ' + el.scrollHeight + ' > ' + el.clientHeight);
      if (cs.textOverflow === 'ellipsis') why.push('text-overflow: ellipsis');
      if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') why.push('line-clamp ' + cs.webkitLineClamp);
      if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') why.push('white-space: ' + cs.whiteSpace);
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.overflow === 'visible' && acs.overflowX === 'visible' && acs.overflowY === 'visible') continue;
        const ar = a.getBoundingClientRect();
        if (r.bottom > ar.bottom + 1 || r.right > ar.right + 1 || r.left < ar.left - 1) { why.push('clipped by ' + (a.id || a.className)); break; }
      }
      out.push({ text: el.textContent, why, top: r.top, bottom: r.bottom });
    }
    return out;
  }, selector);
}
function assertFits(items, where, mustContain) {
  assert.ok(items.length > 0, where + ': nothing visible to check');
  const cut = items.filter((x) => x.why.length);
  assert.deepEqual(cut.map((x) => x.text.slice(0, 40) + '… ' + x.why.join('; ')), [], where);
  for (const t of mustContain || []) assert.ok(items.some((x) => x.text.indexOf(t) >= 0), where + ': full text missing: ' + t.slice(0, 40));
  assert.ok(items.every((x) => x.text.indexOf('…') < 0 || TITLES.concat(LONG_NAMES).some((t) => x.text.indexOf(t) >= 0)), where + ': "…" added to a text');
}

test('layout: channel menu — channel names and what is on wrap, nothing is cut', async () => {
  await closeAll();
  await press(K.ENTER);
  assertFits(await inspect('#channels .row .t, #channels .row .s'), 'menu rows', [LONG.ru, LONG.ua, LONG.he]);
  await closeAll();
});

test('layout: channel menu — rows grow with their wrapped text and the next row starts below them', async () => {
  await closeAll();
  await press(K.ENTER);
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#channels .row'))
    .filter((r) => r.style.visibility !== 'hidden').map((r) => {
      const b = r.getBoundingClientRect();
      const cells = Array.from(r.children).map((c) => c.getBoundingClientRect()).filter((c) => c.height > 0);
      return { top: b.top, bottom: b.bottom, h: b.height, text: r.textContent,
        cellTop: Math.min(...cells.map((c) => c.top)), cellBottom: Math.max(...cells.map((c) => c.bottom)) };
    }));
  await closeAll();
  assert.ok(rows.length >= 5, 'menu rows visible: ' + rows.length);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].top >= rows[i - 1].bottom - 1, 'row ' + i + ' overlaps the row above');
  const hs = rows.map((r) => Math.round(r.h));
  // Every row is as tall as its wrapped content (no cell sticks out of its row), and the longest names
  // (three lines at the row width) make their rows grow: some row is ≥ 20 px taller than the shortest.
  for (const r of rows) assert.ok(r.cellTop >= r.top - 1 && r.cellBottom <= r.bottom + 1, 'content sticks out of its row: ' + r.text.slice(0, 40));
  assert.ok(Math.max(...hs) >= Math.min(...hs) + 20, 'no row grew with its content: ' + hs.join(','));
});

// Decision DEC-2026-10-25-paging (NC-2): page-down turns the page by the number of rows completely
// visible (not a fixed 13): the next page starts right after the last completely visible row, and the
// highlighted channel is on it. Before this decision the test expected channel 34.
test('layout: channel menu — ▼ ×20 and page-down land on the right channel, fully on screen', async () => {
  await closeAll();
  await press(K.ENTER);
  for (let i = 0; i < 20; i++) await key(K.DOWN);
  await settle();
  const focused = () => page.evaluate(() => {
    const r = document.querySelector('#channels .row.focus'), c = document.getElementById('channels').getBoundingClientRect();
    if (!r) return null;
    const b = r.getBoundingClientRect();
    return { num: r.children[0].textContent, inside: b.top >= c.top - 1 && b.bottom <= c.bottom + 1 && b.bottom <= 1081 };
  });
  const a = await focused();
  const before = (await columnView(page, 'channels')).fully.map(Number);
  await press(K.PG_DOWN);
  const b = await focused();
  const after = (await columnView(page, 'channels')).fully.map(Number);
  await closeAll();
  assert.equal(a && a.num, '21');
  assert.ok(a.inside, 'the highlighted row after ▼×20 is not fully on screen');
  assert.equal(Math.min(...after), Math.max(...before) + 1, 'page ' + before.join(',') + ' turned to ' + after.join(','));
  assert.ok(b && b.inside && after.indexOf(+b.num) >= 0, 'the highlighted row after page-down is not on the new page');
});

test('layout: programme panel (▼) — programme titles and the panel title are not cut', async () => {
  await closeAll();
  await press(K.DOWN);
  await new Promise((r) => setTimeout(r, 500));
  assertFits(await inspect('#prog .prow .t, #prog .prog-title'), 'programme panel', [LONG.ru]);
  await closeAll();
});

test('layout: archive slider (▲) — the title line is not cut', async () => {
  await closeAll();
  await press(K.UP);
  await new Promise((r) => setTimeout(r, 300));
  assertFits(await inspect('#s-title'), 'archive slider');
  await closeAll();
});

test('layout: search results — names and what is on are not cut', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT);
  for (let i = 0; i < 12; i++) await key(K.UP);
  await press(K.RIGHT);
  await page.evaluate((q) => { const i = document.getElementById('search-input'); i.value = q; i.dispatchEvent(new Event('input')); }, 'с');
  await settle();
  assertFits(await inspect('#search-list .row .t, #search-list .row .s'), 'search results');
  await closeAll();
});

test('layout: channel banner — the name and the on-air line are not cut', async () => {
  await closeAll();
  await press(K.INFO);
  assertFits(await inspect('#b-title, #b-now, #b-next'), 'banner');
});
