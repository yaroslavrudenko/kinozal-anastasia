'use strict';
// P-D — the background channel health check, and the dead-stream rule it applies.
// docs/PERFORMANCE.md target: health-check requests in flight during a zap: up to 4 → 0; the check is
// cancelled on list refresh. Correctness (review §2): a generic HLS master that lists only BANDWIDTH
// is a valid stream, not a removed channel.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const REFRESH_MS = 60000;           // list refresh brought forward from 6 h so it overlaps a slow check

// 200 channels whose stream probes never answer (each times out): the check takes minutes.
function slowCheckApp() {
  return f.untilPlaying(f.ottApp({ channels: 200, stream: 'hang', config: { PLAYLIST_REFRESH_MS: REFRESH_MS } }));
}
const listRequests = (app) => app.net.requests((r) => f.isList(r.url));

test('P-D: a list refresh aborts the superseded health check\'s requests still in flight', () => {
  const app = slowCheckApp();
  app.advanceUntil(() => listRequests(app).length >= 2, REFRESH_MS + 5000, 100);
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
  app.advance(20000);                                   // the check started at +15 s
  const keySeq = app.seq();
  app.press(KEYS.RIGHT, 0);
  app.advanceUntil(() => app.av.calledAfter('play', keySeq).length > 0, 10000, 10);
  const playSeq = app.av.calledAfter('play', keySeq)[0].seq;
  const tuned = f.streamIdOf(f.lastOpenUrl(app));
  const others = (r) => f.isStream(r.url) && f.streamIdOf(r.url) !== tuned;
  const max = app.net.maxInflight(others, keySeq, playSeq);
  assert.equal(max, 0, 'health-check requests in flight between the key press and play(): ' + max);
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
