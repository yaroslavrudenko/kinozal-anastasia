'use strict';
// Calendar days of the programme panel across a DST change (plan §6.2; verify/codex.md C20).
// Israel leaves summer time on Sunday 2026-10-25 at 02:00, so that day has 25 hours.
process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('./fixtures');

// The default clock is 2026-10-25 19:00 local; the guide is hourly, aligned to UTC hours.
function dayCounts() {
  const app = f.untilPlaying(f.ottApp({ guideLatency: 10 }));
  app.advance(1500);
  const id = f.streamIdOf(f.lastOpenUrl(app));
  return { today: app.ctx.EPG.day(id, 0), yesterday: app.ctx.EPG.day(id, -1) };
}
const localHour = (ms) => new Date(ms).getHours();

test('EPG day (pin): the 25-hour day of the DST change lists all 25 hourly programmes, midnight to midnight', () => {
  const { today } = dayCounts();
  assert.equal(today.length, 25);
  assert.equal(localHour(today[0].start), 0);
  assert.equal(localHour(today[today.length - 1].start), 23);
});

test('EPG day (pin): the day before the DST change lists 24 programmes starting at local midnight', () => {
  const { yesterday } = dayCounts();
  assert.equal(yesterday.length, 24);
  assert.equal(localHour(yesterday[0].start), 0);
});
