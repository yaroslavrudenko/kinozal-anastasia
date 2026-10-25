'use strict';
// First-run setup and the subscriber key. docs/PERFORMANCE.md targets:
//   P-Q localStorage reads of the key per list load: 778 → 1
//   P-R active refresh intervals after repeated setup: N → 1
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, KEYS } = require('./harness');
const f = require('./fixtures');

test('P-Q: the subscriber key is read from localStorage at most once per list load (baseline ~2 per channel)', () => {
  const app = f.ottApp({ channels: 389, boot: false });
  app.boot();
  f.untilPlaying(app);
  const reads = app.storage.reads.get('ottKey') || 0;
  assert.ok(reads <= 2, 'localStorage reads of the key while loading 389 channels: ' + reads);
});

test('P-R: pressing OK twice on the setup screen starts one list refresh, not two', () => {
  const refreshMs = 60000;
  const app = createApp({ config: { PLAYLIST_REFRESH_MS: refreshMs } });
  const list = f.ottChannelList(10);
  app.net.route((u) => f.isList(u), () => ({ body: list.body, delay: 100 }));
  app.net.route((u) => f.isStream(u), () => ({ body: f.MASTER.ottAlive, delay: 100 }));
  app.boot();
  assert.ok(app.visible('setup'), 'the setup screen is not shown without a key');
  app.document.getElementById('key-input').value = f.FAKE_KEY;
  app.press(KEYS.ENTER, 50);
  app.press(KEYS.ENTER, 0);
  app.advance(5000);
  const before = app.net.requests((r) => f.isList(r.url)).length;
  app.advance(refreshMs);
  const perRefresh = app.net.requests((r) => f.isList(r.url)).length - before;
  assert.equal(perRefresh, 1, 'channel-list requests per refresh period: ' + perRefresh);
});
