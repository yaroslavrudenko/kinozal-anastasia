'use strict';
// DEC-2026-10-26-now-refresh-2 (judges 3/3, 2026-10-26): the "now" lines of the menu and search.
//  - Only rows on screen ask the provider; a row whose next programme is known here turns over at its end
//    with no request; every refresh asks the provider-fresh list (?t=); one governor with a 10 s floor
//    (answer to next request), 1 s of quiet after the last key, and a 5-min maintenance re-read.
//  - Nothing is lost: an answer that leaves a channel out keeps its line; a failed, empty or unusable answer
//    changes nothing; past the 15-min linger a row keeps the last programme the provider named, marked
//    «(шла до HH:MM)» (the banner says the same), never blank and never claimed as on air.
// The owner: «Я хочу тебя предостеречь от регрессии. В прошлый раз ты улучшал производительность, в итоге
// потерял данные.» Every "must not lose" item of the decision has a test here or an existing pin.
process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const SEC = 1000, MIN = 60000, HOUR = 3600000, HALF = HOUR / 2;
const MARK = '(шла до ';
const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const freshUrl = (u) => u.indexOf('?t=') > 0;

// A provider whose channel i shows half-hour programmes starting at the half hour plus offset(i, id). The plain
// list answers from a cache 3 min old (0.3 s), the fresh one (?t=) as of the request (3 s). app.fault breaks
// the list: '500', 'timeout', 'empty', 'not-json', '{}', 'no-programmes' or { only: Set of ids } (a partial answer).
// opts.record(i, id, t), when it returns a programme, replaces the one named for channel i (a provider stuck on a show).
function providerApp(opts) {
  const o = Object.assign({ channels: 40, guide: 'fail', offset: (i) => (i % 30) * MIN }, opts);
  const app = f.ottApp({ channels: o.channels, boot: false, guide: o.guide, config: o.config });
  const base = JSON.parse(app.fixture.list.body), ids = Object.keys(base);
  const show = (id, t) => {
    const off = o.offset(ids.indexOf(id), id), len = o.length ? o.length(ids.indexOf(id), id) : HALF;
    const start = Math.floor((t - off) / len) * len + off;
    return { start, stop: start + len, title: 'Шоу ' + id + ' ' + hhmm(start) };
  };
  const body = (t) => {
    const d = {};
    ids.forEach((id) => {
      if (app.fault && app.fault.only && !app.fault.only.has(id)) return;
      const p = (o.record && o.record(ids.indexOf(id), id, t)) || show(id, t), r = Object.assign({}, base[id]);
      if (app.fault === 'no-programmes') { delete r.name; delete r.time; delete r.time_to; } else Object.assign(r, { name: p.title, time: p.start / 1000, time_to: p.stop / 1000 });
      d[id] = r;
    });
    return JSON.stringify(d);
  };
  app.fault = null;
  app.net.route((u) => f.isList(u), (req) => {
    const fresh = freshUrl(req.url), delay = fresh ? 3000 : 300;
    if (app.fault === '500') return { status: 500, body: 'down', delay };
    if (app.fault === 'timeout') return { hang: true };
    if (app.fault === 'empty') return { body: '', delay };
    if (app.fault === 'not-json') return { body: '<html>502 Bad Gateway</html>', delay };
    if (app.fault === '{}') return { body: '{}', delay };
    return { body: body(app.clock.now - (fresh ? 0 : 3 * MIN)), delay };
  });
  if (o.guide === 'all') app.net.route((u) => f.isGuide(u), () => ({ body: JSON.stringify({ epg_data: o.guideOf() }), delay: 300 }));
  app.ids = ids; app.show = show; app.base = base;
  app.boot();
  f.untilPlaying(app);
  return app;
}
const lists = (app, fromSeq) => app.net.requests((r) => f.isList(r.url) && r.sendSeq > (fromSeq || 0));
const playingId = (app) => vm.runInContext('Playback.current().id', app.ctx);
const nameOf = (app, id) => app.base[id].channel_name;
const rows = (app) => app.rowsDetailed('channels');
const rowOf = (app, id) => rows(app).find((r) => r.cells[2].replace(/^★ /, '').replace(/\s+▶$/, '') === nameOf(app, id));
// The channel ids of the rows on screen.
const visibleIds = (app) => rows(app).map((r) => app.ids.find((id) => nameOf(app, id) === r.cells[2].replace(/^★ /, '').replace(/\s+▶$/, ''))).filter(Boolean);
const emptyRows = (app) => rows(app).filter((r) => !r.cells[3]).map((r) => r.cells[2]);
const markedRows = (app) => rows(app).filter((r) => (r.cells[3] || '').indexOf(MARK) >= 0).map((r) => r.cells[2] + ' «' + r.cells[3] + '»');
const redraw = (app) => { app.press(KEYS.DOWN, 100); app.press(KEYS.UP, 100); };
// The banner's «now» line for the playing channel (the menu closed, INFO, the menu opened again).
function bannerNow(app) {
  app.press(KEYS.BACK, 100); app.press(KEYS.INFO, 100);
  const text = app.text('b-now');
  app.press(KEYS.ENTER, 100);
  return text;
}

