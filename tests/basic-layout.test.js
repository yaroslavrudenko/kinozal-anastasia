'use strict';
// «Вид меню: крупный» — the Basic layout of the channel menu (owner 2026-10-28: «крупные меню … группы в виде больших
// карточек … нажимаешь на карту — весь экран будет списком каналов … иконка, название канала и внизу то, что идёт в
// эфире»; addendum: «Наш источник», «О программе», «Настройки» where the cards are, and a help bar at the bottom).
// A setting in «⚙ Настройки» (Advanced by default), applied at the next opening of the menu; the cards and a group's list
// are two screens of their own. Pins the flows, the keys at the edges, Hebrew, and the logo rules (P-1 … P-4).
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const names = (app) => ev(app, 'Channels.groups().map(function (g) { return g.name; })');
const card = (app) => { const r = app.rowsDetailed('cards-grid').find((x) => x.classes.indexOf('focus') >= 0); return r ? r.cells[2] : null; };
const cards = (app) => app.rowsDetailed('cards-grid').map((x) => x.cells[2]);
const listRows = (app) => app.rowsDetailed('clist-rows');
const listFocus = (app) => { const r = listRows(app).find((x) => x.classes.indexOf('focus') >= 0); return r || null; };
const playingId = (app) => f.streamIdOf(f.lastOpenUrl(app));
const PICK = { CH_UP: 427, CH_DOWN: 428 };

// An app in the Basic layout (the setting stored), playing its first channel.
function basicApp(opts) {
  const o = Object.assign({ channels: 30 }, opts || {});
  o.storage = Object.assign({ menuBasic: 'true' }, o.storage || {});
  const app = f.untilPlaying(f.ottApp(o));
  app.advance(2000);
  return app;
}
// OK on the picture opens the list of the group being watched (O5); Back shows the cards on that group.
function openCards(app) { app.press(KEYS.ENTER, 300); app.press(KEYS.BACK, 300); assert.ok(app.visible('cards'), 'the cards did not open'); }
// On the cards, the focus moved to the card named `name` (reading order, from the first card).
function toCard(app, name) {
  const next = ev(app, 'I18n.rtl()') ? KEYS.LEFT : KEYS.RIGHT;
  for (let i = 0; i < 10; i++) app.press(PICK.CH_UP, 10);
  for (let i = 0; i < 60 && card(app) !== name; i++) app.press(next, 10);
  assert.equal(card(app), name, 'no card ' + name + ': ' + JSON.stringify(names(app)));
}

// ---------- the setting ----------
test('basic: Advanced by default; «Вид меню» is the last row of «⚙ Настройки»; OK switches to Basic (stored, said), Back opens the cards — no restart; only the layout in use is laid out (B7)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 12 }));
  app.advance(2000);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('guide') && !app.visible('cards'), 'Advanced is not the default');
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 40 && !/⚙/.test(app.cursorRow('groups') || ''); i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'));
  app.press(KEYS.UP, 100);                                    // the cursor wraps to the last row
  assert.match(app.cursorRow('about-table') || '', /^Вид меню\s*Подробный$/);
  app.press(KEYS.ENTER, 300);
  assert.match(app.cursorRow('about-table') || '', /^Вид меню\s*Крупный$/);
  assert.equal(app.storage.raw.get('menuBasic'), 'true');
  assert.equal(app.text('toast'), 'Вид меню: крупный');
  app.press(KEYS.BACK, 300);
  assert.ok(app.visible('cards') && !app.visible('guide'), 'Back from the settings did not open the cards');
  assert.equal(card(app), '⚙ Настройки', 'not back on the card the settings were opened from');
  const cls = (id) => app.document.getElementById(id).className;
  assert.ok(/\bready\b/.test(cls('cards')) && /\bready\b/.test(cls('clist')) && /\boff\b/.test(cls('guide')), 'Basic in use: ' + cls('cards') + ' / ' + cls('guide'));
  // A fresh app from this storage opens Basic (its list, O5); switched back, the menu is Advanced again at its next opening.
  const next = f.untilPlaying(f.ottApp({ channels: 12, storage: Object.fromEntries(app.storage.raw) }));
  next.advance(2000);
  next.press(KEYS.ENTER, 300);
  assert.ok(next.visible('clist'), 'a restart lost the setting');
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'));
  app.press(KEYS.UP, 100);
  app.press(KEYS.ENTER, 300);
  assert.equal(app.storage.raw.get('menuBasic'), 'false');
  app.press(KEYS.BACK, 300);
  assert.ok(app.visible('guide') && !app.visible('cards'), 'switched back, the menu did not open in Advanced');
  assert.ok(!/\bready\b/.test(cls('cards')) && !/\bready\b/.test(cls('clist')) && !/\boff\b/.test(cls('guide')), 'Advanced in use: ' + cls('cards') + ' / ' + cls('guide'));
});

test('basic: with Advanced in use the Basic screens are never built nor laid out (no rows, no "ready")', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(5000);
  app.press(KEYS.ENTER, 300);
  for (let i = 0; i < 5; i++) app.press(KEYS.DOWN, 50);
  app.press(KEYS.BACK, 300);
  for (const id of ['cards-grid', 'clist-rows']) assert.equal(app.document.getElementById(id).children.length, 0, id + ' was built');
  for (const id of ['cards', 'clist']) assert.ok(!/\bready\b/.test(app.document.getElementById(id).className), id + ' is laid out');
});

// ---------- the cards ----------
test('basic: the cards are the menu\'s groups in its order — 🔍 first, «📡 Провайдеры», «⚙ Настройки», «ℹ О программе» last — with counts; our cards say what they open; adult hidden', () => {
  const app = basicApp({ list: f.ottChannelList(30, { adultIds: ['1003'] }) });
  openCards(app);
  const all = names(app), seen = [];
  for (let i = 0; i < 10; i++) app.press(PICK.CH_UP, 10);
  for (let i = 0; i < all.length; i++) { seen.push(card(app)); app.press(KEYS.RIGHT, 10); }
  assert.deepEqual(seen, all);
  assert.equal(all[0], '🔍 Поиск');
  assert.deepEqual(all.slice(-3), ['📡 Провайдеры', '⚙ Настройки', 'ℹ О программе']);
  assert.ok(all.indexOf('Для взрослых') < 0, 'the adult group is shown');
  const bySub = Object.fromEntries(app.rowsDetailed('cards-grid').map((r) => [r.cells[2], r.cells[3]]));
  assert.equal(bySub['ℹ О программе'], 'Версия ' + ev(app, 'CONFIG.VERSION'));
  assert.equal(bySub['⚙ Настройки'], 'Язык и вид меню');
  toCard(app, 'Кино');
  const kino = app.rowsDetailed('cards-grid').find((r) => r.cells[2] === 'Кино');
  assert.equal(kino.cells[3], ev(app, 'Channels.groups()[Channels.groupIndex("grp:Кино")].items.length') + ' каналов');
});

