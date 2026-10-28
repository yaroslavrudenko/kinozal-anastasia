'use strict';
// The first launch (owner, 2026-10-27): «А если я первый раз установил плеер и запустил — мне он должен предложить
// выбрать источник — то меню, что мы сделали»; «Если я выбрал ОТТ Клуб — ещё и ввести код». Nothing saved and
// nothing built in: «📡 Провайдеры» opens to choose the source, with nothing playing behind it. A choice starts the
// app on it and from then on it opens the last source as before; Back with no choice starts the free iptv-org
// channels (never nothing); OTT Club with no key asks for the key at once, and Back from there returns to the choice.
// A TV with a key or a playlist built in is not a first launch. (Replaces Codex R7's fresh install that played the
// first free playlist at once.)
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createApp, KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const ALL = 'https://iptv-org.github.io/iptv/index.m3u';
const PL = f.m3uPlaylist(6);
// An app on this device's storage (nothing: a first launch), answering the free playlist, OTT Club and the streams.
function device(storage, opts) {
  const app = createApp(Object.assign({ storage: storage || {} }, opts || {}));
  app.net.route((u) => u === ALL, () => ({ body: PL, delay: 100 }));
  app.net.route((u) => u.indexOf('http://iptv.example.test/') === 0, () => ({ body: f.MASTER.ottAlive, delay: 100 }));
  const list = f.ottChannelList(8);
  app.net.route((u) => f.isList(u), () => ({ body: list.body, delay: 100 }));
  app.net.route((u) => f.isGuide(u), (req) => ({ body: f.ottGuide(f.guideIdOf(req.url)), delay: 100 }));
  app.net.route((u) => f.isStream(u), () => ({ body: f.MASTER.ottAlive, delay: 100 }));
  app.boot();
  app.advance(3000);
  return app;
}
const next = (app) => device(Object.fromEntries(app.storage.raw));      // the app as it starts again, from what was saved
const reloads = (app) => app.events.filter((e) => e.type === 'reload').length;
const opens = (app) => app.av.calls.filter((c) => c.fn === 'open').length;
const title = (app) => app.text('sources-title');

test('first launch: «📡 Провайдеры» opens to choose the source — nothing plays and no list is requested before a choice', () => {
  const app = device();
  assert.equal(app.visible('toast'), false, 'the watching hint is shown over the choice');   // it would still be up 3 s in
  app.advance(30000);
  assert.ok(app.visible('sources'), 'the choice screen did not open');
  assert.equal(title(app), 'Выберите, что смотреть');
  assert.match(app.text('sources-hint'), /Назад — бесплатные каналы iptv-org/);
  assert.equal(opens(app), 0, 'a stream was opened behind the choice');
  assert.equal(app.net.requests().length, 0, 'requests before a choice: ' + JSON.stringify(app.net.requests().map((r) => r.url)));
});

test('first launch: OK on an iptv-org playlist starts it; every later launch opens straight to it, never the choice again', () => {
  const app = device();
  app.press(KEYS.DOWN, 100);                                  // iptv-org
  app.press(KEYS.ENTER, 100);                                 // its playlists
  app.press(KEYS.ENTER, 1000);                                // «Весь список»
  assert.equal(reloads(app), 1, 'the choice did not start the app on it');
  let now = next(app);
  for (let i = 0; i < 2; i++) {
    assert.equal(now.visible('sources'), false, 'the choice screen came back on launch ' + (i + 2));
    assert.ok(f.startedPlaying(now), 'nothing plays on launch ' + (i + 2));
    assert.equal(ev(now, 'Sources.activeId()'), 'free:iptvorg/all');
    now = next(now);
  }
});

test('first launch: Back with no choice starts the free iptv-org channels (never nothing)', () => {
  const app = device();
  app.press(KEYS.BACK, 1000);
  assert.equal(reloads(app), 1);
  const now = next(app);
  assert.equal(now.visible('sources'), false);
  assert.ok(f.startedPlaying(now), 'nothing plays after Back');
  assert.equal(ev(now, 'Sources.activeId()'), 'free:iptvorg/all');
});

test('first launch: OK on OTT Club asks for the key at once; Back returns to the choice; the key typed starts OTT Club with it (its streams)', () => {
  const app = device();
  app.press(KEYS.ENTER, 400);                                 // OTT Club (no key)
  assert.ok(app.visible('setup'), 'the key screen did not open');
  assert.equal(opens(app), 0, 'something plays behind the key screen');
  app.press(KEYS.BACK, 100);
  assert.ok(app.visible('sources'), 'Back from the key screen did not return to the choice');
  assert.equal(title(app), 'Выберите, что смотреть');
  assert.equal(reloads(app), 0, 'Back from the key screen started something');
  app.press(KEYS.ENTER, 400);
  app.type('key-input', f.FAKE_KEY);
  app.press(KEYS.ENTER, 1000);
  assert.equal(reloads(app), 1);
  assert.equal(JSON.parse(app.storage.raw.get('ottKey')), f.FAKE_KEY, 'the key was not saved exactly as typed');
  const now = next(app);
  assert.equal(now.visible('sources'), false);
  assert.ok(now.net.requests((r) => f.isList(r.url)).length >= 1, 'the OTT Club list was not requested');
  assert.ok(f.startedPlaying(now), 'OTT Club does not play');
  assert.ok(f.lastOpenUrl(now).indexOf('/stream/' + f.FAKE_KEY + '/') > 0, 'the stream was not opened with the key typed');
  assert.ok(now.net.requests((r) => r.url.indexOf(f.FAKE_KEY) >= 0).every((r) => r.url.indexOf(f.OTT) === 0), 'the key went to another host');
});