// ---------- no data lost on a failed or partial answer (A5, B2, A7) ----------
// The playing channel's row (seed only: its guide fails) ends at E; the list breaks one minute before E.
// At E+14 min the row still shows the show plainly (the linger, as on 37fb286); from E+16 min it shows it
// marked «(шла до HH:MM)», the banner says the same, no row on screen is ever empty, and the failed list is
// re-asked every NOW_RECHECK_MS, never faster and never stopping. The first good answer clears every mark.
// recoverMs: from the provider's return to the next eligible attempt's painted answer (60 s retry tier after
// a failure; 5 min missing tier for rows a partial answer left out) plus the 3 s answer and the redraw.
function outageRun(fault, channels, recoverMs) {
  const app = providerApp({ channels: channels || 40 });
  app.advance(10 * SEC);
  app.press(KEYS.ENTER, 5000);
  const id = playingId(app), end = app.show(id, app.clock.now + 2 * MIN).stop, last = app.show(id, end - 1);
  app.advance(end - MIN - app.clock.now);
  const seq = app.seq();
  app.fault = typeof fault === 'function' ? fault(app, id) : fault;
  const out = { empty: [], wrong: [], banner: [] };
  for (const m of [14, 16, 30, 60]) {
    app.advance(end + m * MIN - app.clock.now);
    redraw(app);
    const e = emptyRows(app);
    if (e.length) out.empty.push('E+' + m + ': ' + e.join(', '));
    const want = m < 15 ? last.title : last.title + ' (шла до ' + hhmm(end) + ')';
    const row = rowOf(app, id), sub = row && row.cells[3];
    if (sub !== want) out.wrong.push('E+' + m + ': «' + sub + '» instead of «' + want + '»');
    const b = bannerNow(app);
    if (!sub || b.indexOf(sub) < 0 || (m >= 15) !== (b.indexOf(MARK) >= 0)) out.banner.push('E+' + m + ': row «' + sub + '», banner «' + b + '»');
  }
  const during = lists(app, seq);
  out.gaps = during.slice(1).map((r, i) => r.sentAt - (during[i].endedAt || r.sentAt)).filter((g) => g < CONFIG_RECHECK);
  out.attempts = during.length;
  app.fault = null;
  app.advance(recoverMs || 70 * SEC);
  out.recoveredMarks = markedRows(app);
  out.recoveredRow = (rowOf(app, id) || { cells: [] }).cells[3];
  out.want = app.show(id, app.clock.now).title;
  return out;
}
const CONFIG_RECHECK = 60000;

for (const fault of ['500', 'timeout', 'empty', 'not-json', '{}', 'no-programmes']) {
  test('now retained (DEC-2026-10-26-now-refresh-2): list answers «' + fault + '» for 60 min — no empty row; plain until E+15 min, then «(шла до HH:MM)» in the row and the banner; retried every 60 s; the first good answer clears the marks', () => {
    const r = outageRun(fault);
    assert.deepEqual(r.empty, [], 'empty rows');
    assert.deepEqual(r.wrong, [], 'the playing row');
    assert.deepEqual(r.banner, [], 'banner ≠ row');
    assert.deepEqual(r.gaps, [], 'a failed list re-asked sooner than 60 s after the failure');
    assert.ok(r.attempts >= (fault === 'timeout' ? 40 : 55), 'only ' + r.attempts + ' attempts in 61 min: the retries stopped');
    assert.deepEqual(r.recoveredMarks, [], 'marks left 70 s after the provider came back');
    assert.equal(r.recoveredRow, r.want);
  });
}

