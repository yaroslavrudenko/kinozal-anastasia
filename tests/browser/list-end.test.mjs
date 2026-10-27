// The list-end line (owner, 2026-10-26: «неизвестно, он кончается на этой странице или нет … кажется, что список
// и заканчивается, а дальше есть каналы внизу»). Under the menu's channel column and under the search results:
// «▼ ещё N каналов · CH− — дальше» while rows remain below the page — N = the rows after the last one completely
// visible — and «Конец списка» once the last row is on screen. Owner 2026-10-26 (after 703a2c1 on the TV, the line
// stuck to the hint bar): one row fewer per page, the line in its slot right under the last visible row, and the
// hint bar set apart from everything above it («не слепаться ни с чем, ни со списком, ни с группами»).
// Here, in a real engine at 1920×1080: the count matches the rows actually on screen on every page; the line sits
// right under the last visible row and overlaps none; ≥ 8 px between the hint bar and every visible row of the
// groups, the list and the line; a page of one-line rows holds 12 (was 13); the line is gone with the menu.
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
    const col = document.getElementById(listId), more = moreId ? document.getElementById(moreId) : null;
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
    const groups = listId === 'channels' ? Array.from(document.getElementById('groups').children).filter((r) => getComputedStyle(r).visibility !== 'hidden') : [];
    return { fully, text: more ? more.textContent : '', visible: !!more && getComputedStyle(more).visibility === 'visible' && more.getBoundingClientRect().height > 0,
      more: more ? box(more) : null, rows: rows.map((r) => ({ i: r.getAttribute('data-i'), ...box(r) })), groups: groups.map(box), hint: box(document.querySelector(hintSel)),
      // The column boxes themselves: a full column's last row can reach their bottom.
      boxes: [box(col.parentElement)].concat(listId === 'channels' ? [box(document.getElementById('groups'))] : []),
      hintRule: getComputedStyle(document.querySelector(hintSel)).borderTopWidth };
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
  // In the list: right under the last completely visible row (a few px), not parked at the column's bottom.
  const lastBottom = Math.max(...v.rows.filter((r) => v.fully.indexOf(+r.i) >= 0).map((r) => r.bottom));
  assert.ok(v.more.top >= lastBottom - 0.5 && v.more.top <= lastBottom + 8, where + ': the line is not right under the last row: row ends ' + lastBottom + ', line starts ' + v.more.top);
  // The hint bar is set apart: ≥ 8 px from every visible row of the list and the groups and from the line, and a rule above it.
  for (const b of [...v.rows, ...v.groups, v.more, ...v.boxes]) assert.ok(v.hint.top - b.bottom >= 8, where + ': less than 8 px above the hint bar: ' + JSON.stringify([b, v.hint]));
  assert.notEqual(v.hintRule, '0px', where + ': the hint bar has no rule above it');
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

// Owner 2026-10-27: «по ползункам уже понятно, где мы» — the «▼ ещё N …» line under the menu's columns gave way to
// a scroll bar beside each column (the search results keep their line). The columns still end above the hint bar.
function bar(id) {
  return page.evaluate((id) => {
    const t = document.getElementById(id), th = t.children[0], a = t.getBoundingClientRect(), b = th.getBoundingClientRect();
    return { on: /\bon\b/.test(t.className), visible: getComputedStyle(t).visibility === 'visible' && a.height > 0,
      top: b.top - a.top, bottom: a.bottom - b.bottom, len: b.height, track: a.height };
  }, id);
}
function assertApart(v, where) {
  for (const b of [...v.rows, ...v.groups, ...v.boxes]) assert.ok(v.hint.top - b.bottom >= 8, where + ': less than 8 px above the hint bar: ' + JSON.stringify([b, v.hint]));
  assert.notEqual(v.hintRule, '0px', where + ': the hint bar has no rule above it');
}