test('basic (O5): OK on the picture opens the list of the group ◀ ▶ zap through, on the channel being watched; Back — the cards on that group, also past the first screen; Back — closed', () => {
  const app = basicApp({ channels: 60 });
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('clist') && !app.visible('cards'), 'OK did not open the list');
  assert.equal(app.text('clist-title'), 'Все каналы', 'nothing picked in a group yet: «Все каналы»');
  assert.equal(listFocus(app).cells[0], app.text('b-num'), 'not on the channel being watched');
  app.press(KEYS.BACK, 300);
  toCard(app, 'Спорт');
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.DOWN, 50);
  const want = listFocus(app).cells[0];
  app.press(KEYS.ENTER, 3000);                                // a «Спорт» channel plays: ◀ ▶ zap inside «Спорт»
  assert.ok(!app.visible('cards') && !app.visible('clist'));
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('clist') && app.text('clist-title') === 'Спорт', 'OK did not open «Спорт»');
  assert.equal(listFocus(app).cells[0], want);
  app.press(KEYS.BACK, 300);
  assert.equal(card(app), 'Спорт');
  assert.ok(cards(app).indexOf('🔍 Поиск') < 0, 'the window did not move past the first screen');
  app.press(KEYS.BACK, 300);
  assert.ok(!app.visible('cards') && !app.visible('clist'), 'Back on the cards did not close');
});

test('basic: cards — ◀ ▶ one card in reading order, ▲ ▼ a row, CH± a screen; the edges stop (nothing wraps); ▼ into a short last row lands on its last card', () => {
  const app = basicApp();
  openCards(app);
  const all = names(app), at = () => all.indexOf(card(app));
  for (let i = 0; i < 10; i++) app.press(PICK.CH_UP, 10);
  assert.equal(at(), 0);
  app.press(KEYS.LEFT, 10); assert.equal(at(), 0, '◀ on the first card moved');
  app.press(KEYS.UP, 10); assert.equal(at(), 0, '▲ on the first row moved');
  app.press(KEYS.RIGHT, 10); assert.equal(at(), 1);
  app.press(KEYS.DOWN, 10); assert.equal(at(), 4);
  app.press(KEYS.UP, 10); assert.equal(at(), 1);
  app.press(PICK.CH_DOWN, 10); assert.equal(at(), Math.min(10, all.length - 1));
  for (let i = 0; i < 10; i++) app.press(PICK.CH_DOWN, 10);
  assert.equal(at(), all.length - 1, 'CH+ did not stop on the last card');
  app.press(KEYS.RIGHT, 10); assert.equal(at(), all.length - 1, '▶ on the last card wrapped');
  app.press(KEYS.DOWN, 10); assert.equal(at(), all.length - 1, '▼ on the last row moved');
  // ▼ from the row above a shorter last row: its last card.
  const lastRow = Math.floor((all.length - 1) / 3);
  if ((all.length - 1) % 3 < 2) {
    for (let i = 0; i < 10; i++) app.press(PICK.CH_UP, 10);
    while (Math.floor(at() / 3) < lastRow - 1) app.press(KEYS.DOWN, 10);
    while (at() % 3 < 2) app.press(KEYS.RIGHT, 10);
    app.press(KEYS.DOWN, 10);
    assert.equal(at(), all.length - 1);
  }
  assert.ok(app.rowsDetailed('cards-grid').length <= 9, 'more than 3 × 3 cards on screen');
});

test('basic: Hebrew — ◀ is the next card (reading right to left), ▶ the previous; in the list ▶ (toward the start) returns to the cards', () => {
  const app = basicApp({ storage: { lang: JSON.stringify('he') } });
  openCards(app);
  const all = names(app), at = () => all.indexOf(card(app));
  for (let i = 0; i < 10; i++) app.press(PICK.CH_UP, 10);
  app.press(KEYS.LEFT, 10); assert.equal(at(), 1);
  app.press(KEYS.RIGHT, 10); assert.equal(at(), 0);
  app.press(KEYS.RIGHT, 10); assert.equal(at(), 0, 'the edge wrapped');
  app.press(KEYS.LEFT, 10);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('clist'));
  app.press(KEYS.LEFT, 100);                                  // ◀ in Hebrew: the next page (owner 2026-10-28 paging)
  assert.ok(app.visible('clist'), '◀ (toward the end in Hebrew) left the list');
  app.press(KEYS.RIGHT, 300);                                 // ▶: the previous page, the first
  app.press(KEYS.RIGHT, 300);                                 // ▶ on the first page: the cards
  assert.ok(app.visible('cards') && at() === 1, '▶ did not return to the same card');
});

// ---------- cards ↔ list ----------
test('basic: OK on «Кино» — its channels full screen, titled «Кино», the cursor on the first; Back — the cards on «Кино»; Back — closed; CH_LIST closes either screen', () => {
  const app = basicApp();
  openCards(app);
  toCard(app, 'Кино');
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('clist') && !app.visible('cards'));
  assert.equal(app.text('clist-title'), 'Кино');
  const kino = ev(app, 'Channels.groups()[Channels.groupIndex("grp:Кино")].items.map(function (i) { return Channels.at(i).name; })');
  const shown = listRows(app).map((r) => r.cells[2]);
  assert.ok(shown.length > 0 && shown.every((t) => kino.some((n) => t.indexOf(n) >= 0)), 'not «Кино» channels: ' + JSON.stringify(shown));
  assert.ok(listFocus(app).cells[2].indexOf(kino[0]) >= 0, 'the cursor is not on the first channel');
  assert.equal(app.text('clist-pos'), '1 / ' + kino.length);
  app.press(KEYS.BACK, 300);
  assert.ok(app.visible('cards') && card(app) === 'Кино', 'Back did not return to the «Кино» card');
  app.press(KEYS.BACK, 300);
  assert.ok(!app.visible('cards') && !app.visible('clist'), 'Back on the cards did not close the menu');
  app.press(KEYS.ENTER, 300);                                 // the list (O5)
  app.press(KEYS.CH_LIST, 300);
  assert.ok(!app.visible('clist'));
  openCards(app);
  app.press(KEYS.CH_LIST, 300);
  assert.ok(!app.visible('clist') && !app.visible('cards'));
});

test('basic: OK on a channel plays it and closes the menu; ◀ ▶ then zap inside that group; the list opened again stands on it, marked ▶', () => {
  const app = basicApp();
  openCards(app);
  toCard(app, 'Кино');
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.DOWN, 50);
  const want = listFocus(app).cells[0];
  app.press(KEYS.ENTER, 3000);
  assert.ok(!app.visible('clist') && !app.visible('cards'));
  assert.equal(app.text('b-num'), want);
  const inKino = (id) => f.ottRecord(app, id).category.name === 'Кино';
  assert.ok(inKino(playingId(app)));
  app.press(KEYS.RIGHT, 3000);
  assert.ok(inKino(playingId(app)), '▶ left «Кино»');
  app.press(KEYS.ENTER, 300);                                 // straight to «Кино»'s list (O5)
  assert.equal(app.text('clist-title'), 'Кино');
  const row = listFocus(app);
  assert.equal(row.cells[0], app.text('b-num'), 'the list did not open on the channel on screen');
  assert.ok(row.classes.indexOf('playing') >= 0 && /▶/.test(row.cells[2]), 'the channel on screen is not marked');
});

