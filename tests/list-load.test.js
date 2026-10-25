'use strict';
// P-B — loading the channel list. docs/PERFORMANCE.md target:
//   parses per load: 2 → 1; no localStorage write (the ~1 MB offline copy) before the first frame.
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('./fixtures');
const { KEYS } = require('./harness');

const LIST_CHANNELS = 400;          // the provider serves ~389 channels (~445 KB)
// Decision FP-2026-10-25 (NC-2): the offline copy is recognised by its CONTENT — a storage write that
// holds the names of the list's first and last channels — not by its size: the plan deliberately keeps
// a compact copy (about 1/11 of the raw list), which the old "≥ half the body" rule could never see.
function listCopyWrites(app) {
  const names = Object.values(JSON.parse(app.fixture.list.body)).map((c) => c.channel_name);
  const first = JSON.stringify(names[0]).slice(1, -1), last = JSON.stringify(names[names.length - 1]).slice(1, -1);
  return app.storage.writes().filter((w) => w.value.indexOf(first) >= 0 && w.value.indexOf(last) >= 0);
}
// "Все каналы" count shown in the channel menu (the menu is opened and closed again).
function allChannelsCount(app) {
  app.press(KEYS.ENTER, 100);
  const row = app.rows('groups').find((t) => t.indexOf('Все каналы') === 0);
  app.press(KEYS.BACK, 100);
  return row ? +row.slice('Все каналы'.length) : 0;
}

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
  const copies = listCopyWrites(app);
  assert.ok(copies.length > 0, 'no offline copy was written at all (the content check found nothing)');
  const early = copies.filter((w) => w.seq < firstPlay.seq);
  assert.equal(early.length, 0, 'list copies written before the first play(): ' + early.map((w) => w.key + ' ' + w.size).join(', '));
});

test('P-B (pin): with the server down, the next launch restores every channel from the offline copy and plays', () => {
  const first = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS }));
  first.advance(60000);
  const relaunch = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS, listDown: true, storage: Object.fromEntries(first.storage.raw) }));
  relaunch.advance(3000);
  assert.equal(allChannelsCount(relaunch), LIST_CHANNELS);
});

test('P-B (pin): the offline copy of the list does not contain the subscriber key', () => {
  const app = f.untilPlaying(f.ottApp({ channels: LIST_CHANNELS }));
  app.advance(60000);
  const copies = listCopyWrites(app);
  assert.ok(copies.length > 0, 'no offline copy was written');
  assert.deepEqual(copies.filter((w) => w.value.indexOf(f.FAKE_KEY) >= 0).map((w) => w.key), []);
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

// ---------- verification round 2026-10-25 (verify/codex.md Q2 #8, Q3 backoff) ----------
test('offline copy: an M3U list saved by an older version (playlistText) is used when the server is down', () => {
  const text = f.m3uPlaylist(5);
  const app = f.m3uApp({ channels: 5, listDown: true, storage: { playlistText: JSON.stringify(text) } });
  f.untilPlaying(app, 15000);
  app.advance(2000);
  assert.equal(allChannelsCount(app), 5);
});

test('list retries: with the server down and no saved copy, at most 12 list requests in 30 minutes (shortest jitter)', () => {
  const app = f.ottApp({ listDown: true, random: () => 0 });
  app.advance(1800000);
  const n = app.net.requests((r) => f.isList(r.url)).length;
  assert.ok(n <= 12, 'list requests in 30 min: ' + n);
});
