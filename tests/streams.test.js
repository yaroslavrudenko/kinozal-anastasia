'use strict';
// Streams batch (review 2026-10-27, scratchpad review3/streams.md; owner 2026-10-28: «закончили со стримами … работа со
// стримами была быстрой и эффективной»). docs/PERFORMANCE.md P-S1 … P-S12. The banner's state line («Подключение…»,
// «Загрузка видео… N%», «Нет сигнала — повтор…») is the owner's and is pinned unchanged here; only the big centre
// spinner is delayed. Buffering itself (BUFFER_PLAY_S / BUFFER_RESUME_S) is not touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN;
const ev = (app, js) => vm.runInContext(js, app.ctx);
const spanOf = (url) => { const q = new URL(url).searchParams; return (Number(q.get('archive_end')) - Number(q.get('archive'))) * SEC; };
const playsAfter = (app, seq) => app.av.calledAfter('play', seq).length > 0;
// Was the big spinner on at any 10 ms step until pred() held (or maxMs passed)?
function spinnerSeenUntil(app, pred, maxMs) {
  let seen = false;
  app.advanceUntil(() => { if (app.visible('spinner')) seen = true; return pred(); }, maxMs, 10);
  return seen;
}
// A booted OTT app watching its first channel for 10 s (past STABLE_MS is not needed here).
function watching(opts) { const app = f.untilPlaying(f.ottApp(opts)); app.advance(10000); return app; }

// ---------- P-S1: the big spinner waits SPINNER_GRACE_START_MS on an open ----------
test('P-S1: a channel whose picture comes within SPINNER_GRACE_START_MS never shows the big spinner', () => {
  const app = watching();
  const seq = app.seq();
  app.press(KEYS.RIGHT, 0);
  const seen = spinnerSeenUntil(app, () => playsAfter(app, seq) && app.av.currentTime >= 500, 5000);
  assert.ok(playsAfter(app, seq), 'the next channel did not start');
  assert.equal(seen, false, 'the big spinner showed on a normal open');
});

test('P-S1: a slow open shows the big spinner only after SPINNER_GRACE_START_MS, and hides it at the first frame', () => {
  const app = watching();
  app.av.prepareMs = 4000;
  app.press(KEYS.RIGHT, 0);
  app.advance(CONFIG_GRACE(app) - 100);
  assert.equal(app.visible('spinner'), false, 'spinner before the grace');
  app.advance(200);
  assert.equal(app.visible('spinner'), true, 'no spinner after the grace on a slow open');
  app.advanceUntil(() => !app.visible('spinner'), 6000, 10);
  assert.ok(app.av.currentTime > 0, 'the spinner went off before the picture');
});
function CONFIG_GRACE(app) { return ev(app, 'CONFIG.SPINNER_GRACE_START_MS'); }

test('P-S1 (pin): the banner state line says «Подключение…» at once on an open (the owner\'s indicator is not delayed)', () => {
  const app = watching();
  app.av.prepareMs = 4000;
  app.press(KEYS.RIGHT, 0);
  assert.equal(app.text('b-state'), ev(app, 'I18n.t("b.connecting")'));
  assert.equal(app.visible('banner'), true);
});

// ---------- P-S2: a rebuffer shows the spinner only after SPINNER_GRACE_REBUFFER_MS ----------
test('P-S2: a rebuffer shorter than SPINNER_GRACE_REBUFFER_MS never shows the spinner; a longer one does, and it goes as playback moves', () => {
  const app = watching();
  const grace = ev(app, 'CONFIG.SPINNER_GRACE_REBUFFER_MS');
  app.av.stalled = true;
  app.av.emit('onbufferingstart');
  const shortSeen = spinnerSeenUntil(app, () => false, grace - 100);
  app.av.stalled = false;
  app.av.emit('onbufferingcomplete');
  assert.equal(shortSeen, false, 'a short rebuffer flashed the spinner');
  app.advance(3000);
  app.av.stalled = true;
  app.av.emit('onbufferingstart');
  app.advance(grace + 100);
  assert.equal(app.visible('spinner'), true, 'a long rebuffer has no spinner');
  app.av.stalled = false;
  app.av.emit('onbufferingcomplete');
  assert.equal(app.visible('spinner'), false, 'the spinner stayed after buffering completed');
});

