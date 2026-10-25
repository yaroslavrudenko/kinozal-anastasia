'use strict';
// Programme panel opened before the channel's full guide arrived (verify/round5-codex.md item 4): when the
// guide arrives the cursor goes to the programme on air — unless the viewer really moved it. An ▲ / ▼
// that could not move the cursor (the one-row "now" seed) is not a move.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

function panelBeforeGuide(keyBefore) {
  const app = f.untilPlaying(f.ottApp({ channels: 10, guideLatency: 6000 }));
  app.advance(300);
  app.press(KEYS.DOWN, 100);                            // panel: only the seed (one row, on air)
  assert.ok(app.visible('prog'), 'the panel did not open');
  if (keyBefore) app.press(keyBefore, 100);
  app.advance(10000);                                   // the full guide arrives
  assert.ok(app.rows('p-list').length > 1, 'the full guide never reached the panel');
  return app.cursorRow('p-list') || '';
}

test('panel (pin): with no key pressed, the late full guide puts the cursor on the programme on air', () => {
  assert.match(panelBeforeGuide(null), /в эфире/);
});

for (const name of ['UP', 'DOWN']) {
  test('panel: ' + name + ' at the one-row seed (cursor cannot move) does not stop the cursor going to the programme on air', () => {
    assert.match(panelBeforeGuide(KEYS[name]), /в эфире/);
  });
}
