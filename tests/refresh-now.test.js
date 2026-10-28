'use strict';
// "What is on now" stays current (owner feature; NowLines): the channel list's "now" line comes from
// /api/channel_now, so the app re-asks it — one request per refresh, never per channel, never during a zap
// burst or in the background — when a row on screen needs it (its show ended) or the open menu's data is
// 5 min old (DEC-2026-10-26-now-refresh-2), and as soon as the network returns after an offline start.
// A refresh never reorders the channels or the groups.
//
// The provider fake answers every request with the shows on air at that moment (hourly, titled
// «Выпуск HH:00» by their UTC hour), so a stale "now" line is distinguishable from a fresh one.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const CHANNELS = 30;
const MIN = 60000, HOUR = 3600000;
const hourLabel = (ms) => new Date(ms).toISOString().slice(11, 13);

function liveList(now) {
  const data = JSON.parse(f.ottChannelList(CHANNELS, { now, padChars: 0 }).body);
  for (const c of Object.values(data)) c.name = 'Выпуск ' + hourLabel(c.time * 1000) + ':00';
  return JSON.stringify(data);
}
// An OTT app whose /api/channel_now always describes the current hour; `down()` / `up()` toggle it.
function liveApp(opts) {
  const app = f.ottApp(Object.assign({ channels: CHANNELS, boot: false }, opts));
  let isDown = !!(opts && opts.startDown);
  app.net.route((u) => f.isList(u), () => (isDown ? { status: 500, body: 'down', delay: 100 } : { body: liveList(app.clock.now), delay: 100 }));
  app.up = () => { isDown = false; };
  if (!(opts && opts.noBoot)) { app.boot(); f.untilPlaying(app); }
  return app;
}
// «Now» refreshes: the provider-fresh list (?t=, js/nowlines.js). The plain list URL is the scheduled list download
// (Sources, hourly since 2026-10-27: «Нужно сделать раз в час»), not a «now» refresh.
const listRequests = (app) => app.net.requests((r) => f.isList(r.url) && r.url.indexOf('?t=') > 0);
const catalogRequests = (app) => app.net.requests((r) => f.isList(r.url) && r.url.indexOf('?t=') < 0);
// Every «now» source in order (the fresh re-reads and the hourly catalog, which carries «now» lines too): the longest
// time between two of them, in ms — the oldest a row on screen can get while nothing fails.
const longestWait = (reqs) => reqs.slice().sort((a, b) => a.sentAt - b.sentAt).reduce((m, r, i, a) => (i ? Math.max(m, r.sentAt - a[i - 1].sentAt) : m), 0);
// The "now" cell of every visible menu row: on air now (this hour's «Выпуск», or the full guide's
// «Передача … THH» for the watched channel)?
function staleRows(app) {
  const h = hourLabel(app.clock.now);
  return app.rowsDetailed('channels').filter((r) => {
    const sub = r.cells[3] || '';
    return !(sub.indexOf('Выпуск ' + h + ':00') >= 0 || sub.indexOf('T' + h) >= 0);
  }).map((r) => r.cells[2] + ' → "' + r.cells[3] + '"');
}

test('now line: with the menu open for 2 hours, every visible row shows the programme on air (checked 6 min after each hour)', () => {
  const app = liveApp();
  app.press(KEYS.ENTER, 100);
  const bad = [];
  for (let m = 1; m <= 120; m++) {
    app.advance(MIN);
    if (m % 60 === 6 || m % 60 === 30) {
      const s = staleRows(app);
      if (s.length) bad.push('+' + m + ' min: ' + s.length + ' rows, e.g. ' + s[0]);
    }
  }
  assert.deepEqual(bad, []);
});

test('now line: with the menu open for 2 hours, no row\'s "now" cell is ever empty', () => {
  const app = liveApp();
  app.press(KEYS.ENTER, 100);
  const empty = [];
  for (let m = 1; m <= 120; m++) {
    app.advance(MIN);
    const e = app.rowsDetailed('channels').filter((r) => !r.cells[3]);
    if (e.length) empty.push('+' + m + ' min: ' + e.length);
  }
  assert.deepEqual(empty, []);
});

