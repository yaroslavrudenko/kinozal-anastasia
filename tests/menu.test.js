'use strict';
// The channel menu, overlays and the remote's key map (plan §6.2 pins; verify/codex.md Q2 #5–#6;
// verify/mad_react…md N1) and the owner's "playing" marker (added to this batch 2026-10-25).
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const OVERLAYS = ['guide', 'prog', 'scrub', 'search', 'about', 'setup'];
const IL_NAMES = ['Channel 9', 'Kan 11', 'Keshet 12', 'Reshet 13'];
const playingId = (app) => f.streamIdOf(f.lastOpenUrl(app));
const playingName = (app) => f.ottRecord(app, playingId(app)).channel_name;

// Opens the menu and moves the group cursor to the group whose row starts with `name`.
function browseGroup(app, name) {
  app.press(KEYS.ENTER, 50);
  app.press(KEYS.LEFT, 50);
  for (let i = 0; i < 20; i++) app.press(KEYS.UP, 10);
  for (let i = 0; i < 20 && (app.cursorRow('groups') || '').indexOf(name) !== 0; i++) app.press(KEYS.DOWN, 10);
  assert.ok((app.cursorRow('groups') || '').indexOf(name) === 0, 'group not found in the menu: ' + name + ' — ' + JSON.stringify(app.rows('groups')));
}
// Tunes the channel at `index` of the channel column of the browsed group.
function tuneFromGroup(app, index) {
  app.press(KEYS.RIGHT, 50);
  for (let i = 0; i < index; i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 3000);
}

// ---------- zap group (N1) ----------
const ZAP_GROUPS = [
  ['Кино', (app, id) => f.ottRecord(app, id).category.name === 'Кино'],
  ['Израиль', (app, id) => IL_NAMES.indexOf(f.ottRecord(app, id).channel_name) >= 0]
];
for (const [group, belongs] of ZAP_GROUPS) {
  test('zap group: YELLOW on the first favourite keeps ▶ advancing inside «' + group + '»', () => {
    const app = f.untilPlaying(f.ottApp({ channels: 30 }));
    app.advance(2000);
    browseGroup(app, group);
    tuneFromGroup(app, 1);
    const before = playingId(app);
    assert.ok(belongs(app, before), 'the tuned channel is not in ' + group);
    app.press(KEYS.YELLOW, 500);                        // the first favourite: «★ Избранное» appears
    app.press(KEYS.RIGHT, 3000);
    const after = playingId(app);
    assert.notEqual(after, before, '▶ stayed on the same channel');
    assert.ok(belongs(app, after), '▶ left «' + group + '» for ' + f.ottRecord(app, after).channel_name);
  });
}

// ---------- cursor after a refresh (Codex Q2 #6) ----------
test('menu: when a refresh shrinks the list, the open menu still has a highlighted channel and OK tunes it', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 30, config: { PLAYLIST_REFRESH_MS: 60000 } }));
  app.advance(2000);
  app.press(KEYS.ENTER, 50);
  for (let i = 0; i < 20; i++) app.press(KEYS.DOWN, 10);
  app.fixture.list = f.ottChannelList(3);               // the next list has three channels, none of them playing
  app.advance(62000);
  assert.ok(app.cursorRow('channels'), 'no highlighted row: ' + JSON.stringify(app.rows('channels')));
  const fromSeq = app.seq();
  app.press(KEYS.ENTER, 2000);
  const opened = app.av.calledAfter('open', fromSeq).map((c) => f.streamIdOf(c.args[0]));
  assert.ok(opened.length === 1 && f.ottChannelList(3).ids.indexOf(opened[0]) >= 0, 'OK opened: ' + JSON.stringify(opened));
});

