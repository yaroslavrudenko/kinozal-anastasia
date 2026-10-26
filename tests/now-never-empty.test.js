'use strict';
// D5 (overnight dry run, 2026-10-26): a channel the provider reports as on air must never show an empty
// «now» in the menu, and the banner must say what the menu row says. Programmes end at staggered times
// (channel i's hour-long shows are shifted by (i mod 7) × 23 s), so a row often ends less than the 60 s
// refresh floor (DEC-2026-10-26-now-refresh) after the previous refresh; rows scrolled into view may have
// ended since the last answer; and the provider may keep answering with an ended show for a few seconds.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const CHANNELS = 40, SEC = 1000, MIN = 60000, HOUR = 3600000;
function timeline(i, t, stepMs) {
  const phase = (i % 7) * (stepMs === undefined ? 23 * SEC : stepMs), start = Math.floor((t - phase) / HOUR) * HOUR + phase;
  return { start, stop: start + HOUR, title: 'Шоу ' + (1001 + i) + ' ' + new Date(start).toISOString().slice(11, 19) };
}
// lagMs: after a show ends, the provider keeps answering with it for this long. stepMs: the stagger.
function staggeredApp(lagMs, stepMs) {
  const tl = (i, t) => timeline(i, t, stepMs);
  const app = f.ottApp({ channels: CHANNELS, boot: false });
  const base = JSON.parse(app.fixture.list.body), ids = Object.keys(base);
  app.net.route((u) => f.isList(u.split('?')[0]), () => {   // the plain URL and the provider-fresh one (?t=…) alike
    const data = JSON.parse(JSON.stringify(base));
    ids.forEach((id, i) => {
      let p = tl(i, app.clock.now);
      if (lagMs && app.clock.now - p.start < lagMs) p = tl(i, p.start - 1);
      Object.assign(data[id], { name: p.title, time: p.start / 1000, time_to: p.stop / 1000 });
    });
    return { body: JSON.stringify(data), delay: 100 };
  });
  app.net.route((u) => f.isGuide(u), (req) => {             // the per-channel guide follows the same timeline
    const i = ids.indexOf(f.guideIdOf(req.url)), epg = [];
    for (let t = app.clock.now - 7 * 24 * HOUR; t < app.clock.now + 24 * HOUR; t += HOUR) {
      const p = tl(i, t);
      if (!epg.length || epg[epg.length - 1].time !== p.start / 1000) epg.push({ name: p.title, descr: '', time: p.start / 1000, time_to: p.stop / 1000 });
    }
    return { body: JSON.stringify({ epg_data: epg }), delay: 50 };
  });
  app.boot();
  f.untilPlaying(app);
  return app;
}
const emptyRows = (app) => app.rowsDetailed('channels').filter((r) => !r.cells[3]).map((r) => r.cells[2]);

test('now never empty: the menu left open 30 min (sampled every 5 s) has no empty «now» cell', () => {
  const app = staggeredApp(0);
  app.press(KEYS.ENTER, 100);
  const bad = [];
  for (let s = 5; s <= 30 * 60; s += 5) {
    app.advance(5 * SEC);
    const e = emptyRows(app);
    if (e.length) bad.push('+' + s + ' s: ' + e.join(', '));
  }
  assert.deepEqual(bad.slice(0, 5), [], bad.length + ' samples with empty cells');
});

test('now never empty: after 30 min open, paging through every channel shows no empty «now» cell', () => {
  const app = staggeredApp(0);
  app.press(KEYS.ENTER, 100);
  app.advance(30 * MIN + 17 * SEC);
  const bad = [];
  for (let p = 0; p < 6; p++) {
    const e = emptyRows(app);
    if (e.length) bad.push('page ' + p + ': ' + e.join(', '));
    app.press(KEYS.CH_DOWN, 100);
  }
  assert.deepEqual(bad, []);
});

// All shows end together here, so no other row's end brings a refresh that would hide a missed retry.
// The real provider was seen naming a show 7+ minutes after its end (03:00–03:17, 2026-10-26).
const LAG = 7 * MIN;
test('now never empty: the provider still answering with an ended show for 7 min leaves no empty cell, and the new show appears within 90 s of the provider moving on', () => {
  const app = staggeredApp(LAG, 0);
  app.press(KEYS.ENTER, 100);
  const bad = [], late = [];
  for (let s = 5; s <= 150 * 60; s += 5) {
    app.advance(5 * SEC);
    const e = emptyRows(app);
    if (e.length) bad.push('+' + s + ' s: ' + e.join(', '));
    for (const r of app.rowsDetailed('channels')) {
      const m = /^Шоу (\d+) /.exec(r.cells[3] || '');
      if (!m) continue;
      const cur = timeline(Number(m[1]) - 1001, app.clock.now, 0);
      if (r.cells[3] !== cur.title && app.clock.now - cur.start - LAG > 90 * SEC) late.push('+' + s + ' s: ' + r.cells[2] + ' «' + r.cells[3] + '»');
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], bad.length + ' samples with empty cells');
  assert.deepEqual(late.slice(0, 5), [], late.length + ' samples more than 90 s late');
});

test('now never empty: the banner shows the programme the menu row shows', () => {
  const app = staggeredApp(0);
  app.press(KEYS.ENTER, 100);
  app.advance(30 * MIN + 30 * SEC);
  app.press(KEYS.DOWN, 50); app.press(KEYS.DOWN, 50);
  const row = app.rowsDetailed('channels').find((r) => r.classes.indexOf('focus') >= 0);
  assert.ok(row && row.cells[3], 'the highlighted row has no «now» line');
  app.press(KEYS.ENTER, 1500);
  assert.ok(app.text('b-now').indexOf(row.cells[3]) >= 0, 'menu said «' + row.cells[3] + '», banner says «' + app.text('b-now') + '»');
});
