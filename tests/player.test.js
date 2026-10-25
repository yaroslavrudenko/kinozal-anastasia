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
// The state AVPlay reports after pause() / suspend() is unverified on the TV (docs §7), so both are run.
for (const state of ['PAUSED', 'PLAYING']) {
  test('P-G: the watchdog does not reopen the stream during a 2-minute pause (AVPlay reports ' + state + ' after pause/suspend)', () => {
    const app = f.untilPlaying(f.ottApp({ avSuspendState: state, avPauseState: state }));
    app.advance(10000);
    const pauseSeq = app.seq();
    app.press(KEYS.PLAY_PAUSE, 0);
    app.advance(120000);
    const reopened = app.av.calledAfter('open', pauseSeq);
    assert.equal(reopened.length, 0, 'reopened during the pause: ' + reopened.length + '×');
  });

  // Implementer's mutation survivor (watchdog "paused" guard): a paused stream is not a failure, so the
  // TV's failure log gets no line during the pause either.
  test('P-G: the watchdog logs no failure during a 2-minute pause (AVPlay reports ' + state + ' after pause/suspend)', () => {
    const app = f.untilPlaying(f.ottApp({ avSuspendState: state, avPauseState: state }));
    app.advance(10000);
    const failLog = () => JSON.parse(app.storage.raw.get('failLog') || '[]');
    app.advance(120000);                                 // flush anything logged before the pause
    const before = failLog().length;
    app.press(KEYS.PLAY_PAUSE, 0);
    app.advance(120000);
    app.press(KEYS.PLAY_PAUSE, 0);                       // resume, then let the log flush
    app.advance(120000);
    assert.deepEqual(failLog().slice(before), [], 'failures logged around the pause');
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
  app.press(KEYS.PLAY_PAUSE, 1000);
  app.press(KEYS.PLAY_PAUSE, 0);
  // Decision FP-2026-10-25 (NC-2): a native pause/resume (no reopen, no seek) is valid. The moment on
  // screen is read from the media clock — recording start (URL) + player time — whichever way it resumed.
  app.advanceUntil(() => app.av.state === 'PLAYING', 5000, 10);
  app.advance(5000);
  const at = f.shownArchiveMs(app);
  const expected = start + played + 5000;
  assert.ok(at !== null && Math.abs(at - expected) <= 3000,
    'on screen +' + (at - start) / 1000 + ' s after resume; expected +' + (expected - start) / 1000 + ' s (shown ' + played / 1000 + ' s, then 5 s)');
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

// ---------- verification round 2026-10-25 (verify/codex.md Q2 #4, Q3; verify/mad_react…md N3) ----------
test('P-E: after the network comes back, an archive recording resumes near where it was, not from 0', () => {
  const app = f.untilPlaying(f.ottApp({ guideLatency: 10 }));
  const start = playPreviousShow(app);
  app.advance(60000);
  const before = f.shownArchiveMs(app);
  app.network('GATEWAY_DISCONNECTED');
  app.network('GATEWAY_CONNECTED');
  app.advanceUntil(() => app.av.state === 'PLAYING', 5000, 10);
  app.advance(1000);
  const at = f.shownArchiveMs(app);
  assert.ok(Math.abs(at - before) <= POSITION_TOLERANCE_MS, 'before +' + (before - start) / 1000 + ' s, after the reconnect +' + (at - start) / 1000 + ' s');
});

test('live pause → resume → error → end of recording: continues (once), never logs "stream ended"', () => {
  const app = f.untilPlaying(f.ottApp());
  app.advance(5000);
  app.press(KEYS.PLAY_PAUSE, 10000);                    // a live pause turns the channel into its archive
  app.press(KEYS.PLAY_PAUSE, 5000);                     // resumed in place
  const errSeq = app.seq();
  app.av.emit('onerror', 'PLAYER_ERROR_CONNECTION_FAILED');
  app.advanceUntil(() => app.av.calledAfter('open', errSeq).length > 0 && app.av.state === 'PLAYING', 30000, 10);
  const endSeq = app.seq();
  app.av.emit('onstreamcompleted');
  app.advance(120000);                                  // the fail log is flushed within 30 s + idle
  const log = JSON.parse(app.storage.raw.get('failLog') || '[]');
  assert.deepEqual(log.filter((l) => /stream ended/.test(l)), [], 'fail log: ' + JSON.stringify(log));
  const continued = app.av.calledAfter('open', endSeq).map((c) => c.args[0]);
  // 15 s behind live is inside LIVE_SNAP_MS, so the continuation is the live stream; either way it opens one.
  assert.equal(continued.length, 1, 'opens after the recording ended: ' + JSON.stringify(continued));
});

test('P-J: the retry delay keeps growing across rebuffer → brief play → failure cycles (no reset by buffering time)', () => {
  const app = f.untilPlaying(f.ottApp({ random: () => 0.5 }));
  const gaps = [];
  for (let i = 0; i < 4; i++) {
    app.advanceUntil(() => app.av.state === 'PLAYING', 30000, 10);
    app.advance(1000);
    app.av.stalled = true;
    app.av.emit('onbufferingstart');
    for (let pct = 4; pct <= 100; pct += 4) { app.advance(1000); app.av.emit('onbufferingprogress', pct); }   // 25 s, progressing
    app.av.stalled = false;
    app.av.emit('onbufferingcomplete');
    app.advance(1000);                                  // one advance of the picture …
    const errSeq = app.seq();
    const errAt = app.clock.now;
    app.av.emit('onerror', 'PLAYER_ERROR_CONNECTION_FAILED');   // … then the stream fails
    app.advanceUntil(() => app.av.calledAfter('open', errSeq).length > 0, 60000, 10);
    gaps.push(app.av.calledAfter('open', errSeq)[0].at - errAt);
  }
  assert.ok(gaps[3] >= 3 * gaps[0], 'delays before each reopen (ms): ' + gaps.join(', '));
});

test('P-G: a rebuffer that keeps reporting the same percentage is recovered (reopened within 60 s)', () => {
  const app = f.untilPlaying(f.ottApp());
  app.advance(10000);
  const fromSeq = app.seq();
  app.av.stalled = true;
  app.av.emit('onbufferingstart');
  for (let t = 0; t < 60; t += 2) { app.advance(2000); app.av.emit('onbufferingprogress', 50); }
  assert.ok(app.av.calledAfter('open', fromSeq).length >= 1, 'stuck at 50 % for 60 s and never reopened');
});
