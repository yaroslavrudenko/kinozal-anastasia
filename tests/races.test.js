'use strict';
// Races between the viewer's latest choice and work still pending from an earlier one (RULE 11).
// Verification round 2026-10-25 (verify/codex.md Q2 #1–#3, Q3 "health traffic"): the latest choice
// always wins — a pending prepare, retry, trailing zap or landing probe never overrides it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const isProbeOfOther = (app) => {
  const playing = f.streamIdOf(f.lastOpenUrl(app));
  return (r) => f.isStream(r.url) && f.streamIdOf(r.url) !== playing;
};

// ---------- pause ----------
test('pause: ⏯ pressed while the new channel is still preparing stays paused (the prepare does not start playback)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10, avPrepareMs: 800 }));
  app.advance(3000);
  app.press(KEYS.RIGHT, 100);                           // opens at once; prepare takes 800 ms
  const pauseSeq = app.seq();
  app.press(KEYS.PLAY_PAUSE, 0);
  app.advance(3000);
  const played = app.av.calledAfter('play', pauseSeq).concat(app.av.calledAfter('open', pauseSeq));
  assert.equal(played.length, 0, 'playback started after the pause: ' + played.map((c) => c.fn).join(', '));
});

test('pause: ⏯ pressed while a retry is pending stays paused (the retry does not reopen the stream)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(3000);
  app.av.emit('onerror', 'PLAYER_ERROR_CONNECTION_FAILED');   // retry scheduled in ~0.5 s
  const pauseSeq = app.seq();
  app.press(KEYS.PLAY_PAUSE, 0);
  app.advance(5000);
  assert.equal(app.av.calledAfter('open', pauseSeq).length, 0, 'the retry reopened the stream during the pause');
});

test('pause: no health-check probe is sent while playback is paused (Codex counted 30)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 200, stream: 'hang' }));
  app.advance(30000);                                   // playback steady; the check's quiet period is running
  const pauseSeq = app.seq();
  app.press(KEYS.PLAY_PAUSE, 0);
  app.advance(300000);                                  // a 5-minute pause
  const probes = app.net.requests((r) => r.sendSeq > pauseSeq && isProbeOfOther(app)(r));
  assert.equal(probes.length, 0, 'probes sent during the pause: ' + probes.length);
});

// ---------- trailing zap ----------
test('trailing zap: a zap still settling when the app goes to Home does not open a stream in the background', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(3000);
  app.press(KEYS.RIGHT, 50);
  app.press(KEYS.RIGHT, 0);                             // a burst: the second press settles after 350 ms
  const hideSeq = app.seq();
  app.setHidden(true);
  app.advance(2000);
  assert.equal(app.av.calledAfter('open', hideSeq).length, 0, 'a stream was opened while the app was hidden');
});

for (const [name, key] of [['the programme panel (▼)', KEYS.DOWN], ['the archive slider (▲)', KEYS.UP], ['the channel menu (OK)', KEYS.ENTER]]) {
  test('trailing zap: opening ' + name + ' while a zap settles keeps the channel the overlay shows', () => {
    const app = f.untilPlaying(f.ottApp({ channels: 10 }));
    app.advance(3000);
    app.press(KEYS.RIGHT, 50);
    app.press(KEYS.RIGHT, 0);
    const overlaySeq = app.seq();
    app.press(key, 0);
    app.advance(2000);
    assert.equal(app.av.calledAfter('open', overlaySeq).length, 0, 'the settling zap opened a stream under the overlay');
    assert.equal(app.visible('banner'), false, 'the banner appeared over the overlay');
  });
}

// ---------- landing probe ----------
test('landing probe: a late "removed" answer does not override the archive show picked meanwhile', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10, guideLatency: 10 }));
  app.advance(3000);
  let slowDead = true;
  app.net.route((u) => f.isStream(u), () => (slowDead ? { body: f.MASTER.ottDead, delay: 3000 } : { body: f.MASTER.ottAlive, delay: 50 }));
  app.press(KEYS.RIGHT, 600);                           // lands at once; its probe answers "removed" after 3 s
  slowDead = false;
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.UP, 50);                               // the previous show
  app.press(KEYS.ENTER, 0);
  const archiveUrl = f.lastOpenUrl(app);
  assert.ok(f.archiveStartOf(archiveUrl) !== null, 'the archive did not open: ' + archiveUrl);
  app.advance(5000);
  assert.equal(f.lastOpenUrl(app), archiveUrl, 'the late probe switched away from the archive');
});
