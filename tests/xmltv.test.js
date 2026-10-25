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