test('basic: CH− / CH+ page through a group — every channel is on some page; ▲ ▼ stop at the ends', () => {
  const app = basicApp({ channels: 40 });
  openCards(app);
  toCard(app, 'Все каналы');
  app.press(KEYS.ENTER, 300);
  const total = 40, seen = new Set();
  app.press(KEYS.UP, 10);
  assert.equal(listFocus(app).cells[0], '1', '▲ on the first row moved');
  for (let i = 0; i < 20; i++) { listRows(app).forEach((r) => seen.add(r.cells[0])); app.press(PICK.CH_DOWN, 10); }
  assert.equal(seen.size, total, 'channels never on a page: ' + total + ' vs ' + seen.size);
  assert.equal(listFocus(app).cells[0], String(total));
  app.press(KEYS.DOWN, 10);
  assert.equal(listFocus(app).cells[0], String(total), '▼ on the last row wrapped');
  for (let i = 0; i < 20; i++) app.press(PICK.CH_UP, 10);
  assert.equal(listFocus(app).cells[0], '1');
});

test('basic: 🔍 📡 ⚙ ℹ open their screens; Back returns to the cards on the same card; a channel tuned from search — the next OK opens its list, not 🔍', () => {
  for (const [name, screen] of [['📡 Провайдеры', 'sources'], ['⚙ Настройки', 'about'], ['ℹ О программе', 'about'], ['🔍 Поиск', 'search']]) {
    const app = basicApp();
    openCards(app);
    toCard(app, name);
    app.press(KEYS.ENTER, 300);
    assert.ok(app.visible(screen) && !app.visible('cards'), name + ' did not open ' + screen);
    if (screen === 'search') {
      app.type('search-input', 'Мульт');
      app.press(KEYS.ENTER, 100);
      app.press(KEYS.ENTER, 3000);                            // tunes «Мульт»
      assert.ok(!app.visible('search'));
      app.press(KEYS.ENTER, 300);
      assert.ok(app.visible('clist') && !app.visible('search'), 'after tuning from search OK did not open the list (O5)');
      continue;
    }
    app.press(KEYS.BACK, 300);
    assert.ok(app.visible('cards'), 'Back from ' + screen);
    assert.equal(card(app), name);
  }
});

test('basic (B12): BLUE opens «📡 Провайдеры» from both screens; Back from it returns to the cards on the group the viewer was in', () => {
  const app = basicApp();
  app.press(KEYS.ENTER, 300);                                 // the list of «Все каналы»
  app.press(KEYS.BLUE, 300);
  assert.ok(app.visible('sources'));
  app.press(KEYS.BACK, 300);
  assert.ok(app.visible('cards'));
  assert.equal(card(app), 'Все каналы', 'Back from BLUE landed on another card');
  app.press(KEYS.BLUE, 300);
  assert.ok(app.visible('sources'));
  app.press(KEYS.BACK, 300);
  assert.equal(card(app), 'Все каналы');
});

test('basic: YELLOW in the list adds a favourite (★, toast), the cursor stays on it; the cards gain «★ Избранное»; the last favourite removed inside «★» falls back to «Все каналы»', () => {
  const app = basicApp();
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.DOWN, 50);
  const num = listFocus(app).cells[0];
  app.press(KEYS.YELLOW, 100);
  assert.equal(app.text('toast'), 'Добавлено в избранное');
  assert.equal(listFocus(app).cells[0], num);
  assert.match(listFocus(app).cells[2], /^★ /);
  app.press(KEYS.BACK, 300);
  assert.ok(names(app).indexOf('★ Избранное') >= 0);
  toCard(app, '★ Избранное');
  app.press(KEYS.ENTER, 300);
  assert.equal(app.text('clist-title'), '★ Избранное');
  app.press(KEYS.YELLOW, 100);
  assert.equal(app.text('toast'), 'Убрано из избранного');
  assert.equal(app.text('clist-title'), 'Все каналы', 'the emptied «★» was kept');
  assert.equal(listFocus(app).cells[0], num, 'the focus left the channel (B3)');
  app.press(KEYS.BACK, 300);
  assert.equal(card(app), 'Все каналы');
});

test('basic: an hourly list that shrinks the group keeps a highlighted row in the open list, and OK tunes it', () => {
  const app = basicApp({ config: { PLAYLIST_REFRESH_MS: 60000 } });
  app.press(KEYS.ENTER, 300);
  for (let i = 0; i < 20; i++) app.press(KEYS.DOWN, 10);
  app.fixture.list = f.ottChannelList(3);
  app.advance(62000);
  assert.ok(listFocus(app), 'no highlighted row: ' + JSON.stringify(listRows(app)));
  const seq = app.seq();
  app.press(KEYS.ENTER, 2000);
  const opened = app.av.calledAfter('open', seq).map((c) => f.streamIdOf(c.args[0]));
  assert.ok(opened.length === 1 && f.ottChannelList(3).ids.indexOf(opened[0]) >= 0, 'OK opened: ' + JSON.stringify(opened));
});

test('basic: an adult group switched on in «⚙ Настройки» is a card when Back returns to the cards', () => {
  const app = basicApp({ list: f.ottChannelList(30, { adultIds: ['1003', '1009'] }) });
  openCards(app);
  toCard(app, '⚙ Настройки');
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.DOWN, 100); app.press(KEYS.DOWN, 100);       // language, picture → adult channels
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.BACK, 300);
  assert.ok(names(app).indexOf('Для взрослых') >= 0);
  toCard(app, 'Для');                                         // a provider group by its first word (O1)
});

