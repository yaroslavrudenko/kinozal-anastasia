'use strict';
// Logos ahead of the viewer (owner, 2026-10-28: «хотелось бы по возможности не видеть, как дозагружаются иконки … чтобы
// визуально казалось, что всё загрузилось, а на самом деле всё загружается как нам надо: частями, не всё сразу»;
// «навигация максимально мягкая, smooth, без дерганий, залипаний и торможений»; DEC-2026-10-28-logos-ahead):
//  - no dwell: the pictures ahead of the cursor load while keys are held too;
//  - a rolling window: the page on screen, two pages ahead the way the cursor moves, one behind;
//  - the zap group's logos trickle in at idle after the first picture — before the menu is ever opened — paused for
//    LOGO_ZAP_PAUSE_MS after every zap so the stream starts first; a group highlighted in the menu goes first;
//  - paced: at most LOGO_STARTS_PER_SLOT downloads start per idle slot (never in a key's task), at most
//    LOGO_PUTS_PER_FRAME pictures go into rows per frame; rows of a screen nobody sees get no src.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const rows = (app) => app.document.getElementById('channels').children.filter((r) => r.style.visibility !== 'hidden');
const logo = (app, num) => ev(app, 'Channels.byNum(' + num + ').logo');
const asked = (app, url) => app.images.requests.some((r) => r.url === url);
// An app playing its first channel; trickle: false turns the zap group's trickle off (its wish is dropped) to pin the window alone.
function boot(opts) {
  const o = Object.assign({ channels: 200, trickle: true }, opts);
  const app = f.ottApp(Object.assign({}, o, { boot: false }));
  if (!o.trickle) vm.runInContext('var __noGroup = Logos.want; Logos.want = function (who) { if (who !== "group") return __noGroup.apply(this, arguments); };', app.ctx);
  app.boot();
  return f.untilPlaying(app);
}

test('logos ahead: no dwell — CH− held at 150 ms asks for the pages ahead of the cursor while the key is held', () => {
  const app = boot({ trickle: false });
  app.advance(5000);
  app.press(KEYS.ENTER, 3000);
  const n = rows(app).length;
  for (let i = 0; i < 4; i++) app.press(KEYS.CH_DOWN, 150);
  const first = Number(rows(app)[0].children[0].textContent);       // the page the cursor reached with the 4th key
  assert.ok(asked(app, logo(app, first + n)), 'the next page was not asked for while the key was held');
});

test('logos ahead: the window — the page on screen, two pages ahead the way the cursor moves, one behind; nothing beyond', () => {
  const app = boot({ trickle: false });
  app.advance(5000);
  app.press(KEYS.ENTER, 3000);
  const n = rows(app).length;
  for (let i = 0; i < 3; i++) app.press(KEYS.CH_DOWN, 3000);       // on page 4 (first row 3n+1), moving down
  const urls = new Set(app.images.requests.map((r) => r.url));
  for (const num of [3 * n + 1, 4 * n + 1, 5 * n + 1, 6 * n - 1, 2 * n + 1]) assert.ok(urls.has(logo(app, num)), 'channel ' + num + ' not asked for');
  assert.ok(!urls.has(logo(app, 6 * n + 2)), 'a third page ahead was asked for');
  app.press(KEYS.CH_UP, 3000);                                      // moving up: the pages above
  assert.ok(asked(app, logo(app, n + 1)) && asked(app, logo(app, 1)), 'the pages above were not asked for');
});

test('logos ahead: the zap group\'s logos trickle in after the first picture, before the menu is opened — none for LOGO_ZAP_PAUSE_MS after a zap — and no row of the hidden menu is given a picture', () => {
  const app = boot();
  const pause = ev(app, 'CONFIG.LOGO_ZAP_PAUSE_MS'), page1 = new Set(Array.from({ length: 14 }, (_, i) => logo(app, i + 1)));
  const beyond = () => app.images.requests.filter((r) => !page1.has(r.url)).length;
  app.advance(pause - 500);
  assert.equal(beyond(), 0, 'the trickle started while the stream was starting');
  const rowWrites = () => app.document.getElementById('channels').children.reduce((s, r) => s + (r.children[1].srcWrites || 0), 0);
  const w0 = rowWrites();
  app.advance(20000);
  assert.equal(ev(app, 'Overlay.mode()'), 'none');
  assert.ok(beyond() >= 150, 'the zap group did not load before the menu opened: ' + beyond());
  assert.equal(rowWrites() - w0, 0, 'rows of the hidden menu were given pictures');
  // A zap: the trickle pauses again (the new stream first).
  app.press(KEYS.ENTER, 300); app.press(KEYS.BACK, 300);
  const r0 = app.images.requests.length;
  vm.runInContext('Logos.want("highlight", Channels.groups()[Channels.allIdx()].items.map(function (i) { return Channels.at(i).logo + "?again"; }));', app.ctx);
  app.press(KEYS.RIGHT, pause - 500);
  assert.equal(app.images.requests.filter((r) => /\?again$/.test(r.url)).length, 0, 'the trickle ran right after a zap');
  app.advance(3000);
  assert.ok(app.images.requests.length - r0 > 0, 'the trickle did not resume');
  // The menu opened: every logo of page 1 and 2 is there in the key's frame.
  app.press(KEYS.ENTER, 0);
  assert.ok(rows(app).every((r) => r.children[1].style.visibility !== 'hidden' && r.children[1].showing), 'the menu opened on empty boxes');
});