// Shared run: the menu open for 2 hours; the channel_now requests and the guide requests it caused.
function twoHoursOpen() {
  const app = liveApp();
  const fromSeq = app.seq();
  const playing = f.streamIdOf(f.lastOpenUrl(app));
  app.press(KEYS.ENTER, 100);
  app.advance(2 * HOUR);
  return { lists: listRequests(app).filter((r) => r.sendSeq > fromSeq), catalogs: catalogRequests(app).filter((r) => r.sendSeq > fromSeq),
    guides: app.net.requests((r) => r.sendSeq > fromSeq && f.isGuide(r.url) && f.guideIdOf(r.url) !== playing) };
}

// DEC-2026-10-26-now-refresh-2 (NC-2; replaces the lower bound «≥ 2 in 2 hours»): every show here ends on
// the hour, so the refreshes are the open menu's re-read 5 min after each answer (17:05 … 18:55: 23), the
// 18:00 end falling on one of them; never per-channel guide requests.
test('now line: a refresh is one /api/channel_now request and never per-channel guide requests', () => {
  const { lists, catalogs, guides } = twoHoursOpen();
  // Owner 2026-10-26 (accuracy when paging): the open menu re-reads every 60 s after the 100 ms answer —
  // 2 h / 60.1 s = 119 refreshes; the hourly ends fall on re-reads.
  // Owner 2026-10-27 («Нужно сделать раз в час»): the catalog is downloaded every hour too (2 in 2 h) and brings «now»
  // lines, so the re-read after it counts from it: 118 fresh re-reads + 2 catalogs, never more than 61 s apart.
  assert.equal(catalogs.length, 2, 'hourly catalog downloads in 2 hours');
  assert.ok(longestWait(lists.concat(catalogs)) <= 61000, 'a «now» line waited ' + longestWait(lists.concat(catalogs)) + ' ms');
  assert.equal(lists.length, 118, 'refreshes in 2 hours: ' + lists.map((r) => new Date(r.sentAt).toISOString().slice(11, 19)).join(' '));
  assert.ok(lists.every((r, i) => i === 0 || r.sentAt - lists[i - 1].sentAt > 1000), 'two channel_now requests for one refresh');
  assert.deepEqual(guides.map((r) => r.url), [], 'per-channel guide requests');
});

// DEC-2026-10-26-now-refresh-2 (NC-2; replaces «refreshes are never closer than 60 s (send to send)»): the
// floor is 10 s from the previous answer to the next request, and every refresh asks the provider-fresh
// list (?t=). Here a show on screen ends every 2 s (one-minute shows, channel i shifted by (i mod 30) × 2 s),
// so the floor is what spaces the requests.
test('now line (DEC-2026-10-26-now-refresh-2): every refresh asks the provider-fresh list and is sent ≥ 10 s after the previous answer, also with a show on screen ending every 2 s', () => {
  const app = f.ottApp({ channels: CHANNELS, boot: false });
  const base = JSON.parse(app.fixture.list.body), ids = Object.keys(base);
  const minute = (i, t) => { const ph = (i % 30) * 2000, start = Math.floor((t - ph) / MIN) * MIN + ph; return { start, stop: start + MIN, title: 'Минутка ' + (1001 + i) + ' ' + start }; };
  app.net.route((u) => f.isList(u), () => {
    const data = JSON.parse(JSON.stringify(base));
    ids.forEach((id, i) => { const p = minute(i, app.clock.now); Object.assign(data[id], { name: p.title, time: p.start / 1000, time_to: p.stop / 1000 }); });
    return { body: JSON.stringify(data), delay: 100 };
  });
  app.boot();
  f.untilPlaying(app);
  const fromSeq = app.seq();
  app.press(KEYS.ENTER, 100);
  app.advance(10 * MIN);
  const lists = listRequests(app).filter((r) => r.sendSeq > fromSeq);
  const gaps = lists.slice(1).map((r, i) => r.sentAt - lists[i].endedAt);
  assert.deepEqual(lists.filter((r) => !/\?t=\d+$/.test(r.url)).map((r) => r.url), [], 'a refresh of the plain (cached) list');
  assert.deepEqual(gaps.filter((g) => g < 10000), [], 'sent sooner than 10 s after the previous answer');
  assert.ok(lists.length >= 50, 'only ' + lists.length + ' refreshes in 10 min with a show ending every 2 s: the floor is not what spaces them');
});

