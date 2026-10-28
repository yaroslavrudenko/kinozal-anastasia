'use strict';
// Logos behave like the channel names: «как будто они были и есть» (owner, 2026-10-28). A logo shown once is shown
// again at once, with no request; the page on screen and the next one the way the cursor moves are loaded, no more;
// a logo not loaded yet leaves its box empty — never another channel's picture; a failed one is asked for once; an
// unchanged URL is never asked for again, not even by the hourly list; nothing loads for a menu nobody sees.
// Requests are the harness's picture downloads (app.images.requests), not src writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const rows = (app) => app.document.getElementById('channels').children.filter((r) => r.style.visibility !== 'hidden');
const reqs = (app) => app.images.requests.length;
// Each visible row: 'ok' its own channel's picture painted; 'empty' its box empty; 'wrong' another picture painted.
function logoStates(app) {
  return rows(app).map((r) => {
    const c = ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ')'), img = r.children[1];
    const painted = img.style.visibility !== 'hidden' && img.showing;    // the picture on screen (harness: showing)
    return !painted ? 'empty' : img.showing === c.logo ? 'ok' : 'wrong:' + r.children[0].textContent;
  });
}
const allOk = (app) => logoStates(app).every((s) => s === 'ok');
// The zap group's background trickle is off here (its wish is dropped), so these tests pin what the menu itself
// asks for; tests/logos-trickle.test.js pins the trickle (DEC-2026-10-28-logos-ahead).
function menuApp(opts) {
  const app = f.ottApp(Object.assign({ channels: 200 }, opts, { boot: false }));
  vm.runInContext('var __noGroup = Logos.want; Logos.want = function (who) { if (who !== "group") return __noGroup.apply(this, arguments); };', app.ctx);
  app.boot();
  f.untilPlaying(app);
  app.advance(5000);
  return app;
}

test('logos: flicked down three pages and back, the first page shows its logos in the frame of the key — no request, no empty box (owner, 2026-10-28)', () => {
  const app = menuApp();
  app.press(KEYS.ENTER, 3000);
  assert.ok(rows(app).length >= 12 && allOk(app), 'first page settled: ' + logoStates(app));
  for (let i = 0; i < 3; i++) app.press(KEYS.CH_DOWN, 250);
  const r0 = reqs(app);
  for (let i = 0; i < 3; i++) {
    app.press(KEYS.CH_UP, 0);
    const st = logoStates(app);
    assert.ok(st.every((s) => s === 'ok' || s === 'empty') && !st.some((s) => /wrong/.test(s)), 'another channel\'s picture: ' + st);
    app.advance(250);
  }
  assert.ok(allOk(app), 'page 1 at the key: ' + logoStates(app));
  assert.equal(reqs(app) - r0, 0, 'pictures downloaded again');
});

test('logos: requests — the menu laid out at the first frame loads its page; the first opening loads the two pages ahead; a CH− after a pause = 0 for the page shown + the next page two ahead; CH+ back = 0 (DEC-2026-10-28-logos-ahead)', () => {
  const app = menuApp();
  const r0 = reqs(app);
  app.press(KEYS.ENTER, 3000);
  const n = rows(app).length;
  assert.equal(new Set(app.images.requests.map((r) => r.url)).size, 3 * n, 'page 1 (at the first frame, with the banner\'s) + pages 2 and 3');
  assert.equal(reqs(app) - r0, 2 * n, 'first opening: the two pages ahead');
  const r1 = reqs(app);
  app.press(KEYS.CH_DOWN, 0);
  assert.ok(allOk(app), 'the page loaded ahead is shown at once: ' + logoStates(app));
  app.advance(3000);
  assert.equal(reqs(app) - r1, n, 'CH− after a pause: the page two ahead only');
  const r2 = reqs(app);
  app.press(KEYS.CH_UP, 3000);
  assert.equal(reqs(app) - r2, 0, 'CH+ back');
  assert.ok(allOk(app));
});