// ---------- P-S3: no spinner through the backoff wait; a static «no signal» from NO_SIGNAL_AFTER failures ----------
test('P-S3: a stream that never plays shows no big spinner during the backoff wait, and none at all from the NO_SIGNAL_AFTER-th failure on', () => {
  const app = watching();
  const after = ev(app, 'CONFIG.NO_SIGNAL_AFTER');
  app.av.prepareMs = 1e9;                                    // the next stream never prepares: buffering timeout, retry, …
  app.press(KEYS.RIGHT, 0);
  const fails = () => ev(app, 'Diag.snapshot().recent.length');
  const f0 = fails();
  let inBackoffSeen = false, lateSeen = false;
  for (let t = 0; t < 180000; t += 50) {
    app.advance(50);
    const n = fails() - f0, pending = /повтор/.test(app.text('b-state'));
    if (pending && app.visible('spinner')) inBackoffSeen = true;
    if (n >= after && app.visible('spinner')) lateSeen = true;
  }
  assert.ok(fails() - f0 >= after + 1, 'only ' + (fails() - f0) + ' failures in 3 min');
  assert.equal(inBackoffSeen, false, 'the spinner spun while the banner said «повтор»');
  assert.equal(lateSeen, false, 'the spinner came back after ' + after + ' failures');
});

test('P-S3 (pin): the banner still says «Нет сигнала — повтор…» during the backoff, and the toast «Нет сигнала…» from the NO_SIGNAL_AFTER-th failure', () => {
  const app = watching();
  app.av.prepareFails = true;
  app.press(KEYS.RIGHT, 0);
  let retryText = false, toast = false;
  for (let t = 0; t < 20000; t += 50) {
    app.advance(50);
    if (/^Нет сигнала — повтор/.test(app.text('b-state'))) retryText = true;
    if (app.visible('toast') && /^Нет сигнала, переподключаюсь/.test(app.text('toast'))) toast = true;
  }
  assert.ok(retryText && toast, 'retry line ' + retryText + ', toast ' + toast);
});

// ---------- P-S4: AVPlay opens in the key's task (default); BANNER_BEFORE_TEARDOWN paints the banner first ----------
// Stop calls made by a channel change: [{ tasks (tasks finished before the call), title (banner title at the call) }].
function stopsDuring(app, fn) {
  const avp = app.ctx.webapis.avplay, stop = avp.stop, at = [];
  avp.stop = function () { at.push({ tasks: app.tasks.length, title: app.text('b-title') }); return stop.apply(this, arguments); };
  fn();
  avp.stop = stop;
  return at;
}
test('P-S4 (TV 2026-10-28: +144 ms key→playing with the deferral): by default AVPlay is torn down and opened in the key\'s own task, the banner already updated', () => {
  const app = watching();
  assert.equal(ev(app, 'CONFIG.BANNER_BEFORE_TEARDOWN'), false);
  const next = ev(app, 'Channels.get(Channels.nextVisible(Playback.current().key, 1, Zap.group())).name');
  const tasksBefore = app.tasks.length;
  const at = stopsDuring(app, () => app.press(KEYS.RIGHT, 0));
  assert.equal(at.length, 1);
  assert.equal(at[0].tasks, tasksBefore, 'AVPlay stop did not run in the key task');
  assert.ok(at[0].title.indexOf(next) >= 0, 'banner «' + at[0].title + '»');
});

test('P-S4: BANNER_BEFORE_TEARDOWN — a channel change paints the new name first — AVPlay stop/close/open run in a later task, with the banner already showing the new channel', () => {
  const app = watching({ config: { BANNER_BEFORE_TEARDOWN: true } });
  const avp = app.ctx.webapis.avplay, stop = avp.stop;
  const at = [];
  avp.stop = function () { at.push({ tasks: app.tasks.length, title: app.text('b-title') }); return stop.apply(this, arguments); };
  const tasksBefore = app.tasks.length;
  const next = ev(app, 'Channels.get(Channels.nextVisible(Playback.current().key, 1, Zap.group())).name');
  app.press(KEYS.RIGHT, 0);
  assert.equal(at.length, 1, 'stop calls: ' + at.length);
  assert.ok(at[0].tasks > tasksBefore, 'AVPlay stop ran inside the key task');
  assert.ok(at[0].title.indexOf(next) >= 0, 'the banner showed «' + at[0].title + '» at the teardown, not «' + next + '»');
});