test('scroll bar: in a long group the thumb starts at the top, moves down page by page and reaches the bottom; no list-end line under the menu', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT, K.UP, K.UP);
  for (let i = 0; i < 12; i++) await press(K.UP);
  await press(K.DOWN, K.RIGHT);                                     // «Все каналы» (second group row), its first channel
  assert.equal(await page.evaluate(() => document.getElementById('channels-more')), null, 'the menu still has a list-end line');
  const seen = [];
  for (let i = 0; i < 30; i++) {
    const v = await look('channels', null, '#guide .hint'), b = await bar('channels-bar');
    assert.ok(b.on && b.visible, 'page ' + (i + 1) + ': the scroll bar is not shown for 45 channels');
    assertApart(v, 'channels page ' + (i + 1));
    seen.push({ fully: v.fully.join(), b });
    if (seen.length > 1 && seen[seen.length - 1].fully === seen[seen.length - 2].fully) break;
    await press(K.PG_DOWN);
  }
  await new Promise((r) => setTimeout(r, 300));                    // the thumb's transition
  const last = await bar('channels-bar');
  assert.ok(seen.length >= 3, 'too few pages: ' + seen.length);
  assert.ok(seen[0].b.top <= 1, 'the thumb does not start at the top: ' + JSON.stringify(seen[0].b));
  assert.ok(last.bottom <= 1.5, 'the thumb does not reach the bottom on the last page: ' + JSON.stringify(last));
  for (let i = 1; i < seen.length - 1; i++) assert.ok(seen[i].b.top >= seen[i - 1].b.top - 0.5, 'the thumb moved up while paging down');
  assert.ok(seen[0].b.len < seen[0].b.track * 0.5, 'the thumb is not proportional to 12 of 45 rows: ' + JSON.stringify(seen[0].b));
});

test('scroll bar: a group that fits one page shows no bar', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT);
  const groups = await page.evaluate(() => Array.from(document.querySelectorAll('#groups .grow')).filter((r) => getComputedStyle(r).visibility !== 'hidden')
    .map((r) => ({ i: +r.getAttribute('data-i'), t: r.children[2].textContent, n: +r.children[3].textContent })));
  const cur = await page.evaluate(() => +document.querySelector('#groups .focus').getAttribute('data-i'));
  const small = groups.find((g) => g.n > 0 && g.n <= 6);
  assert.ok(small, 'no short group in the fixture: ' + JSON.stringify(groups));
  for (let i = 0; i < Math.abs(small.i - cur); i++) await press(small.i > cur ? K.DOWN : K.UP);
  await press(K.RIGHT);
  const v = await look('channels', null, '#guide .hint');
  assert.equal(v.fully.length, small.n, 'the short group «' + small.t + '» is not completely on one page');
  assert.equal((await bar('channels-bar')).visible, false, 'a bar is shown for a list that fits');
  assertApart(v, 'short group');
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
  // Its hint bar has its own ground too (owner 2026-10-26), with readable text.
  const bg = await page.evaluate(() => [getComputedStyle(document.querySelector('.search-hint')).backgroundColor, getComputedStyle(document.getElementById('search')).backgroundColor]);
  assert.notEqual(bg[0], bg[1], 'the search hint bar has no ground of its own: ' + bg.join(' / '));
  assert.notEqual(bg[0], 'rgba(0, 0, 0, 0)', 'the search hint bar is transparent');
});

test('list end: with one-line rows a page holds 12 channels (one row slot kept free above the hint bar)', async () => {
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
      const v = await look('channels', null, '#guide .hint');
      assert.equal(v.fully.length, 12, 'one-line rows on a page: ' + v.fully.length);
      assertApart(v, 'one-line rows');
    } finally { page = prev; }
  } finally { await one.close(); }
});

test('scroll bar: after a channel is picked the bars are not visible', async () => {
  await closeAll();
  await press(K.ENTER);
  assert.ok((await bar('channels-bar')).visible, 'the bar is not shown in the open menu');
  await press(K.DOWN, K.ENTER);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await bar('channels-bar')).visible, false, 'the scroll bar stays on the picture after the pick');
  assert.equal((await bar('groups-bar')).visible, false, 'the groups bar stays on the picture after the pick');
});

