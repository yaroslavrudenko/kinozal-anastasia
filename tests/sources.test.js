'use strict';
// «Источники» (owner, 2026-10-26/27): OTT Club, ten built-in free playlists that cannot be removed, and the
// viewer's own playlists, added and removed on the TV. Groups follow the playlist (no empty group),
// Israeli then Ukrainian channels first, nothing filtered, the key used exactly as entered.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createApp, KEYS } = require('./harness');
const f = require('./fixtures');

const OWN = 'http://my.provider.test/list/own.m3u';
const freeUrl = (app, i) => vm.runInContext('CONFIG.FREE_PROVIDERS[0].playlists[' + i + '].url', app.ctx);
const stored = (app, k) => { const v = app.storage.raw.get(k); return v == null ? null : JSON.parse(v); };
const reloads = (app) => app.events.filter((e) => e.type === 'reload').length;
// Every group the menu lists (no filter here: an empty group shown must fail the tests).
const groups = (app) => JSON.parse(vm.runInContext('JSON.stringify(Channels.groups().filter(function (g) { return !g.search && !g.about && !g.sources; }).map(function (g) { return [g.name, g.items.length]; }))', app.ctx));
const allNames = (app) => JSON.parse(vm.runInContext('JSON.stringify(Channels.groups()[1].items.map(function (i) { return Channels.at(i).name; }))', app.ctx));
function openSources(app) { app.press(KEYS.ENTER, 300); app.press(KEYS.BLUE, 300); assert.ok(app.visible('sources'), '«Источники» did not open'); }

test('sources: one\'s own playlist is added on the TV, listed, and removed by RED pressed twice', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.UP, 100);                              // wraps to «+ Добавить свой плейлист»
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('setup'), 'the link screen did not open');
  app.document.getElementById('key-input').value = OWN;
  app.press(KEYS.ENTER, 600);
  assert.deepEqual(stored(app, 'userPlaylists'), [OWN]);
  assert.equal(stored(app, 'playlistUrl'), OWN);
  assert.equal(stored(app, 'sourceMode'), 'm3u');
  assert.ok(reloads(app) >= 1, 'the app did not start again on the new playlist');

  const app2 = f.untilPlaying(f.ottApp({ channels: 5, storage: { userPlaylists: JSON.stringify([OWN]) } }));
  openSources(app2);
  assert.equal(app2.rows('sources-list').length, 4);
  app2.press(KEYS.UP, 100);
  app2.press(KEYS.UP, 100);                             // the own playlist (above «+ Добавить…»)
  app2.press(KEYS.RED, 100);
  assert.match(app2.cursorRow('sources-list') || '', /ещё раз/);
  app2.press(KEYS.RED, 100);
  assert.deepEqual(stored(app2, 'userPlaylists'), []);
  assert.equal(app2.rows('sources-list').length, 3);
});

// An iptv-org style playlist: guide ids "Name.il@SD", quality and [Not 24/7] in the names, "General;News".
const IPTV_ORG = ['#EXTM3U',
  '#EXTINF:-1 tvg-id="Rai1.it@SD" group-title="General;News",Rai 1 (1080p)', 'http://iptv.example.test/live/1/index.m3u8',
  '#EXTINF:-1 tvg-id="Kan11.il@SD" group-title="General",Kan 11 (1080p)', 'http://iptv.example.test/live/2/index.m3u8',
  '#EXTINF:-1 tvg-id="Inter.ua@SD" group-title="General",Inter (576p)', 'http://iptv.example.test/live/3/index.m3u8',
  '#EXTINF:-1 tvg-id="Channel9.il@SD" group-title="Entertainment",Channel 9 (1080p) [Not 24/7]', 'http://iptv.example.test/live/4/index.m3u8',
  '#EXTINF:-1 tvg-id="Euronews.fr@SD" group-title="News",Euronews English (720p)', 'http://iptv.example.test/live/5/index.m3u8', ''].join('\n');