test('now line: with no programme ending, there is no refresh more often than the open menu\'s 60 s re-read', () => {
  const app = f.ottApp({ channels: CHANNELS, boot: false });
  const t0 = app.clock.now;
  const data = JSON.parse(f.ottChannelList(CHANNELS, { now: t0, padChars: 0 }).body);
  for (const c of Object.values(data)) { c.time = (t0 - 30 * MIN) / 1000; c.time_to = (t0 + 10 * HOUR) / 1000; c.name = 'Марафон'; }
  app.net.route((u) => f.isList(u), () => ({ body: JSON.stringify(data), delay: 100 }));
  app.boot();
  f.untilPlaying(app);
  const fromSeq = app.seq();
  app.press(KEYS.ENTER, 100);
  app.advance(2 * HOUR);
  const lists = listRequests(app).filter((r) => r.sendSeq > fromSeq);
  const gaps = lists.slice(1).map((r, i) => r.sentAt - lists[i].sentAt);
  assert.ok(gaps.every((g) => g >= MIN), 'refreshes closer than 60 s with nothing ending: ' + gaps.filter((g) => g < MIN).map((g) => g + ' ms').join(', '));
});

test('now line: every refresh is justified — a programme in the last answer ended, or that answer is ≥ 60 s old', () => {
  const app = accurateApp();
  const fromSeq = app.seq();
  app.press(KEYS.ENTER, 100);
  app.advance(2 * HOUR);
  const lists = listRequests(app).filter((r) => r.sendSeq > fromSeq);
  const earliestEnd = (t) => Math.min(...Array.from({ length: CHANNELS }, (_, i) => timeline(i, t).stop));
  const unjustified = [];
  for (let k = 1; k < lists.length; k++) {
    const prev = lists[k - 1], t = lists[k].sentAt;
    const ended = earliestEnd(prev.sentAt) <= t, old = t - prev.endedAt >= MIN - 1000;
    if (!ended && !old) unjustified.push(Math.round((t - prev.sentAt) / 1000) + ' s after the previous one');
  }
  // DEC-2026-10-26-now-refresh-2 (NC-2; replaces the lower bound «≥ 10»): a show on screen ends every 12 min
  // (9 ends: 17:12 … 18:48), each followed by the 5-min re-reads at +5 and +10 min, plus 17:05 and 17:10: 29.
  // Owner 2026-10-26: the 60 s re-read dominates; the 12-min ends fall on re-reads: 119 in 2 hours.
  // Owner 2026-10-27: the hourly catalog brings «now» lines and the next re-read counts from it: 118 + 2 catalogs.
  const catalogs = catalogRequests(app).filter((r) => r.sendSeq > fromSeq);
  assert.equal(catalogs.length, 2);
  assert.ok(longestWait(lists.concat(catalogs)) <= 61000, 'a «now» line waited ' + longestWait(lists.concat(catalogs)) + ' ms');
  assert.equal(lists.length, 118, 'refreshes in 2 hours: ' + lists.map((r) => new Date(r.sentAt).toISOString().slice(11, 19)).join(' '));
  assert.deepEqual(unjustified, []);
});

