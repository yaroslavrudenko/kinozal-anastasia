'use strict';
// Version parity (plan §6.2): the version the app shows equals the one the TV installs (config.xml).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp, ROOT } = require('./harness');

test('config (pin): CONFIG.VERSION equals the widget version in config.xml', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'config.xml'), 'utf8');
  const widget = /<widget\b[^>]*\bversion="([^"]+)"/.exec(xml);
  assert.ok(widget, 'no version attribute on <widget> in config.xml');
  assert.equal(createApp().ctx.CONFIG.VERSION, widget[1]);
});