// url: where the list comes from (iptv-org's or any other); no list's groups are translated (owner, 2026-10-27).
const IPTV_ORG_URL = 'https://iptv-org.github.io/iptv/countries/il.m3u';
function playlistApp(body, url) {
  const app = f.m3uApp({ boot: false, storage: url ? { playlistUrl: JSON.stringify(url) } : {} });
  app.fixture.playlist = body;
  if (url) app.net.route((u) => u === url, () => ({ body: app.fixture.playlist, delay: 100 }));
  app.boot();
  app.advance(3000);
  return app;
}

test('playlists: Israeli channels first, then Ukrainian, then the rest in the playlist\'s order', () => {
  const app = playlistApp(IPTV_ORG);
  assert.deepEqual(allNames(app), ['Kan 11 (1080p)', 'Channel 9 (1080p) [Not 24/7]', 'Inter (576p)', 'Rai 1 (1080p)', 'Euronews English (720p)']);
});

test('playlists: groups come from the playlist (iptv-org ids and "General;News" read right); no channel is filtered', () => {
  const app = playlistApp(IPTV_ORG, IPTV_ORG_URL);
  const g = Object.fromEntries(groups(app));
  assert.equal(g['Все каналы'], 5, JSON.stringify(g));
  assert.equal(g['Израиль'], 2, JSON.stringify(g));
  assert.equal(g['Украина'], 1, JSON.stringify(g));
  assert.equal(g['News'], 2, JSON.stringify(g));         // "General;News" -> News, and "News": the provider's own word
  assert.equal(g['Music'], undefined, 'a group with no channels is shown');
});

test('playlists: no Ukrainian channel -> no «Украина» group', () => {
  const body = IPTV_ORG.split('\n').filter((l, i, a) => l.indexOf('Inter') < 0 && (a[i - 1] || '').indexOf('Inter') < 0).join('\n');
  const app = playlistApp(body);
  const names = groups(app).map((x) => x[0]);
  assert.ok(names.indexOf('Украина') < 0, JSON.stringify(names));
  assert.ok(names.indexOf('Израиль') >= 0, JSON.stringify(names));
});

// Owner: «приложение всегда открывает последний стрим… последняя группа и последний канал». The harness'
// reload is a no-op, so the restart is a new app booted on the same storage.
test('sources: each source keeps its own last channel and group; coming back reopens them', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  // watch a channel picked inside a provider group, so both the last channel and the group are remembered
  vm.runInContext('(function () { var g = Channels.groups(), i = 0; while (!g[i].key || g[i].key.indexOf("grp:") !== 0) i++; Zap.pick(Channels.at(g[i].items[1]), i); })()', app.ctx);
  app.advance(6000);
  const ottLast = stored(app, 'lastCh'), ottGroup = stored(app, 'zapGroup');
  assert.ok(ottLast, 'no last channel was remembered');
  assert.match(String(ottGroup), /^grp:/, 'no provider group was remembered');
  openSources(app);
  app.press(KEYS.DOWN, 100);                            // iptv-org
  app.press(KEYS.ENTER, 300);                           // its playlists
  app.press(KEYS.ENTER, 600);                           // «Весь список»
  assert.equal(stored(app, 'lastCh'), null, 'the free playlist would reopen an OTT Club channel');
  const storage = Object.fromEntries(app.storage.raw);
  const app2 = f.ottApp({ channels: 8, boot: false, storage });
  app2.net.route((u) => u.indexOf('iptv-org.github.io') >= 0, () => ({ body: '#EXTM3U\n#EXTINF:-1,Free 1\nhttp://iptv.example.test/live/1/index.m3u8\n', delay: 100 }));
  app2.boot();
  app2.advance(3000);
  openSources(app2);
  app2.press(KEYS.UP, 100);                             // OTT Club (the free playlist is the current row)
  app2.press(KEYS.ENTER, 600);
  assert.deepEqual(stored(app2, 'lastCh'), ottLast, 'OTT Club\'s last channel was not restored');
  assert.equal(stored(app2, 'zapGroup'), ottGroup, 'OTT Club\'s last group was not restored');
  assert.equal(stored(app2, 'sourceMode'), 'ott');
});


