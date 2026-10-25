'use strict';
// The connection banner (owner feature): from the moment a channel is chosen — a zap landing, the
// launch, the return from another app, a retry or a network reconnect — until its first frame, the
// banner stays up with the channel's number and name, what is on, the clock and a state line:
//   «Подключение…» · «Загрузка видео… N%» · «Нет сигнала — повтор через N с (попытка K)» ·
//   «Канал отключён провайдером». It never hides before the first frame. After the first frame the normal
// banner (with the tech line) shows and then hides. A later stall shows the state banner again until
// playback resumes. The whole banner's text is checked, so where the state line lives is up to the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const SLOW_PREPARE_MS = 9000;       // longer than BANNER_MS: an auto-hide before the first frame would show
const CLOCK = /\d\d:\d\d/;
const RETRY = /Нет сигнала\s*[—–-]\s*повтор через \d+\s*с\s*\(попытка \d+\)/;
const banner = (app) => app.text('banner') || '';

// Samples the banner every 100 ms until the stream opened after `fromSeq` shows its first frame.
function watchUntilFirstFrame(app, fromSeq, maxMs) {
  const samples = [];
  for (let t = 0; t < maxMs; t += 100) {
    const open = app.av.calledAfter('open', fromSeq).pop();
    if (open && app.av.url === open.args[0] && app.av.currentTime > 0) return { samples, framed: true };
    samples.push({ shown: app.visible('banner'), text: banner(app), opened: !!open });
    app.advance(100);
  }
  return { samples, framed: false };
}
function assertStateBanner(r, where, state) {
  assert.ok(r.framed, where + ': no first frame');
  const waiting = r.samples.filter((s) => s.opened);
  assert.ok(waiting.length > 0, where + ': nothing sampled before the first frame');
  const hidden = waiting.filter((s) => !s.shown);
  assert.equal(hidden.length, 0, where + ': banner hidden for ' + hidden.length * 100 + ' ms before the first frame');
  assert.ok(waiting.some((s) => (state || /Подключение…/).test(s.text)), where + ': no state line; banner said "' + waiting[waiting.length - 1].text + '"');
}
function nameOf(app) { return f.ottRecord(app, f.streamIdOf(f.lastOpenUrl(app))).channel_name; }

test('connect banner: a zap landing keeps the banner with name, programme, clock and «Подключение…» until the first frame', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(20000);
  app.av.prepareMs = SLOW_PREPARE_MS;
  const seq = app.seq();
  app.press(KEYS.RIGHT, 0);
  const r = watchUntilFirstFrame(app, seq, 20000);
  assertStateBanner(r, 'zap');
  const last = r.samples[r.samples.length - 1].text;
  assert.ok(last.indexOf(nameOf(app)) >= 0, 'channel name missing: ' + last);
  assert.ok(/Вечерние новости|Передача/.test(last), 'programme missing: ' + last);
  assert.ok(CLOCK.test(last), 'clock missing: ' + last);
});

test('connect banner: the launch keeps the state banner up until the first channel\'s first frame', () => {
  const app = f.ottApp({ channels: 10, avPrepareMs: SLOW_PREPARE_MS });
  assertStateBanner(watchUntilFirstFrame(app, 0, 20000), 'launch');
});

test('connect banner: «Загрузка видео… N%» while the stream buffers before its first frame', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(20000);
  app.av.prepareMs = SLOW_PREPARE_MS;
  const seq = app.seq();
  app.press(KEYS.RIGHT, 500);
  app.av.emit('onbufferingstart');
  app.av.emit('onbufferingprogress', 40);
  app.advance(200);
  assert.match(banner(app), /Загрузка видео…\s*40\s*%/);
  assert.ok(app.visible('banner'), 'banner hidden while buffering');
  assertStateBanner(watchUntilFirstFrame(app, seq, 20000), 'buffering', /Загрузка видео|Подключение/);
});

test('connect banner: a failing stream shows «Нет сигнала — повтор через N с (попытка K)» and stays up', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(20000);
  app.av.prepareFails = true;
  app.press(KEYS.RIGHT, 0);
  const texts = [];
  for (let t = 0; t < 12000; t += 100) { app.advance(100); texts.push({ shown: app.visible('banner'), text: banner(app) }); }
  assert.ok(texts.some((s) => RETRY.test(s.text)), 'no retry state line; last banner "' + texts[texts.length - 1].text + '"');
  assert.equal(texts.filter((s) => !s.shown).length, 0, 'banner hidden while the stream keeps failing');
});

test('connect banner: a channel found removed says «Канал отключён провайдером» on the banner', () => {
  const app = f.ottApp({ channels: 10, boot: false, avPrepareMs: SLOW_PREPARE_MS });
  app.net.route((u) => f.isStream(u), () => ({ body: f.MASTER.ottDead, delay: 300 }));
  app.boot();
  app.advance(3000);
  assert.ok(app.visible('banner'), 'banner hidden');
  assert.match(banner(app), /Канал отключён провайдером|отключён провайдером/);
});

test('connect banner: returning from another app keeps the state banner up until the first frame', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(20000);
  app.setHidden(true);
  app.advance(5000);
  app.av.prepareMs = SLOW_PREPARE_MS;
  const seq = app.seq();
  app.setHidden(false);
  assertStateBanner(watchUntilFirstFrame(app, seq, 20000), 'return from Home');
});

test('connect banner: a network reconnect keeps the state banner up until the first frame', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(20000);
  app.av.prepareMs = SLOW_PREPARE_MS;
  const seq = app.seq();
  app.network('GATEWAY_DISCONNECTED');
  app.network('GATEWAY_CONNECTED');
  assertStateBanner(watchUntilFirstFrame(app, seq, 20000), 'reconnect');
});

test('connect banner: after the first frame the banner shows the normal line, then hides', () => {
  const app = f.ottApp({ channels: 10, boot: false });
  app.av.streamInfo = () => [{ type: 'VIDEO', extra_info: JSON.stringify({ Width: 1920, Height: 1080, fourCC: 'h264' }) }];
  app.boot();
  f.untilPlaying(app);
  app.advance(1500);
  assert.ok(app.visible('banner') && /1920×1080/.test(banner(app)), 'no tech line after the first frame: ' + banner(app));
  assert.ok(!/Подключение…|Загрузка видео/.test(banner(app)), 'state line left on the banner: ' + banner(app));
  app.advance(15000);
  assert.equal(app.visible('banner'), false, 'the banner did not hide');
});

test('connect banner: a stall during playback shows the state banner until playback resumes', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 10 }));
  app.advance(20000);
  assert.equal(app.visible('banner'), false, 'precondition: banner hidden while watching');
  app.av.stalled = true;
  app.av.emit('onbufferingstart');
  app.av.emit('onbufferingprogress', 20);
  const during = [];
  for (let t = 0; t < 8000; t += 200) { app.advance(200); during.push({ shown: app.visible('banner'), text: banner(app) }); }
  assert.equal(during.filter((s) => !s.shown).length, 0, 'banner hidden during the stall');
  assert.ok(during.some((s) => /Загрузка видео|Подключение/.test(s.text)), 'no state line during the stall: ' + during[during.length - 1].text);
  app.av.stalled = false;
  app.av.emit('onbufferingcomplete');
  app.advance(20000);
  assert.equal(app.visible('banner'), false, 'the banner stayed after playback resumed');
});
