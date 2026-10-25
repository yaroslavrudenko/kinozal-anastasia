'use strict';
// The on-device failure log (localStorage "failLog", read by the TV scripts) never keeps credentials
// (verify/codex.md S02: path credentials /live/USER/PASS/ stayed in the log).
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('./fixtures');

const USER = 'anastasia', PASS = 'fake123';
const STREAMS = {
  path: (id) => 'http://iptv.example.test/live/' + USER + '/' + PASS + '/' + id + '.ts',
  query: (id) => 'http://iptv.example.test/live/' + id + '.m3u8?username=' + USER + '&password=' + PASS,
  userinfo: (id) => 'http://' + USER + ':' + PASS + '@iptv.example.test/live/' + id + '.m3u8'
};

// Every playback attempt fails; returns the fail log as stored on the device after it was flushed.
function failLogFor(streamUrl) {
  const app = f.m3uApp({ channels: 3, boot: false, m3u: { streamUrl } });
  app.av.prepareFails = true;
  app.boot();
  app.advance(120000);
  const log = JSON.parse(app.storage.raw.get('failLog') || '[]');
  assert.ok(log.length > 0, 'nothing was logged although every attempt failed');
  return log;
}

for (const [kind, streamUrl] of Object.entries(STREAMS)) {
  test('failLog: ' + kind + ' credentials of an M3U stream URL are not stored' + (kind === 'path' ? '' : ' (pin)'), () => {
    const leaks = failLogFor(streamUrl).filter((l) => l.indexOf(PASS) >= 0 || l.indexOf(USER) >= 0);
    assert.deepEqual(leaks, []);
  });
}