// ---------- review batch 2026-10-27 (performance expert, independent expert, Codex) ----------
const restart = (app, extra) => {                       // the page starting again on the same storage
  const app2 = f.ottApp(Object.assign({ channels: 8, boot: false, storage: Object.fromEntries(app.storage.raw) }, extra || {}));
  app2.net.route((u) => u.indexOf('iptv-org.github.io') >= 0 || u.indexOf('my.provider.test') >= 0,
    () => ({ body: '#EXTM3U\n#EXTINF:-1,Free 1\nhttp://iptv.example.test/live/1/index.m3u8\n', delay: 100 }));
  app2.boot();
  app2.advance(3000);
  return app2;
};

test('review: OK pressed twice on a source keeps the position of the source being left', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  app.press(KEYS.RIGHT, 6000);
  const ottLast = stored(app, 'lastCh');
  openSources(app);
  app.press(KEYS.DOWN, 100);                            // iptv-org
  app.press(KEYS.ENTER, 300);                           // its playlists
  app.press(KEYS.ENTER, 30);
  app.press(KEYS.ENTER, 600);                           // the second OK before the restart
  assert.deepEqual(stored(app, 'lastBySource').ott.ch, ottLast);
});

test('review: adding one\'s own playlist keeps the position of the source being left and does not carry its channel', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  app.press(KEYS.RIGHT, 6000);
  const ottLast = stored(app, 'lastCh');
  openSources(app);
  app.press(KEYS.UP, 100);                              // «+ Добавить свой плейлист»
  app.press(KEYS.ENTER, 300);
  app.document.getElementById('key-input').value = OWN;
  app.press(KEYS.ENTER, 600);
  assert.deepEqual(stored(app, 'lastBySource').ott.ch, ottLast);
  assert.equal(stored(app, 'lastCh'), null, 'the new playlist would reopen an OTT Club channel');
  assert.equal(stored(app, 'playlistUrl'), OWN);
});

test('review: entering the OTT Club key from a playlist switches to OTT Club through the one switch', () => {
  const app = playlistApp(IPTV_ORG);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.BLUE, 300);
  app.press(KEYS.BLUE, 300);                            // the key screen
  app.document.getElementById('key-input').value = 'NEWKEY77';
  app.press(KEYS.ENTER, 600);
  assert.equal(stored(app, 'ottKey'), 'NEWKEY77');
  assert.equal(stored(app, 'sourceMode'), 'ott');
  assert.ok(stored(app, 'lastBySource')['user:' + f.M3U_URL] !== undefined, 'the playlist\'s position was not kept');
});

test('review: a playlist set up before «Источники» (or built in) is listed there and marked as current', () => {
  const app = playlistApp(IPTV_ORG);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.BLUE, 300);
  const rows = app.rows('sources-list');
  assert.equal(rows.length, 4, JSON.stringify(rows));
  assert.ok(rows.some((r) => /сейчас/.test(r) && /playlist\.example\.test/.test(r)), JSON.stringify(rows));
});

test('review: removing the playlist being watched switches away and leaves no saved position for it', () => {
  const app = f.ottApp({ channels: 5, storage: { userPlaylists: JSON.stringify([OWN]), sourceMode: '"m3u"', playlistUrl: JSON.stringify(OWN) }, boot: false });
  app.net.route((u) => u === OWN, () => ({ body: '#EXTM3U\n#EXTINF:-1,Own 1\nhttp://iptv.example.test/live/1/index.m3u8\n', delay: 50 }));
  app.net.route((u) => u.indexOf('http://iptv.example.test/') === 0, () => ({ body: f.MASTER.ottAlive, delay: 50 }));
  app.boot();
  f.untilPlaying(app);
  openSources(app);                                     // the cursor is on the current (own) playlist
  app.press(KEYS.RED, 100);
  app.press(KEYS.RED, 600);
  assert.deepEqual(stored(app, 'userPlaylists'), []);
  assert.equal(stored(app, 'sourceMode'), 'ott');
  assert.equal((stored(app, 'lastBySource') || {})['user:' + OWN], undefined);
});