// ---------- a row: a reduced status banner ----------
test('basic: a row — number, name, «21:00–22:00  <what is on>» in grey under it, «ещё N мин» with the progress under it (O4); the minute tick turns them with no request', () => {
  const app = basicApp();
  app.press(KEYS.ENTER, 300);
  const row = () => app.document.getElementById('clist-rows').children.find((r) => /\bfocus\b/.test(r.className));
  const r = row(), c = ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ')');
  const nowShow = ev(app, 'EPG.shown(' + JSON.stringify(c.id) + ', Date.now()).p');
  const span = ev(app, 'Util.span(' + nowShow.start + ', ' + nowShow.stop + ')');
  assert.equal(r.children[2].children[1].textContent, span + '  ' + nowShow.title);
  const minutesLeft = () => Number((/\d+/.exec(row().children[3].textContent) || [])[0]);
  const left0 = minutesLeft(), pg = r.children[3].children[1];
  assert.equal(pg.className, 'pg', 'the progress is not under «ещё N мин»');
  assert.match(row().children[3].textContent, /^ещё \d+ мин$/);
  assert.equal(left0, Math.ceil((nowShow.stop - app.clock.now) / 60000));
  assert.equal(pg.style.visibility, 'inherit');
  const scale0 = pg.children[0].style.transform;
  // The tick itself: no list render (layout read), no request — only ListRows.tick's time cells.
  vm.runInContext('var __n = { column: 0, tick: 0, net: 0 }, __c = ListView.column, __t = ListRows.tick, __g = Net.get;' +
    ' ListView.column = function () { __n.column++; return __c.apply(this, arguments); }; ListRows.tick = function () { __n.tick++; return __t.apply(this, arguments); };' +
    ' Net.get = function () { __n.net++; return __g.apply(this, arguments); };', app.ctx);
  app.advance(60000 - app.clock.now % 60000 + 1);              // the first minute boundary: NowLines is not due yet
  assert.deepEqual(ev(app, '__n'), { column: 0, tick: 1, net: 0 });
  app.advance(4 * 60000);
  assert.equal(minutesLeft(), left0 - 5, 'the minutes left did not move with the clock');
  assert.notEqual(pg.children[0].style.transform, scale0, 'the progress did not move');
});

test('basic: the help bars — the cards\' and the list\'s keys', () => {
  const app = basicApp();
  openCards(app);
  assert.equal(app.text('cards-hint'), 'OK — открыть · ◀ ▶ ▲ ▼ — выбор · Синяя — провайдеры · Назад — закрыть');
  assert.equal(app.document.getElementById('cards-hint').children.filter((e) => /\bdot b\b/.test(e.className)).length, 1, 'the blue key has no dot');
  app.press(KEYS.ENTER, 300);
  assert.equal(app.text('clist-hint'), 'OK — смотреть · ◀ ▶ — страница · Жёлтая — избранное · Назад — к группам');
  assert.equal(app.document.getElementById('clist-hint').children.filter((e) => /\bdot y\b/.test(e.className)).length, 1, 'the yellow key has no dot');
});

test('basic: desktop clicks — a card opens it, a row plays it', () => {
  const app = basicApp();
  openCards(app);
  const grid = app.document.getElementById('cards-grid');
  const kino = grid.children.find((r) => r.children[2].textContent === 'Кино') || grid.children[1];
  app.runTask('click', () => app.ctx.Overlay.onClick(kino));
  assert.ok(app.visible('clist'));
  const row = app.document.getElementById('clist-rows').children[1], num = row.children[0].textContent;
  app.runTask('click', () => app.ctx.Overlay.onClick(row));
  app.advance(3000);
  assert.ok(!app.visible('clist'));
  assert.equal(app.text('b-num'), num);
});

// ---------- logos ----------
const reqUrls = (app) => app.images.requests.map((r) => r.url);
const rowStates = (app) => app.document.getElementById('clist-rows').children.filter((r) => r.style.visibility !== 'hidden').map((r) => {
  const img = r.children[1], c = ev(app, 'Channels.byNum(' + Number(r.children[0].textContent) + ')');
  return img.style.visibility !== 'hidden' && img.showing ? (img.showing === c.logo ? 'ok' : 'wrong') : 'empty';
});

test('basic logos: the keys that open the cards and the list start no download in their own task; after a dwell on a card its list opens with every logo at once', () => {
  const app = basicApp({ channels: 120 });
  app.advance(8000);
  let n = reqUrls(app).length;
  app.press(KEYS.ENTER, 0);
  assert.equal(reqUrls(app).length, n, 'OK on the picture started a download in its task');
  app.advance(300);
  n = reqUrls(app).length;
  app.press(KEYS.BACK, 0);
  assert.equal(reqUrls(app).length, n, 'Back to the cards started a download in its task');
  app.advance(300);
  toCard(app, 'Детские');
  app.advance(4000);                                          // the dwell: its page loads in idle time
  n = reqUrls(app).length;
  app.press(KEYS.ENTER, 0);
  assert.equal(reqUrls(app).length, n, 'OK on the card started a download in its task');
  assert.deepEqual(rowStates(app).filter((s) => s !== 'ok'), [], 'the list opened with empty boxes: ' + rowStates(app));
});

// The trickles (the zap group's, the cards') are off in these two: what is pinned is the list's own wish.
const NO_TRICKLES = 'var __noTrickle = Logos.want; Logos.want = function (who) { if (who !== "group" && who !== "cards" && who !== "highlight") return __noTrickle.apply(this, arguments); };';
function basicNoTrickles(opts) {
  const o = Object.assign({ channels: 30 }, opts || {}, { boot: false });
  o.storage = Object.assign({ menuBasic: 'true' }, o.storage || {});
  const app = f.ottApp(o);
  vm.runInContext(NO_TRICKLES, app.ctx);
  app.boot();
  f.untilPlaying(app);
  app.advance(2000);
  return app;
}
test('basic logos: the list closed while its pages wait asks for nothing after it closed; while the cards are up no picture is put into the hidden list', () => {
  const app = basicNoTrickles({ channels: 200, imageDelayMs: 2000 });
  app.press(KEYS.ENTER, 0);
  for (let i = 0; i < 6; i++) app.press(PICK.CH_DOWN, 30);
  const listUrls = new Set(ev(app, 'Channels.groups()[Channels.allIdx()].items.slice(60).map(function (i) { return Channels.at(i).logo; })'));
  app.press(KEYS.BACK, 0);
  app.press(KEYS.BACK, 0);
  const t = app.images.requests.length;
  app.advance(10000);
  assert.deepEqual(app.images.requests.slice(t).map((r) => r.url).filter((u) => listUrls.has(u)), [], 'the closed list kept asking');
  const app2 = basicNoTrickles({ channels: 200, imageDelayMs: 1500 });
  app2.press(KEYS.ENTER, 0);
  app2.press(PICK.CH_DOWN, 10);
  app2.press(KEYS.BACK, 0);                                   // the cards, the list's pictures still on their way
  const srcs = () => app2.document.getElementById('clist-rows').children.reduce((s, r) => s + (r.children[1].srcWrites || 0), 0);
  const w = srcs();
  app2.advance(5000);
  assert.equal(srcs(), w, 'a picture was put into the hidden list');
});

