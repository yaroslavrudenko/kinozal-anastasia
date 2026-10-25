'use strict';
// P-D — the background channel health check, and the dead-stream rule it applies.
// docs/PERFORMANCE.md target: health-check requests in flight during a zap: up to 4 → 0; the check is
// cancelled on list refresh. Correctness (review §2): a generic HLS master that lists only BANDWIDTH
// is a valid stream, not a removed channel.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

// List refresh brought forward from 6 h so it overlaps a slow check. 120 s: after the plan's deferred
// sweep start (first frame + 20 s steady + 60 s quiet), so the refresh really meets a running sweep.
const REFRESH_MS = 120000;

// 200 channels whose stream probes never answer (each times out): the check takes minutes.
function slowCheckApp() {
  return f.untilPlaying(f.ottApp({ channels: 200, stream: 'hang', config: { PLAYLIST_REFRESH_MS: REFRESH_MS } }));
}
const listRequests = (app) => app.net.requests((r) => f.isList(r.url));

// Decision FP-2026-10-25 (NC-2): the window starts after the key press has been handled (a sweep
// aborted synchronously by the key is not "in flight during the zap"), and the press happens while a
// sweep is really running — the plan defers the sweep until playback is settled.
function sweepRunning(app) {
  const playing = f.streamIdOf(f.lastOpenUrl(app));
  return app.net.requests((r) => f.isStream(r.url) && r.endedAt === null && f.streamIdOf(r.url) !== playing).length > 0;
}

test('P-D: a list refresh aborts the superseded health check\'s requests still in flight', () => {
  const app = slowCheckApp();
  let runningAtRefresh = false;
  app.advanceUntil(() => { if (listRequests(app).length < 2) runningAtRefresh = sweepRunning(app); return listRequests(app).length >= 2; }, REFRESH_MS + 5000, 100);
  assert.ok(runningAtRefresh, 'no health check was running when the list refreshed');
  const refreshAt = listRequests(app)[1].sentAt;
  app.advance(1000);
  const leftOver = app.net.requests((r) => f.isStream(r.url) && r.sentAt < refreshAt && (r.endedAt === null || r.endedAt > refreshAt) && !r.aborted);
  assert.equal(leftOver.length, 0, 'probes of the old check still running after the refresh: ' + leftOver.length);
});

test('P-D: across a list refresh, at most 4 health-check requests are ever in flight', () => {
  const app = slowCheckApp();
  app.advance(REFRESH_MS + 120000);
  const max = app.net.maxInflight((r) => f.isStream(r.url), 0);
  assert.ok(max <= 4, 'health-check requests in flight at once: ' + max);
});

test('P-D: no health-check request is in flight while a zapped channel is starting (target 0, baseline up to 4)', () => {
  const app = slowCheckApp();
  assert.ok(app.advanceUntil(() => sweepRunning(app), 300000, 100), 'the health check never started');
  app.press(KEYS.RIGHT, 0);
  const afterKeySeq = app.seq();                        // after the synchronous handling of the key
  app.advanceUntil(() => app.av.calledAfter('play', afterKeySeq).length > 0, 10000, 10);
  const play = app.av.calledAfter('play', afterKeySeq)[0];
  assert.ok(play, 'the zapped channel never started');
  const tuned = f.streamIdOf(f.lastOpenUrl(app));
  const others = (r) => f.isStream(r.url) && f.streamIdOf(r.url) !== tuned;
  const max = app.net.maxInflight(others, afterKeySeq, play.seq);
  assert.equal(max, 0, 'health-check requests in flight between the handled key press and play(): ' + max);
});

test('correctness: a generic HLS master with only BANDWIDTH is not hidden as "removed by the provider"', () => {
  const app = f.untilPlaying(f.m3uApp({ channels: 3, master: f.MASTER.genericBandwidthOnly }));
  app.advance(30000);                                   // the check runs at +15 s
  app.press(KEYS.ENTER, 100);                           // open the channel menu
  const rows = app.rows('channels');
  assert.equal(rows.length, 3, 'channels listed: ' + JSON.stringify(rows));
  assert.ok(rows.every((t) => t.indexOf('отключён') < 0), JSON.stringify(rows));
});

test('correctness (pin): the provider\'s "removed" clip still hides the channel', () => {
  const app = f.untilPlaying(f.m3uApp({ channels: 3, master: f.MASTER.ottDead }));
  app.advance(30000);
  app.press(KEYS.ENTER, 100);
  assert.ok(app.rows('channels').length < 3, JSON.stringify(app.rows('channels')));
});
