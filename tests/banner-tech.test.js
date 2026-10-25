'use strict';
// The stream's technical line on landing (owner feature, iteration 5): as soon as the new channel's
// picture plays, the banner shows its resolution / codec / bitrate / sound, for the time CONFIG sets,
// then hides; it is always the NEW channel's line (never the previous channel's values), it comes back on
// the next landing, and it costs no request.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const FAST_MS = 700;                // first frame (≤ 500 ms after play(), the fake's clock tick) + slack
// Each newly opened stream gets the next of two profiles (Full HD H.264 stereo / HD HEVC 5.1), so two
// channels opened one after the other always differ and a stale line is visible.
const PROFILES = [
  { v: { Width: 1920, Height: 1080, fourCC: 'h264', fps: '25', Bit_rate: 6200000 }, a: { channels: 2, fourCC: 'aac' }, res: '1920×1080' },
  { v: { Width: 1280, Height: 720, fourCC: 'hevc', fps: '50', Bit_rate: 3100000 }, a: { channels: 6, fourCC: 'ac3' }, res: '1280×720' }
];
const assigned = new Map();
function profileOf(url) {
  if (!assigned.has(url)) assigned.set(url, PROFILES[assigned.size % 2]);
  return assigned.get(url);
}
function streamInfo(url) {
  const p = profileOf(url);
  return [{ type: 'VIDEO', extra_info: JSON.stringify(p.v) }, { type: 'AUDIO', extra_info: JSON.stringify(p.a) }];
}
const resolutionOf = (url) => profileOf(url).res;

function landedApp() {
  const app = f.ottApp({ channels: 10, boot: false });
  assigned.clear();
  app.av.streamInfo = streamInfo;
  app.boot();
  f.untilPlaying(app);
  app.advance(20000);                                   // the launch banner has come and gone
  return app;
}
// Presses ▶ once and watches the banner every 50 ms for `ms`: [{ t (ms after play()), shown, tech }].
function landAndWatch(app, ms) {
  const keySeq = app.seq();
  app.press(KEYS.RIGHT, 0);
  const samples = [];
  let playAt = null;
  for (let t = 0; t < ms; t += 50) {
    app.advance(50);
    const play = app.av.calledAfter('play', keySeq)[0];
    if (play && playAt === null) playAt = play.at;
    samples.push({ at: app.clock.now, shown: app.visible('banner'), tech: app.text('b-tech') });
  }
  return { keySeq, playAt, samples, url: app.av.calledAfter('open', keySeq).map((c) => c.args[0]).pop() };
}

test('tech line: shown within 0.7 s of the new channel starting to play', () => {
  const app = landedApp();
  const r = landAndWatch(app, 8000);
  assert.ok(r.playAt !== null, 'the new channel never played');
  const first = r.samples.find((s) => s.shown && s.tech);
  assert.ok(first, 'the tech line never appeared');
  assert.ok(first.at - r.playAt <= FAST_MS, 'tech line appeared ' + (first.at - r.playAt) + ' ms after play()');
  assert.ok(first.tech.indexOf(resolutionOf(r.url)) >= 0, 'tech line "' + first.tech + '" is not the new channel\'s');
});

test('tech line: never shows the previous channel\'s values while landing', () => {
  const app = landedApp();
  const prevRes = resolutionOf(f.lastOpenUrl(app));
  const r = landAndWatch(app, 8000);
  assert.notEqual(resolutionOf(r.url), prevRes, 'fixture: neighbours must differ');
  const stale = r.samples.filter((s) => s.shown && s.tech && s.tech.indexOf(prevRes) >= 0);
  assert.equal(stale.length, 0, 'the previous channel\'s line was on screen ' + stale.length * 50 + ' ms');
});

test('tech line: stays for the configured time (CONFIG.TECH_LINE_MS), then the banner hides', () => {
  const app = landedApp();
  const r = landAndWatch(app, 60000);
  const configured = app.ctx.CONFIG.TECH_LINE_MS;
  const shownWithTech = r.samples.filter((s) => s.shown && s.tech).length * 50;
  assert.ok(configured >= 3000, 'CONFIG.TECH_LINE_MS = ' + configured);
  assert.ok(Math.abs(shownWithTech - configured) <= 600, 'tech line on screen ' + shownWithTech + ' ms, configured ' + configured + ' ms');
  assert.equal(r.samples[r.samples.length - 1].shown, false, 'the banner is still up after 60 s');
});

test('tech line: comes back on the next landing, with that channel\'s values', () => {
  const app = landedApp();
  landAndWatch(app, 20000);
  const r = landAndWatch(app, 8000);
  const first = r.samples.find((s) => s.shown && s.tech && s.at >= r.playAt);
  assert.ok(first && first.tech.indexOf(resolutionOf(r.url)) >= 0, 'second landing tech line: ' + (first && first.tech));
});

test('tech line (pin): costs no request — landing sends only the probe and the guide', () => {
  const app = landedApp();
  const r = landAndWatch(app, 10000);
  const other = app.net.requests((q) => q.sendSeq > r.keySeq && !f.isStream(q.url) && !f.isGuide(q.url));
  assert.deepEqual(other.map((q) => q.url), []);
});

// ---------- verify/round5-codex.md item 3 ----------
// The player describes the stream only 2.5 s after it opens; the guide arrives (and redraws the banner)
// before that. While the tech line is active it shows «…» and then the values — never an empty line.
test('tech line: stays «…» across a banner redraw by the guide, then fills — never blank while active', () => {
  const app = f.ottApp({ channels: 10, boot: false, guideLatency: 50 });
  assigned.clear();
  app.av.streamInfo = (url) => {
    const open = app.av.calls.filter((c) => c.fn === 'open').pop();
    return open && app.clock.now - open.at >= 2500 ? streamInfo(url) : [];
  };
  app.boot();
  f.untilPlaying(app);
  app.advance(20000);
  const r = landAndWatch(app, 8000);
  const firstShown = r.samples.findIndex((s) => s.shown && s.tech);
  assert.ok(firstShown >= 0, 'the tech line never appeared');
  const filled = r.samples.findIndex((s) => s.tech && s.tech !== '…');
  assert.ok(filled > firstShown, 'the values never replaced «…»');
  const blank = r.samples.slice(firstShown, filled).filter((s) => s.shown && !s.tech);
  assert.equal(blank.length, 0, 'tech line blank for ' + blank.length * 50 + ' ms before the values arrived');
  assert.ok(app.net.requests((q) => f.isGuide(q.url) && q.sendSeq > r.keySeq).length >= 1, 'no guide arrived to redraw the banner');
});

test('tech line: visible for the whole TECH_LINE_MS even when it is longer than BANNER_MS (8000 / 5000)', () => {
  const app = f.ottApp({ channels: 10, boot: false, config: { TECH_LINE_MS: 8000, BANNER_MS: 5000 } });
  assigned.clear();
  app.av.streamInfo = streamInfo;
  app.boot();
  f.untilPlaying(app);
  app.advance(20000);
  const r = landAndWatch(app, 20000);
  const shownWithTech = r.samples.filter((s) => s.shown && s.tech).length * 50;
  assert.ok(shownWithTech >= 7400, 'tech line on screen ' + shownWithTech + ' ms of 8000');
});
