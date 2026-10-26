'use strict';
// D6 (overnight dry run, 2026-10-26): rows showed the previous programme while the API already returned
// the current one. Measured cause: the provider's server cache serves the plain /api/channel_now minutes
// old (26–132 of 389 channels naming an ended show), while a URL of its own (?t=<seconds>) is built fresh
// (0–1). And «71 Прямий»: the per-channel guide may end a programme earlier than the channel list says,
// so the panel put the cursor on it marked «● архив» instead of «в эфире».
process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const CHANNELS = 30, SEC = 1000, MIN = 60000, HOUR = 3600000;
// Channel i's half-hour shows, shifted by i min: across the channels a show ends every minute, as on the
// real list (389 channels), so a cached answer always names some shows that ended minutes before it.
function show(i, t) {
  const phase = (i % 30) * MIN, start = Math.floor((t - phase) / (HOUR / 2)) * (HOUR / 2) + phase;
  return { start, stop: start + HOUR / 2, title: 'Передача ' + (1001 + i) + ' ' + new Date(start).toISOString().slice(11, 16) };
}
// The plain URL answers from a cache CACHE_AGE old; a URL with a query is built at the moment of the request.
const CACHE_AGE = 3 * MIN;
function cachedApp() {
  const app = f.ottApp({ channels: CHANNELS, boot: false });
  const base = JSON.parse(app.fixture.list.body), ids = Object.keys(base);
  const body = (t) => { const d = JSON.parse(JSON.stringify(base)); ids.forEach((id, i) => { const p = show(i, t); Object.assign(d[id], { name: p.title, time: p.start / 1000, time_to: p.stop / 1000 }); }); return JSON.stringify(d); };
  const plain = (u) => f.isList(u), fresh = (u) => f.isList(u.split('?')[0]) && u.indexOf('?') > 0;
  app.net.route((u) => plain(u), () => ({ body: body(app.clock.now - CACHE_AGE), delay: 300 }));
  app.net.route((u) => fresh(u), () => ({ body: body(app.clock.now), delay: 3000 }));
  app.net.route((u) => f.isGuide(u), (req) => {             // the watched channel's guide follows the same shows
    const i = ids.indexOf(f.guideIdOf(req.url)), epg = [];
    for (let t = app.clock.now - 24 * HOUR; t < app.clock.now + 24 * HOUR; t += HOUR / 2) { const p = show(i, t); epg.push({ name: p.title, descr: '', time: p.start / 1000, time_to: p.stop / 1000 }); }
    return { body: JSON.stringify({ epg_data: epg }), delay: 50 };
  });
  app.ids = ids;
  app.boot();
  f.untilPlaying(app);
  return app;
}
// Visible rows whose "now" is not the show on air.
function notOnAir(app) {
  return app.rowsDetailed('channels').map((r) => {
    const m = /^Передача (\d+) /.exec(r.cells[3] || '');
    const cur = m && show(Number(m[1]) - 1001, app.clock.now);
    return !m ? r.cells[2] + ': «' + r.cells[3] + '»' : r.cells[3] !== cur.title ? r.cells[2] + ': «' + r.cells[3] + '» ≠ «' + cur.title + '»' : null;
  }).filter(Boolean);
}

test('now fresh (D6): with the provider serving the plain list minutes old, the menu shows what is on air within 5 s of opening', () => {
  const app = cachedApp();
  app.advance(27 * MIN + 20 * SEC);                         // shows have changed since the cached answer (none ends in the next 5 s)
  app.press(KEYS.ENTER, 5000);
  assert.deepEqual(notOnAir(app), []);
});

test('now fresh (D6): with the menu open for 1 hour, a row is never more than 70 s behind the show on air', () => {
  const app = cachedApp();
  app.advance(2 * MIN);
  app.press(KEYS.ENTER, 5000);
  const bad = [];
  for (let s = 10; s <= 3600; s += 10) {
    app.advance(10 * SEC);
    const late = app.rowsDetailed('channels').filter((r) => {
      const m = /^Передача (\d+) /.exec(r.cells[3] || ''), cur = m && show(Number(m[1]) - 1001, app.clock.now);
      return !cur || (r.cells[3] !== cur.title && app.clock.now - cur.start > 70 * SEC);
    });
    if (late.length) bad.push('+' + s + ' s: ' + late.map((r) => r.cells[2] + ' «' + r.cells[3] + '»').join(', '));
  }
  assert.deepEqual(bad.slice(0, 5), [], bad.length + ' late samples');
});

// A show that ended within the last 70 s may still be shown: refreshes are at least 60 s apart (DEC-2026-10-26-now-refresh).
test('now fresh (D6): after 40 min on one page, every page scrolled into view shows what is on air at once (≤ 70 s behind)', () => {
  const app = cachedApp();
  app.advance(2 * MIN);
  app.press(KEYS.ENTER, 5000);
  app.advance(40 * MIN + 30 * SEC);                         // no end within the next few seconds
  const bad = [];
  for (let page = 0; page < 3; page++) {
    app.press(KEYS.CH_DOWN, 200);
    const late = app.rowsDetailed('channels').filter((r) => {
      const m = /^Передача (\d+) /.exec(r.cells[3] || ''), cur = m && show(Number(m[1]) - 1001, app.clock.now);
      return !cur || (r.cells[3] !== cur.title && app.clock.now - cur.start > 70 * SEC);
    });
    bad.push(...late.map((r) => 'page ' + (page + 1) + ': ' + r.cells[2] + ' «' + r.cells[3] + '»'));
  }
  assert.deepEqual(bad, []);
});