test('P-S4: BANNER_BEFORE_TEARDOWN — a choice superseded before its deferred open never opens — only the last channel is opened', () => {
  const app = watching({ config: { BANNER_BEFORE_TEARDOWN: true } });
  const seq = app.seq();
  app.runTask('two picks', () => {
    ev(app, 'Zap.pick(Channels.at(3)); Zap.pick(Channels.at(4))');
  });
  app.advance(3000);
  const opens = app.av.calledAfter('open', seq).map((c) => c.args[0]);
  assert.equal(opens.length, 1, 'opens: ' + opens.length);
  assert.equal(opens[0], ev(app, 'Channels.at(4).url'));
});

// ---------- P-S5 (pin): the AVPlay call sequence of a channel change with every experiment flag at its default ----------
// The AVPlay calls of one ◀▶ channel change, from the key to play().
function zapCalls(app) {
  const seq = app.seq();
  app.press(KEYS.RIGHT, 0);
  app.advanceUntil(() => playsAfter(app, seq), 3000, 10);
  return app.av.calls.filter((c) => c.seq > seq);
}
test('P-S5 (pin): with the defaults (fast switching on) a channel change is stop → open → rect → method → STARTBITRATE=HIGHEST → prepareAsync → play; switched off, close() comes back after stop', () => {
  const app = watching();
  const calls = zapCalls(app);
  assert.deepEqual(calls.map((c) => c.fn), ['stop', 'open', 'setDisplayRect', 'setDisplayMethod', 'setStreamingProperty', 'prepareAsync', 'play']);
  assert.deepEqual(calls[4].args, ['ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST']);
  assert.deepEqual([...ev(app, '[CONFIG.START_BITRATE, CONFIG.AV_REUSE_NO_CLOSE, CONFIG.AV_BUFFERING_TIMEOUT_S, CONFIG.FREEZE_AS_BUFFERING, CONFIG.ARCHIVE_LONG_CONTINUATION, CONFIG.BANNER_BEFORE_TEARDOWN, CONFIG.FAST_SWITCH_DEFAULT]')],
    ['HIGHEST', true, null, false, false, false, true]);
  const off = watching({ config: { FAST_SWITCH_DEFAULT: false } });
  assert.deepEqual(zapCalls(off).map((c) => c.fn), ['stop', 'close', 'open', 'setDisplayRect', 'setDisplayMethod', 'setStreamingProperty', 'prepareAsync', 'play']);
});

// ---------- P-S13: «Быстрое переключение каналов» in «⚙ Настройки» ----------
function openSettings(app) {
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 40 && (app.cursorRow('groups') || '').indexOf('⚙ Настройки') !== 0; i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'), '«⚙ Настройки» did not open');
}
test('P-S13: «Быстрое переключение каналов» is on by default (FAST_SWITCH_DEFAULT); OK turns it off — saved, and the next zap closes the player again without a restart; OK turns it back on', () => {
  const app = watching();
  openSettings(app);
  const table = () => app.text('about-table') || '';
  assert.match(table(), /Быстрое переключение каналов\s*да/);
  for (let i = 0; i < 3; i++) app.press(KEYS.DOWN, 100);     // language, picture, adult → fast switching
  app.press(KEYS.ENTER, 300);
  assert.match(table(), /Быстрое переключение каналов\s*нет/);
  assert.equal(app.text('toast'), 'Быстрое переключение каналов выключено');
  assert.equal(app.storage.raw.get('fastSwitch'), 'false');
  app.press(KEYS.BACK, 300); app.press(KEYS.BACK, 300);
  assert.ok(zapCalls(app).some((c) => c.fn === 'close'), 'switched off, but the next zap kept the player');
  openSettings(app);
  for (let i = 0; i < 3; i++) app.press(KEYS.DOWN, 100);
  app.press(KEYS.ENTER, 300);
  assert.equal(app.storage.raw.get('fastSwitch'), 'true');
  app.press(KEYS.BACK, 300); app.press(KEYS.BACK, 300);
  assert.ok(!zapCalls(app).some((c) => c.fn === 'close'), 'switched on, but the next zap closed the player');
});

