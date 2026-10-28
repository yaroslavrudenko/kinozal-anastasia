'use strict';
// The picture fits the TV screen exactly (owner, 2026-10-27: «изображение ложилось чётко на размер экрана, чтобы
// оно не было уже, и стрим адаптировался под разрешение и размер экрана телевизора»; «поставить себе отметку,
// чтобы мы не потеряли эту функциональность»). Every stream the player opens gets the whole 1920×1080 screen,
// the full-screen display mode by default, and adaptive quality that starts at the best the bandwidth allows.
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const callsAfter = (app, fn, seq) => app.av.calls.filter((c) => c.fn === fn && c.seq > seq);

test('picture fit: every stream opened (start and each zap) gets the whole 1920×1080 screen, full screen by default, adaptive quality from the highest', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 6 }));
  for (let i = 0; i < 3; i++) app.press(KEYS.RIGHT, 4000);
  const opens = app.av.calls.filter((c) => c.fn === 'open');
  assert.ok(opens.length >= 4, 'streams opened: ' + opens.length);
  for (const o of opens) {
    const rect = callsAfter(app, 'setDisplayRect', o.seq)[0], mode = callsAfter(app, 'setDisplayMethod', o.seq)[0];
    const abr = callsAfter(app, 'setStreamingProperty', o.seq).find((c) => c.args[0] === 'ADAPTIVE_INFO');
    assert.deepEqual(rect && rect.args, [0, 0, 1920, 1080], 'display rect after ' + o.args[0]);
    assert.deepEqual(mode && mode.args, ['PLAYER_DISPLAY_MODE_FULL_SCREEN'], 'display mode after ' + o.args[0]);
    assert.ok(abr && /STARTBITRATE=HIGHEST/.test(abr.args[1]), 'adaptive start after ' + o.args[0]);
  }
});

test('picture fit: GREEN cycles full screen → aspect-keeping → with borders → full screen, and the choice is kept', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  const modes = [];
  for (let i = 0; i < 3; i++) {
    const seq = app.seq();
    app.press(KEYS.GREEN, 300);
    modes.push((callsAfter(app, 'setDisplayMethod', seq)[0] || { args: [] }).args[0]);
  }
  assert.deepEqual(modes, ['PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO', 'PLAYER_DISPLAY_MODE_LETTER_BOX', 'PLAYER_DISPLAY_MODE_FULL_SCREEN']);
  assert.equal(app.storage.raw.get('displayIdx'), '0');
});

test('picture fit: the setting «Картинка во весь экран» in «⚙ Настройки» is on by default; OK turns it off (stream proportions) and on again', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);                             // the groups column
  for (let i = 0; i < 40 && (app.cursorRow('groups') || '').indexOf('⚙ Настройки') !== 0; i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'), '«⚙ Настройки» did not open');
  const table = () => app.text('about-table') || '';
  assert.match(table(), /Картинка во весь экран\s*да/);
  app.press(KEYS.DOWN, 100);                             // past «Язык интерфейса» to the picture setting
  let seq = app.seq();
  app.press(KEYS.ENTER, 300);
  assert.deepEqual((callsAfter(app, 'setDisplayMethod', seq)[0] || { args: [] }).args, ['PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO']);
  assert.match(table(), /Картинка во весь экран\s*нет/);
  seq = app.seq();
  app.press(KEYS.ENTER, 300);
  assert.deepEqual((callsAfter(app, 'setDisplayMethod', seq)[0] || { args: [] }).args, ['PLAYER_DISPLAY_MODE_FULL_SCREEN']);
  app.press(KEYS.DOWN, 100);
  app.press(KEYS.ENTER, 100);                            // the second setting: adult channels
  assert.match(table(), /Каналы для взрослых\s*показываются/);
});


// Owner, 2026-10-27: «перейти на пункт автора, нажать «Ввод», и открылся браузер с моим LinkedIn-профайлом».
test('about: «Автор» is in «ℹ О программе»; OK on it opens the author\'s LinkedIn profile in the TV\'s browser', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 3 }));
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 40 && (app.cursorRow('groups') || '').indexOf('ℹ О программе') !== 0; i++) app.press(KEYS.DOWN, 10);
  app.press(KEYS.ENTER, 300);
  assert.match(app.text('about-table') || '', /Автор\s*Ярослав Руденко/);
  app.press(KEYS.ENTER, 300);                            // «Автор» is the only item, under the cursor
  const opened = app.events.filter((e) => e.type === 'appcontrol');
  assert.deepEqual(opened.map((e) => [e.operation, e.uri]), [['http://tizen.org/appcontrol/operation/view', 'https://www.linkedin.com/in/yaroslav-rudenko-2303']]);
});