test('basic logos (P-1): the list asks for its page, LOGO_AHEAD_ROWS ahead and LOGO_BEHIND_ROWS behind — Advanced\'s 13-row menu the same 13 + 26 + 13 as before', () => {
  const spy = 'var __w = {}, __want = Logos.want; Logos.want = function (who, urls) { __w[who] = urls; return __want.apply(this, arguments); };';
  const app = basicApp({ channels: 200 });
  vm.runInContext(spy, app.ctx);
  app.press(KEYS.ENTER, 300);
  for (let i = 0; i < 30; i++) app.press(KEYS.DOWN, 10);
  const basic = ev(app, '__w.clist()');
  assert.equal(basic.length, ev(app, 'CONFIG.BASIC_ROWS + CONFIG.LOGO_AHEAD_ROWS + CONFIG.LOGO_BEHIND_ROWS'));
  assert.deepEqual(ev(app, '[CONFIG.LOGO_AHEAD_ROWS, CONFIG.LOGO_BEHIND_ROWS]'), [26, 13]);
  const adv = f.untilPlaying(f.ottApp({ channels: 200 }));
  adv.advance(2000);
  vm.runInContext(spy, adv.ctx);
  adv.press(KEYS.ENTER, 300);
  for (let i = 0; i < 30; i++) adv.press(KEYS.DOWN, 10);
  const urls = ev(adv, '__w.channels()'), first = Number(adv.rows('channels').length && adv.rowsDetailed('channels')[0].cells[0]);
  const at = (num) => ev(adv, 'Channels.byNum(' + num + ').logo');
  const expect = [];
  for (let k = 0; k < 13; k++) expect.push(at(first + k));
  for (let k = 0; k < 26; k++) expect.push(at(first + 13 + k));
  for (let k = 0; k < 13; k++) expect.push(first - 1 - k >= 1 ? at(first - 1 - k) : '');
  assert.deepEqual(urls, expect, 'Advanced\'s window changed');
});

test('basic logos (P-2): a consumer Logos does not serve is refused loudly; every consumer of both layouts is served', () => {
  const app = basicApp();
  assert.throws(() => vm.runInContext('Logos.want("nobody", [])', app.ctx), /unknown consumer nobody/);
  app.press(KEYS.ENTER, 300);                                 // the list
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.BACK, 300);                                  // the cards
  app.press(KEYS.DOWN, 50);
  app.advance(5000);
  assert.deepEqual(app.errors, []);
  assert.deepEqual(ev(app, 'Object.keys(Logos)').indexOf('want') >= 0, true);
  // 'clist' and 'cards' were served: their pictures were downloaded.
  const kino = ev(app, 'Channels.groups()[Channels.allIdx()].items.slice(0, 8).map(function (i) { return Channels.at(i).logo; })');
  assert.ok(kino.every((u) => reqUrls(app).indexOf(u) >= 0), 'the list\'s page was never loaded');
});

test('basic logos (P-3): a page of a group, not the whole group — Channels.logos(gi, from, max)', () => {
  const app = basicApp({ channels: 60 });
  assert.equal(ev(app, 'Channels.logos(Channels.allIdx(), null, 6).length'), 6);
  assert.equal(ev(app, 'Channels.logos(Channels.allIdx(), null).length'), 60);
});

// P-4: a trickle longer than LOGO_KEEP used to let go of the first logos it loaded — the page the menu opens on. The app
// starts on channel 50 (remembered by a first app), so the page laid out ahead also holds rows above the channel on
// screen, which the zap group's trickle (from the channel on, forward) never asks for.
for (const layout of ['Advanced', 'Basic']) {
  test('logos (P-4, ' + layout + '): a zap-group trickle longer than LOGO_KEEP keeps the page the menu opens on, and the trickle\'s own first pages', () => {
    const config = { LOGO_KEEP: 30, LOGO_EVICT: 5, LOGO_GROUP_MAX: 80 }, storage = layout === 'Basic' ? { menuBasic: 'true' } : {};
    const seed = f.untilPlaying(f.ottApp({ channels: 100, config, storage }));
    seed.runTask('pick 50', () => vm.runInContext('Zap.pick(Channels.byNum(50))', seed.ctx));
    seed.advance(5000);
    const app = f.untilPlaying(f.ottApp({ channels: 100, config, storage: Object.fromEntries(seed.storage.raw) }));
    app.advance(30000);                                       // the trickle ran through all of its 80
    assert.equal(app.text('b-num'), '50');
    const at = (num) => ev(app, 'Channels.byNum(' + num + ').logo'), ready = (num) => ev(app, 'Logos.ready(' + JSON.stringify(at(num)) + ')');
    assert.ok(ev(app, 'Channels.groups()[Channels.allIdx()].items.filter(function (i) { return Logos.ready(Channels.at(i).logo); }).length') <= 30, 'more kept than LOGO_KEEP');
    const page = app.rowsDetailed(layout === 'Basic' ? 'clist-rows' : 'channels').map((r) => Number(r.cells[0]));   // laid out ahead
    assert.ok(page[0] < 50 && page.indexOf(50) > 0, 'the page laid out ahead does not start above the channel: ' + page);
    const lost = page.concat([1, 2, 3, 4, 5].map((k) => page[page.length - 1] + k)).filter((num) => !ready(num));
    assert.deepEqual(lost, [], 'let go of the opening page or the next one');
    const n = app.images.requests.length, pageUrls = new Set(page.map(at));
    app.press(KEYS.ENTER, 300);                               // Advanced's menu, or Basic's list (O5)
    assert.deepEqual(app.images.requests.slice(n).map((r) => r.url).filter((u) => pageUrls.has(u)), [], 'the opening page was asked for again');
  });
}

test('basic: one overlay at a time across both screens and our screens; no task throws', () => {
  const app = basicApp();
  const ids = ['guide', 'prog', 'scrub', 'search', 'about', 'lang', 'sources', 'setup', 'cards', 'clist'];
  const seq = [KEYS.ENTER, KEYS.RIGHT, KEYS.DOWN, KEYS.ENTER, KEYS.DOWN, KEYS.BACK, KEYS.BACK, KEYS.ENTER, PICK.CH_DOWN, PICK.CH_DOWN, KEYS.ENTER, KEYS.BACK,
    KEYS.ENTER, KEYS.ENTER, KEYS.YELLOW, KEYS.LEFT, KEYS.BLUE, KEYS.BACK, KEYS.BACK];
  for (const k of seq) {
    app.press(k, 200);
    const open = ids.filter((id) => app.visible(id));
    assert.ok(open.length <= 1, 'after key ' + k + ': ' + open.join(' + '));
  }
  assert.deepEqual(app.errors, []);
});


// ---------- the judges' common decision (review of 1.9.4): B-items and the owner's O-items ----------
// A list of `groups` provider groups of `per` channels each, named by `name(g)`.
function groupedList(groups, per, name) {
  const body = JSON.parse(f.ottChannelList(groups * per).body);
  Object.keys(body).forEach((id, i) => { const g = i % groups; body[id].category = { class: 'g' + g, name: name(g) }; });
  return { body: JSON.stringify(body), ids: Object.keys(body) };
}

