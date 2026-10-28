'use strict';
// «⚙ Настройки» and «ℹ О программе» are two rows of the menu and two screens (owner 2026-10-28: «вынести настройки в
// отдельное меню — у нас "Настройки" и отдельно "О программе", чтобы не мешать всё вместе»).
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

function openRow(app, name) {
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 40 && (app.cursorRow('groups') || '').indexOf(name) !== 0; i++) app.press(KEYS.DOWN, 10);
  assert.equal((app.cursorRow('groups') || '').indexOf(name), 0, 'no menu row ' + name);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'), name + ' did not open');
}
const names = (app) => JSON.parse(JSON.stringify(app.ctx.Channels.groups().map((g) => g.name)));

test('settings/about: the menu ends with «📡 Провайдеры», «⚙ Настройки», «ℹ О программе» — neither counts as a provider group', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  assert.deepEqual(names(app).slice(-3), ['📡 Провайдеры', '⚙ Настройки', 'ℹ О программе']);
  const n = app.ctx.Channels.providerGroupCount();
  const special = app.ctx.Channels.groups().filter((g) => g.search || g.all || g.fav || g.pinned || g.sources || g.settings || g.about).length;
  assert.equal(n, app.ctx.Channels.groups().length - special);
});

test('settings/about: «⚙ Настройки» holds only the settings — no dedication, no app facts, no author; Back returns to the menu', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  openRow(app, '⚙ Настройки');
  assert.equal(app.text('about-title'), '⚙ Настройки');
  const table = app.text('about-table') || '';
  for (const s of ['Язык интерфейса', 'Картинка во весь экран', 'Быстрое переключение']) assert.ok(table.indexOf(s) >= 0, s + ' missing: ' + table);
  for (const s of ['Версия', 'Автор', 'Ярослав Руденко']) assert.ok(table.indexOf(s) < 0, s + ' should be in «ℹ О программе»: ' + table);
  assert.equal(app.document.getElementById('about-dedication').style.display, 'none');
  app.press(KEYS.BACK, 300);
  assert.ok(!app.visible('about') && app.visible('guide'), 'Back did not return to the menu');
});

test('settings/about: «ℹ О программе» holds the dedication, the version and the author — and no settings', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  openRow(app, 'ℹ О программе');
  assert.equal(app.text('about-title'), 'ℹ О программе');
  const table = app.text('about-table') || '';
  for (const s of ['Версия', 'Автор', 'Ярослав Руденко']) assert.ok(table.indexOf(s) >= 0, s + ' missing: ' + table);
  for (const s of ['Язык интерфейса', 'Картинка во весь экран', 'Быстрое переключение']) assert.ok(table.indexOf(s) < 0, s + ' should be in «⚙ Настройки»: ' + table);
  assert.notEqual(app.document.getElementById('about-dedication').style.display, 'none');
  assert.match(app.text('about-hint') || '', /профиль автора/);
});

test('settings/about: opening «⚙ Настройки» after «ℹ О программе» hides the dedication again and shows the settings hint', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  openRow(app, 'ℹ О программе');
  app.press(KEYS.BACK, 300);
  app.press(KEYS.BACK, 300);
  openRow(app, '⚙ Настройки');
  assert.equal(app.text('about-title'), '⚙ Настройки');
  assert.equal(app.document.getElementById('about-dedication').style.display, 'none');
  assert.match(app.text('about-hint') || '', /переключить/);
});
