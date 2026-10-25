'use strict';
// Player watchdog, archive position and retry backoff. docs/PERFORMANCE.md targets:
//   P-G watchdog restarts while paused or progressing: > 0 → 0
//   P-E archive position after reconnect / Home: 0 → within a few seconds of the last position
//   P-H content skipped at continuation: buffering time → 0 s
//   P-J retry interval for a repeatedly failing stream: 0.5 s forever → 0.5 s … 15 s backoff
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const POSITION_TOLERANCE_MS = 10000;

// ---------- P-G: the watchdog ----------
for (const suspendState of ['PAUSED', 'PLAYING']) {
  test('P-G: the watchdog does not reopen the stream during a 2-minute pause (AVPlay reports ' + suspendState + ' after suspend)', () => {
    const app = f.untilPlaying(f.ottApp({ avSuspendState: suspendState }));
    app.advance(10000);
    const pauseSeq = app.seq();
    app.press(KEYS.PLAY_PAUSE, 0);
    app.advance(120000);
    const reopened = app.av.calledAfter('open', pauseSeq);
    assert.equal(reopened.length, 0, 'reopened during the pause: ' + reopened.length + '×');
  });
}

test('P-G: the watchdog does not reopen a stream that is rebuffering with visible progress', () => {
  const app = f.untilPlaying(f.ottApp());
  app.advance(10000);
  const fromSeq = app.seq();
  app.av.stalled = true;
  app.av.emit('onbufferingstart');
  for (let pct = 5; pct <= 100; pct += 5) { app.advance(1000); app.av.emit('onbufferingprogress', pct); }
  app.av.stalled = false;
  app.av.emit('onbufferingcomplete');
  app.advance(5000);
  assert.equal(app.av.calledAfter('open', fromSeq).length, 0);
});

test('P-G (pin): the watchdog reopens a live stream whose play time stops advancing', () => {
  const app = f.untilPlaying(f.ottApp());
  app.advance(10000);
  const fromSeq = app.seq();
  app.av.stalled = true;
  app.advance(20000);
  assert.ok(app.av.calledAfter('open', fromSeq).length >= 1);
});

// ---------- archive helpers ----------
// Plays the show before the current one from the programme panel; returns its archive start (ms).
function playPreviousShow(app) {
  app.advance(2000);
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.UP, 50);
  app.press(KEYS.ENTER, 0);
  app.advanceUntil(() => app.av.state === 'PLAYING' && f.archiveStartOf(app.av.url) !== null, 5000, 10);
  const start = f.archiveStartOf(app.av.url);
  assert.ok(start !== null, 'the archive did not start');
  return start;
}
// The playback position the player resumed at after `fromSeq`: a new archive start in the URL plus
// any seek / restore offset applied to that stream.
function resumedPosition(app, fromSeq, programmeStart) {
  const after = app.av.calls.filter((c) => c.seq > fromSeq);
  const open = after.filter((c) => c.fn === 'open').pop();
  const restore = after.filter((c) => c.fn === 'restore').pop();
  const urlStart = f.archiveStartOf((open || restore || {}).args ? (open || restore).args[0] : null);
  const seek = after.filter((c) => c.fn === 'seekTo').pop();
  const offset = seek ? seek.args[0] : (restore && !open ? restore.args[1] || 0 : 0);
  return (urlStart == null ? programmeStart : urlStart) + offset;
}

// ---------- P-E: position kept across reconnect / Home ----------
test('P-E: after a network error, an archive recording resumes near where it was, not from its start', () => {
  const app = f.untilPlaying(f.ottApp({ guideLatency: 10 }));
  const start = playPreviousShow(app);
  app.advance(60000);                                   // 60 s of the recording watched
  const errSeq = app.seq();
  app.av.emit('onerror', 'PLAYER_ERROR_CONNECTION_FAILED');
  app.advance(3000);
  const at = resumedPosition(app, errSeq, start);
  assert.ok(Math.abs(at - (start + 60000)) <= POSITION_TOLERANCE_MS, 'resumed ' + (at - start) / 1000 + ' s into the recording');
});

test('P-E: after returning from Home, an archive recording resumes near where it was, not from 0', () => {
  const app = f.untilPlaying(f.ottApp({ guideLatency: 10 }));
  const start = playPreviousShow(app);
  app.advance(60000);
  const homeSeq = app.seq();
  app.setHidden(true);
  app.advance(5000);
  app.setHidden(false);
  app.advance(3000);
  const at = resumedPosition(app, homeSeq, start);
  assert.ok(Math.abs(at - (start + 60000)) <= POSITION_TOLERANCE_MS, 'resumed ' + (at - start) / 1000 + ' s into the recording');
});

// ---------- P-H: position follows the player, not the wall clock ----------
test('P-H: pause + resume continues from the player position — 30 s of buffering is not counted as watched', () => {
  const app = f.untilPlaying(f.ottApp({ guideLatency: 10 }));
  const start = playPreviousShow(app);
  app.av.stalled = true;
  app.av.emit('onbufferingstart');
  app.advance(10000);                                   // under the 30 s archive buffering limit
  app.av.emit('onbufferingprogress', 50);
  app.advance(10000);
  app.av.stalled = false;
  app.av.emit('onbufferingcomplete');
  app.advance(30000);                                   // 30 s actually played
  const played = app.av.currentTime;                    // what the player really showed
  const pauseSeq = app.seq();
  app.press(KEYS.PLAY_PAUSE, 1000);
  app.press(KEYS.PLAY_PAUSE, 1000);
  const at = resumedPosition(app, pauseSeq, start);
  assert.ok(Math.abs(at - (start + played)) <= 3000, 'resumed at +' + (at - start) / 1000 + ' s; the player had shown ' + played / 1000 + ' s');
});

// ---------- P-J: backoff ----------
test('P-J: a stream that fails seconds after each start is retried with growing delays (0.5 s → ≥ 4 s)', () => {
  const app = f.untilPlaying(f.ottApp());
  const gaps = [];
  for (let i = 0; i < 6; i++) {
    app.advanceUntil(() => app.av.state === 'PLAYING', 30000, 10);
    app.advance(2000);                                  // plays briefly …
    const errSeq = app.seq();
    const errAt = app.clock.now;
    app.av.emit('onerror', 'PLAYER_ERROR_CONNECTION_FAILED');   // … then fails
    app.advanceUntil(() => app.av.calledAfter('open', errSeq).length > 0, 30000, 10);
    gaps.push(app.av.calledAfter('open', errSeq)[0].at - errAt);
  }
  assert.ok(gaps[gaps.length - 1] >= 4000, 'delays before each reopen (ms): ' + gaps.join(', '));
});