test('basic logos (B2): the focused card\'s page, then the opening pages of every card one key away — ◀ ▶ ▲ ▼ and CH± — come before the rest of the focused group', () => {
  const app = basicApp({ list: groupedList(24, 12, (g) => 'Группа' + (g < 10 ? '0' : '') + g) });
  vm.runInContext('var __w = {}, __want = Logos.want; Logos.want = function (who, urls) { __w[who] = urls; return __want.apply(this, arguments); };', app.ctx);
  openCards(app);
  toCard(app, 'Группа08');                                    // both cards a screen away are provider groups
  const all = names(app), gi = all.indexOf('Группа08'), rows = ev(app, 'CONFIG.BASIC_ROWS');
  const items = (g) => ev(app, 'Channels.groups()[' + g + '].items.map(function (i) { return Channels.at(i).logo; })');
  const wish = ev(app, '__w.highlight()'), tail = wish.indexOf(items(gi)[rows]);   // the focused group past its first page
  assert.ok(tail > 0, 'the focused group\'s rest is not in the wish');
  for (const d of [-1, 1, -3, 3, -9, 9]) {
    assert.ok(items(gi + d).length >= rows, all[gi + d] + ' has no full page: the check would be empty');
    for (const u of items(gi + d).slice(0, rows)) {
      const at = wish.indexOf(u);
      assert.ok(at >= 0 && at < tail, 'card ' + all[gi + d] + ' (' + d + '): its opening page is ' + (at < 0 ? 'missing' : 'after the focused group\'s rest'));
    }
  }
});

for (const layout of ['Basic', 'Advanced']) {
  test('focus (B3, ' + layout + '): the hourly list drops the channel above the focused one — the focus stays on the same channel, and OK tunes it', () => {
    const app = f.untilPlaying(f.ottApp({ channels: 30, config: { PLAYLIST_REFRESH_MS: 60000 }, storage: layout === 'Basic' ? { menuBasic: 'true' } : {} }));
    app.advance(2000);
    app.press(KEYS.ENTER, 300);
    for (let i = 0; i < 3; i++) app.press(KEYS.DOWN, 10);
    const col = layout === 'Basic' ? 'clist-rows' : 'channels', rows = app.rowsDetailed(col), at = rows.findIndex((r) => r.classes.indexOf('focus') >= 0);
    const chans = ev(app, 'Channels.groups()[Channels.allIdx()].items.map(function (i) { var c = Channels.at(i); return [String(c.num), c.name, c.id]; })');
    const name = (num) => chans.find((c) => c[0] === num)[1], before = name(rows[at].cells[0]), above = chans.find((c) => c[0] === rows[at - 1].cells[0])[2];
    app.fixture.list = f.ottChannelList(30, { skip: [above] });
    app.advance(62000);
    const now = app.rowsDetailed(col).find((r) => r.classes.indexOf('focus') >= 0);
    assert.ok(now && now.cells[2].indexOf(before) >= 0, 'the focus moved from «' + before + '» to ' + (now && now.cells[2]));
    const seq = app.seq();
    app.press(KEYS.ENTER, 2000);
    const opened = app.av.calledAfter('open', seq).map((c) => f.streamIdOf(c.args[0]));
    assert.deepEqual(opened.map((id) => f.ottRecord(app, id).channel_name), [before]);
  });
}

// DOM elements created by the app from here on (the switch's idle layout must leave the next opening nothing to build);
// Logos' Image() downloads are not DOM and are not counted.
function countElements(app) {
  const ce = app.document.createElement, n = { made: 0 };
  app.document.createElement = function (tag) { if (tag !== 'img') n.made++; return ce.call(app.document, tag); };
  return n;
}
test('basic (B4): after the layout is switched, the chosen one is laid out at idle — its next opening creates no element, in both directions', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(5000);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 40 && !/⚙/.test(app.cursorRow('groups') || ''); i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.UP, 100);
  app.press(KEYS.ENTER, 300);                                 // «Вид меню» → Крупный
  app.advance(3000);                                          // idle
  let n = countElements(app);
  app.press(KEYS.BACK, 300);
  assert.ok(app.visible('cards'));
  app.press(KEYS.ENTER, 300);                                 // ⚙ again; the cards' pools exist
  assert.equal(n.made, 0, 'the first Basic opening after the switch built ' + n.made + ' elements');
  const b = f.untilPlaying(f.ottApp({ channels: 30, storage: { menuBasic: 'true' } }));
  b.advance(5000);
  openCards(b);
  toCard(b, '⚙ Настройки');
  b.press(KEYS.ENTER, 300);
  b.press(KEYS.UP, 100);
  b.press(KEYS.ENTER, 0);                                     // «Вид меню» → Подробный, before any idle
  assert.equal(b.document.getElementById('channels').children.length, 0, 'Advanced was built before the switch');
  b.advance(3000);
  n = countElements(b);
  b.press(KEYS.BACK, 300);
  assert.ok(b.visible('guide'));
  assert.equal(n.made, 0, 'the first Advanced opening after the switch built ' + n.made + ' elements');
});

// A canvas that measures every character as 0.6 em, and a card whose name has 512 px (B5).
function fitApp(list, context) {
  const app = f.ottApp({ channels: 30, list, storage: { menuBasic: 'true' }, boot: false });
  const ce = app.document.createElement, n = { canvases: 0 };
  app.document.createElement = function (tag) {
    if (tag !== 'canvas') return ce.call(app.document, tag);
    n.canvases++;
    return { getContext: function () { return context ? { font: '', measureText: function (t) { return { width: t.length * Number(/(\d+)px/.exec(this.font)[1]) * 0.6 }; } } : null; } };
  };
  app.ctx.getComputedStyle = function () { return { fontFamily: 'Stub', fontWeight: '600' }; };
  app.boot();
  f.untilPlaying(app);
  app.advance(2000);
  app.measured = n;
  return app;
}
test('basic (B5): a card name takes the first size it fits on one line — 60, 52, 44, then 36 px for a long single word, never broken; no canvas: measured once', () => {
  const proto = Object.getPrototypeOf(require('./harness').createApp({}).document.body);
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return this.className === 't' ? 512 : 0; } });
  try {
    const names3 = ['Кино', 'Развлекательные', 'Достопримечательности'];
    const app = fitApp(groupedList(3, 6, (g) => names3[g]), true);
    openCards(app);
    const cls = (name) => { toCard(app, name); return app.rowsDetailed('cards-grid').find((r) => r.cells[2] === name).classes; };
    assert.ok(!cls('Кино').some((c) => /^long/.test(c)), '«Кино» is not at 60 px');
    assert.ok(cls('Развлекательные').indexOf('long') >= 0, '«Развлекательные» not at 52 px');
    assert.ok(cls('Достопримечательности').indexOf('longest') >= 0, 'a 21-letter word not at 36 px');
    const none = fitApp(f.ottChannelList(30), false);
    openCards(none);
    for (let i = 0; i < 10; i++) none.press(KEYS.RIGHT, 10);
    assert.equal(none.measured.canvases, 1, 'measured ' + none.measured.canvases + ' times with no canvas');
  } finally { delete proto.clientWidth; }
});