test('review: the same link added twice, or a built-in link added as one\'s own, is listed once', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  vm.runInContext('Sources.addUser(' + JSON.stringify(OWN) + '); Sources.addUser(' + JSON.stringify(OWN) + '); Sources.addUser(CONFIG.FREE_PROVIDERS[0].playlists[3].url)', app.ctx);
  assert.deepEqual(stored(app, 'userPlaylists'), [OWN]);
});

test('review: a playlist link typed on the key screen is not taken as a key and says why', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.BLUE, 300);
  app.document.getElementById('key-input').value = 'http://other.provider.test/list.m3u';
  app.press(KEYS.ENTER, 300);
  assert.equal(stored(app, 'ottKey'), f.FAKE_KEY);
  assert.match(app.text('setup-err') || '', /ссылка на список каналов/);
});

test('review: Back on the key screen returns to «Источники» with nothing changed', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.BLUE, 300);
  app.press(KEYS.BACK, 300);
  assert.ok(app.visible('sources'));
  assert.equal(stored(app, 'ottKey'), f.FAKE_KEY);
});

test('review: channel keys keep the playlist\'s own group text (1.8.3 favourites and last channel still match)', () => {
  const app = playlistApp(IPTV_ORG);
  const keys = JSON.parse(vm.runInContext('JSON.stringify(Channels.groups()[1].items.map(function (i) { return Channels.at(i).key; }))', app.ctx));
  assert.ok(keys.indexOf('m3u:Rai1.it@SD|General;News') >= 0, JSON.stringify(keys));
  assert.ok(keys.indexOf('m3u:Kan11.il@SD|General') >= 0, JSON.stringify(keys));
});

test('review: a provider group «XXX» stays the provider\'s group and is not hidden', () => {
  const body = IPTV_ORG + '#EXTINF:-1 tvg-id="Some.us@SD" group-title="XXX",Some (720p)\nhttp://iptv.example.test/live/9/index.m3u8\n';
  const app = playlistApp(body);
  const g = Object.fromEntries(groups(app));
  assert.equal(g['Все каналы'], 6, JSON.stringify(g));
  assert.equal(g['XXX'], 1, JSON.stringify(g));
});

test('review: groups from #EXTGRP are read like group-title', () => {
  const body = ['#EXTM3U', '#EXTINF:-1 tvg-id="A.fr@SD",A (720p)', '#EXTGRP:General;News', 'http://iptv.example.test/live/1/index.m3u8', ''].join('\n');
  const app = playlistApp(body, IPTV_ORG_URL);
  const g = Object.fromEntries(groups(app));
  assert.equal(g['News'], 1, JSON.stringify(g));
});


// Owner, 2026-10-27: «ключ для OTT-клуба отправляется только в плейлист OTT-клуба и не отправляется в другие плейлисты».
// Every address the app reaches: page requests (list, guide, «now», probes) and the streams the player opens.
const outgoing = (app) => app.net.requests(() => true).map((r) => r.url).concat(app.av.calls.filter((c) => c.fn === 'open').map((c) => String(c.args[0])));
test('key privacy: with an OTT Club key saved, a free or own playlist never receives it (list, streams, guide, zaps, switching)', () => {
  const KEY = 'SECRETKEY4242';
  const app = f.m3uApp({ boot: false, storage: { ottKey: JSON.stringify(KEY), sourceMode: '"m3u"', userPlaylists: JSON.stringify([OWN]) } });
  app.fixture.playlist = IPTV_ORG.replace('#EXTM3U', '#EXTM3U url-tvg="http://epg.example.test/guide.xml"');
  app.net.route((u) => u.indexOf('http://epg.example.test/') === 0, () => ({ body: '<tv></tv>', delay: 50 }));
  app.boot();
  f.untilPlaying(app);
  for (let i = 0; i < 4; i++) app.press(KEYS.RIGHT, 4000);   // zaps: streams and their probes
  app.press(KEYS.ENTER, 2000);                           // the menu: «now» lines, logos
  app.press(KEYS.BLUE, 300);
  app.press(KEYS.DOWN, 100);
  app.press(KEYS.ENTER, 600);                            // switch to a free playlist
  const all = outgoing(app);
  assert.ok(all.filter((u) => u.indexOf('http://iptv.example.test/') === 0).length >= 4, 'too few streams opened to judge: ' + JSON.stringify(all));
  const leaked = all.filter((u) => u.indexOf(KEY) >= 0 || /myott|ottclub/i.test(u));
  assert.deepEqual(leaked, [], 'the OTT Club key (or a request to OTT Club) went out from a playlist source');
});