test('now retained (DEC-2026-10-26-now-refresh-2): every answer names only 50 of 389 channels, none on screen — no row is lost or blank for 60 min; past the linger they are marked; a full answer clears the marks', () => {
  const r = outageRun((app) => ({ only: new Set(app.ids.filter((x) => visibleIds(app).indexOf(x) < 0).slice(0, 50)) }), 389, 5 * MIN + 10 * SEC);
  assert.deepEqual(r.empty, [], 'empty rows');
  assert.deepEqual(r.wrong, [], 'the playing row');
  assert.deepEqual(r.banner, [], 'banner ≠ row');
  assert.deepEqual(r.recoveredMarks, [], 'marks left 70 s after full answers came back');
  assert.equal(r.recoveredRow, r.want);
});

// B2 at the store: 389 channels known, then an answer naming 50 — the other 339 keep their line.
test('now retained (B2): an answer naming 50 of 389 channels updates those 50 and keeps the other 339', () => {
  const app = f.ottApp({ channels: 5 });
  f.untilPlaying(app);
  const out = vm.runInContext(`(function () {
    var t = Date.now(), m = 60000, a = Util.dict(), b = Util.dict(), kept = 0, updated = 0;
    for (var i = 0; i < 389; i++) a['x' + i] = [{ start: t - m, stop: t + 60 * m, title: 'old' + i }];
    EPG.setSeeds(a);
    for (var k = 0; k < 50; k++) b['x' + k] = [{ start: t - 2 * m, stop: t + 120 * m, title: 'new' + k }];
    EPG.setSeeds(b);
    for (var n = 0; n < 389; n++) { var s = EPG.shown('x' + n, t); if (s && s.p.title === 'old' + n) kept++; if (s && s.p.title === 'new' + n) updated++; }
    return kept + '/' + updated;
  })()`, app.ctx);
  assert.equal(out, '339/50');
});

// D7 through an outage: the placeholder «Нет данных», then the real programme (earlier start), then 60 min
// with no answer: what stays is the real programme, marked — never the placeholder.
test('now retained (D7): after «Нет данных» was replaced by the real programme, 60 min without answers keep the real one, marked', () => {
  const app = f.ottApp({ channels: 5 });
  f.untilPlaying(app);
  const out = vm.runInContext(`(function () {
    var id = 'd7-no-guide', t = Date.now(), m = 60000, a = Util.dict(), b = Util.dict();
    a[id] = [{ start: t - 30 * m, stop: t + 30 * m, title: 'Нет данных' }];
    b[id] = [{ start: t - 90 * m, stop: t + 10 * m, title: 'Wake Up Call.' }];
    EPG.setSeeds(a); EPG.setSeeds(b);
    return [EPG.label(EPG.shown(id, t)), EPG.label(EPG.shown(id, t + 20 * m)), EPG.label(EPG.shown(id, t + 70 * m))].join(' | ');
  })()`, app.ctx);
  assert.equal(out, 'Wake Up Call. | Wake Up Call. | Wake Up Call. (шла до ' + hhmm(f.DEFAULT_NOW + 10 * MIN) + ')');
});

// The provider's gap: an answer naming only a programme that starts later never erases the one shown.
test('now retained (B2): an answer naming only a later programme keeps the current one until that programme starts', () => {
  const app = f.ottApp({ channels: 5 });
  f.untilPlaying(app);
  const out = vm.runInContext(`(function () {
    var id = 'gap', t = Date.now(), m = 60000, a = Util.dict(), b = Util.dict(), c = Util.dict();
    a[id] = [{ start: t - 20 * m, stop: t + 10 * m, title: 'Сейчас' }];
    b[id] = [{ start: t + 30 * m, stop: t + 90 * m, title: 'Потом' }];
    EPG.setSeeds(a); EPG.setSeeds(b);
    var r = [EPG.label(EPG.shown(id, t)), EPG.label(EPG.shown(id, t + 20 * m)), EPG.label(EPG.shown(id, t + 40 * m))];
    c[id] = [{ start: t + 5 * m, stop: t + 90 * m, title: 'Наложение' }];   // overlaps the one on air: the one on air stays
    a[id] = [{ start: t - 20 * m, stop: t + 10 * m, title: 'Сейчас' }];
    EPG.setSeeds(a); EPG.setSeeds(c);
    r.push(EPG.label(EPG.shown(id, t)));
    return r.join(' | ');
  })()`, app.ctx);
  assert.equal(out, 'Сейчас | Сейчас | Потом | Сейчас');
});