test('logos: the key that opens the menu starts no download in its own task (O(1) in render); they start right after', () => {
  const app = menuApp();
  const r0 = reqs(app);
  app.press(KEYS.ENTER, 0);
  assert.equal(reqs(app) - r0, 0, 'downloads started inside the key handler');
  app.advance(50);
  assert.ok(reqs(app) - r0 > 0, 'nothing started after the key');
});

test('logos: CH− held through 10 pages — the downloads run ahead of the cursor while the key is held, each picture once, never another channel\'s picture; the page it stops on is shown once it rests (DEC-2026-10-28-logos-ahead)', () => {
  const app = menuApp();
  app.press(KEYS.ENTER, 3000);
  const r0 = reqs(app);
  for (let i = 0; i < 10; i++) app.press(KEYS.CH_DOWN, 120);
  assert.ok(reqs(app) - r0 > 0, 'nothing loaded while the key was held');
  assert.ok(logoStates(app).every((s) => s === 'ok' || s === 'empty'), 'another channel\'s picture while held: ' + logoStates(app));
  app.advance(2000);
  assert.ok(allOk(app), logoStates(app));
  const urls = app.images.requests.map((r) => r.url);
  assert.equal(new Set(urls).size, urls.length, 'a picture downloaded twice');
  assert.ok(reqs(app) - r0 <= 13 * rows(app).length, 'downloads for 10 pages: ' + (reqs(app) - r0));
});

test('logos: a page not loaded yet shows empty boxes, never the previous channels\' pictures, and fills in as they arrive', () => {
  const app = menuApp({ imageDelayMs: 800 });
  app.press(KEYS.ENTER, 3000);
  app.press(KEYS.CH_DOWN, 100); app.press(KEYS.CH_DOWN, 100);    // page 3: not loaded ahead
  const st = logoStates(app);
  assert.ok(st.every((s) => s === 'empty' || s === 'ok') && st.some((s) => s === 'empty'), st);
  app.advance(6000);
  assert.ok(allOk(app), logoStates(app));
});

test('logos: a logo that fails (404) is asked for once within the hour — not again on flicking back or reopening the menu; the next hourly list asks for it once more (DEC-2026-10-28-logo-retry-hourly); its box stays empty', () => {
  const app = menuApp({ imageStatus: (u) => (/0\.png$/.test(u) ? 404 : 200) });
  app.press(KEYS.ENTER, 3000);
  for (let i = 0; i < 2; i++) app.press(KEYS.CH_DOWN, 300);
  for (let i = 0; i < 2; i++) app.press(KEYS.CH_UP, 300);
  app.press(KEYS.BACK, 500); app.press(KEYS.ENTER, 2000);
  const asked = () => app.images.requests.filter((r) => /0\.png$/.test(r.url)).map((r) => r.url);
  const bad = asked();
  assert.ok(bad.length >= 1, 'no failing logo was on the pages seen');
  assert.equal(new Set(bad).size, bad.length, 'a failed logo asked for again within the hour: ' + bad);
  const row = rows(app).find((r) => /0\.png$/.test(ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ').logo')));
  assert.ok(row, 'a failing logo is on the page');
  assert.equal(row.children[1].style.visibility, 'hidden');
  // The hourly list: each failed URL the menu still shows is asked for once more — not more.
  const onScreen = rows(app).map((r) => ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ').logo')).filter((u) => /0\.png$/.test(u));
  app.advance(ev(app, 'CONFIG.PLAYLIST_REFRESH_MS') + 5000);
  const after = asked();
  for (const u of onScreen) assert.equal(after.filter((x) => x === u).length, 2, u + ' after the hourly list: ' + after);
  assert.equal(row.children[1].style.visibility, 'hidden', 'a logo that still fails shows');
});