test('logos ahead: a group highlighted in the menu has its logos loaded first', () => {
  const app = boot({ trickle: false, channels: 600 });
  app.advance(5000);
  app.press(KEYS.ENTER, 2000);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 4; i++) app.press(KEYS.DOWN, 50);            // a provider group, highlighted
  const name = app.cursorRow('groups') || '';
  const urls = ev(app, '(function (t) { var g = Channels.groups().filter(function (x) { return x.own && t.indexOf(x.name) === 0; })[0]; return g ? g.items.map(function (i) { return Channels.at(i).logo; }) : []; })(' + JSON.stringify(name) + ')');
  assert.ok(urls.length > 4 * 13, 'the group under test is not bigger than the window: ' + name + ' ' + urls.length);
  app.advance(5000);
  assert.deepEqual(urls.filter((u) => !asked(app, u)), [], 'the highlighted group\'s logos were not all loaded');
});

test('logos ahead: paced — at most LOGO_STARTS_PER_SLOT downloads start per idle slot, none in a key\'s task', () => {
  const app = boot();
  vm.runInContext('var __starts = 0, __max = 0, __I = Image; Image = function () { __starts++; return __I(); };' +
    ' var __idle = Util.idle; Util.idle = function (fn, t) { return __idle(function (d) { __starts = 0; fn(d); if (__starts > __max) __max = __starts; }, t); };', app.ctx);
  app.advance(15000);
  app.press(KEYS.ENTER, 2000);
  for (let i = 0; i < 6; i++) app.press(KEYS.CH_DOWN, 150);
  app.advance(5000);
  const max = ev(app, '__max'), per = ev(app, 'CONFIG.LOGO_STARTS_PER_SLOT');
  assert.ok(max >= 1 && max <= per, 'starts in one idle slot: ' + max);
});

test('logos ahead: pictures arriving together go into the rows at most LOGO_PUTS_PER_FRAME per frame', () => {
  const app = boot({ trickle: false, imageDelayMs: 300 });
  app.advance(5000);
  app.press(KEYS.ENTER, 3000);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 4; i++) app.press(KEYS.DOWN, 0);           // a provider group shown: its pictures are not loaded
  const cold = rows(app).filter((r) => !r.children[1].showing || r.children[1].style.visibility === 'hidden').length;
  assert.ok(cold >= 8, 'the group shown has only ' + cold + ' pictures to load');
  const per = ev(app, 'CONFIG.LOGO_PUTS_PER_FRAME'), shown = () => rows(app).filter((r) => r.children[1].showing && r.children[1].style.visibility !== 'hidden').length;
  let prev = shown(), most = 0;
  for (let t = 0; t < 3000; t += 4) { app.advance(4); const now = shown(); most = Math.max(most, now - prev); prev = now; }
  assert.equal(prev, rows(app).length, 'the page never filled');
  assert.ok(most <= per, 'pictures put into rows in one step: ' + most);
});

test('logos ahead: a menu closed while its pictures are on their way gives its hidden rows none of them (batch 3 #1)', () => {
  const app = boot({ trickle: false, imageDelayMs: 600 });
  app.advance(5000);
  app.press(KEYS.ENTER, 3000);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 4; i++) app.press(KEYS.DOWN, 0);           // a group whose pictures start loading now
  app.press(KEYS.BACK, 0);
  assert.equal(ev(app, 'Overlay.mode()'), 'none');
  const writes = () => app.document.getElementById('channels').children.reduce((s, r) => s + (r.children[1].srcWrites || 0), 0);
  const w0 = writes();
  app.advance(3000);
  assert.equal(writes() - w0, 0, 'rows of the closed menu were given pictures');
});