test('basic (B6): the list closed stops its "now" re-reads — Back, Back, and BLUE; while it is open they run', () => {
  const nowReqs = (app) => app.net.requests((r) => f.isList(r.url)).length;
  const span = (app) => ev(app, 'CONFIG.NOW_OPEN_REREAD_MS + CONFIG.NOW_MIN_INTERVAL_MS') + 5000;
  const open = basicApp();
  open.press(KEYS.ENTER, 300);
  let n = nowReqs(open);
  open.advance(span(open));
  assert.ok(nowReqs(open) > n, 'control: no re-read while the list is open');
  for (const close of [[KEYS.BACK, KEYS.BACK], [KEYS.BLUE]]) {
    const app = basicApp();
    app.press(KEYS.ENTER, 300);
    for (const k of close) app.press(k, 300);
    n = nowReqs(app);
    app.advance(span(app));
    assert.equal(nowReqs(app) - n, 0, 'the closed list kept re-reading after ' + close);
  }
});

test('basic (B8): a ▼ in the list costs no more than in the Advanced menu — median of 20 ≤ 1.5 × Advanced + 2 ms, no more layout reads, no element created', () => {
  const proto = Object.getPrototypeOf(require('./harness').createApp({}).document.body), reads = { n: 0 };
  for (const p of ['clientHeight', 'offsetTop', 'offsetHeight']) Object.defineProperty(proto, p, { configurable: true, get() { reads.n++; return undefined; } });
  try {
    const run = (app) => {
      app.press(KEYS.ENTER, 300);
      for (let i = 0; i < 3; i++) app.press(KEYS.DOWN, 50);
      const made = countElements(app), t0 = app.tasks.length, r0 = reads.n;
      for (let i = 0; i < 20; i++) app.press(KEYS.DOWN, 50);
      const ms = app.tasks.slice(t0).filter((t) => t.label === 'key ' + KEYS.DOWN).map((t) => t.ms).sort((a, b) => a - b);
      return { median: ms[10], reads: (reads.n - r0) / 20, made: made.made };
    };
    const adv = run(f.untilPlaying(f.ottApp({ channels: 200 })));
    const bas = run(basicApp({ channels: 200 }));
    assert.ok(bas.median <= 1.5 * adv.median + 2, 'Basic ' + bas.median.toFixed(2) + ' ms vs Advanced ' + adv.median.toFixed(2) + ' ms');
    assert.ok(bas.reads <= adv.reads, 'layout reads per key: Basic ' + bas.reads + ', Advanced ' + adv.reads);
    assert.deepEqual([bas.made, adv.made], [0, 0]);
  } finally { for (const p of ['clientHeight', 'offsetTop', 'offsetHeight']) delete proto[p]; }
});

test('basic (B9): Channels.logos with max 0 gives none (0 is not "the default")', () => {
  const app = basicApp();
  assert.equal(ev(app, 'Channels.logos(Channels.allIdx(), null, 0).length'), 0);
});

test('basic logos (B10): switched to Advanced, the cards\' pending wishes start no download; while Basic is in use they run', () => {
  const only = 'var __w0 = Logos.want; Logos.want = function (who) { if (who === "highlight" || who === "cards") return __w0.apply(this, arguments); };';
  const go = (switchOff) => {
    const app = f.ottApp({ channels: 300, imageDelayMs: 400, storage: { menuBasic: 'true' }, boot: false });
    vm.runInContext(only, app.ctx);
    app.boot(); f.untilPlaying(app); app.advance(2000);
    openCards(app);
    for (let i = 0; i < 3; i++) app.press(KEYS.RIGHT, 20);
    if (switchOff) app.runTask('switch', () => vm.runInContext('BasicMenu.setOn(false)', app.ctx));
    app.advance(500);
    const n = app.images.requests.length;
    app.advance(60000);
    return app.images.requests.length - n;
  };
  assert.ok(go(false) > 0, 'control: no download while Basic is in use');
  assert.equal(go(true), 0, 'Basic\'s wishes kept downloading after the switch');
});

test('basic (B11): the menu asked for before any list exists opens nothing and throws nothing', () => {
  const app = f.ottApp({ channels: 30, listLatency: 20000, storage: { menuBasic: 'true' } });
  app.advance(100);
  for (const name of ['menu', 'cards', 'clist']) app.runTask('open ' + name, () => vm.runInContext('Overlay.open(' + JSON.stringify(name) + ')', app.ctx));
  assert.deepEqual(app.errors.map((e) => e.label + ': ' + e.error.message), []);
  assert.equal(ev(app, 'Overlay.mode()'), 'none');
});

test('basic (O1): a provider group\'s card shows its first word, two where two cards would read the same; our own rows keep their whole name', () => {
  const groupNames = ['Кино HD', 'Музыкальные клипы', 'Музыкальные хиты', 'Спорт / Футбол', 'Детские'];
  const app = basicApp({ list: groupedList(5, 6, (g) => groupNames[g]) });
  openCards(app);
  const seen = new Map();
  for (let i = 0; i < 10; i++) app.press(PICK.CH_UP, 10);
  for (let i = 0; i < 20; i++) { for (const r of app.rowsDetailed('cards-grid')) seen.set(r.cells[2], r.cells[3]); app.press(PICK.CH_DOWN, 10); }
  const labels = [...seen.keys()];
  for (const want of ['Кино', 'Музыкальные клипы', 'Музыкальные хиты', 'Спорт', 'Детские', 'Все каналы', '🔍 Поиск', 'Израиль']) assert.ok(labels.indexOf(want) >= 0, 'no card «' + want + '»: ' + JSON.stringify(labels));
  assert.equal(seen.get('Кино'), '6 каналов');
  toCard(app, 'Кино');
  app.press(KEYS.ENTER, 300);
  assert.equal(app.text('clist-title'), 'Кино HD', 'the list\'s header lost the full name');
});

test('basic (O7): the free channels\' notice — under the free provider in «📡 Провайдеры» and as a row of «ℹ О программе», in every language', () => {
  for (const lang of ['ru', 'uk', 'he', 'en']) {
    const app = basicApp({ storage: { lang: JSON.stringify(lang) } });
    const note = ev(app, 'I18n.t("src.freeNote")');
    app.press(KEYS.ENTER, 300);
    app.press(KEYS.BLUE, 300);
    const free = app.document.getElementById('sources-list').children.find((r) => /\bfree\b/.test(r.className));
    assert.ok(free && free.children[2] && free.children[2].textContent === note, lang + ': no notice under the free provider');
    app.press(KEYS.BACK, 300);
    toCard(app, ev(app, 'I18n.t("g.about")'));
    app.press(KEYS.ENTER, 300);
    assert.ok((app.text('about-table') || '').indexOf(note) >= 0, lang + ': no notice in «ℹ О программе»');
  }
  assert.match(ev(basicApp(), 'I18n.t("src.freeNote")'), /OTT Club/);
});

