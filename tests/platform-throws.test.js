'use strict';
// The TV's platform calls can THROW (the 2017 TV threw WebAPIException error 18 from
// webapis.network.addNetworkStateChangeListener and the build failed to start). Every optional platform
// call on the boot / landing path is made to throw, one at a time: the app must still load the list,
// start the first channel (Player.open → PLAYING), zap to the next one, and never leak an uncaught error.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const OPTIONAL_CALLS = [
  'webapis.network.addNetworkStateChangeListener',
  'webapis.avplay.getCurrentStreamInfo',
  'webapis.avplay.setStreamingProperty',
  'webapis.avplay.setBufferingParam',
  'webapis.productinfo.getVersion',
  'webapis.productinfo.getModel',
  'webapis.tvinfo.getVersion',
  'tizen.tvinputdevice.getSupportedKeys',
  'tizen.tvinputdevice.registerKey',
  'tizen.systeminfo.getCapability'
];
const errorsOf = (app) => app.errors.map((e) => e.label + ': ' + (e.error && (e.error.message || JSON.stringify(e.error))));

for (const call of OPTIONAL_CALLS) {
  test('platform: boot and a zap still work when ' + call + ' throws (error 18)', (t) => {
    const app = f.ottApp({ channels: 10, boot: false, platformThrows: [call] });
    app.boot();
    assert.ok(app.advanceUntil(() => f.startedPlaying(app), 5000), 'the first channel never reached PLAYING');
    assert.ok(app.net.requests((r) => f.isList(r.url)).length >= 1, 'the channel list was never requested');
    app.advance(3000);
    const zapSeq = app.seq();
    app.press(KEYS.RIGHT, 0);
    assert.ok(app.advanceUntil(() => app.av.calledAfter('play', zapSeq).length > 0, 5000), 'the zap never reached PLAYING');
    app.advance(5000);
    assert.deepEqual(errorsOf(app), [], 'uncaught errors');
    if (!app.thrown.length) t.diagnostic(call + ' was not called on this path');
  });
}