test('key privacy: on OTT Club the key goes only to the OTT Club server', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  for (let i = 0; i < 3; i++) app.press(KEYS.RIGHT, 4000);
  app.press(KEYS.ENTER, 2000);
  const withKey = outgoing(app).filter((u) => u.indexOf(f.FAKE_KEY) >= 0);
  assert.ok(withKey.length > 0, 'no keyed address at all: the test would prove nothing');
  const elsewhere = withKey.filter((u) => u.indexOf(f.OTT + '/') !== 0);
  assert.deepEqual(elsewhere, [], 'the key went to another host');
});


// Owner 2026-10-27 («А если я первый раз установил плеер и запустил — мне он должен предложить выбрать источник»):
// a fresh install opens the choice of source instead of playing at once (replaces Codex R7's auto-play); Back there
// still gives iptv-org's whole list — free out of the box. More: tests/first-launch.test.js.
test('fresh install (no key, no playlist): «📡 Провайдеры» opens to choose; Back plays iptv-org\'s whole list — free out of the box', () => {
  const boot = (storage) => {
    const app = createApp({ storage });
    app.net.route((u) => u.indexOf('iptv-org.github.io') >= 0, () => ({ body: IPTV_ORG, delay: 100 }));
    app.net.route((u) => u.indexOf('http://iptv.example.test/') === 0, () => ({ body: f.MASTER.ottAlive, delay: 50 }));
    app.boot();
    return app;
  };
  const first = boot({});
  first.advance(2000);
  assert.ok(first.visible('sources') && !first.visible('setup'), 'a fresh install does not offer the choice');
  first.press(KEYS.BACK, 1000);
  const app = boot(Object.fromEntries(first.storage.raw));
  f.untilPlaying(app);
  assert.equal(stored(app, 'playlistUrl'), freeUrl(app, 0));
  assert.match(f.lastOpenUrl(app), /^http:\/\/iptv\.example\.test\//);
});

test('key as typed: whatever is typed on the key screen is saved exactly so, spaces included, with no check of the app\'s own', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.BLUE, 300);
  app.document.getElementById('key-input').value = '  abc ';
  app.press(KEYS.ENTER, 600);
  assert.equal(stored(app, 'ottKey'), '  abc ');
});

test('another provider\'s link with a key inside (/playlist/<key>/) is added as a playlist; the OTT Club key stays', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.UP, 100);                               // «+ Добавить свой плейлист»
  app.press(KEYS.ENTER, 300);
  const link = 'http://other.provider.test/playlist/ABCDEF123456/m3u';
  app.document.getElementById('key-input').value = link;
  app.press(KEYS.ENTER, 600);
  assert.equal(stored(app, 'ottKey'), f.FAKE_KEY);
  assert.equal(stored(app, 'playlistUrl'), link);
  assert.equal(stored(app, 'sourceMode'), 'm3u');
});

test('review: an OTT-Club-looking word elsewhere in a link, or a look-alike host, is not taken as an OTT Club key', () => {
  for (const link of ['http://evil.example.test/myott.top/playlist/ABCDEF123456/m3u', 'https://ottclub.other.test/playlist/ABCDEF123456/m3u',
    'https://other.test/?provider=myott&key=ABC123']) {
    const app = f.untilPlaying(f.ottApp({ channels: 5 }));
    openSources(app);
    app.press(KEYS.BLUE, 300);
    app.document.getElementById('key-input').value = link;
    app.press(KEYS.ENTER, 300);
    assert.equal(stored(app, 'ottKey'), f.FAKE_KEY, link);
  }
});

test('review: an OTT Club link on the key screen gives its key', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.BLUE, 300);
  app.document.getElementById('key-input').value = 'http://myott.top/playlist/NEWKEY998877/m3u';
  app.press(KEYS.ENTER, 600);
  assert.equal(stored(app, 'ottKey'), 'NEWKEY998877');
});


