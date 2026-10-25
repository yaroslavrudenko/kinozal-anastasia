'use strict';
// P-C — XMLTV guide (M3U playlists with url-tvg). docs/PERFORMANCE.md target:
//   malformed 8000-tag input: 483 ms (desktop) → linear time; overlapping parses give correct results.
// Budgets are for this Mac (desktop); the TV is several times slower, so they are deliberately tight.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const f = require('./fixtures');

const LONG_TASK_MS = 50;            // the browser's long-task threshold
const MALFORMED_TOTAL_MS = 150;     // whole malformed-guide parse, desktop

// Loads `body` as an XMLTV guide through the app's EPG module and runs until it reports done.
function loadGuide(app, url, body, wanted) {
  app.net.route((u) => u === url, () => ({ body, delay: 20 }));
  const state = { done: false, firstTask: 0 };
  app.runTask('epg-load', () => app.ctx.EPG.load(url, wanted, () => { state.done = true; }));
  app.advanceUntil(() => app.net.requests((r) => r.url === url && r.endedAt !== null).length > 0, 1000, 5);
  return state;
}

function malformedRun() {
  const app = createApp();
  const t0 = app.tasks.length;
  const state = loadGuide(app, 'http://epg.example.test/broken.xml', f.xmltvUnclosed(8000), { c1: true });
  app.advanceUntil(() => state.done, 60000, 5);
  const parseTasks = app.tasks.slice(t0).filter((t) => t.label !== 'av-clock' && t.label !== 'setInterval');
  return { app, state, longest: app.longestTask(t0), total: parseTasks.reduce((s, t) => s + t.ms, 0) };
}

test('P-C: a malformed guide (8000 unclosed <programme>) never blocks the main thread longer than ' + LONG_TASK_MS + ' ms', () => {
  const { longest } = malformedRun();
  assert.ok(longest < LONG_TASK_MS, 'longest task: ' + longest.toFixed(1) + ' ms');
});

test('P-C: a malformed guide (8000 unclosed <programme>) is processed in under ' + MALFORMED_TOTAL_MS + ' ms in total', () => {
  const { total, state } = malformedRun();
  assert.ok(state.done, 'the parse never finished');
  assert.ok(total < MALFORMED_TOTAL_MS, 'total parse time: ' + total.toFixed(1) + ' ms');
});

test('P-C: two overlapping guide parses do not corrupt each other (each channel ends with one full, consistent version)', () => {
  const ids = ['c1', 'c2', 'c3'];
  const PER_CHANNEL = 300;
  const app = createApp({ autoTickMs: 1 });   // every clock read moves 1 ms, so the parser yields often
  const wanted = { c1: true, c2: true, c3: true };
  app.net.route((u) => /old\.xml$/.test(u), () => ({ body: f.xmltv(ids, PER_CHANNEL, { version: 'old' }), delay: 20 }));
  app.net.route((u) => /new\.xml$/.test(u), () => ({ body: f.xmltv(ids, PER_CHANNEL, { version: 'new' }), delay: 25 }));
  let finished = 0;
  app.runTask('epg-load old', () => app.ctx.EPG.load('http://epg.example.test/old.xml', wanted, () => finished++));
  app.runTask('epg-load new', () => app.ctx.EPG.load('http://epg.example.test/new.xml', wanted, () => finished++));
  app.advanceUntil(() => finished >= 2, 600000, 5);
  for (const id of ids) {
    const list = [];
    for (let d = -8; d <= 2; d++) list.push.apply(list, app.ctx.EPG.day(id, d));
    const versions = new Set(list.map((p) => p.title.split(' ')[0]));
    const starts = new Set(list.map((p) => p.start));
    assert.equal(versions.size, 1, id + ': mixed versions ' + Array.from(versions).join('+'));
    assert.equal(list.length, PER_CHANNEL, id + ': ' + list.length + ' programmes instead of ' + PER_CHANNEL);
    assert.equal(starts.size, list.length, id + ': duplicate programmes');
  }
});

test('P-C (pin): a well-formed guide is parsed completely', () => {
  const app = createApp();
  const state = loadGuide(app, 'http://epg.example.test/ok.xml', f.xmltv(['c1'], 100), { c1: true });
  app.advanceUntil(() => state.done, 10000, 5);
  let n = 0;
  for (let d = -8; d <= 2; d++) n += app.ctx.EPG.day('c1', d).length;
  assert.equal(n, 100);
});

// verify/codex.md Q3 / verify/mad_react…md N2: many unclosed <programme> tags followed by ONE closed one
// (the shape that defeats "stop at the first missing close"). Linear: each doubling ≤ 2.5× the time.
function closedTailMs(count) {
  let best = Infinity;
  for (let run = 0; run < 3; run++) {
    const app = createApp();
    const url = 'http://epg.example.test/tail-' + count + '.xml';
    app.net.route((u) => u === url, () => ({ body: f.xmltvUnclosed(count, { closedTail: true }), delay: 20 }));
    let done = false;
    const t0 = app.tasks.length;
    app.runTask('epg-load', () => app.ctx.EPG.load(url, { c1: true }, () => { done = true; }));
    app.advanceUntil(() => done, 600000, 5);
    assert.ok(done, 'the parse of ' + count + ' tags never finished');
    best = Math.min(best, app.tasks.slice(t0).filter((t) => t.label !== 'av-clock' && t.label !== 'setInterval').reduce((s, t) => s + t.ms, 0));
  }
  return best;
}

test('P-C: many unclosed <programme> + one closed one is parsed in linear time (2k → 32k, each doubling ≤ 2.5×)', () => {
  const sizes = [2000, 4000, 8000, 16000, 32000];
  const ms = [];
  for (const n of sizes) {
    ms.push(closedTailMs(n));
    const k = ms.length - 1;
    // Sub-5 ms timings are noise; compare only when the larger one is measurable. Stop at the first
    // super-linear step (a quadratic parser would take ~20 s at 32k).
    if (k > 0 && ms[k] >= 5) assert.ok(ms[k] <= 2.5 * Math.max(ms[k - 1], 2), 'ms per size ' + sizes.slice(0, k + 1).join('/') + ': ' + ms.map((x) => x.toFixed(1)).join(' / '));
  }
  assert.ok(ms[2] < 50, '8000 tags took ' + ms[2].toFixed(1) + ' ms (target < 50)');
});