// ---------- the "playing" marker (owner feature; class name `playing` until the implementer confirms) ----------
const PLAYING_CLASS = 'playing';
// Tunes the 20th channel of «Все каналы» from the menu; returns { num, name } of the playing channel.
function watch20th() {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(2000);
  app.press(KEYS.ENTER, 50);
  for (let i = 0; i < 19; i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 3000);
  return { app, prefix: { num: app.text('b-num'), name: playingName(app) } };
}
// A row shows the playing channel: same number and name (title decorations ★ / ▶ ignored).
const isPlayingRow = (p) => (r) => r.cells[0] === p.num && r.cells[2].replace(/^★ /, '').replace(/\s+▶$/, '') === p.name;
const marked = (r) => r.classes.indexOf(PLAYING_CLASS) >= 0;
// Every visible row: marked ⇔ it is the playing channel.
function assertMarker(app, column, prefix, where) {
  for (const r of app.rowsDetailed(column)) {
    assert.equal(marked(r), isPlayingRow(prefix)(r), where + ': row "' + r.text + '" classes ' + r.classes.join(' '));
  }
}

test('playing marker: the menu opens with the cursor on the playing channel', () => {
  const { app, prefix } = watch20th();
  app.press(KEYS.ENTER, 50);
  const cur = app.rowsDetailed('channels').find((r) => r.classes.indexOf('focus') >= 0);
  assert.ok(cur && isPlayingRow(prefix)(cur), 'cursor on "' + (cur && cur.text) + '", playing ' + JSON.stringify(prefix));
});

test('playing marker: the playing row is marked, and stays marked when the cursor moves away', () => {
  const { app, prefix } = watch20th();
  app.press(KEYS.ENTER, 50);
  assert.ok(app.rowsDetailed('channels').some((r) => isPlayingRow(prefix)(r) && marked(r)), 'the playing row is not marked');
  app.press(KEYS.DOWN, 10);
  app.press(KEYS.DOWN, 10);
  assertMarker(app, 'channels', prefix, 'cursor two rows below');
  assert.ok(app.rowsDetailed('channels').some(marked), 'the marker disappeared when the cursor moved');
});

test('playing marker: scrolling the virtualised list never leaves the marker on another channel\'s row', () => {
  const { app, prefix } = watch20th();
  app.press(KEYS.ENTER, 50);
  for (let i = 0; i < 12; i++) { app.press(KEYS.DOWN, 10); assertMarker(app, 'channels', prefix, 'down ' + (i + 1)); }
  for (let i = 0; i < 30; i++) { app.press(KEYS.UP, 10); assertMarker(app, 'channels', prefix, 'up ' + (i + 1)); }
  for (let i = 0; i < 19; i++) app.press(KEYS.DOWN, 10);
  assert.ok(app.rowsDetailed('channels').some(marked), 'the marker is missing after scrolling back');
});

test('playing marker: the playing channel is marked in search results', () => {
  const { app, prefix } = watch20th();
  browseGroup(app, '🔍 Поиск');
  app.press(KEYS.RIGHT, 300);
  app.type('search-input', playingName(app).toLowerCase());
  const rows = app.rowsDetailed('search-list');
  assert.ok(rows.some(isPlayingRow(prefix)), 'not found by search: ' + JSON.stringify(rows.map((r) => r.text)));
  assertMarker(app, 'search-list', prefix, 'search results');
});

test('playing marker: the playing channel is marked in «★ Избранное»', () => {
  const { app, prefix } = watch20th();
  app.press(KEYS.YELLOW, 500);
  browseGroup(app, '★ Избранное');
  app.press(KEYS.RIGHT, 50);
  assert.ok(app.rowsDetailed('channels').some((r) => isPlayingRow(prefix)(r) && marked(r)), JSON.stringify(app.rowsDetailed('channels')));
});

// ---------- overlay manager, key map, eligibility (plan §6.2) ----------
test('overlays (pin): at most one overlay is ever on screen', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 30, guideLatency: 10 }));
  app.advance(2000);
  const seq = [KEYS.DOWN, KEYS.UP, KEYS.BACK, KEYS.UP, KEYS.DOWN, KEYS.BACK, KEYS.BACK, KEYS.ENTER, KEYS.LEFT, KEYS.UP, KEYS.UP,
    KEYS.UP, KEYS.RIGHT, KEYS.BACK, KEYS.BACK, KEYS.DOWN, KEYS.ENTER];
  for (const k of seq) {
    app.press(k, 300);
    const open = OVERLAYS.filter((id) => app.visible(id));
    assert.ok(open.length <= 1, 'after key ' + k + ': ' + open.join(' + '));
  }
});