// Only a channel that left the catalog loses its line (B2 lifecycle): a list reload without channel 1005.
test('now retained (B2): a list reload that drops a channel from the catalog drops its line; the others keep theirs', () => {
  const app = f.ottApp({ channels: 6, config: { PLAYLIST_REFRESH_MS: 10 * MIN } });
  f.untilPlaying(app);
  const before = vm.runInContext('[!!EPG.shown("1005", Date.now()), !!EPG.shown("1004", Date.now())].join()', app.ctx);
  app.fixture.list = f.ottChannelList(6, { skip: ['1005'] });
  app.advance(10 * MIN + 5 * SEC);
  const after = vm.runInContext('[!!EPG.shown("1005", Date.now()), !!EPG.shown("1004", Date.now())].join()', app.ctx);
  assert.equal(before + ' → ' + after, 'true,true → false,true');
});

// The programme panel's «в эфире» keeps its own lookup: a retained, ended programme is never «в эфире».
test('now retained (A7): during an outage the programme panel never marks the retained, ended programme «в эфире»', () => {
  const app = providerApp({});
  app.advance(10 * SEC);
  const id = playingId(app), end = app.show(id, app.clock.now).stop;
  app.fault = '500';
  app.advance(end + 30 * MIN - app.clock.now);
  app.press(KEYS.DOWN, 1000);                                 // the programme panel (its guide fails: the list's line)
  const onAir = app.rowsDetailed('p-list').filter((r) => r.cells[3] === 'в эфире').map((r) => r.cells[2]);
  assert.deepEqual(onAir, []);
});

// ---------- healthy provider: never a mark, never an empty row (T-no-flicker, U0) ----------
// A key every 2 s redraws the rows (so a show that just ended is drawn before its re-read lands), yet leaves
// the second of quiet a refresh needs.
test('now healthy (DEC-2026-10-26-now-refresh-2): the menu open 60 min with a show ending every minute and a key every 2 s — never a «(шла до …)» mark, never an empty row', () => {
  const app = providerApp({});
  app.press(KEYS.ENTER, 1000);
  const bad = [];
  for (let s = 1; s <= 3600; s++) {
    if (s % 2) app.press(s % 4 === 1 ? KEYS.DOWN : KEYS.UP, SEC); else app.advance(SEC);
    const m = markedRows(app), e = emptyRows(app);
    if (m.length || e.length) bad.push('+' + s + ' s: ' + m.concat(e).join(', '));
  }
  assert.deepEqual(bad.slice(0, 5), [], bad.length + ' bad samples');
});

test('now healthy (DEC-2026-10-26-now-refresh-2): after 30, 40 and 60 min on one page, every row of every group is filled and unmarked', () => {
  const app = providerApp({ channels: 60 });
  app.press(KEYS.ENTER, 1000);
  const t0 = app.clock.now;
  const groups = JSON.parse(vm.runInContext('JSON.stringify(Channels.groups().map(function (g) { return g.search || g.about || g.sources ? 0 : g.items.length; }))', app.ctx));
  const bad = [];
  let seen = 0;
  for (const at of [30, 40, 60]) {
    app.advance(t0 + at * MIN - app.clock.now);
    app.press(KEYS.LEFT, 100);
    for (let gi = 1; gi < groups.length - 2; gi++) {          // the last two rows: 📡 Источники, ℹ О программе
      if (gi > 1) app.press(KEYS.DOWN, 100);
      app.press(KEYS.RIGHT, 100);
      for (let shown = 0; shown < groups[gi]; ) {
        const r = rows(app);
        r.forEach((x) => { if (!x.cells[3] || x.cells[3].indexOf(MARK) >= 0) bad.push(at + ' min, group ' + gi + ': ' + x.cells[2] + ' «' + x.cells[3] + '»'); });
        shown += r.length; seen += r.length;
        if (shown < groups[gi]) app.press(KEYS.CH_DOWN, 200);
      }
      app.press(KEYS.LEFT, 100);
    }
    for (let gi = groups.length - 3; gi > 1; gi--) app.press(KEYS.UP, 100);
    app.press(KEYS.RIGHT, 100);
  }
  assert.ok(seen >= 3 * 2 * 60, 'only ' + seen + ' rows checked');
  assert.deepEqual(bad.slice(0, 5), [], bad.length + ' bad rows');
});

