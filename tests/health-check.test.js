'use strict';
// Channels are shown as the provider lists them — DEC-2026-10-26-show-as-is (owner: «Может, просто
// канал не прятать, а показывать, как будто он рабочий… Не нужно принимать решение и прятать его, нужно
// отдавать как есть»). Before it, a background sweep hid every channel whose stream answered the
// provider's "removed" clip for 6 h (7 Israeli channels vanished on the TV on 2026-10-26, 14:00–22:00).
// The subscriber key is the provider's business too (owner: «Ключ проверяет сам провайдер. Если ключ
// недействующий, просто место потока вернется на страницу с ошибкой»): the app makes no stream request
// of its own besides the channel it tunes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const NO_KEY = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200000\nhttp://myott.top/system/1/key.ts\n';
const deadStreams = (app) => app.net.route((u) => f.isStream(u), () => ({ body: f.MASTER.ottDead, delay: 50 }));

test('show-as-is: channels whose streams answer the "removed" clip all stay in the menu after 10 min', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  deadStreams(app);
  app.press(KEYS.RIGHT, 3000);                          // the landing check meets the "removed" clip
  app.advance(600000);                                  // well past the old sweep (stable 20 s + 60 s)
  app.press(KEYS.ENTER, 100);
  const rows = app.rows('channels');
  assert.equal(rows.length, 10, 'channels listed: ' + JSON.stringify(rows));
  assert.ok(rows.every((t) => t.indexOf('отключён') < 0), JSON.stringify(rows));
});

test('show-as-is: zapping onto a "removed" channel tunes it, with no skip and no «отключён» message', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  deadStreams(app);
  app.press(KEYS.RIGHT, 0);
  const target = f.streamIdOf(f.lastOpenUrl(app));
  app.advance(5000);
  assert.equal(f.streamIdOf(f.lastOpenUrl(app)), target, 'the app stepped away from the channel');
  assert.ok((app.text('banner') || '').indexOf('отключён') < 0, app.text('banner'));
  assert.ok((app.text('toast') || '').indexOf('отключён') < 0, app.text('toast'));
});

test('show-as-is: steady playback makes no background stream requests (old sweep: one per channel)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 50 }));
  const playing = f.streamIdOf(f.lastOpenUrl(app));
  app.advance(600000);
  const others = app.net.requests((r) => f.isStream(r.url) && f.streamIdOf(r.url) !== playing);
  assert.equal(others.length, 0, 'stream requests for channels not playing: ' + others.length);
});

test('show-as-is: a stream answering the provider\'s "no key" clip is tuned; the app adds no key message of its own', () => {
  const app = f.ottApp({ channels: 5, boot: false });
  app.net.route((u) => f.isStream(u), () => ({ body: NO_KEY, delay: 50 }));
  app.boot();
  app.advance(5000);
  assert.ok(f.lastOpenUrl(app), 'nothing was tuned');
  const shown = (app.text('banner') || '') + ' ' + (app.text('toast') || '');
  assert.ok(!/ключ/i.test(shown), shown);
});