test('logos: a logo that failed for a passing reason (503) stays empty within the hour and is shown after the next hourly list asked for it once more (review 7, F1; DEC-2026-10-28-logo-retry-hourly)', () => {
  const seen = new Map();
  let flaky = null;                                            // a logo of page 2: page 1's were loaded at the first frame
  const app = menuApp({ imageStatus: (u) => { const n = (seen.get(u) || 0) + 1; seen.set(u, n); return u === flaky && n === 1 ? 503 : 200; } });
  flaky = ev(app, 'Channels.byNum(' + (rows(app).length + 3) + ').logo');
  const row = () => rows(app).find((r) => ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ').logo') === flaky);
  app.press(KEYS.ENTER, 3000);                                 // the opening asks for page 2: the flaky one fails
  app.press(KEYS.CH_DOWN, 500); app.press(KEYS.CH_UP, 500); app.press(KEYS.BACK, 500); app.press(KEYS.ENTER, 1000); app.press(KEYS.CH_DOWN, 2000);
  assert.ok(row(), 'the flaky logo is on the page');
  assert.equal(seen.get(flaky), 1, 'retried within the hour');
  assert.equal(row().children[1].style.visibility, 'hidden');
  app.advance(ev(app, 'CONFIG.PLAYLIST_REFRESH_MS') + 5000);
  assert.equal(seen.get(flaky), 2, 'not retried once at the hourly list');
  assert.equal(row().children[1].showing, flaky);
  assert.notEqual(row().children[1].style.visibility, 'hidden');
});

test('logos: a download that never answers is given up after LOGO_TIMEOUT_MS — six dead logos do not stop the others (review 7, F2; PF-13 T3)', () => {
  const dead = new Set();
  const app = menuApp({ imageStatus: (u) => (dead.has(u) ? 'hang' : 200) });
  for (let n = 14; n <= 19; n++) dead.add(ev(app, 'Channels.byNum(' + n + ').logo'));   // the first six of page 2
  app.press(KEYS.ENTER, 3000);
  const later = [20, 21, 22, 23, 24, 25, 26].map((n) => ev(app, 'Channels.byNum(' + n + ').logo'));
  const asked = () => later.filter((u) => app.images.requests.some((r) => r.url === u)).length;
  assert.equal(asked(), 0, 'the rest of page 2 started while six downloads hang (the test does not test the timeout)');
  app.advance(ev(app, 'CONFIG.LOGO_TIMEOUT_MS || 8000') + 1000);
  assert.equal(asked(), later.length, 'the rest of page 2 never started: the hung downloads hold every slot');
  app.press(KEYS.CH_DOWN, 1000);
  const st = logoStates(app);
  assert.ok(!st.some((x) => /wrong/.test(x)), st.join());
  assert.equal(st.filter((x) => x === 'ok').length, rows(app).length - 6, 'page 2: ' + st);
});

test('logos: a pooled row that passes to another channel wanting the same new URL does not keep the previous channel\'s picture while it loads (review 7, Codex C7-1)', () => {
  const app = menuApp({ imageDelayMs: 600 });
  app.press(KEYS.ENTER, 3000);
  assert.ok(allOk(app));
  const n = rows(app).length, list = JSON.parse(app.fixture.list.body);
  for (const num of [1, 1 + n]) list[ev(app, 'Channels.byNum(' + num + ').id')].img = 'shared-new.png';
  app.fixture.list.body = JSON.stringify(list);
  app.advanceUntil(() => app.images.requests.some((r) => /shared-new\.png$/.test(r.url)), ev(app, 'CONFIG.PLAYLIST_REFRESH_MS') + 60000, 10);
  app.press(KEYS.CH_DOWN, 0);                                  // the first row now shows channel 1 + n, the shared URL still loading
  for (const wait of [0, 100, 200]) {
    const st = logoStates(app);
    assert.ok(!st.some((x) => /wrong/.test(x)), 'after ' + wait + ' ms: ' + st.join());
    app.advance(100);
  }
  app.advance(1000);
  assert.ok(allOk(app), logoStates(app).join());
});