test('logos (F2, CODEX-1): a later trickle never lets go of the page an earlier trickle\'s list opens on', () => {
  const app = require('./harness').createApp({ config: { LOGO_KEEP: 20, LOGO_EVICT: 5 } });
  const u = (p, n) => Array.from({ length: n }, (_, i) => 'http://logo.test/' + p + i + '.png');
  const page = u('p', 5);
  app.runTask('highlight', () => vm.runInContext('Logos.start(); Logos.want("highlight", ' + JSON.stringify(page.concat(u('t', 10))) + ');', app.ctx));
  app.advance(5000);
  assert.deepEqual(page.filter((x) => !ev(app, 'Logos.ready(' + JSON.stringify(x) + ')')), [], 'control: the page did not load');
  app.runTask('group', () => vm.runInContext('Logos.want("group", ' + JSON.stringify(u('g', 20)) + ');', app.ctx));
  app.advance(10000);
  const asked = new Set(app.images.requests.map((r) => r.url));
  assert.ok(u('g', 20).every((x) => asked.has(x)), 'control: the later trickle did not load');
  assert.deepEqual(page.filter((x) => !ev(app, 'Logos.ready(' + JSON.stringify(x) + ')')), [], 'the earlier trickle\'s opening page was let go');
});

test('logos (F4, CODEX-6): a picture that arrives just before its list is closed is not put into the hidden list; the list drawn again shows it', () => {
  const app = basicNoTrickles({ channels: 200, imageDelayMs: 100 });
  app.press(KEYS.ENTER, 3000);                                // the list, its page loaded
  const srcs = () => app.document.getElementById('clist-rows').children.reduce((s, r) => s + (r.children[1].srcWrites || 0), 0);
  for (let i = 0; i < 6; i++) app.press(PICK.CH_DOWN, 0);      // past the look-ahead: a cold page
  app.advance(110);                                           // its pictures arrived (+101 ms); their frame is at +117 ms
  const w = srcs();
  app.press(KEYS.BACK, 0);                                    // the cards, before that frame
  app.advance(2000);
  assert.equal(srcs(), w, 'a picture was put into the hidden list');
  app.press(KEYS.BACK, 300);                                  // closed; the list again, the same page
  app.press(KEYS.ENTER, 300);
  for (let i = 0; i < 6; i++) app.press(PICK.CH_DOWN, 0);
  app.advance(300);
  assert.deepEqual(rowStates(app).filter((s) => s !== 'ok'), [], 'the page is not shown: ' + rowStates(app));
});

// Owner 2026-10-28: in the Basic list ▶ is the next page and ◀ the previous one (as CH±, held keeps paging); ◀ on the
// first page returns to the cards on this group; ▶ on the last page does nothing; Hebrew mirrors.
for (const lang of ['ru', 'he']) {
  test('basic list paging (' + lang + '): ' + (lang === 'he' ? '◀' : '▶') + ' the next page and ' + (lang === 'he' ? '▶' : '◀') + ' the previous, as CH±; held, it keeps paging; the last page stays; the previous on the first page shows the cards on this group', () => {
    const app = basicApp({ channels: 40, storage: { lang: JSON.stringify(lang) } });
    const NEXT = lang === 'he' ? KEYS.LEFT : KEYS.RIGHT, PREV = lang === 'he' ? KEYS.RIGHT : KEYS.LEFT;
    openCards(app);
    toCard(app, ev(app, 'I18n.t("g.all")'));
    app.press(KEYS.ENTER, 300);
    const first = () => app.rowsDetailed('clist-rows')[0].cells[0], focus = () => listFocus(app).cells[0];
    assert.equal(first(), '1');
    // The same pages as CH−/CH+: one key each way from a twin app.
    const twin = basicApp({ channels: 40, storage: { lang: JSON.stringify(lang) } });
    openCards(twin); toCard(twin, ev(twin, 'I18n.t("g.all")')); twin.press(KEYS.ENTER, 300);
    twin.press(PICK.CH_DOWN, 300);
    app.press(NEXT, 300);
    assert.deepEqual([first(), focus()], [twin.rowsDetailed('clist-rows')[0].cells[0], listFocus(twin).cells[0]], 'the next page is not CH+\'s');
    app.press(NEXT, 300);
    app.press(PREV, 300);                                        // a middle page: back one page, still the list
    twin.press(PICK.CH_DOWN, 300); twin.press(PICK.CH_UP, 300);
    assert.ok(app.visible('clist'));
    assert.deepEqual([first(), focus()], [twin.rowsDetailed('clist-rows')[0].cells[0], listFocus(twin).cells[0]], 'the previous page is not CH−\'s');
    for (let i = 0; i < 10; i++) app.press(NEXT, 80);             // held: a key every 80 ms keeps paging to the end
    const end = focus();
    assert.ok(app.rowsDetailed('clist-rows').some((r) => r.cells[0] === '40'), 'held, it did not page to the last page');
    app.press(NEXT, 300);
    assert.ok(app.visible('clist') && focus() === end, 'the next on the last page did something');
    for (let i = 0; i < 10 && first() !== '1'; i++) { app.press(PREV, 80); assert.ok(app.visible('clist'), 'held back, it left the list before the first page'); }
    assert.equal(first(), '1', 'held back, it did not reach the first page');
    app.press(PREV, 300);
    assert.ok(app.visible('cards') && !app.visible('clist'), 'the previous on the first page did not show the cards');
    assert.equal(card(app), ev(app, 'I18n.t("g.all")'));
  });
}

// Owner 2026-10-28: on the picture (no menu open) the keys are the same in both layouts — ◀ ▶ the previous / next channel,
// ▲ the archive slider, ▼ the programme guide; the ◀ ▶ paging lives only inside the Basic list.
test('basic: on the picture the keys are Advanced\'s — ◀ ▶ zap, ▲ the archive slider, ▼ the programme guide', () => {
  const look = (storage) => {
    const app = f.untilPlaying(f.ottApp({ channels: 30, storage }));
    app.advance(8000);
    const out = {}, id = () => playingId(app);
    let before = id(); app.press(KEYS.RIGHT, 3000); out.right = id() !== before;
    before = id(); app.press(KEYS.LEFT, 3000); out.left = id() !== before;
    app.press(KEYS.UP, 300); out.up = app.visible('scrub'); app.press(KEYS.BACK, 300);
    app.press(KEYS.DOWN, 300); out.down = app.visible('prog'); app.press(KEYS.BACK, 300);
    out.menus = ['cards', 'clist', 'guide'].filter((x) => app.visible(x));
    return out;
  };
  const adv = look({}), bas = look({ menuBasic: 'true' });
  assert.deepEqual(adv, { right: true, left: true, up: true, down: true, menus: [] });
  assert.deepEqual(bas, adv);
});