test('now line: opening the menu after the shows ended refreshes and shows what is on within 2 s', () => {
  const app = liveApp();
  app.advance(70 * MIN);                                // the 17:00 shows are over; the menu was closed
  const before = listRequests(app).length;
  app.press(KEYS.ENTER, 2000);
  assert.ok(listRequests(app).length > before || staleRows(app).length === 0, 'no refresh on opening the menu with stale data');
  assert.deepEqual(staleRows(app), []);
});

test('now line: opening search after the shows ended shows what is on within 2 s', () => {
  const app = liveApp();
  app.advance(70 * MIN);
  app.press(KEYS.ENTER, 50); app.press(KEYS.LEFT, 50);
  for (let i = 0; i < 12; i++) app.press(KEYS.UP, 10);
  app.press(KEYS.RIGHT, 300);
  app.type('search-input', '');
  app.advance(2000);
  const h = hourLabel(app.clock.now);
  const stale = app.rowsDetailed('search-list').filter((r) => (r.cells[3] || '').indexOf('Выпуск ' + h + ':00') < 0 && (r.cells[3] || '').indexOf('T' + h) < 0);
  assert.deepEqual(stale.map((r) => r.cells[2] + ' → ' + r.cells[3]), []);
});

test('now line: no refresh during a zap burst', () => {
  const app = liveApp();
  app.advance(70 * MIN);
  const fromSeq = app.seq();
  for (let i = 0; i < 10; i++) app.press(KEYS.RIGHT, 100);
  const during = listRequests(app).filter((r) => r.sendSeq > fromSeq);
  assert.deepEqual(during.map((r) => r.sentAt), [], 'channel_now requested during the burst');
});

test('now line: no refresh while the app is in the background (even with the menu left open)', () => {
  const app = liveApp();
  app.press(KEYS.ENTER, 100);
  app.setHidden(true);
  const fromSeq = app.seq();
  app.advance(2 * HOUR);
  assert.equal(listRequests(app).filter((r) => r.sendSeq > fromSeq).length, 0);
});

test('now line (pin): a refresh keeps the channel order and the groups exactly as they were', () => {
  const app = liveApp();
  app.press(KEYS.ENTER, 100);
  const snapshot = () => ({ groups: app.rows('groups'), channels: app.rowsDetailed('channels').map((r) => r.cells[0] + ' ' + r.cells[2]) });
  const before = snapshot();
  const n = listRequests(app).length;
  app.advance(70 * MIN);
  app.press(KEYS.BACK, 100); app.press(KEYS.ENTER, 2000);
  assert.ok(listRequests(app).length > n, 'precondition: no refresh happened');
  assert.deepEqual(snapshot(), before);
});

test('now line: after an offline-copy start, rows get what is on as soon as the network returns', () => {
  const first = liveApp();
  first.advance(60000);                                 // the offline copy is written
  const app = liveApp({ startDown: true, noBoot: true, storage: Object.fromEntries(first.storage.raw) });
  app.boot();
  f.untilPlaying(app, 15000);
  app.advance(5000);
  app.press(KEYS.ENTER, 100);
  app.up();
  app.network('GATEWAY_DISCONNECTED');
  app.network('GATEWAY_CONNECTED');
  app.advance(5000);
  assert.deepEqual(staleRows(app), []);
});