test('P-S13: a saved «off» outlives a restart even when FAST_SWITCH_DEFAULT is on; FAST_SWITCH_DEFAULT off is the value when nothing is saved', () => {
  const app = watching({ storage: { fastSwitch: 'false' } });
  assert.equal(ev(app, 'Player.fastSwitch()'), false);
  const fresh = watching({ config: { FAST_SWITCH_DEFAULT: false } });
  assert.equal(ev(fresh, 'Player.fastSwitch()'), false);
  assert.equal(ev(watching(), 'Player.fastSwitch()'), true);
});

// ---------- P-S6: the experiment flags, each read at the next open ----------
test('P-S6: START_BITRATE=AVERAGE set at runtime is used by the next open', () => {
  const app = watching();
  ev(app, 'CONFIG.START_BITRATE = "AVERAGE"');
  const seq = app.seq();
  app.press(KEYS.RIGHT, 0);
  app.advanceUntil(() => playsAfter(app, seq), 3000, 10);
  const sp = app.av.calledAfter('setStreamingProperty', seq);
  assert.deepEqual(sp[0].args, ['ADAPTIVE_INFO', 'STARTBITRATE=AVERAGE']);
});

test('P-S6: AV_REUSE_NO_CLOSE skips close() on a channel change (the stopped player is IDLE), and the channel plays', () => {
  const app = watching();
  ev(app, 'CONFIG.AV_REUSE_NO_CLOSE = true');
  const seq = app.seq();
  app.press(KEYS.RIGHT, 0);
  app.advanceUntil(() => playsAfter(app, seq), 3000, 10);
  assert.equal(app.av.calledAfter('close', seq).length, 0);
  assert.ok(playsAfter(app, seq));
});

test('P-S6: AV_BUFFERING_TIMEOUT_S calls setTimeoutForBuffering in IDLE before prepareAsync; null (default) never calls it', () => {
  const app = watching();
  const got = [];
  app.ctx.webapis.avplay.setTimeoutForBuffering = function (s) { got.push({ s: s, state: app.av.state, prepared: app.av.calls.filter((c) => c.fn === 'prepareAsync').length }); };
  app.press(KEYS.RIGHT, 3000);
  assert.deepEqual(got, [], 'called with the default');
  ev(app, 'CONFIG.AV_BUFFERING_TIMEOUT_S = 10');
  const before = app.av.calls.filter((c) => c.fn === 'prepareAsync').length;
  app.press(KEYS.RIGHT, 3000);
  assert.deepEqual(got, [{ s: 10, state: 'IDLE', prepared: before }]);
});

test('P-S6: FREEZE_AS_BUFFERING shows the spinner for a frozen picture after FREEZE_MS + the rebuffer grace; off (default) it does not', () => {
  for (const on of [false, true]) {
    const app = watching();
    ev(app, 'CONFIG.FREEZE_AS_BUFFERING = ' + on);
    app.av.stalled = true;
    const seen = spinnerSeenUntil(app, () => false, ev(app, 'CONFIG.FREEZE_MS + CONFIG.SPINNER_GRACE_REBUFFER_MS') + 1500);
    assert.equal(seen, on, 'flag ' + on);
    app.av.stalled = false;
    app.advance(1100);
    assert.equal(app.visible('spinner'), false, 'the spinner stayed after the picture moved again (flag ' + on + ')');
  }
});

// ---------- P-S7: archive request length (F-S8 minimum, S-7 flag) ----------
// Plays channel 0's archive from `remainder` before the end of the programme two hours ago; returns the request's span.
function archiveSpan(app, remainderMs) {
  const end = Math.floor(app.clock.now / HOUR) * HOUR - 2 * HOUR;
  const seq = app.seq();
  ev(app, 'Playback.archive(Playback.current(), ' + (end - remainderMs) + ')');
  app.advance(0);
  const url = app.av.calledAfter('open', seq).map((c) => c.args[0]).pop();
  assert.ok(url && /archive=/.test(url), 'no archive opened');
  return spanOf(url);
}
function withGuide() { const app = watching(); app.advanceUntil(() => ev(app, 'EPG.at(Playback.current().id, Date.now() - 3 * 3600000) !== null'), 10000, 50); return app; }

