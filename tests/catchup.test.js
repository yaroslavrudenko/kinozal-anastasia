'use strict';
// Catch-up URL templates (review §2: `${Y}`-style placeholders leave a stray `$`, e.g. `$2026-$10-$24`).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');

const START = Date.UTC(2026, 9, 24, 18, 30, 0);       // a show that aired yesterday evening
const DURATION = 3600000;
const pad = (n) => (n < 10 ? '0' : '') + n;
const local = new Date(START);
const DATE = local.getFullYear() + '-' + pad(local.getMonth() + 1) + '-' + pad(local.getDate());
const TIME = pad(local.getHours()) + pad(local.getMinutes()) + pad(local.getSeconds());

function archiveUrl(source) {
  const app = createApp();
  const ch = { url: 'http://iptv.example.test/live/ch1/index.m3u8', catchup: 'default', catchupSource: source, catchupDays: 7 };
  return app.ctx.Catchup.url(ch, START, DURATION);
}

test('catch-up: a ${Y}-${m}-${d}/${H}${M}${S} template has no stray "$"', () => {
  const url = archiveUrl('http://archive.example.test/ch1/${Y}-${m}-${d}/${H}${M}${S}.m3u8');
  assert.equal(url, 'http://archive.example.test/ch1/' + DATE + '/' + TIME + '.m3u8');
});

test('catch-up (pin): a {Y}-{m}-{d}/{H}{M}{S} template is filled', () => {
  const url = archiveUrl('http://archive.example.test/ch1/{Y}-{m}-{d}/{H}{M}{S}.m3u8');
  assert.equal(url, 'http://archive.example.test/ch1/' + DATE + '/' + TIME + '.m3u8');
});

test('catch-up (pin): ${start} and ${duration} are filled', () => {
  const url = archiveUrl('?utc=${start}&dur=${duration}');
  assert.equal(url, 'http://iptv.example.test/live/ch1/index.m3u8?utc=' + START / 1000 + '&dur=' + DURATION / 1000);
});
