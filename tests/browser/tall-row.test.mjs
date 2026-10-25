// A channel whose name + what-is-on wraps taller than the whole menu column (owner's "everything must
// fit", iteration 4): with the cursor on it, ▼ / ▲ scroll through it until every line has been on screen,
// no character stays clipped for good, no other row is ever shown cut, and the next ▼ moves on to the
// next channel. Also: one key press costs at most 2 layout passes, even with many long wrapping names.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, LONG, K } from './app-page.mjs';

const CHANNELS = 45;
const TALL_ID = '1022';                                     // «Kan 11»: its "now" line is ~2500 characters
const TALL_TEXT = Array.from({ length: 8 }, () => [LONG.ru, LONG.ua, LONG.he].join(' ')).join(' ');
const MAX_PRESSES = 120;
let app, page, key, settle, closeAll, tallName;

before(async () => {
  const now = Date.now();
  const data = longData(CHANNELS, now, (c) => { if (c.ch_id === TALL_ID) c.name = TALL_TEXT; });
  tallName = data[TALL_ID].channel_name;
  app = await openApp({ data, guide: (id) => longGuide(id, now) });
  ({ page, key, settle, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

// One look at the channel column: the highlighted row, the part of the tall row's text that can be
// seen (in the text's own coordinates), and every other row that is on screen but cut.
function look() {
  return page.evaluate((name) => {
    const col = document.getElementById('channels');
    let clip = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    for (let a = col; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect();
      clip = { top: Math.max(clip.top, r.top), bottom: Math.min(clip.bottom, r.bottom), left: Math.max(clip.left, r.left), right: Math.min(clip.right, r.right) };
    }
    // Clip of an element: the column's clip plus its own clipping ancestors inside the column.
    function visibleOf(el) {
      let c = Object.assign({}, clip);
      for (let a = el.parentElement; a && a !== col; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
        const r = a.getBoundingClientRect();
        c = { top: Math.max(c.top, r.top), bottom: Math.min(c.bottom, r.bottom), left: c.left, right: c.right };
      }
      const r = el.getBoundingClientRect();
      return { from: Math.max(0, c.top - r.top), to: Math.min(r.height, c.bottom - r.top), height: r.height };
    }
    const rows = Array.from(col.children).filter((r) => r.style.visibility !== 'hidden' && getComputedStyle(r).visibility !== 'hidden');
    const out = { focus: null, focusTall: false, tall: null, cut: [], clipHeight: clip.bottom - clip.top };
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      const isTall = r.children[2].textContent.replace(/^★ /, '').replace(/\s+▶$/, '') === name;
      if (r.className.split(' ').indexOf('focus') >= 0) { out.focus = r.children[2].textContent; out.focusTall = isTall; }
      const onScreen = b.bottom > clip.top + 1 && b.top < clip.bottom - 1;
      if (isTall) {
        const s = r.children[3];
        out.tall = Object.assign(visibleOf(s), { wide: s.scrollWidth > s.clientWidth + 1 });
        const n = visibleOf(r.children[2]);
        out.tallName = n;
      } else if (onScreen && (b.top < clip.top - 1 || b.bottom > clip.bottom + 1)) {
        out.cut.push(r.textContent.slice(0, 40));
      }
    }
    return out;
  }, tallName);
}

// Union of [from, to] intervals; returns the parts of [0, height] never covered.
function gaps(intervals, height) {
  const iv = intervals.filter((x) => x.to > x.from).sort((a, b) => a.from - b.from);
  const out = [];
  let at = 0;
  for (const x of iv) { if (x.from > at + 2) out.push([Math.round(at), Math.round(x.from)]); at = Math.max(at, x.to); }
  if (at < height - 2) out.push([Math.round(at), Math.round(height)]);
  return out;
}

// Presses `code` until the highlighted row is the tall channel, then keeps pressing while it stays there.
async function passThrough(code) {
  const seen = [], cuts = [];
  let reached = false, left = null;
  for (let i = 0; i < MAX_PRESSES; i++) {
    await key(code);
    await settle();
    const l = await look();
    if (l.cut.length) cuts.push(...l.cut);
    if (l.focusTall) { reached = true; seen.push(l.tall); continue; }
    if (reached) { left = l; break; }
  }
  return { reached, seen, cuts, left };
}

test('tall row: ▼ scrolls through a channel taller than the column — every line is seen, nothing else is cut, then ▼ moves on', async () => {
  await closeAll();
  await key(K.ENTER); await settle();
  const r = await passThrough(K.DOWN);
  assert.ok(r.reached, 'the cursor never reached ' + tallName);
  const h = r.seen[0].height;
  assert.ok(h > (await look()).clipHeight, 'the fixture is not taller than the column (' + Math.round(h) + ' px)');
  assert.deepEqual(gaps(r.seen, h), [], 'text of the tall row never shown (px ranges of its ' + Math.round(h) + ' px)');
  assert.ok(r.seen.every((x) => !x.wide), 'the tall row is cut horizontally');
  assert.deepEqual(Array.from(new Set(r.cuts)), [], 'other rows shown cut');
  assert.ok(r.left && r.left.focus && !r.left.focusTall, '▼ never moved on to the next channel');
  await closeAll();
});

test('tall row: ▲ from the next channel scrolls back through it the same way', async () => {
  await closeAll();
  await key(K.ENTER); await settle();
  const down = await passThrough(K.DOWN);                   // now on the channel after the tall one
  assert.ok(down.left, 'could not get past the tall row');
  const up = await passThrough(K.UP);
  assert.ok(up.reached, '▲ never reached ' + tallName);
  assert.deepEqual(gaps(up.seen, up.seen[0].height), [], 'text never shown while scrolling up');
  assert.deepEqual(Array.from(new Set(up.cuts)), [], 'other rows shown cut');
  assert.ok(up.left && up.left.focus && !up.left.focusTall, '▲ never moved on to the channel before');
  await closeAll();
});

test('layout passes: one ▼ in the menu costs at most 2 layouts, with many long wrapping names', async () => {
  await closeAll();
  await key(K.ENTER); await settle();
  const cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');
  const layouts = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount').value;
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const per = [], refreshed = [];
  for (let i = 0; i < 25; i++) {
    await frame();
    const before = await layouts(), hits = app.listHits.length;
    await key(K.DOWN);
    await frame();
    per.push((await layouts()) - before);
    if (app.listHits.length > hits) refreshed.push(i);     // a channel-list ("now" lines) answer landed in this press
  }
  await closeAll();
  assert.ok(Math.max(...per) <= 2, 'layouts per ▼: ' + per.join(',') + (refreshed.length ? ' · list answers during presses #' + refreshed.join(',') : ' · no list answer during the presses'));
});
