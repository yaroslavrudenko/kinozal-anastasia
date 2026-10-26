'use strict';
// D4 (dry run of the TV runner, 2026-10-26): after midnight the ▼ panel's «Сегодня» must include the
// programme on air that started before 00:00, and the cursor must be on it («в эфире») — not on the first
// programme of the new day, which has not started yet.
process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert/strict');
const { KEYS } = require('./harness');
const f = require('./fixtures');

const HOUR = 3600000;
const NOW = Date.UTC(2026, 9, 25, 22, 30);                // 26.10 00:30 in Israel (UTC+2)
// Two-hour programmes on odd UTC hours: the one on air ran 21:00–23:00 UTC = 23:00–01:00 local.
function guide(id) {
  const epg = [];
  for (let t = NOW - 7 * 24 * HOUR - 3 * HOUR; t < NOW + 24 * HOUR; t += 2 * HOUR) {
    const start = Math.floor(t / (2 * HOUR)) * 2 * HOUR + HOUR;
    if (epg.length && epg[epg.length - 1].time === start / 1000) continue;
    epg.push({ name: 'Ночной фильм ' + id + ' ' + new Date(start).toISOString().slice(5, 16), descr: '', time: start / 1000, time_to: (start + 2 * HOUR) / 1000 });
  }
  return JSON.stringify({ epg_data: epg });
}
const ON_AIR = (id) => 'Ночной фильм ' + id + ' ' + new Date(Date.UTC(2026, 9, 25, 21)).toISOString().slice(5, 16);

function panelAfterMidnight(keysBefore) {
  const app = f.ottApp({ channels: 10, now: NOW, guideLatency: 50, boot: false });
  app.net.route((u) => f.isGuide(u), (req) => ({ body: guide(f.guideIdOf(req.url)), delay: 50 }));
  app.boot();
  f.untilPlaying(app);
  app.advance(3000);                                        // the watched channel's guide has arrived
  app.press(KEYS.DOWN, 500);
  for (const k of keysBefore || []) app.press(k, 300);
  return { app, id: f.streamIdOf(f.lastOpenUrl(app)) };
}

test('panel after midnight (D4): «Сегодня» lists the programme on air that started before 00:00', () => {
  const { app, id } = panelAfterMidnight();
  const rows = app.rowsDetailed('p-list').map((r) => r.cells[2]);
  assert.ok(rows.some((t) => t.indexOf(ON_AIR(id)) >= 0), 'not in the panel: ' + ON_AIR(id) + ' · rows ' + JSON.stringify(rows.slice(0, 4)));
});

test('panel after midnight (D4): the cursor is on that programme, marked «в эфире»', () => {
  const { app, id } = panelAfterMidnight();
  const cur = app.rowsDetailed('p-list').find((r) => r.classes.indexOf('focus') >= 0);
  assert.ok(cur && cur.cells[2].indexOf(ON_AIR(id)) >= 0 && cur.cells[3] === 'в эфире', 'cursor on ' + JSON.stringify(cur && cur.cells));
});

test('panel after midnight (pin): OK on it plays its archive from its start (23:00 local)', () => {
  const { app } = panelAfterMidnight();
  const seq = app.seq();
  app.press(KEYS.ENTER, 1000);
  const url = app.av.calledAfter('open', seq).map((c) => c.args[0]).pop();
  assert.equal(f.archiveStartOf(url), Date.UTC(2026, 9, 25, 21));
});
