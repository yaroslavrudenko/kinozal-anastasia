'use strict';
// TV full run on f7ccc45 (2026-10-26):
//  D1 on the TV: M5 7-day edge on 352 Inrating, no first frame. The knob (window minus 10 min) lay before the
//    channel's first guide entry (the guide starts at its fetch time minus 7 days), so the archive request
//    had no programme length and asked for 7 days up to now; OTT Club answers that with 404 (desktop probe:
//    spans of 30 min–24 h → 200, 48 h and 7 days → 404).
//  Tech line: the player described some streams after the 5 s window had already closed (232 BCU, 242, 372).
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
const spanOf = (url) => { const q = new URL(url).searchParams; return (Number(q.get('archive_end')) - Number(q.get('archive'))) * SEC; };

test('archive (D1 on the TV): a moment with no guide programme never asks the provider for more than 4 h', () => {
  const app = f.ottApp({ channels: 5 });
  f.untilPlaying(app);
  const url = vm.runInContext(`Catchup.url(Channels.at(0), Date.now() - 7 * ${DAY} + 10 * ${MIN}, 0)`, app.ctx);
  assert.ok(spanOf(url) > 0 && spanOf(url) <= 4 * HOUR, 'span ' + spanOf(url) / HOUR + ' h');
});

test('archive (D1 on the TV): the scrub knob at the 7-day edge opens a request of at most 4 h', () => {
  const app = f.ottApp({ channels: 5, guide: 'fail' });       // no guide at all: no programme length anywhere
  f.untilPlaying(app);
  const seq = app.seq();
  vm.runInContext(`Playback.archive(Playback.current(), Date.now() - 8 * ${DAY})`, app.ctx);   // clamped to the edge
  const url = app.av.calledAfter('open', seq).map((c) => c.args[0]).pop();
  assert.ok(url && /archive=/.test(url), 'no archive opened: ' + url);
  assert.ok(spanOf(url) <= 4 * HOUR, 'span ' + spanOf(url) / HOUR + ' h');
});

test('archive (pin): a programme shorter than 4 h is still asked for as a whole', () => {
  const app = f.ottApp({ channels: 5 });
  f.untilPlaying(app);
  const url = vm.runInContext(`Catchup.url(Channels.at(0), Date.now() - 3 * ${DAY}, 50 * ${MIN})`, app.ctx);
  assert.equal(spanOf(url), 50 * MIN);
});

const INFO = [{ type: 'VIDEO', extra_info: JSON.stringify({ Width: 1920, Height: 1080, fourCC: 'h264', Bit_rate: 6200000 }) },
  { type: 'AUDIO', extra_info: JSON.stringify({ channels: 2, fourCC: 'aac' }) }];
test('tech line (TV run): a stream the player describes 12 s after it opens still shows its line for the full window after that', () => {
  const app = f.ottApp({ channels: 10, boot: false });
  let describeAt = Infinity;
  app.av.streamInfo = () => (app.clock.now >= describeAt ? INFO : []);
  app.boot();
  f.untilPlaying(app);
  app.advance(20000);
  describeAt = app.clock.now + 12 * SEC;                    // the next stream is described 12 s after it is opened
  app.press(KEYS.RIGHT, 13000);
  const at13 = app.text('b-tech');
  app.advance(3500);                                        // past the 15 s wait for a description, inside 5 s after it came
  const at16 = app.text('b-tech');
  assert.ok(/1920×1080/.test(at13) && /1920×1080/.test(at16), 'tech line at +13 s «' + at13 + '», at +16.5 s «' + at16 + '»');
});