// ---------- the refresh policy (A1–A6, B1) ----------
// T-flip (Judge 3's scenario): the playing channel's full guide changes programme at :20/:50; the rows on
// screen end on the hour, the rest every minute. The playing row turns over at 17:20:00 by itself.
test('now refresh (A3): the playing row, whose next programme the guide knows, turns over at its end within 1 s with no request', () => {
  const guideOf = () => { const epg = []; for (let t = f.DEFAULT_NOW - 6 * HOUR + 20 * MIN; t < f.DEFAULT_NOW + 24 * HOUR; t += HALF) epg.push({ name: 'Гид ' + hhmm(t), descr: '', time: t / 1000, time_to: (t + HALF) / 1000 }); return epg; };
  const st = { vis: null };
  const app = providerApp({ channels: 100, guide: 'all', guideOf, offset: (i, id) => (st.vis && st.vis.has(id) ? 0 : (i * MIN) % HOUR), length: () => HOUR });
  app.advance(10 * SEC);
  app.press(KEYS.ENTER, 0);
  st.vis = new Set(visibleIds(app));
  app.advance(2000);
  const id = playingId(app), boundary = f.DEFAULT_NOW + 20 * MIN;
  assert.ok(rowOf(app, id), 'the playing row is on screen');
  app.advance(boundary - 10 * SEC - app.clock.now);
  const seq = app.seq();
  let flippedAt = null;
  while (flippedAt === null && app.clock.now < boundary + 10 * SEC) {
    app.advance(100);
    if ((rowOf(app, id).cells[3] || '') === 'Гид ' + hhmm(boundary)) flippedAt = app.clock.now;
  }
  assert.ok(flippedAt !== null && flippedAt - boundary <= 1000, 'flipped ' + (flippedAt === null ? 'not within 10 s' : (flippedAt - boundary) + ' ms') + ' after the end');
  // The open menu's 60 s re-read (NOW_OPEN_REREAD_MS) may run near the end; the flip must not come from an answer.
  assert.deepEqual(lists(app, seq).filter((r) => r.endedAt >= boundary && r.endedAt <= flippedAt).map((r) => hhmm(r.sentAt)), [], 'a list answer landed between the end and the flip');
});

// A2 crossing (Codex): a request sent at E−1 s is answered at E+2 s — it sampled before E, so the row
// that ended at E is re-asked at once after the floor: E+12 s, not E+62 s.
test('now refresh (A2): an answer asked for 1 s before a row ends and arriving 2 s after it does not count for that row — it is re-asked at E+12 s', () => {
  const E = f.DEFAULT_NOW + 30 * SEC;                       // channel 0 ends at E, the others at E−2 s
  const app = providerApp({ offset: (i) => (i === 0 ? E : E - 2 * SEC) % HOUR, length: () => HOUR });
  app.advance(7 * SEC);                                     // past the landing gate
  vm.runInContext('NowLines.watch(function () { return ' + JSON.stringify(app.ids) + '; })', app.ctx);
  const seq = app.seq();
  app.advance(E + 80 * SEC - app.clock.now);
  const r = lists(app, seq).map((x) => ({ sent: x.sentAt - E, done: x.endedAt - E }));
  assert.deepEqual(r.slice(0, 2), [{ sent: -1000, done: 2000 }, { sent: 12000, done: 15000 }]);
});