// Owner 2026-10-26: «подсветить … бэкграунд цвет сделать отличным», «для группы background-цвет сделать отличным
// от … списка каналов», «слабо видимую линию», and «нежным, не резким … разница должна быть видна, но не очень
// контрастно». The hint bar and the groups column each have their own ground, a faint divider stands between the
// columns, every text stays ≥ 4.5:1, the steps are gentle (≤ 10 % HSL lightness), and the highlighted row stays the
// strongest difference on screen.
test('list end: the hint bar, the groups and the channel list have their own gentle grounds and a faint divider', async () => {
  await closeAll();
  await press(K.ENTER);
  const c = await page.evaluate(() => {
    const rgba = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const cs = (el) => getComputedStyle(el);
    const body = rgba(cs(document.body).backgroundColor);
    const guide = over(rgba(cs(document.getElementById('guide')).backgroundColor), body);
    const hintEl = document.querySelector('#guide .hint'), groupsEl = document.getElementById('groups');
    const hint = over(rgba(cs(hintEl).backgroundColor), guide), groups = over(rgba(cs(groupsEl).backgroundColor), guide);
    const list = over(rgba(cs(document.getElementById('channels')).backgroundColor), guide);
    const focus = over(rgba(cs(document.querySelector('#channels .focus')).backgroundColor), list);
    const div = getComputedStyle(document.querySelector('#guide .list-wrap'), ':before');
    const text = (sel) => Array.from(document.querySelectorAll(sel)).filter((e) => cs(e).visibility !== 'hidden' && e.textContent.trim() && !e.closest('.focus, .sel')).map((e) => rgba(cs(e).color));
    return { guide, hint, groups, list, focus, hintText: rgba(cs(hintEl).color), divider: { w: parseFloat(div.width), bg: rgba(div.backgroundColor), content: div.content },
      groupTexts: text('#groups .grow .t, #groups .grow .s'), listTexts: text('#channels .row .n, #channels .row .t, #channels .row .s') };
  });
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (x) => 0.2126 * lin(x.r) + 0.7152 * lin(x.g) + 0.0722 * lin(x.b);
  const ratio = (a, b) => { const p = lum(a), q = lum(b); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
  const light = (x) => (Math.max(x.r, x.g, x.b) + Math.min(x.r, x.g, x.b)) / 2 / 255 * 100;   // HSL lightness, %
  const step = (a, b) => Math.abs(light(a) - light(b));
  const hex = (x) => '#' + [x.r, x.g, x.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  assert.ok(step(c.hint, c.guide) >= 2, 'the hint bar has no ground of its own: ' + hex(c.hint) + ' on ' + hex(c.guide));
  assert.ok(step(c.groups, c.list) >= 2, 'the groups column looks like the channel list: ' + hex(c.groups) + ' vs ' + hex(c.list));
  assert.notEqual(hex(c.hint), hex(c.focus), 'the hint bar has the highlighted row\'s colour');
  for (const [a, b, what] of [[c.hint, c.guide, 'hint bar / menu'], [c.groups, c.list, 'groups / channels']]) {
    assert.ok(step(a, b) <= 10, what + ': the step is harsh: ' + step(a, b).toFixed(1) + ' % (' + hex(a) + ' / ' + hex(b) + ')');
    assert.ok(step(c.focus, c.list) > step(a, b), what + ': the highlighted row is no longer the strongest difference');
  }
  assert.ok(c.divider.w > 0 && c.divider.content !== 'none' && c.divider.bg.a > 0 && c.divider.bg.a <= 0.35, 'no faint divider between the columns: ' + JSON.stringify(c.divider));
  assert.ok(ratio(c.hintText, c.hint) >= 4.5, 'hint text contrast ' + ratio(c.hintText, c.hint).toFixed(2));
  assert.ok(c.groupTexts.length > 0 && c.listTexts.length > 0, 'no texts measured');
  for (const t of c.groupTexts) assert.ok(ratio(t, c.groups) >= 4.5, 'groups text ' + hex(t) + ' on ' + hex(c.groups) + ': ' + ratio(t, c.groups).toFixed(2));
  for (const t of c.listTexts) assert.ok(ratio(t, c.list) >= 4.5, 'channel text ' + hex(t) + ' on ' + hex(c.list) + ': ' + ratio(t, c.list).toFixed(2));
});