// ---------- accuracy (owner: critical) ----------
// Programmes end at different times: channel i's hour-long shows are shifted by (i mod 5) × 12 min, so
// across the channels a show ends every 12 minutes. The provider fake (list and per-channel guide) follows
// this one timeline; the menu must follow it to the minute.
const PHASE_MIN = 12;
function timeline(i, t) {
  const phase = (i % 5) * PHASE_MIN * MIN, start = Math.floor((t - phase) / HOUR) * HOUR + phase;
  return { start, stop: start + HOUR, title: 'Шоу ' + (1001 + i) + ' ' + new Date(start).toISOString().slice(11, 16) };
}
function accurateApp() {
  const app = f.ottApp({ channels: CHANNELS, boot: false, guideLatency: 50 });
  const base = JSON.parse(app.fixture.list.body);
  const ids = Object.keys(base);
  const indexOf = (id) => ids.indexOf(id);
  app.net.route((u) => f.isList(u), () => {
    const data = JSON.parse(JSON.stringify(base));
    ids.forEach((id, i) => { const p = timeline(i, app.clock.now); Object.assign(data[id], { name: p.title, time: p.start / 1000, time_to: p.stop / 1000 }); });
    return { body: JSON.stringify(data), delay: 100 };
  });
  app.net.route((u) => f.isGuide(u), (req) => {
    const id = f.guideIdOf(req.url), i = indexOf(id), epg = [];
    for (let t = app.clock.now - 7 * 24 * HOUR; t < app.clock.now + 24 * HOUR; t += HOUR) {
      const p = timeline(i, t);
      if (!epg.length || epg[epg.length - 1].time !== p.start / 1000) epg.push({ name: p.title, descr: '', time: p.start / 1000, time_to: p.stop / 1000 });
    }
    return { body: JSON.stringify({ epg_data: epg }), delay: 50 };
  });
  app.byName = {};
  ids.forEach((id, i) => { app.byName[base[id].channel_name] = i; });
  app.boot();
  f.untilPlaying(app);
  return app;
}
const SWITCH_MS = 10000;
// Rows whose "now" cell is not the programme on air (an ended one is tolerated for SWITCH_MS after its end).
function wrongRows(app) {
  const t = app.clock.now, out = [];
  const rows = app.rowsDetailed('channels');
  const known = rows.filter((r) => app.byName[r.cells[2].replace(/^★ /, '').replace(/\s+▶$/, '')] !== undefined);
  if (known.length < 5) return ['only ' + known.length + ' recognisable rows on screen'];
  for (const r of rows) {
    const i = app.byName[r.cells[2].replace(/^★ /, '').replace(/\s+▶$/, '')];
    if (i === undefined) continue;
    const cur = timeline(i, t), prev = timeline(i, cur.start - 1);
    const ok = r.cells[3] === cur.title || (r.cells[3] === prev.title && t - cur.start <= SWITCH_MS);
    if (!ok) out.push(r.cells[2] + ': "' + r.cells[3] + '" instead of "' + cur.title + '"');
  }
  return out;
}

test('now line accuracy: over 2 hours, every visible row shows the programme on air at every minute (switch ≤ 10 s after each end)', () => {
  const app = accurateApp();
  app.press(KEYS.ENTER, 100);
  const bad = [];
  const t0 = app.clock.now;
  for (let m = 1; m <= 120; m++) {
    app.advance(t0 + m * MIN - app.clock.now);           // exactly on each minute (ends fall on minutes)
    let w = wrongRows(app);
    if (w.length) bad.push('+' + m + ' min: ' + w[0] + (w.length > 1 ? ' (+' + (w.length - 1) + ')' : ''));
    app.advance(SWITCH_MS + 1000);                        // 11 s later every ended show must have switched
    w = wrongRows(app);
    if (w.length) bad.push('+' + m + ' min 11 s: ' + w[0] + (w.length > 1 ? ' (+' + (w.length - 1) + ')' : ''));
  }
  assert.deepEqual(bad.slice(0, 10), [], bad.length + ' wrong samples');
});

test('now line accuracy: the landing banner shows the same programme the menu row showed', () => {
  const app = accurateApp();
  app.advance(37 * MIN);                                // a moment when some shows have just changed
  app.press(KEYS.ENTER, 2000);
  for (let i = 0; i < 4; i++) app.press(KEYS.DOWN, 50);
  const row = app.rowsDetailed('channels').find((r) => r.classes.indexOf('focus') >= 0);
  assert.ok(row && row.cells[3], 'the highlighted row has no "now" line');
  app.press(KEYS.ENTER, 2000);
  assert.ok(app.text('b-now').indexOf(row.cells[3]) >= 0, 'menu said "' + row.cells[3] + '", banner says "' + app.text('b-now') + '"');
});