test('logos: page up with the layout\'s correcting fill asks for the page above, not the one below (review 7, Codex C7-2)', () => {
  const app = menuApp();
  const col = app.document.getElementById('channels');
  col.clientHeight = 840;                                      // 12 rows of 70 px fit; the pool has 13
  col.children.forEach((r, i) => { r.offsetTop = 70 * i; r.offsetHeight = 70; });
  vm.runInContext('var __wishes = [], __want = Logos.want; Logos.want = function (who, u) { if (who === "channels") __wishes.push(typeof u === "function" ? u() : u); return __want.apply(this, arguments); };', app.ctx);
  app.press(KEYS.ENTER, 2000);
  app.press(KEYS.CH_DOWN, 2000);
  app.press(KEYS.CH_DOWN, 2000);
  assert.equal(ev(app, 'ListView.shown("channels").first'), 24);
  app.press(KEYS.CH_UP, 2000);
  assert.equal(ev(app, 'ListView.shown("channels").first'), 12);
  const wish = ev(app, '__wishes[__wishes.length - 1]'), logo = (num) => ev(app, 'Channels.byNum(' + num + ').logo');
  assert.ok([1, 6, 12].every((num) => wish.indexOf(logo(num)) >= 0), 'the page above was not asked for');
  // DEC-2026-10-28-logos-ahead: the pages ahead (above) come before the one page behind (below), and no second page below.
  assert.ok(wish.indexOf(logo(1)) < wish.indexOf(logo(30)), 'the page below was asked for before the page above');
  assert.ok(wish.indexOf(logo(45)) < 0, 'a second page below was asked for');
  // Up again to the top: nothing is above, so the next page is the one below.
  app.press(KEYS.CH_UP, 2000);
  assert.equal(ev(app, 'ListView.shown("channels").first'), 0);
  const top = ev(app, '__wishes[__wishes.length - 1]');
  assert.ok([14, 20].every((num) => top.indexOf(logo(num)) >= 0), 'at the top the page below was not asked for');
});

test('logos: the banner and the menu each keep their own wish — a menu wish never drops the banner\'s logo, the banner\'s logo never drops the menu\'s page (review 7, F3, R7-P2)', () => {
  // The banner first: OK on a channel within the dwell while the menu's logos load. The banner is drawn once only, so a
  // later redraw cannot hide a dropped wish (review 7, F3: the menu's leftover timer wished [] and dropped it).
  const a = menuApp({ imageDelayMs: 600 });
  const logo = a.document.getElementById('b-logo');
  a.press(KEYS.ENTER, 50);
  for (let i = 0; i < 21; i++) a.press(KEYS.DOWN, 10);
  vm.runInContext('var __banner = UI.banner; UI.banner = function (m, h) { __banner(m, h); UI.banner = function () {}; };', a.ctx);
  a.press(KEYS.ENTER, 0);
  const url = ev(a, 'Playback.current().logo');
  a.advance(4000);
  assert.equal(logo.showing, url, 'the banner\'s logo was dropped by the menu');
  // The menu first: its page is queued (6 on their way, the rest waiting) when the banner asks for one logo.
  const b = menuApp({ imageDelayMs: 600 });
  b.press(KEYS.ENTER, 50);
  const wished = [14, 18, 22, 26].map((num) => ev(b, 'Channels.byNum(' + num + ').logo')), other = ev(b, 'Channels.byNum(150).logo');
  vm.runInContext('UI.banner({ num: 150, logo: ' + JSON.stringify(other) + ', title: "x" })', b.ctx);
  b.advance(5000);
  const asked = (u) => b.images.requests.some((r) => r.url === u);
  assert.ok(asked(other), 'the banner\'s logo was not asked for');
  assert.deepEqual(wished.filter((u) => !asked(u)), [], 'the menu\'s page was dropped by the banner');
});