// A6 quiet: keys every 200 ms (a held button) send nothing; the one request goes NOW_QUIET_MS after the last.
test('now refresh (A6): while keys repeat every 200 ms no list request is sent; one goes 1 s after the last key', () => {
  const app = providerApp({ offset: () => 0 });
  app.advance(10 * SEC);
  const E = app.show(app.ids[0], app.clock.now).stop;
  app.advance(E - 30 * SEC - app.clock.now);
  app.press(KEYS.ENTER, 1000);
  app.advance(E - 1000 - app.clock.now);
  const seq = app.seq();
  for (let k = 0; k < 300; k++) app.press(k % 2 ? KEYS.UP : KEYS.DOWN, 200);
  const lastKey = app.clock.now - 200;
  const during = lists(app, seq).map((r) => r.sentAt - E);
  app.advance(5 * SEC);
  const after = lists(app, seq).map((r) => r.sentAt - lastKey);
  assert.deepEqual(during, [], 'requests while the keys repeated');
  assert.deepEqual(after, [1000]);
});

// A1 + B1: ends of shows off screen send nothing; with nothing ending on screen the only refresh is the
// open menu's re-read, NOW_OPEN_REREAD_MS (60 s, owner 2026-10-26) after the previous answer.
test('now refresh (A1, B1): with a show ending every minute off screen and none on screen, the only requests are the open menu\'s re-read every 60 s', () => {
  const st = { vis: null }, onScreen = (id) => !!st.vis && st.vis.has(id);
  const app = providerApp({ channels: 100, offset: (i, id) => (onScreen(id) ? 0 : (i * MIN) % HALF), length: (i, id) => (onScreen(id) ? 24 * HOUR : HALF) });
  app.advance(10 * SEC);
  app.press(KEYS.ENTER, 0);
  st.vis = new Set(visibleIds(app));
  app.advance(2 * MIN);                                     // the rows on screen learn their all-day shows
  const all = lists(app), c0 = all[all.length - 1].endedAt;  // the last answer: the window starts there
  app.advance(c0 + HOUR - app.clock.now);
  const r = lists(app).filter((x) => x.sentAt > c0);
  const gaps = r.map((x, i) => x.sentAt - (i ? r[i - 1] : all[all.length - 1]).endedAt);
  // Re-reads every 60 s + the 3 s answer: 57 in the hour (3600 / 63), each exactly NOW_OPEN_REREAD_MS after the previous answer.
  assert.equal(r.length, 57, 'requests in 1 h: ' + r.map((x) => new Date(x.sentAt).toISOString().slice(11, 19)).join(' '));
  assert.deepEqual(gaps.filter((g) => g !== MIN), [], 'gaps other than 60 s');
});

// ---------- Codex REJECT on f0b31a7, fixed 2026-10-26 (COMMON-DECISION-Q1, A2/A5/A7) ----------
// (a) A long outage with no key pressed: the playing row (seed only) lingers plainly to E+15 min and is then
// redrawn by itself with «(шла до HH:MM)» — the failed answers never redrew it on f0b31a7.
test('now retained (A7, Codex a): during an outage with no key pressed, a row is marked «(шла до HH:MM)» when its linger ends, with no redraw from keys', () => {
  const app = providerApp({});
  app.advance(10 * SEC);
  app.press(KEYS.ENTER, 5000);
  const id = playingId(app), end = app.show(id, app.clock.now + 2 * MIN).stop, last = app.show(id, end - 1);
  app.advance(end - MIN - app.clock.now);
  app.fault = '500';
  app.advance(end + 14 * MIN - app.clock.now);
  const at14 = (rowOf(app, id) || { cells: [] }).cells[3];
  app.advance(end + 15 * MIN + 2 * SEC - app.clock.now);
  const at15 = (rowOf(app, id) || { cells: [] }).cells[3];
  assert.equal(at14 + ' | ' + at15, last.title + ' | ' + last.title + ' (шла до ' + hhmm(end) + ')');
});

