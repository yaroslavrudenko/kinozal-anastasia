'use strict';
// P-A / P-F — zapping with ◀ ▶. docs/PERFORMANCE.md targets:
//   P-A requests per zap burst of 10 presses: ~21 (~2 MB) → ≤ 3, stale requests cancelled
//   P-F pause or archive started within 350 ms of a zap is kept (0 overrides)
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const PRESSES = 10;
const PRESS_GAP_MS = 100;           // a viewer holding / tapping ▶ quickly

// Boots, plays the first channel, then presses ▶ PRESSES times and lets everything settle.
function zapBurst() {
  const app = f.untilPlaying(f.ottApp({ channels: 30 }));
  app.advance(2000);
  const fromSeq = app.seq();
  for (let i = 0; i < PRESSES; i++) app.press(KEYS.RIGHT, PRESS_GAP_MS);
  const lastPressSeq = app.events.filter((e) => e.type === 'key').pop().seq;
  app.advance(3000);
  const finalId = f.streamIdOf(f.lastOpenUrl(app));
  const burst = app.net.requests((r) => r.sendSeq > fromSeq && (f.isGuide(r.url) || f.isStream(r.url)));
  return { app, fromSeq, lastPressSeq, finalId, burst };
}

test('P-A: a burst of 10 ▶ presses sends at most 3 network requests (target ≤ 3, baseline ~21)', () => {
  const { burst } = zapBurst();
  assert.ok(burst.length <= 3, 'requests during the burst: ' + burst.length + '\n' + burst.map((r) => r.url).join('\n'));
});

test('P-A: requests for channels zapped past are cancelled (aborted) or never sent', () => {
  const { burst, finalId } = zapBurst();
  const stale = burst.filter((r) => (f.streamIdOf(r.url) || f.guideIdOf(r.url)) !== finalId);
  const notAborted = stale.filter((r) => !r.aborted);
  assert.equal(notAborted.length, 0, 'stale requests left running: ' + notAborted.map((r) => r.url).join(', '));
});

// At most 2 opens: P-K lets the first press open at once; after that only the channel stopped on.
test('P-A (pin): a burst does not open every channel passed — at most 2 opens, the last one is where the viewer stopped', () => {
  const { app, fromSeq } = zapBurst();
  const opens = app.av.calledAfter('open', fromSeq);
  assert.ok(opens.length >= 1 && opens.length <= 2, 'opens during the burst: ' + opens.length);
  const finalName = JSON.parse(app.fixture.list.body)[f.streamIdOf(f.lastOpenUrl(app))].channel_name;
  assert.equal(app.text('b-title').split('   ·   ')[0], finalName, 'the banner and the opened stream disagree');
});

test('P-F: ⏯ pressed within 350 ms of a zap keeps the pause (the pending zap does not reopen the stream)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10, guideLatency: 10, streamLatency: 10 }));
  app.advance(2000);
  app.press(KEYS.RIGHT, 100);
  const pauseSeq = app.seq();
  app.press(KEYS.PLAY_PAUSE, 0);
  app.advance(2000);
  const reopened = app.av.calledAfter('open', pauseSeq);
  assert.equal(reopened.length, 0, 'stream reopened after pause: ' + reopened.map((c) => c.args[0]).join(', '));
});

test('P-F: an archive show picked within 350 ms of a zap keeps playing (the pending zap does not switch to live)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10, guideLatency: 10, streamLatency: 10 }));
  app.advance(2000);
  app.press(KEYS.RIGHT, 30);         // zap; its guide arrives in 10 ms
  app.press(KEYS.DOWN, 30);          // programme panel
  app.press(KEYS.UP, 30);            // previous show (already over → archive)
  app.press(KEYS.ENTER, 0);
  app.advance(2000);
  const url = f.lastOpenUrl(app);
  assert.ok(f.archiveStartOf(url) !== null, 'the player ended on ' + url + ' instead of the archive');
});

test('P-K: a single ▶ press starts opening the next channel at once (no fixed 350 ms wait)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(2000);
  const keySeq = app.seq();
  const pressedAt = app.clock.now;
  app.press(KEYS.RIGHT, 0);
  app.advanceUntil(() => app.av.calledAfter('open', keySeq).length > 0, 2000, 5);
  const open = app.av.calledAfter('open', keySeq)[0];
  assert.ok(open && open.at - pressedAt <= 50, 'open() ' + (open ? open.at - pressedAt + ' ms' : 'never') + ' after the press');
});

test('P-M: zapping writes nothing to localStorage on the key path (target 0 writes per zap)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(2000);
  const keySeq = app.seq();
  app.press(KEYS.RIGHT, 0);
  app.advance(1000);
  const writes = app.storage.writes().filter((w) => w.seq > keySeq);
  assert.equal(writes.length, 0, 'writes: ' + writes.map((w) => w.key).join(', '));
});
