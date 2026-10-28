'use strict';
// Fix batch 8 (TV, batch 7 against 1.8.4; owner: «новая версия не хуже старой», «регрессия на 100 мс — это уже очень
// плохо»):
//  - R1: no logo is downloaded before the channel list is applied and the first picture is on screen — the boot and the
//    stream start have the network and the thread (a screen of logos opened before any picture still gets them);
//  - R2: a page key sets each row's logo once (not once per fill: a page up fills twice), and writes nothing for a row
//    whose picture and visibility do not change.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const rows = (app) => app.document.getElementById('channels').children.filter((r) => r.style.visibility !== 'hidden');

test('logos at boot: nothing is downloaded before the list is applied and the first picture is up — then they load', () => {
  const app = f.ottApp({ channels: 60, avPrepareMs: 4000, storage: { lastCh: JSON.stringify(['1005', 'X', '', '', '', '', '', 0, 0, 0, 'ott:1005', 5]) } });
  app.advanceUntil(() => ev(app, 'Channels.count()') > 0, 5000, 10);
  app.advanceUntil(() => app.av.calls.some((c) => c.fn === 'open'), 5000, 10);
  app.advance(1500);                                              // the stream is still connecting: the launch banner is up
  assert.ok(!app.av.calls.some((c) => c.fn === 'play'), 'the stream already plays: not the case under test');
  assert.equal(app.images.requests.length, 0, 'logos downloaded before the first picture: ' + app.images.requests.map((r) => r.url).join());
  f.untilPlaying(app);
  app.advance(2000);
  assert.ok(app.images.requests.length > 0, 'no logo after the first picture');
});

test('logos at boot: a menu opened while no picture ever came still gets its logos', () => {
  const app = f.ottApp({ channels: 60, boot: false });
  app.av.prepareFails = true;                                     // the stream never starts: no first picture
  app.boot();
  app.advanceUntil(() => ev(app, 'Channels.count()') > 0, 5000, 10);
  app.advance(2000);
  assert.ok(!app.av.calls.some((c) => c.fn === 'play'), 'the stream plays: not the case under test');
  assert.equal(app.images.requests.length, 0);
  app.press(KEYS.ENTER, 2000);
  assert.ok(app.visible('guide'));
  assert.ok(rows(app).length >= 12 && rows(app).every((r) => r.children[1].showing && r.children[1].style.visibility !== 'hidden'), 'the menu has no logos');
});

test('logos on a page key: each row\'s logo is set once per key (a page up\'s correcting fill sets none twice) and unchanged rows write nothing', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 200 }));
  app.advance(20000);                                             // the zap group is loaded in the background
  app.press(KEYS.ENTER, 2000);
  const col = app.document.getElementById('channels');
  col.clientHeight = 840;                                         // 12 rows of 70 px fit; the pool has 13: page up corrects
  col.children.forEach((r, i) => { r.offsetTop = 70 * i; r.offsetHeight = 70; });
  // Count the visibility writes of every logo <img> (the harness's style is a plain object).
  const imgs = [...col.children, ...app.document.getElementById('groups').children].map((r) => r.children[1]);
  let vis = 0;
  for (const im of imgs) { let v = im.style.visibility; Object.defineProperty(im.style, 'visibility', { get: () => v, set: (x) => { vis++; v = x; }, configurable: true }); }
  const srcs = () => imgs.reduce((s, im) => s + (im.srcWrites || 0), 0);
  for (let i = 0; i < 2; i++) app.press(KEYS.CH_DOWN, 1500);
  const n = 13;
  for (const k of [KEYS.CH_UP, KEYS.CH_DOWN, KEYS.CH_UP]) {
    const s0 = srcs(), v0 = vis;
    app.press(k, 0);
    assert.ok(srcs() - s0 <= n, 'src writes for one page key: ' + (srcs() - s0));
    assert.ok(vis - v0 <= n, 'visibility writes for one page key: ' + (vis - v0));
    // In the key's own frame, a row whose logo is already loaded shows it: the cheaper key path never leaves its box empty.
    const loaded = rows(app).filter((r) => ev(app, 'Logos.ready(Channels.byNum(' + Number(r.children[0].textContent) + ').logo)'));
    assert.ok(loaded.length > 0, 'no row with a loaded logo on this page: not the case under test');
    assert.ok(loaded.every((r) => r.children[1].getAttribute('src') === ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ').logo') &&
      r.children[1].style.visibility !== 'hidden'), 'a loaded logo\'s box is empty in the key\'s frame');
    app.advance(1500);
    assert.ok(rows(app).every((r) => r.children[1].showing === ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ').logo')), 'a row without its logo');
  }
  const s1 = srcs(), v1 = vis;
  app.press(KEYS.UP, 0);                                          // the cursor moves inside the page (a page up left it on the last row): no logo changes
  assert.equal(srcs() - s1, 0, 'src writes for ▲ inside the page');
  assert.equal(vis - v1, 0, 'visibility writes for ▲ inside the page');
});

test('logos at boot, no signal: from the 4th failed attempt the menu laid out ahead gets its page\'s logos, so it opens full', () => {
  const app = f.ottApp({ channels: 60, boot: false });
  app.av.prepareFails = true;                                     // the stream never starts: no first picture
  app.boot();
  app.advanceUntil(() => ev(app, 'Channels.count()') > 0, 5000, 10);
  app.advance(2000);                                              // the silent retries: the stream keeps the network
  assert.equal(app.images.requests.length, 0, 'logos downloaded during the silent retries');
  app.advance(20000);                                             // «no signal»: the menu is laid out ahead, hidden
  assert.ok(ev(app, 'Overlay.isNone()'), 'an overlay opened: not the case under test');
  assert.ok(app.images.requests.length >= 12, 'the hidden menu loaded no logos: ' + app.images.requests.length);
  app.press(KEYS.ENTER, 0);
  assert.ok(app.visible('guide'));
  assert.ok(rows(app).length >= 12 && rows(app).every((r) => r.children[1].showing && r.children[1].style.visibility !== 'hidden'),
    'the menu opened with an empty logo box');
});
