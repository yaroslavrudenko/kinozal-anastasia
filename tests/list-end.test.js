'use strict';
// The list-end line under the menu's channel column and under the search results (owner, 2026-10-26: «неизвестно,
// он кончается на этой странице или нет»): «▼ ещё N каналов · CH− — дальше» while rows remain below the page,
// «Конец списка» on the last page. Here: the Russian plural it uses and the line's text (no layout in the
// harness: a page is the 13 pooled rows). Layout and paging in a real engine: tests/browser/list-end.test.mjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, KEYS } = require('./harness');
const f = require('./fixtures');

const FORMS = ['канал', 'канала', 'каналов'];

test('list end: the Russian plural of «канал» — 1 канал, 2 канала, 5 каналов, 11 каналов, 21 канал', () => {
  const plural = createApp().ctx.Util.plural;
  const cases = [[1, 'канал'], [2, 'канала'], [4, 'канала'], [5, 'каналов'], [11, 'каналов'], [12, 'каналов'], [14, 'каналов'],
    [21, 'канал'], [22, 'канала'], [25, 'каналов'], [101, 'канал'], [111, 'каналов'], [112, 'каналов'], [123, 'канала'], [0, 'каналов']];
  assert.deepEqual(cases.map(([n]) => n + ' ' + plural(n, FORMS)), cases.map(([n, w]) => n + ' ' + w));
});

test('scroll bar: the menu\'s channel bar starts at the top and its thumb reaches the bottom on the last page (no list-end line in the menu)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(2000);
  app.press(KEYS.ENTER, 50);
  for (let i = 0; i < 40; i++) app.press(KEYS.UP, 10);       // the first channel of «Все каналы»
  const bar = () => { const t = app.document.getElementById('channels-bar'); return { on: /\bon\b/.test(t.className), tr: t.children[0].style.transform, h: parseFloat(t.children[0].style.height) }; };
  assert.equal(app.document.getElementById('channels-more'), null);
  let b = bar();
  assert.ok(b.on, 'no bar for 30 channels');
  assert.equal(b.tr, 'translateY(0.00%)');
  app.press(KEYS.CH_DOWN, 50);
  app.press(KEYS.CH_DOWN, 50);
  b = bar();
  const end = 100 * (100 - b.h) / b.h, at = parseFloat(/translateY\(([\d.]+)%\)/.exec(b.tr)[1]);   // the thumb's foot on the track's foot
  assert.ok(Math.abs(at - end) < 1, 'the thumb is not at the bottom: ' + b.tr + ', expected ~' + end.toFixed(2) + '%');
});
