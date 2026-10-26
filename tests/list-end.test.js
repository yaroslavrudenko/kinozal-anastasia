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

test('list end: the menu says how many channels are below the page, and «Конец списка» on the last page', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(2000);
  app.press(KEYS.ENTER, 50);
  for (let i = 0; i < 40; i++) app.press(KEYS.UP, 10);       // the first channel of «Все каналы»
  const v = app.ctx.ListView.shown('channels');
  assert.equal(v.total - v.first - v.count, 30 - 13);
  assert.equal(app.text('channels-more'), '▼ ещё 17 каналов · CH− — дальше');
  app.press(KEYS.CH_DOWN, 50);
  assert.equal(app.text('channels-more'), '▼ ещё 4 канала · CH− — дальше');
  app.press(KEYS.CH_DOWN, 50);
  assert.equal(app.text('channels-more'), 'Конец списка');
});