// (b) Per-row confirmation: answers that leave out a row on screen whose show ended confirm nothing for it —
// it stays due and is re-asked after the 10 s floor (E+25 s), not after the 60 s recheck (E+75 s).
test('now refresh (A2, Codex b): an answer that leaves out an ended row on screen does not confirm it — it is re-asked 10 s after that answer', () => {
  const E = f.DEFAULT_NOW + 30 * SEC;                       // channel 0 ends at E, the others at E−2 s
  const app = providerApp({ offset: (i) => (i === 0 ? E : E - 2 * SEC) % HOUR, length: () => HOUR });
  app.fault = { only: new Set(app.ids.slice(1)) };          // every fresh answer leaves channel 0 out
  app.advance(7 * SEC);
  vm.runInContext('NowLines.watch(function () { return ' + JSON.stringify(app.ids) + '; })', app.ctx);
  const seq = app.seq();
  app.advance(E + 80 * SEC - app.clock.now);
  const r = lists(app, seq).map((x) => x.sentAt - E);
  assert.deepEqual(r.slice(0, 4), [-1000, 12000, 25000, 38000]);
});

// (c) A failed answer is due again NOW_RECHECK_MS later even when no row on screen needs the provider
// (f0b31a7 only allowed it then and waited for the 5-min maintenance re-read).
test('now refresh (A5, Codex c): with nothing ending on screen, a failed list is asked again 60 s after the failure, not 5 min', () => {
  const app = providerApp({ offset: () => 0, length: () => 24 * HOUR });
  app.advance(7 * SEC);
  vm.runInContext('NowLines.watch(function () { return ' + JSON.stringify(app.ids.slice(0, 13)) + '; })', app.ctx);
  app.fault = '500';
  const seq = app.seq();
  app.advance(15 * MIN);
  const r = lists(app, seq);
  const gaps = r.slice(1).map((x, i) => x.sentAt - r[i].endedAt);
  assert.ok(r.length >= 10, 'only ' + r.length + ' attempts in 15 min');
  assert.deepEqual(gaps.filter((g) => g !== CONFIG_RECHECK), [], 'gaps other than 60 s');
});

// (d) A provider still naming a show that ended keeps being re-asked every 60 s, also past 15 min after its
// end (f0b31a7 fell back to 5 min there).
test('now refresh (A2, Codex d): a row whose show the provider still names 20–40 min after its end is re-asked every 60 s', () => {
  const E = f.DEFAULT_NOW + MIN;
  const app = providerApp({ offset: () => 0, length: () => 24 * HOUR, record: (i) => (i === 0 ? { start: E - HALF, stop: E, title: 'Застрявшее шоу' } : null) });
  app.advance(7 * SEC);
  vm.runInContext('NowLines.watch(function () { return ' + JSON.stringify([app.ids[0]]) + '; })', app.ctx);
  app.advance(E + 20 * MIN - app.clock.now);
  const seq = app.seq();
  app.advance(20 * MIN);
  const r = lists(app, seq);
  const gaps = r.slice(1).map((x, i) => x.sentAt - r[i].endedAt);
  assert.ok(r.length >= 18, 'only ' + r.length + ' requests in 20 min');
  assert.deepEqual(gaps.filter((g) => g !== CONFIG_RECHECK), [], 'gaps other than 60 s');
});

// ---------- paging (owner 2026-10-26: «да, исправляй») ----------
// TV run 2026-10-26-14-02 on 8413f34: a row scrolled into view showed a show that had ended 98 s and 210 s
// before, because off-screen rows were re-read only every 5 min. While the menu is open the whole list is
// re-read every NOW_OPEN_REREAD_MS (60 s), so a row scrolled into view is at most ~63 s old (60 s + the 3 s
// answer) before its own request lands.
test('now paging: a row scrolled into view never shows a show that ended more than 65 s before, with no key for minutes before the scroll', () => {
  const app = providerApp({ channels: 100, offset: (i) => (i * 37 * SEC) % HALF });
  app.advance(10 * SEC);
  app.press(KEYS.ENTER, 0);
  const late = [];
  for (let k = 0; k < 12; k++) {
    app.advance(4 * MIN + 17 * SEC);                       // no key: only the open menu's re-reads keep the rows
    app.press(KEYS.CH_DOWN, 0);                            // CH−: the next page of rows comes into view
    const t = app.clock.now;
    for (const id of visibleIds(app)) {
      const r = rowOf(app, id), on = app.show(id, t);
      if (r && (r.cells[3] || '').indexOf(on.title) < 0 && t - on.start > 65 * SEC) late.push(nameOf(app, id) + ' «' + r.cells[3] + '» ≠ «' + on.title + '» ' + Math.round((t - on.start) / 1000) + ' s');
    }
  }
  assert.deepEqual(late, []);
});
