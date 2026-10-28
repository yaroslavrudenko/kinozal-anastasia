'use strict';
// The interface language is picked from a list (owner, 2026-10-28: «когда ты нажимаешь кнопку на выбор языка, появилось
// какое-то меню или отдельная страница со всеми возможными языками. Я там этот язык выбираю, и он применяется» — one OK
// cycled to the next language, so reaching Ukrainian took several restarts). «⚙ Настройки» → «🌐 Язык интерфейса» → OK
// opens the list: every language written in itself, the current one marked and under the cursor. OK on another
// language applies it (the app starts again in it, on the same channel and group); OK on the current one or Back
// returns to the settings with nothing changed. One OK never changes the language any more.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const langOf = (app) => app.document.documentElement.getAttribute('lang');
const reloads = (app) => app.events.filter((e) => e.type === 'reload').length;
const stored = (app) => (app.storage.raw.has('lang') ? JSON.parse(app.storage.raw.get('lang')) : null);
const withLang = (lang, channels) => f.untilPlaying(f.ottApp({ channels: channels || 8, storage: { lang: JSON.stringify(lang) } }));
const successor = (prev) => f.untilPlaying(f.ottApp({ channels: 12, storage: Object.fromEntries(prev.storage.raw) }));
// The rows of the language list: [name, the name's direction, classes].
const langRows = (app) => app.document.getElementById('lang-list').children.map((r) => [r.children[0].textContent, r.children[0].getAttribute('dir'), r.className.split(/\s+/)]);
function openSettings(app) {
  app.press(KEYS.ENTER, 300);
  app.press(ev(app, 'I18n.rtl()') ? KEYS.RIGHT : KEYS.LEFT, 100);
  for (let i = 0; i < 40 && !/⚙/.test(app.cursorRow('groups') || ''); i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'), 'the settings did not open');
  assert.match(app.cursorRow('about-table') || '', /🌐/, 'the cursor is not on the language row');
}
function openList(app) {
  openSettings(app);
  app.press(KEYS.ENTER, 100);
  assert.ok(app.visible('lang') && !app.visible('about'), 'OK on the language row did not open the language list');
}

test('language list: OK on «🌐 Язык интерфейса» opens the list — four rows, each language in itself, the current one marked and under the cursor; nothing changes yet', () => {
  for (const [lang, cur] of [['ru', 'Русский'], ['uk', 'Українська'], ['he', 'עברית'], ['en', 'English']]) {
    const app = withLang(lang);
    openList(app);
    const rows = langRows(app);
    assert.deepEqual(rows.map((r) => r[0]), ['Русский', 'Українська', 'עברית', 'English'], lang);
    assert.deepEqual(rows.filter((r) => r[2].indexOf('on') >= 0).map((r) => r[0]), [cur], lang + ': the current one is not marked');
    assert.deepEqual(rows.filter((r) => r[2].indexOf('sel') >= 0).map((r) => r[0]), [cur], lang + ': the cursor is not on the current one');
    assert.equal(reloads(app), 0, lang + ': the app restarted');
    assert.equal(stored(app), lang, lang + ': the language changed');
    assert.equal(app.text('lang-title'), ev(app, 'I18n.t("st.language")'), lang);
  }
});

test('language list: from English ▼ ▼ OK on «Українська» — Ukrainian applied once; the app starts again in it on the same channel in the same group', () => {
  let app = withLang('en', 12);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 4; i++) app.press(KEYS.DOWN, 50);         // a provider group
  app.press(KEYS.RIGHT, 100);
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.ENTER, 2500);                                // a channel picked in it: the zap group
  const want = ev(app, '[Playback.current().key, Channels.groups()[Zap.group()].key]');
  assert.ok(/^grp:/.test(want[1]), 'not a provider group: ' + want[1]);
  openList(app);
  app.press(KEYS.DOWN, 50);                                   // English → Русский (the list wraps)
  app.press(KEYS.DOWN, 50);                                   // → Українська
  assert.match(app.cursorRow('lang-list') || '', /Українська/);
  app.press(KEYS.ENTER, 1000);
  assert.equal(stored(app), 'uk');
  assert.equal(reloads(app), 1);
  app = successor(app);
  assert.deepEqual([langOf(app)].concat(ev(app, '[Playback.current().key, Channels.groups()[Zap.group()].key]')), ['uk'].concat(want));
});

test('language list: Back returns to «⚙ Настройки» on the language row with nothing changed — also after moving the cursor', () => {
  const app = withLang('ru');
  openList(app);
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.BACK, 1000);
  assert.ok(app.visible('about') && !app.visible('lang'), 'Back did not return to the settings');
  assert.match(app.cursorRow('about-table') || '', /🌐/);
  assert.equal(stored(app), 'ru');
  assert.equal(reloads(app), 0);
  // Opened again: the cursor is back on the current language.
  app.press(KEYS.ENTER, 100);
  assert.match(app.cursorRow('lang-list') || '', /Русский/);
});

test('language list: OK on the current language returns to «⚙ Настройки» — no restart, nothing written', () => {
  const app = withLang('he');
  openList(app);
  const writes = app.storage.raw.get('lang');
  app.press(KEYS.ENTER, 1000);
  assert.ok(app.visible('about') && !app.visible('lang'));
  assert.equal(app.storage.raw.get('lang'), writes);
  assert.equal(reloads(app), 0);
});

test('language list: a double OK on another language switches once (one language, one restart)', () => {
  const app = withLang('ru');
  openList(app);
  app.press(KEYS.DOWN, 50);                                   // Українська
  app.press(KEYS.ENTER, 50);
  app.press(KEYS.DOWN, 50);                                   // the list still on screen until the restart: עברית
  app.press(KEYS.ENTER, 50);
  app.advance(1000);
  assert.equal(stored(app), 'uk', 'a second OK before the restart changed the language again');
  assert.equal(reloads(app), 1);
});

test('language list: each language\'s name is laid out in its own direction — «עברית» right to left, the others left to right, in Russian and in Hebrew', () => {
  for (const lang of ['ru', 'he']) {
    const app = withLang(lang);
    openList(app);
    assert.deepEqual(langRows(app).map((r) => [r[0], r[1]]), [['Русский', 'ltr'], ['Українська', 'ltr'], ['עברית', 'rtl'], ['English', 'ltr']], lang);
    assert.deepEqual(app.document.getElementById('lang-list').children.map((r) => r.children[0].getAttribute('lang')), ['ru', 'uk', 'he', 'en'], lang);
  }
});

test('language list: the settings row says OK opens the list, not «next», in every language', () => {
  const app = withLang('ru');
  const states = ev(app, 'I18n.table()["st.languageState"]');
  assert.ok(states.every((s) => !/следующ|наступн|הבאה|next/.test(s)), JSON.stringify(states));
});
