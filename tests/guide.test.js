'use strict';
// OTT Club per-channel guide (/api/channel/<id>). docs/PERFORMANCE.md targets:
//   P-O requests after a failed guide request: 176 req/s → bounded retries with backoff; the banner hides
//   P-I memory per visited channel: ~200 KB → bounded cache, descriptions not stored
// Correctness (review §2): a failed / malformed guide must not be stored as "complete" for an hour,
// and must not wipe the "now" title the channel list already gave.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const guideRequests = (app) => app.net.requests((r) => f.isGuide(r.url));

test('P-O: a failing guide is retried a bounded number of times in the first minute (≤ 5, baseline ~1000)', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'fail', guideLatency: 50 }));
  app.advance(60000);
  assert.ok(guideRequests(app).length <= 5, 'guide requests in 60 s: ' + guideRequests(app).length);
});

test('P-O: retries of a failing guide back off (waits never shrink and grow at least 4×)', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'fail', guideLatency: 50 }));
  app.advance(600000);
  const sent = guideRequests(app).map((r) => r.sentAt);
  const gaps = sent.slice(1).map((t, i) => t - sent[i]);
  assert.ok(gaps.length >= 1, 'the guide was never retried within 10 minutes');
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] >= gaps[i - 1], 'gaps (ms): ' + gaps.slice(0, 12).join(', '));
  assert.ok(gaps.length >= 3 && gaps[gaps.length - 1] >= 4 * gaps[0], 'gaps (ms): ' + gaps.slice(0, 12).join(', '));
});

test('P-O: with a failing guide the channel banner still hides after its timeout', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'fail', guideLatency: 50 }));
  app.advance(20000);
  assert.equal(app.visible('banner'), false);
});

test('P-O (pin): with a working guide the channel banner hides after its timeout', () => {
  const app = f.untilPlaying(f.ottApp());
  app.advance(20000);
  assert.equal(app.visible('banner'), false);
});

test('correctness: a malformed guide answer keeps the "now" title the channel list gave', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'malformed', guideLatency: 50 }));
  app.advance(3000);
  app.press(KEYS.INFO, 100);
  assert.match(app.text('b-now'), /Вечерние новости/);
});

test('correctness: a malformed guide answer is not cached as complete — looking again 10 minutes later re-requests it', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'malformed', guideLatency: 50 }));
  app.advance(3000);
  const before = guideRequests(app).length;
  app.advance(600000);
  app.press(KEYS.INFO, 1000);
  assert.ok(guideRequests(app).length > before, 'no new guide request after 10 minutes');
});

// P-I: viewing many channels' guides. The bound (≤ 64 channels with a full guide) is this suite's
// contract for "bounded cache"; the architect may choose a smaller one.
const MAX_FULL_GUIDES = 64;
function browseGuides(count) {
  const app = f.untilPlaying(f.ottApp({ channels: count, guideLatency: 20 }));
  const ids = app.fixture.list.ids;
  for (const id of ids) { app.runTask('ensure ' + id, () => app.ctx.EPG.ensure(id)); app.advance(100); }
  return { app, ids };
}
function guideEntries(app, id) {
  const out = [];
  for (let d = -8; d <= 1; d++) out.push.apply(out, app.ctx.EPG.day(id, d));
  return out;
}

test('P-I: guide entries do not keep the unused description text', () => {
  const { app, ids } = browseGuides(10);
  const withDescr = ids.filter((id) => guideEntries(app, id).some((p) => p.descr !== undefined));
  assert.equal(withDescr.length, 0, 'channels whose guide keeps descr: ' + withDescr.length);
});

test('P-I: the full-guide cache is bounded (≤ ' + MAX_FULL_GUIDES + ' channels after browsing 300)', () => {
  const { app, ids } = browseGuides(300);
  const full = ids.filter((id) => guideEntries(app, id).length > 1).length;
  assert.ok(full <= MAX_FULL_GUIDES, 'channels holding a full guide: ' + full);
});

test('P-I (pin): the channel being watched keeps its full guide while browsing', () => {
  const { app } = browseGuides(300);
  const playing = f.streamIdOf(f.lastOpenUrl(app));
  app.runTask('ensure playing', () => app.ctx.EPG.ensure(playing));
  app.advance(500);
  assert.ok(guideEntries(app, playing).length > 24, 'the watched channel lost its guide');
});

// ---------- verification round 2026-10-25 (verify/codex.md Q2 #7, Q3; implementer's mutation survivor) ----------
test('P-O: a failing guide is requested at most 5 times in 10 minutes, even with the shortest jitter every time', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'fail', guideLatency: 50, random: () => 0 }));
  app.advance(600000);
  const sent = guideRequests(app).map((r) => Math.round(r.sentAt / 100) / 10);
  assert.ok(sent.length <= 5, 'guide requests in 10 min: ' + sent.length);
});

test('P-O: pressing INFO repeatedly during the cool-down after a guide failure sends no new guide request', () => {
  const app = f.untilPlaying(f.ottApp({ guide: 'fail', guideLatency: 50 }));
  app.advance(3000);
  const before = guideRequests(app).length;
  for (let i = 0; i < 10; i++) app.press(KEYS.INFO, 1000);   // 10 s, well inside the cool-down
  assert.equal(guideRequests(app).length, before, 'INFO re-requested the failing guide');
});

test('guide: an OTT guide sent newest-first still finds the programme on air now', () => {
  const app = f.untilPlaying(f.ottApp({ guideOrder: 'desc', guideLatency: 10 }));
  app.advance(1500);
  app.press(KEYS.INFO, 100);
  assert.match(app.text('b-now'), /Передача/, 'banner "now" line: "' + app.text('b-now') + '"');
});