test('logos: beyond LOGO_KEEP the least recently shown are let go — never the page on screen; one let go is asked for again only when it is wanted again (review 7, F4)', () => {
  const app = menuApp();
  // Every picture Logos itself asks for (an Image()'s src), by URL — the harness's memory cache would hide a re-request.
  vm.runInContext('CONFIG.LOGO_KEEP = 60; CONFIG.LOGO_EVICT = 5; var __loads = [], __I = Image; Image = function () { var im = __I(), d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(im), "src");' +
    ' Object.defineProperty(im, "src", { set: function (v) { __loads.push(v); d.set.call(this, v); }, get: function () { return d.get.call(this); } }); return im; };', app.ctx);
  const loads = (u) => ev(app, '__loads').filter((x) => x === u).length, ready = (u) => ev(app, 'Logos.ready(' + JSON.stringify(u) + ')');
  app.press(KEYS.ENTER, 3000);
  for (let i = 0; i < 3; i++) app.press(KEYS.CH_DOWN, 3000);
  const all = ev(app, 'Channels.groups()[Channels.allIdx()].items.map(function (i) { return Channels.at(i).logo; })');
  assert.ok(all.filter(ready).length <= 60, 'kept ' + all.filter(ready).length + ' > LOGO_KEEP');
  const shown = rows(app).map((r) => ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ').logo'));
  assert.deepEqual(shown.filter((u) => !ready(u)), [], 'the page on screen was let go');
  const n = rows(app).length, first = all.slice(0, n);
  assert.deepEqual(first.filter(ready), [], 'the first page (least recently shown) is still kept');
  assert.deepEqual(first.map(loads), first.map(() => 0), 'a logo let go was asked for again before it was wanted');
  for (let i = 0; i < 3; i++) app.press(KEYS.CH_UP, 3000);
  assert.ok(allOk(app), logoStates(app));
  assert.deepEqual(first.map(loads), first.map(() => 1), 'the first page, wanted again');
});

test('logos: the hourly list — unchanged URLs download nothing; a changed URL downloads once, its row keeps the old picture until the new one has arrived', () => {
  const app = menuApp({ imageDelayMs: 600 });
  app.press(KEYS.ENTER, 5000);
  assert.ok(allOk(app));
  const r0 = reqs(app);
  const id = ev(app, 'Channels.byNum(2).id'), list = JSON.parse(app.fixture.list.body);
  list[id].img = 'logo-' + id + '-new.png';
  app.fixture.list.body = JSON.stringify(list);
  app.advanceUntil(() => app.images.requests.some((r) => /-new\.png$/.test(r.url)), ev(app, 'CONFIG.PLAYLIST_REFRESH_MS') + 60000, 10);
  const img = rows(app).find((r) => r.children[0].textContent === '2').children[1];
  assert.equal(img.getAttribute('src'), 'http://myott.top/images/logo-' + id + '.png', 'the old picture stays while the new one loads');
  assert.equal(img.showing, img.getAttribute('src'));
  assert.notEqual(img.style.visibility, 'hidden');
  app.advance(300);
  assert.equal(img.getAttribute('src'), 'http://myott.top/images/logo-' + id + '.png', 'still loading: the old picture');
  app.advance(3000);
  assert.equal(img.getAttribute('src'), 'http://myott.top/images/logo-' + id + '-new.png');
  assert.equal(reqs(app) - r0, 1, 'downloads for the hourly list');
  // The URL the list no longer names is forgotten (freshness of logos = freshness of the list; memory bound).
  app.advance(1000);
  assert.equal(ev(app, 'Logos.ready("http://myott.top/images/logo-' + id + '.png")'), false, 'a logo the list dropped is still kept');
});