const KEY_MAP = [['DOWN', 'prog'], ['UP', 'scrub'], ['ENTER', 'guide'], ['CH_LIST', 'guide'], ['INFO', 'banner']];
for (const [name, screen] of KEY_MAP) {
  test('key map (pin): ' + name + ' while watching shows «' + screen + '», BACK closes it', () => {
    const app = f.untilPlaying(f.ottApp({ channels: 10 }));
    app.advance(8000);                                  // the launch banner has gone
    app.press(KEYS[name], 100);
    assert.ok(app.visible(screen), screen + ' is not shown');
    if (screen !== 'banner') { app.press(KEYS.BACK, 100); assert.equal(app.visible(screen), false, screen + ' stayed open after BACK'); }
  });
}

test('eligibility (pin): an adult channel is not listed, not found by search and never zapped to', () => {
  const adult = '1003';
  const app = f.untilPlaying(f.ottApp({ channels: 10, list: f.ottChannelList(10, { adultIds: [adult] }) }));
  app.advance(2000);
  const name = f.ottRecord(app, adult).channel_name;
  app.press(KEYS.ENTER, 50);
  assert.ok(app.rows('groups').some((t) => t === 'Все каналы9'), JSON.stringify(app.rows('groups')));
  assert.ok(!app.rows('groups').some((t) => t.indexOf('Для взрослых') === 0), 'the adult group is listed');
  app.press(KEYS.BACK, 50);
  browseGroup(app, '🔍 Поиск');
  app.press(KEYS.RIGHT, 300);
  app.type('search-input', name.toLowerCase());
  assert.deepEqual(app.rows('search-list').filter((t) => t.indexOf(name) >= 0), []);
  app.press(KEYS.BACK, 50);
  app.press(KEYS.BACK, 50);
  for (let i = 0; i < 15; i++) app.press(KEYS.RIGHT, 1200);
  const opened = app.av.calls.filter((c) => c.fn === 'open').map((c) => f.streamIdOf(c.args[0]));
  assert.ok(opened.indexOf(adult) < 0, 'zapped to the adult channel');
});

// ---------- the remembered group (owner bug 2026-10-26: the group and the channel pointer are lost) ----------
// The fixture's «Кино» holds list positions 0, 6, 12, 18, 24: «Дом Кино», «Кино ТВ», «Euronews», «ТНТ», «ICTV».
const inKino = (app, id) => f.ottRecord(app, id).category.name === 'Кино';
// Tunes the 2nd channel of «Кино» («Кино ТВ») from the menu and lets it play long enough to be remembered.
function pickInKino() {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(2000);
  browseGroup(app, 'Кино');
  tuneFromGroup(app, 1);
  app.advance(2000);
  assert.ok(inKino(app, playingId(app)), 'the picked channel is not in «Кино»');
  return app;
}
// The app launched again on the same TV (same storage), e.g. after a power cycle or a return from another app.
function relaunch(app, opts) {
  const again = f.untilPlaying(f.ottApp(Object.assign({ channels: 30, storage: Object.fromEntries(app.storage.raw) }, opts)));
  again.advance(2000);
  return again;
}
// Opens the menu and checks it shows `group` with the cursor on the playing channel (a row on screen); closes it.
function assertMenuOn(app, group, where) {
  app.press(KEYS.ENTER, 50);
  const g = app.cursorRow('groups') || '', prefix = { num: app.text('b-num'), name: playingName(app) };
  const cur = app.rowsDetailed('channels').find((r) => r.classes.indexOf('focus') >= 0);
  app.press(KEYS.BACK, 50);
  assert.ok(g.indexOf(group) === 0, where + ': the menu opened on «' + g + '», expected «' + group + '»');
  assert.ok(cur && isPlayingRow(prefix)(cur), where + ': cursor on "' + (cur && cur.text) + '", playing ' + JSON.stringify(prefix));
}

