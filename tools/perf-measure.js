// Deterministic performance measurements behind docs/PERFORMANCE.md, run in the test harness (Node 22):
//   node tools/perf-measure.js                      this tree
//   KINOZAL_ROOT=<other tree> node tools/perf-measure.js   another tree (same harness, e.g. the baseline commit)
// Desktop CPU, virtual clock; numbers labelled desktop. Prints one JSON object.
const T = require('path').join(__dirname, '..', 'tests') + '/';
const f = require(T + 'fixtures'); const { KEYS, createApp } = require(T + 'harness');
const out = {};
{ // zap burst
  const app = f.untilPlaying(f.ottApp({ channels: 30 })); app.advance(2000); const s0 = app.seq(); const w0 = app.storage.writes().length;
  for (let i = 0; i < 10; i++) app.press(KEYS.RIGHT, 100); app.advance(3000);
  const b = app.net.requests((r) => r.sendSeq > s0 && (f.isGuide(r.url) || f.isStream(r.url)));
  out.zapRequests = b.length; out.zapAborted = b.filter((r) => r.aborted).length; out.zapOpens = app.av.calledAfter('open', s0).length;
  out.zapWritesWithin1sOfLastKey = app.storage.writes().filter((w) => w.seq > s0 && w.at <= app.clock.now - 3000 + 1000).length;
}
{ // single press → open
  const app = f.untilPlaying(f.ottApp({ channels: 10 })); app.advance(2000); const s = app.seq(), t = app.clock.now;
  app.press(KEYS.RIGHT, 0); app.advanceUntil(() => app.av.calledAfter('open', s).length > 0, 2000, 5);
  out.singlePressOpenMs = app.av.calledAfter('open', s)[0].at - t;
}
{ // list parse + writes before first play
  const app = f.untilPlaying(f.ottApp({ channels: 400 })); app.advance(60000);
  const body = app.fixture.list.body; out.listParses = app.jsonParses.filter((p) => p.text === body).length;
  const play = app.av.calls.find((c) => c.fn === 'play');
  const early = app.storage.writes().filter((w) => w.seq < play.seq);
  out.writesBeforeFirstPlay = early.length; out.charsBeforeFirstPlay = early.reduce((s, w) => s + w.size, 0);
  const snap = app.storage.writes().filter((w) => /playlist(Snap|Text)/.test(w.key)); out.offlineCopyChars = snap.length ? snap[snap.length - 1].size : 0;
  out.listBodyChars = body.length; out.ottKeyReads = app.storage.reads.get('ottKey') || 0;
}
{ // failing guide
  const app = f.untilPlaying(f.ottApp({ guide: 'fail', guideLatency: 50 })); app.advance(600000);
  out.failedGuideRequests10min = app.net.requests((r) => f.isGuide(r.url)).length;
}
{ // guide memory
  const app = f.untilPlaying(f.ottApp({ channels: 100, guideLatency: 20 }));
  for (const id of app.fixture.list.ids) { app.runTask('e', () => app.ctx.EPG.ensure(id)); app.advance(100); }
  let full = 0, descr = 0;
  for (const id of app.fixture.list.ids) { let n = 0; for (let d = -8; d <= 1; d++) for (const p of app.ctx.EPG.day(id, d)) { n++; if (p.descr) descr += p.descr.length; } if (n > 1) full++; }
  out.fullGuidesAfter100 = full; out.descrCharsHeld = descr;
}
{ // malformed xmltv
  const app = createApp(); const url = 'http://epg.example.test/b.xml'; app.net.route((u) => u === url, () => ({ body: f.xmltvUnclosed(8000), delay: 20 }));
  let done = false; const t0 = app.tasks.length; app.runTask('l', () => app.ctx.EPG.load(url, { c1: true }, () => { done = true; }));
  app.advanceUntil(() => done, 60000, 5);
  const ts = app.tasks.slice(t0).filter((t) => t.label !== 'av-clock' && t.label !== 'setInterval');
  out.xmltvMalformedTotalMs = +ts.reduce((s, t) => s + t.ms, 0).toFixed(1); out.xmltvMalformedLongestMs = +app.longestTask(t0).toFixed(1);
}
{ // list down 30 min with an offline copy present
  const first = f.untilPlaying(f.ottApp({ channels: 50 })); first.advance(60000);
  const app = f.ottApp({ channels: 50, boot: false, storage: Object.fromEntries(first.storage.raw) });
  app.net.route((u) => f.isList(u), () => ({ error: true, delay: 100 })); app.boot(); app.advance(1800000);
  out.listRequestsDown30min = app.net.requests((r) => f.isList(r.url)).length;
}
{ // health sweep: requests in the first 2 minutes, max in flight
  const app = f.untilPlaying(f.ottApp({ channels: 200 })); app.advance(120000);
  out.healthRequests2min = app.net.requests((r) => f.isStream(r.url)).length;
  out.healthMaxInflight = app.net.maxInflight((r) => f.isStream(r.url), 0);
}

{ const first = f.untilPlaying(f.ottApp({ channels: 200 })); first.advance(300000);
const firstSweepStart = first.net.requests((r) => f.isStream(r.url)).slice(1)[0];
const relaunch = f.untilPlaying(f.ottApp({ channels: 200, now: f.DEFAULT_NOW + 3600000, storage: Object.fromEntries(first.storage.raw) }));
relaunch.advance(300000);
Object.assign(out, { firstBootSweepRequests5min: first.net.requests((r) => f.isStream(r.url)).length - 1,
  firstSweepStartsAfterMs: firstSweepStart ? firstSweepStart.sentAt - f.DEFAULT_NOW : null,
  relaunch1hLaterStreamRequests5min: relaunch.net.requests((r) => f.isStream(r.url)).length });
}
console.log(JSON.stringify(out));
