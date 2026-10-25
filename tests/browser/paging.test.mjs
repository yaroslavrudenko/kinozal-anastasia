// Decision DEC-2026-10-25-paging (owner): CH+ / CH− (page keys) move by the number of rows completely
// visible on the page. With wrapped names a page holds fewer rows, so repeated page-down visits every
// channel (each one completely visible on some page, none skipped unseen); page-up mirrors it. With
// one-line rows a page is still 13.
// The page is the set of rows completely visible; the cursor is only required to be on the new page
// (DEC-2026-10-25-paging governs how far the PAGE moves, not where in it the cursor lands).
import test from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, columnView, f, K } from './app-page.mjs';

const CHANNELS = 45;
const PG_UP = 33;

async function withApp(data, now, fn) {
  const app = await openApp({ data, guide: (id) => longGuide(id, now) });
  try { await fn(app); } finally { await app.close(); }
}
// The page = the channel numbers completely visible. Pages through the menu with `code` until the page
// stops changing; returns every channel seen completely and each step's { before, after, focus } pages.
async function pageThrough(app, code) {
  const seen = new Set(), steps = [];
  let v = await columnView(app.page, 'channels');
  v.fully.forEach((n) => seen.add(n));
  for (let i = 0; i < 60; i++) {
    await app.key(code); await app.settle();
    const w = await columnView(app.page, 'channels');
    w.fully.forEach((n) => seen.add(n));
    steps.push({ before: v.fully.map(Number), after: w.fully.map(Number), focus: +w.focusNum });
    if (w.fully.join() === v.fully.join()) break;
    v = w;
  }
  return { seen, steps };
}
const missing = (seen) => Array.from({ length: CHANNELS }, (_, i) => String(i + 1)).filter((n) => !seen.has(n));
const first = (p) => Math.min(...p), last = (p) => Math.max(...p);
// Each page turn moves the page by exactly its own size: the next page starts right after the last row
// that was completely visible (page-down) or ends right before the first one (page-up), unless the list
// ends first; the highlighted channel is always on the new page.
function assertTurns(steps, dir) {
  const moved = steps.filter((s) => s.after.join() !== s.before.join());
  assert.ok(moved.length >= 3, 'too few page turns: ' + moved.length);
  for (const s of moved) {
    const ok = dir > 0 ? first(s.after) === last(s.before) + 1 || last(s.after) === CHANNELS
      : last(s.after) === first(s.before) - 1 || first(s.after) === 1;
    assert.ok(ok, 'page ' + first(s.before) + '–' + last(s.before) + ' turned to ' + first(s.after) + '–' + last(s.after));
    assert.ok(s.after.indexOf(s.focus) >= 0, 'the highlighted channel ' + s.focus + ' is not on the new page');
  }
}

test('paging: with long wrapped names, page-down turns whole pages and shows every channel completely on some page', async () => {
  const now = Date.now();
  await withApp(longData(CHANNELS, now), now, async (app) => {
    await app.key(K.ENTER); await app.settle();
    const r = await pageThrough(app, K.PG_DOWN);
    assert.deepEqual(missing(r.seen), [], 'channels never completely visible while paging down');
    assertTurns(r.steps, 1);
  });
});

test('paging: with long wrapped names, page-up from the bottom mirrors it — every channel completely visible on some page', async () => {
  const now = Date.now();
  await withApp(longData(CHANNELS, now), now, async (app) => {
    await app.key(K.ENTER); await app.settle();
    for (let i = 0; i < 50; i++) await app.key(K.DOWN);   // to the last channel
    await app.settle();
    const r = await pageThrough(app, PG_UP);
    assert.deepEqual(missing(r.seen), [], 'channels never completely visible while paging up');
    assertTurns(r.steps, -1);
  });
});

test('paging (pin): with one-line rows a page is still 13 channels', async () => {
  const now = Date.now();
  const data = JSON.parse(f.ottChannelList(CHANNELS, { now, padChars: 0 }).body);
  Object.values(data).forEach((c) => { c.name = 'Новости'; });
  await withApp(data, now, async (app) => {
    await app.key(K.ENTER); await app.settle();
    const before = (await columnView(app.page, 'channels')).fully.map(Number);
    await app.key(K.PG_DOWN); await app.settle();
    const after = await columnView(app.page, 'channels');
    assert.equal(before.length, 13, 'one-line rows on a page: ' + before.length);
    assert.deepEqual([first(after.fully.map(Number)), after.fully.length], [14, 13], 'page after page-down: ' + after.fully.join(','));
    assert.ok(after.fully.indexOf(after.focusNum) >= 0, 'the highlighted channel is not on the new page');
  });
});

// verify/round5-codex.md item 2: rows of very different heights (repeating ≈ 70/125/180/235/70 px — the
// shape [70, 100, 160, 210, 90] px Codex injected) must still page up as an exact mirror.
import { LONG } from './app-page.mjs';
const MIX = [0, 2, 3, 4, 1];                              // ≈ 70, 125, 180, 235, 70 px rows (menu width)
const MIX_SEARCH = [0, 1, 2, 3, 1];                       // search is narrower: this shape reproduces Codex's 6–9 → 3–6
function mixedData(now, mix) {
  const m = mix || MIX;
  return longData(CHANNELS, now, (c, i) => {
    const k = m[i % m.length];
    c.name = k ? Array.from({ length: k }, () => LONG.ru).join(' ') : 'Новости';
  });
}

test('paging: with mixed row heights, page-up in the menu ends exactly one row before the previous page', async () => {
  const now = Date.now();
  await withApp(mixedData(now), now, async (app) => {
    await app.key(K.ENTER); await app.settle();
    for (let i = 0; i < 50; i++) await app.key(K.DOWN);
    await app.settle();
    const r = await pageThrough(app, PG_UP);
    assert.deepEqual(missing(r.seen), [], 'channels never completely visible while paging up');
    assertTurns(r.steps, -1);
  });
});

test('paging: with mixed row heights, page-up in search results ends exactly one row before the previous page', async () => {
  const now = Date.now();
  await withApp(mixedData(now, MIX_SEARCH), now, async (app) => {
    await app.key(K.ENTER); await app.settle(); await app.key(K.LEFT); await app.settle();
    for (let i = 0; i < 12; i++) await app.key(K.UP);
    await app.key(K.RIGHT); await app.settle();
    await app.page.evaluate(() => { const i = document.getElementById('search-input'); i.value = ''; i.dispatchEvent(new Event('input')); });
    await app.settle();
    await app.key(K.DOWN); await app.settle();
    for (let i = 0; i < 50; i++) await app.key(K.DOWN);
    await app.settle();
    const seen = new Set(), steps = [];
    let v = await columnView(app.page, 'search-list');
    for (let i = 0; i < 40; i++) {
      await app.key(PG_UP); await app.settle();
      const w = await columnView(app.page, 'search-list');
      w.fully.forEach((n) => seen.add(n));
      steps.push({ before: v.fully.map(Number), after: w.fully.map(Number), focus: +w.focusNum });
      if (w.fully.join() === v.fully.join()) break;
      v = w;
    }
    assertTurns(steps, -1);
  });
});