// The channel title one row below the cursor of the menu as it opens (the channel ▶ should go to next).
function nextInMenu(app) {
  app.press(KEYS.ENTER, 50);
  app.press(KEYS.DOWN, 10);
  const cur = app.rowsDetailed('channels').find((r) => r.classes.indexOf('focus') >= 0);
  app.press(KEYS.BACK, 50);
  return cur.cells[2].replace(/^★ /, '').replace(/\s+▶$/, '');
}

test('remembered group: after a restart the menu opens in the group the channel was picked in, on that channel', () => {
  const first = pickInKino();
  const app = relaunch(first);
  assert.equal(playingId(app), playingId(first), 'the last channel was not restored');
  assertMenuOn(app, 'Кино', 'after a restart');
});

test('remembered group: after a restart ▶ zaps inside that group and the menu opens on the new channel there', () => {
  const app = relaunch(pickInKino());
  const before = playingId(app);
  app.press(KEYS.RIGHT, 3000);
  const after = playingId(app);
  assert.notEqual(after, before, '▶ stayed on the same channel');
  assert.ok(inKino(app, after), '▶ left «Кино» for ' + f.ottRecord(app, after).channel_name);
  assertMenuOn(app, 'Кино', 'after ▶');
});

test('remembered group: browsing another group and closing the menu without a pick keeps the group and the channel', () => {
  const app = pickInKino();
  browseGroup(app, 'Новостные');                     // the playing channel is not in this group
  app.press(KEYS.BACK, 50);
  assertMenuOn(app, 'Кино', 'after browsing «Новостные»');
  browseGroup(app, 'Детские');
  app.press(KEYS.RIGHT, 50);                         // into the channel column (cursor on its first row), no pick
  app.press(KEYS.BACK, 50);
  app.press(KEYS.RIGHT, 3000);
  assert.ok(inKino(app, playingId(app)), '▶ after browsing went to ' + playingName(app));
});

test('remembered group: a channel found by search that is in the group keeps the group', () => {
  const app = pickInKino();
  browseGroup(app, '🔍 Поиск');
  app.press(KEYS.RIGHT, 300);
  app.type('search-input', 'euronews');
  app.press(KEYS.ENTER, 50);                         // into the results
  app.press(KEYS.ENTER, 3000);                       // tune the first result
  assert.equal(playingName(app), 'Euronews');
  assertMenuOn(app, 'Кино', 'after a search pick inside the group');
});

test('remembered group: a channel tuned by number that is not in the group switches to «Все каналы» (menu and ▶)', () => {
  const app = pickInKino();
  app.press(48 + 1, 100);                            // channel number 17: «Інтер», the channel just before «Кино» (18–22)
  app.press(48 + 7, 3000);
  assert.equal(app.text('b-num'), '17');
  assert.ok(!inKino(app, playingId(app)), 'channel 17 is in «Кино»: ' + playingName(app));
  // ▶ walks «Все каналы» by number (the menu is not opened first), also past a «Кино» channel on the way.
  let passedKino = false;
  for (let n = 18; n <= 23; n++) {
    app.press(KEYS.RIGHT, 1500);
    assert.equal(app.text('b-num'), String(n), '▶ did not go to channel ' + n + ' of «Все каналы»: ' + playingName(app));
    passedKino = passedKino || inKino(app, playingId(app));
  }
  assert.ok(passedKino, 'the walk passed no «Кино» channel: the test cannot tell the groups apart');
  assertMenuOn(app, 'Все каналы', 'after a number pick outside the group and ▶');
});

test('remembered group: a group that no longer exists after a restart falls back to «Все каналы» without errors', () => {
  const first = pickInKino();
  const data = JSON.parse(first.fixture.list.body);
  for (const id of Object.keys(data)) if (data[id].category.name === 'Кино') data[id].category = { class: 'c3', name: 'Новостные' };
  const app = relaunch(first, { list: { body: JSON.stringify(data), ids: Object.keys(data) } });
  assertMenuOn(app, 'Все каналы', 'with «Кино» gone');
  const next = nextInMenu(app);
  app.press(KEYS.RIGHT, 3000);
  assert.equal(playingName(app), next, '▶ did not go to the next channel of «Все каналы»');
  assert.deepEqual(app.errors.map((e) => e.label + ': ' + e.error.message), []);
});