// Owner decision 2026-10-26 (option b): a launch list that came from the provider's cache does not count
// toward the 60 s floor; the fresh answer is asked for at once, so a menu opened 4 s after launch is current.
test('now fresh (D6b): a cached launch list is re-read fresh at once, and the menu opened 4 s after it shows what is on air', () => {
  const app = f.ottApp({ channels: CHANNELS, boot: false });
  const base = JSON.parse(app.fixture.list.body), ids = Object.keys(base);
  const body = (t) => { const d = JSON.parse(JSON.stringify(base)); ids.forEach((id, i) => { const p = show(i, t); Object.assign(d[id], { name: p.title, time: p.start / 1000, time_to: p.stop / 1000 }); }); return JSON.stringify(d); };
  app.net.route((u) => f.isList(u), () => ({ body: body(app.clock.now - CACHE_AGE), delay: 300 }));
  app.net.route((u) => f.isList(u.split('?')[0]) && u.indexOf('?') > 0, () => ({ body: body(app.clock.now), delay: 3000 }));
  app.net.route((u) => f.isGuide(u), (req) => {
    const i = ids.indexOf(f.guideIdOf(req.url)), epg = [];
    for (let t = app.clock.now - 24 * HOUR; t < app.clock.now + 24 * HOUR; t += HOUR / 2) { const p = show(i, t); epg.push({ name: p.title, descr: '', time: p.start / 1000, time_to: p.stop / 1000 }); }
    return { body: JSON.stringify({ epg_data: epg }), delay: 50 };
  });
  app.boot();
  app.advanceUntil(() => app.net.requests((r) => f.isList(r.url)).some((r) => r.endedAt), 5000);
  const listAt = app.clock.now;
  app.advance(4000);
  const fresh = app.net.requests((r) => /channel_now\?/.test(r.url));
  assert.ok(fresh.length && fresh[0].sentAt - listAt < 1000, 'fresh re-read sent ' + (fresh.length ? (fresh[0].sentAt - listAt) + ' ms' : 'never') + ' after the cached list');
  app.press(KEYS.ENTER, 300);
  assert.deepEqual(notOnAir(app), []);
});

test('now fresh (D6, pin): an older answer never replaces a newer "now" line', () => {
  const app = f.ottApp({ channels: 5 });
  f.untilPlaying(app);
  const out = vm.runInContext(`(function () {
    var id = 'd6-no-guide', t = Date.now(), m = 60000, a = Util.dict(), b = Util.dict();
    a[id] = [{ start: t - 5 * m, stop: t + 25 * m, title: 'Новая' }];
    b[id] = [{ start: t - 35 * m, stop: t - 5 * m, title: 'Старая' }];
    EPG.setSeeds(a); EPG.setSeeds(b);
    return EPG.onAir(id, t).title;
  })()`, app.ctx);
  assert.equal(out, 'Новая');
});

// «71 Прямий» 2026-10-26: the channel list says 23:20–07:00 «Повтори прямих ефірів…»; a guide that ends
// that programme at 02:00 (next 07:00) must not turn it into an archive row at 03:09.
const NOW = Date.UTC(2026, 9, 26, 1, 9);                   // 03:09 local
const T = (h, m) => Date.UTC(2026, 9, 25, 21, 20) + ((h * 60 + m) - (23 * 60 + 20)) * MIN;   // local hh:mm from 25.10 23:20
const TITLE = 'Повтори прямих ефірів і передач дня';
test('now fresh (D6, «Прямий»): a guide ending the programme earlier than the channel list still shows it «в эфире» with the cursor on it', () => {
  const app = f.ottApp({ channels: 5, now: NOW, boot: false, guideLatency: 50 });
  const base = JSON.parse(app.fixture.list.body);
  for (const id of Object.keys(base)) Object.assign(base[id], { name: TITLE, time: T(23, 20) / 1000, time_to: T(31, 0) / 1000 });
  app.fixture.list.body = JSON.stringify(base);
  app.net.route((u) => f.isGuide(u), () => ({ body: JSON.stringify({ epg_data: [
    { name: 'Музика заради перемоги', descr: '', time: T(22, 30) / 1000, time_to: T(23, 20) / 1000 },
    { name: TITLE, descr: '', time: T(23, 20) / 1000, time_to: T(26, 0) / 1000 },
    { name: 'Телемагазин', descr: '', time: T(31, 0) / 1000, time_to: T(32, 15) / 1000 }] }), delay: 50 }));
  app.boot();
  f.untilPlaying(app);
  app.advance(3000);
  app.press(KEYS.DOWN, 500);
  const cur = app.rowsDetailed('p-list').find((r) => r.classes.indexOf('focus') >= 0);
  assert.ok(cur && cur.cells[2] === TITLE && cur.cells[3] === 'в эфире', 'cursor on ' + JSON.stringify(cur && cur.cells));
});
