'use strict';
// P-B — loading the channel list. docs/PERFORMANCE.md target:
//   parses per load: 2 → 1; no localStorage write (the ~1 MB offline copy) before the first frame.
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('./fixtures');
const { KEYS } = require('./harness');

const LIST_CHANNELS = 400;          // the provider serves ~389 channels (~445 KB)
// A storage write at least half the size of the list body is the offline copy of the list.
const isListCopy = (app) => (w) => w.size >= app.fixture.list.body.length / 2;

test('P-B: the channel list text is parsed once per load (target 1, baseline 2)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS }));
  const body = app.fixture.list.body;
  const parses = app.jsonParses.filter((p) => p.text === body).length;
  assert.equal(parses, 1, 'JSON.parse of the list body: ' + parses);
});

test('P-B: the offline copy of the list is not written to localStorage before the first channel plays', () => {
  const app = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS }));
  app.advance(60000);
  const firstPlay = app.av.calls.find((c) => c.fn === 'play');
  const bigWrites = app.storage.writes().filter(isListCopy(app));
  const early = bigWrites.filter((w) => w.seq < firstPlay.seq);
  assert.equal(early.length, 0, 'large writes before the first play(): ' + early.map((w) => w.key + ' ' + w.size).join(', '));
});

test('P-B (pin): the offline copy of the list is still kept (written within a minute of playback)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS }));
  app.advance(60000);
  assert.ok(app.storage.writes().some(isListCopy(app)), 'no offline copy was written');
});

test('P-B (pin): a list larger than the storage quota still plays, with no uncaught error', () => {
  const app = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS, quotaChars: 200000 }));
  app.advance(60000);
  assert.deepEqual(app.errors.map((e) => e.label + ': ' + e.error.message), []);
});

test('P-B (pin): with a list larger than the quota, the last watched channel still opens on the next launch', () => {
  const quota = { channels: LIST_CHANNELS, quotaChars: 200000 };
  const first = f.untilPlaying(f.ottApp(quota));
  first.advance(2000);
  first.press(KEYS.RIGHT, 3000);
  const watched = f.lastOpenUrl(first);
  const relaunch = f.untilPlaying(f.ottApp(Object.assign({ storage: Object.fromEntries(first.storage.raw) }, quota)));
  assert.equal(f.lastOpenUrl(relaunch), watched);
});
