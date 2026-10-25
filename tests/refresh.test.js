'use strict';
// Correctness after a channel-list refresh (review §2: `s.playing = -1` → ⏯ TypeError, stale `s.previous`,
// keys dereferencing a channel that is gone). The app refreshes every PLAYLIST_REFRESH_MS; here 60 s.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const REFRESH_MS = 60000;
const errorsOf = (app) => app.errors.map((e) => e.label + ': ' + (e.error && e.error.message));

// Watches the first channel; the next list (served at the refresh) no longer has it.
function refreshedWithoutPlayingChannel() {
  const app = f.untilPlaying(f.ottApp({ channels: 30, config: { PLAYLIST_REFRESH_MS: REFRESH_MS } }));
  const playing = f.streamIdOf(f.lastOpenUrl(app));
  app.fixture.list = f.ottChannelList(30, { skip: [playing] });
  app.advance(REFRESH_MS + 2000);
  return app;
}

const KEYS_AFTER_REFRESH = ['PLAY_PAUSE', 'PLAY', 'PAUSE', 'STOP', 'PREV_CH', 'DOWN', 'UP', 'REWIND', 'INFO', 'YELLOW', 'RIGHT', 'LEFT', 'ENTER', 'BACK'];
for (const name of KEYS_AFTER_REFRESH) {
  test('correctness: after a refresh removed the playing channel, ' + name + ' does not throw', () => {
    const app = refreshedWithoutPlayingChannel();
    assert.deepEqual(errorsOf(app), [], 'errors before the key');
    app.press(KEYS[name], 2000);
    assert.deepEqual(errorsOf(app), []);
  });
}

test('correctness: PREV after a refresh that reordered the list returns to the channel watched before', () => {
  const first = [{ id: 'a1', name: 'Дом Кино', group: 'Кино' }, { id: 'a2', name: 'Мульт', group: 'Детские' },
    { id: 'a3', name: 'Euronews', group: 'Новостные' }];
  const app = f.untilPlaying(f.m3uApp({ channels: first, config: { PLAYLIST_REFRESH_MS: REFRESH_MS } }));
  app.advance(2000);
  app.press(KEYS.RIGHT, 3000);                         // Дом Кино → Мульт
  assert.equal(f.lastOpenUrl(app), f.m3uStreamUrl('a2'));
  app.fixture.playlist = f.m3uPlaylist([{ id: 'n1', name: 'Первый канал', group: 'Национальные' },
    first[2], first[1], first[0]]);
  app.advance(REFRESH_MS);
  app.press(KEYS.PREV_CH, 3000);
  assert.equal(f.lastOpenUrl(app), f.m3uStreamUrl('a1'));
});