// Owner, 2026-10-27: «Источник — это … источник провайдера»; «если он отдаёт отдельно плейлисты … это источник плейлистов».
test('providers: OTT Club, the free iptv-org provider, «+ Добавить провайдера»; iptv-org opens its playlists («Весь список» first); Back returns', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  let rows = app.rows('sources-list');
  assert.equal(rows.length, 3, JSON.stringify(rows));
  assert.match(rows[0], /^OTT Club/);
  assert.match(rows[1], /^iptv-org/);
  assert.match(rows[2], /Добавить провайдера/);
  app.press(KEYS.DOWN, 100);
  app.press(KEYS.ENTER, 300);
  rows = app.rows('sources-list');
  assert.equal(rows.length, 11, JSON.stringify(rows));
  assert.match(rows[0], /^Весь список/);
  assert.match(app.text('sources-title'), /iptv-org/);
  app.press(KEYS.BACK, 300);
  assert.equal(app.rows('sources-list').length, 3);
  assert.match(app.cursorRow('sources-list') || '', /^iptv-org/);
  assert.ok(app.visible('sources'));
});

test('providers: the built-in iptv-org provider and its playlists cannot be removed (RED twice)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  openSources(app);
  app.press(KEYS.DOWN, 100);
  app.press(KEYS.RED, 100);
  app.press(KEYS.RED, 100);
  assert.equal(app.rows('sources-list').length, 3);
  assert.match(app.text('toast') || '', /встроенный/);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.RED, 100);
  app.press(KEYS.RED, 100);
  assert.equal(app.rows('sources-list').length, 11);
});

test('providers: OK on an iptv-org playlist switches to it; its provider row is marked as current', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 5 }));
  app.advance(2000);
  openSources(app);
  app.press(KEYS.DOWN, 100);
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.DOWN, 100);                             // «Израиль»
  app.press(KEYS.ENTER, 600);
  assert.equal(stored(app, 'sourceMode'), 'm3u');
  assert.equal(stored(app, 'playlistUrl'), freeUrl(app, 1));
  assert.equal(stored(app, 'lastCh'), null);
  assert.ok(reloads(app) >= 1);
  const app2 = restart(app);
  openSources(app2);
  assert.match(app2.cursorRow('sources-list') || '', /^iptv-org.*сейчас/);
});

test('menu: a scroll bar shows that the groups column goes on below', () => {
  const body = ['#EXTM3U'].concat([].concat.apply([], Array.from({ length: 40 }, (_, i) => ['#EXTINF:-1 group-title="Group ' + (i + 1) + '",Channel ' + (i + 1), 'http://iptv.example.test/live/' + (i + 1) + '/index.m3u8']))).join('\n') + '\n';
  const app = playlistApp(body);
  app.press(KEYS.ENTER, 300);
  assert.match(app.document.getElementById('groups-bar').className, /\bon\b/);
});

test('providers: with two free providers each lists only its own playlists (review 4, F7: one list of free playlists, filtered per provider)', () => {
  const two = [{ id: 'iptvorg', playlists: [{ id: 'all', url: 'https://iptv-org.github.io/iptv/index.m3u' }, { id: 'il', url: 'https://iptv-org.github.io/iptv/countries/il.m3u' }] },
    { id: 'freetv', playlists: [{ id: 'news', url: 'https://free-tv.example.test/news.m3u' }] }];
  const app = createApp({ config: { FREE_PROVIDERS: two } });
  const rows = JSON.parse(vm.runInContext('JSON.stringify(Sources.list().filter(function (r) { return r.kind === "free"; })' +
    '.map(function (r) { return [r.id, r.playlists.map(function (p) { return [p.id, p.kind, p.url]; })]; }))', app.ctx));
  assert.deepEqual(rows, [
    ['free:iptvorg', [['free:iptvorg/all', 'freepl', two[0].playlists[0].url], ['free:iptvorg/il', 'freepl', two[0].playlists[1].url]]],
    ['free:freetv', [['free:freetv/news', 'freepl', two[1].playlists[0].url]]]]);
});