for (const r of [500, 5 * SEC, 59 * SEC, 61 * SEC, 299 * SEC]) {
  test('P-S7: a moment ' + r / SEC + ' s before a programme\'s end asks for the next programme too (never a recording of a few seconds)', () => {
    const app = withGuide();
    const span = archiveSpan(app, r);
    assert.ok(span >= ev(app, 'CONFIG.ARCHIVE_MIN_SPAN_MS'), 'span ' + span / SEC + ' s');
    assert.equal(span, Math.floor((r + HOUR) / SEC) * SEC);
  });
}
test('P-S7 (pin): a moment more than ARCHIVE_MIN_SPAN_MS before the end asks for the rest of that programme only', () => {
  const app = withGuide();
  assert.equal(archiveSpan(app, 20 * MIN), 20 * MIN);
});
test('P-S7: ARCHIVE_LONG_CONTINUATION asks for ARCHIVE_SPAN_MS instead of one programme', () => {
  const app = withGuide();
  ev(app, 'CONFIG.ARCHIVE_LONG_CONTINUATION = true');
  const end = Math.floor(app.clock.now / HOUR) * HOUR - 6 * HOUR;
  const seq = app.seq();
  ev(app, 'Playback.archive(Playback.current(), ' + (end - 20 * MIN) + ')');
  app.advance(0);
  assert.equal(spanOf(app.av.calledAfter('open', seq).pop().args[0]), ev(app, 'CONFIG.ARCHIVE_SPAN_MS'));
});

// ---------- P-S8: formats AVPlay cannot play are dead at parse (F-S12) ----------
const RTMP = (id) => (id === 'ch2' ? 'rtmp://live.example.test/app/' + id : id === 'ch3' ? 'http://tv.example.test/' + id + '/watch.html' : f.m3uStreamUrl(id));
test('P-S8: an rtmp:// entry and a web page are marked dead at parse; an http(s) stream is not', () => {
  const app = f.untilPlaying(f.m3uApp({ m3u: { streamUrl: RTMP } }));
  assert.deepEqual([...ev(app, '[Channels.byNum(1).dead, Channels.byNum(2).dead, Channels.byNum(3).dead, Channels.byNum(4).dead]')], [false, true, true, false]);
});

test('P-S8: picking a dead channel never opens it and never retries: the old stream stops, no spinner, one toast, over a minute', () => {
  const app = f.untilPlaying(f.m3uApp({ m3u: { streamUrl: RTMP } }));
  app.advance(5000);
  const seq = app.seq();
  ev(app, 'Zap.pick(Channels.byNum(2))');
  let spin = false;
  for (let t = 0; t < 60000; t += 100) { app.advance(100); if (app.visible('spinner')) spin = true; }
  assert.equal(app.av.calledAfter('open', seq).length, 0, 'opened');
  assert.ok(app.av.calledAfter('stop', seq).length >= 1, 'the previous stream kept playing');
  assert.equal(spin, false);
  assert.equal(ev(app, 'Playback.current().key'), ev(app, 'Channels.byNum(2).key'));
  assert.equal(ev(app, 'Diag.snapshot().recent.length'), 0, 'retried');
  assert.equal(app.text('toast'), ev(app, 'I18n.t("m.unplayable")'));
});

test('P-S8: the offline copy keeps a dead entry dead', () => {
  const first = f.untilPlaying(f.m3uApp({ m3u: { streamUrl: RTMP } }));
  first.advance(40000);
  const storage = {};
  for (const [k, v] of first.storage.raw) storage[k] = v;
  const app = f.m3uApp({ m3u: { streamUrl: RTMP }, listDown: true, storage });
  app.advance(3000);
  assert.equal(ev(app, 'Channels.count() > 0 && Channels.byNum(2).dead'), true);
});