test('first launch: BLUE and «+ Добавить провайдера» on the choice screen also return to it on Back', () => {
  const app = device();
  app.press(KEYS.BLUE, 300);
  assert.ok(app.visible('setup'));
  app.press(KEYS.BACK, 100);
  assert.equal(title(app), 'Выберите, что смотреть');
  for (let i = 0; i < 6; i++) app.press(KEYS.DOWN, 50);      // the last row: «+ Добавить провайдера» (rows wrap)
  app.press(KEYS.UP, 50);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('setup'));
  app.press(KEYS.BACK, 100);
  assert.ok(app.visible('sources'));
  assert.equal(title(app), 'Выберите, что смотреть');
  assert.equal(reloads(app), 0);
});

test('not a first launch: a key built in (OTT_KEY) starts OTT Club, a playlist built in (PLAYLIST_URL) starts it — no choice screen', () => {
  const ott = device({}, { config: { OTT_KEY: f.FAKE_KEY } });
  assert.equal(ott.visible('sources'), false);
  assert.ok(f.startedPlaying(ott));
  assert.equal(ev(ott, 'Sources.mode()'), 'ott');
  const pl = device({}, { config: { PLAYLIST_URL: ALL } });
  assert.equal(pl.visible('sources'), false);
  assert.ok(f.startedPlaying(pl));
  assert.equal(ev(pl, 'Sources.mode()'), 'm3u');
});

test('no source but a last channel saved (a TV once built with a key or a playlist, now built without): the choice opens — nothing requested, no empty own provider, «📡 Провайдеры» reachable (review 4, F1)', () => {
  const lastCh = JSON.stringify(['101', 'Канал 11', '', 'Израиль', '', '', '', 0, 1, 0, 'ott:101', 1]);
  const app = device({ lastCh, lastUrl: JSON.stringify('http://myott.top/stream/OLDKEY/101.m3u8') });
  app.advance(30000);
  assert.ok(app.visible('sources'), 'the choice screen did not open');
  assert.equal(title(app), 'Выберите, что смотреть');
  assert.deepEqual(app.net.requests().map((r) => r.url), [], 'requests with no source chosen');
  assert.equal(app.visible('fatal'), false, 'a fatal screen came up');
  assert.equal(app.storage.raw.get('userPlaylists'), undefined, 'an empty own provider was saved');
  assert.equal(opens(app), 0);
  // The choice works as on a first launch: Back starts the free channels, and the next launch plays them.
  app.press(KEYS.BACK, 1000);
  const now = next(app);
  assert.equal(now.visible('sources'), false);
  assert.ok(f.startedPlaying(now), 'nothing plays after Back');
  assert.equal(ev(now, 'Sources.activeId()'), 'free:iptvorg/all');
  assert.ok(now.net.requests().every((r) => r.url !== '' && r.url.indexOf('index.html') < 0), 'a request to no URL');
});

test('own providers: a link that is empty is never saved as a provider', () => {
  const app = device();
  vm.runInContext('Sources.addUser(""); Sources.addUser(null);', app.ctx);
  assert.equal(app.storage.raw.get('userPlaylists'), undefined);
});

test('first launch: the key prompt for OTT Club says what applies — no «saved key», Back returns to the choice; from «Провайдеры» later it is the usual prompt (review 4, D8)', () => {
  const app = device();
  app.press(KEYS.ENTER, 400);                                 // OTT Club (no key)
  assert.ok(app.visible('setup'));
  assert.equal(app.text('setup-text'), 'Ключ OTT Club. Введите ключ или нажмите «Назад» — вернуться к выбору.');
  app.press(KEYS.BACK, 100);
  assert.equal(title(app), 'Выберите, что смотреть');
  // Not a first launch: the menu → BLUE (Providers) → BLUE (the key).
  const ott = device({}, { config: { OTT_KEY: f.FAKE_KEY } });
  ott.advance(5000);
  ott.press(KEYS.ENTER, 300);
  ott.press(KEYS.BLUE, 300);
  ott.press(KEYS.BLUE, 300);
  assert.ok(ott.visible('setup'));
  assert.match(ott.text('setup-text'), /сохранённый ключ/);
});