test('logos: a row whose picture arrived while it was on screen keeps it while the hourly list\'s new URL for the same channel loads (review 7, Codex C7-1: the row\'s channel survives the arrival)', () => {
  const app = menuApp({ imageDelayMs: 600 });
  app.press(KEYS.ENTER, 3000);
  app.press(KEYS.CH_DOWN, 50);                                 // page 3 is not loaded: its pictures arrive on screen
  app.press(KEYS.CH_DOWN, 4000);
  assert.ok(allOk(app), logoStates(app));
  const num = Number(rows(app)[1].children[0].textContent), id = ev(app, 'Channels.byNum(' + num + ').id'), list = JSON.parse(app.fixture.list.body);
  list[id].img = 'logo-' + id + '-v2.png';
  app.fixture.list.body = JSON.stringify(list);
  app.advanceUntil(() => app.images.requests.some((r) => /-v2\.png$/.test(r.url)), ev(app, 'CONFIG.PLAYLIST_REFRESH_MS') + 60000, 10);
  const img = rows(app).find((r) => Number(r.children[0].textContent) === num).children[1];
  assert.equal(img.showing, 'http://myott.top/images/logo-' + id + '.png', 'the old picture went while the new one loads');
  assert.notEqual(img.style.visibility, 'hidden', 'the box went empty while the new one loads');
  app.advance(2000);
  assert.equal(img.showing, 'http://myott.top/images/logo-' + id + '-v2.png');
});

test('logos: a menu closed while pages wait starts no download after it closed', () => {
  const app = menuApp({ imageDelayMs: 600 });
  app.press(KEYS.ENTER, 3000);
  for (let i = 0; i < 4; i++) app.press(KEYS.CH_DOWN, 120);
  app.press(KEYS.BACK, 0);
  const r0 = reqs(app);
  app.advance(3000);
  assert.equal(reqs(app) - r0, 0);
  // Closed while the opening's pictures are on their way (6 of 26 started): the rest of that wish is dropped.
  const b = menuApp({ imageDelayMs: 600 });
  b.press(KEYS.ENTER, 50);
  const started = reqs(b);
  b.press(KEYS.BACK, 0);
  b.advance(3000);
  assert.equal(reqs(b) - started, 0, 'downloads started after the menu closed');
});

test('logos: a picture on its way is never asked for a second time — a new wish for the same page shares the downloads under way', () => {
  const app = menuApp({ imageDelayMs: 600 });
  vm.runInContext('var __images = 0, __Image = Image; Image = function () { __images++; return __Image(); };', app.ctx);
  const before = app.images.requests.length;
  app.press(KEYS.ENTER, 50);
  app.press(KEYS.DOWN, 300);                 // the same page asked for again while its pictures load
  app.press(KEYS.DOWN, 300);
  app.advance(5000);
  assert.ok(allOk(app), logoStates(app));
  const urls = app.images.requests.slice(before).map((r) => r.url);
  assert.ok(urls.length >= 13, 'the opening downloaded ' + urls.length);
  assert.equal(ev(app, '__images'), new Set(urls).size, 'one Image per picture: ' + urls.length + ' downloads');
});

test('logos (banner): a channel whose logo is not loaded shows an empty box, not the previous channel\'s; zapping back to a loaded one shows it at once with no download', () => {
  const app = menuApp({ imageDelayMs: 600 });
  const logo = app.document.getElementById('b-logo');
  const first = ev(app, 'Playback.current().logo');
  app.press(KEYS.LEFT, 50);                                   // the last channel: its logo was never loaded
  assert.ok(logo.style.visibility === 'hidden' || !logo.showing, 'the previous channel\'s picture in the banner: ' + logo.showing);
  app.advance(3000);
  assert.equal(logo.showing, ev(app, 'Playback.current().logo'));
  assert.notEqual(logo.style.visibility, 'hidden');
  const r0 = reqs(app);
  app.press(KEYS.RIGHT, 0);
  assert.equal(logo.showing, first, 'not at once');
  assert.notEqual(logo.style.visibility, 'hidden');
  assert.equal(reqs(app) - r0, 0);
});