// ---------- P-S9: catch-up days a playlist does not declare (F-S13) ----------
test('P-S9: an M3U channel with catch-up but no days uses ARCHIVE_DAYS_UNDECLARED; declared days and OTT Club keep theirs', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  assert.equal(ev(app, 'Catchup.days({ catchup: "default" })'), ev(app, 'CONFIG.ARCHIVE_DAYS_UNDECLARED'));
  assert.ok(ev(app, 'CONFIG.ARCHIVE_DAYS_UNDECLARED < CONFIG.ARCHIVE_DAYS'));
  assert.equal(ev(app, 'Catchup.days({ catchup: "default", catchupDays: 5 })'), 5);
  assert.equal(ev(app, 'Catchup.days(Channels.at(0))'), 7);
});

// ---------- P-S10: catch-up-source formatted tokens (F-S14) ----------
test('P-S10: {utc:YmdHMS}, {utcend:…}, {lutc:…}, ${start:Y-m-d}, {duration:60} and {offset:60} are filled (UTC for the utc forms)', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  const START = Date.UTC(2026, 9, 24, 18, 30, 5), now = app.clock.now;
  const ch = JSON.stringify({ url: 'http://iptv.example.test/live/ch1/index.m3u8', catchup: 'default', catchupDays: 7,
    catchupSource: 'http://a.example.test/{utc:YmdHMS}/{utcend:Y-m-d_H.M.S}/${start:Y}/{duration:60}/{offset:60}/{lutc:H}.m3u8' });
  const url = ev(app, 'Catchup.url(' + ch + ', ' + START + ', ' + HOUR + ')');
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const local = new Date(START), offset = Math.floor((Math.floor(now / 1000) - START / 1000) / 60);
  assert.equal(url, 'http://a.example.test/20261024183005/2026-10-24_19.30.05/' + local.getFullYear() + '/60/' + offset + '/' + pad(new Date(now).getUTCHours()) + '.m3u8');
});

// ---------- P-S11: S-0 timeline marks and S-10 player events in Diag ----------
test('P-S11: Diag.snapshot() holds the attempt\'s timeline — key, stop, close, open, setup, prepared, play, first time, first-frame reads — in order', () => {
  const app = watching();
  app.press(KEYS.RIGHT, 3000);
  const a = ev(app, 'Diag.snapshot().attempts').pop();
  const order = ['key', 'start', 'stop', 'close', 'open', 'setup', 'prepared', 'play', 'firstTime', 'ffRead0', 'ffRead1'];
  for (const k of order) assert.equal(typeof a.marks[k], 'number', 'mark ' + k + ' missing: ' + JSON.stringify(a.marks));
  for (let i = 1; i < order.length; i++) assert.ok(a.marks[order[i]] >= a.marks[order[i - 1]], order[i] + ' before ' + order[i - 1]);
  assert.equal(a.archive, false);
  assert.ok(ev(app, 'Diag.snapshot().attempts.length') <= ev(app, 'CONFIG.DIAG_ATTEMPTS'));
});

test('P-S11: AVPlay onevent types are counted in Diag, with a URL in the data redacted (no key)', () => {
  const app = watching();
  app.runTask('av-onevent', () => app.av.listener.onevent('PLAYER_MSG_HTTP_ERROR_CODE', 'http://myott.top/stream/' + f.FAKE_KEY + '/1001.m3u8?x=1 404'));
  app.runTask('av-onevent', () => app.av.listener.onevent('PLAYER_MSG_BITRATE_CHANGE', '4000000'));
  const s = ev(app, 'Diag.snapshot()');
  assert.equal(s.counters['avEvent.PLAYER_MSG_HTTP_ERROR_CODE'], 1);
  assert.equal(s.counters['avEvent.PLAYER_MSG_BITRATE_CHANGE'], 1);
  assert.equal(s.notes['avEvent.PLAYER_MSG_BITRATE_CHANGE'], '4000000');
  assert.ok(JSON.stringify(s).indexOf(f.FAKE_KEY) < 0, 'the key leaked into Diag');
  assert.equal(typeof s.attempts.pop().marks['ev.PLAYER_MSG_HTTP_ERROR_CODE'], 'number');
});

test('P-S12 (pin): F-S16 — the background handler bumps the selection, so a pending zap never lands while hidden', () => {
  const app = watching();
  const sel = ev(app, 'Playback.selection()');
  app.setHidden(true);
  assert.equal(ev(app, 'Playback.selection()'), sel + 1);
  app.setHidden(false);
});
