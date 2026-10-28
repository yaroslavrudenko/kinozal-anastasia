'use strict';
// The interface language (owner, 2026-10-27: «О программе» becomes «Настройки» with the interface language —
// Russian by default, then Ukrainian, Hebrew, English; «Мы переводим интерфейс. Название канала возвращает
// провайдер»). The app's own texts change; channel names, programmes and a provider's own groups do not.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createApp, KEYS } = require('./harness');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
// The interface language the app runs in: the page's lang (I18n.apply).
const langOf = (app) => app.document.documentElement.getAttribute('lang');
const groupNames = (app) => ev(app, 'Channels.groups().map(function (g) { return g.name; })');
// The app as it starts again after a restart: a new app booted from the previous one's storage (everything it kept).
const successor = (prev) => f.untilPlaying(f.ottApp({ channels: 8, storage: Object.fromEntries(prev.storage.raw) }));
const withLang = (lang, opts) => f.untilPlaying(f.ottApp(Object.assign({ channels: 8 }, opts || {}, { storage: Object.assign({ lang: JSON.stringify(lang) }, (opts || {}).storage || {}) })));
function openSettings(app) {
  app.press(KEYS.ENTER, 300);
  app.press(ev(app, 'I18n.rtl()') ? KEYS.RIGHT : KEYS.LEFT, 100);   // toward the groups column (on the right in Hebrew)
  for (let i = 0; i < 40; i++) { if (app.ctx.Channels.groups()[app.ctx.Channels.groups().length - 1] && /⚙/.test(app.cursorRow('groups') || '')) break; app.press(KEYS.DOWN, 10); }
  app.press(KEYS.ENTER, 300);
  assert.ok(app.visible('about'), 'the settings did not open');
}
// On the language row: OK opens the language list, ▼ moves to the next language, OK picks it (REGISTER4 #6).
function pickNext(app, ms) {
  app.press(KEYS.ENTER, 50);
  assert.ok(app.visible('lang'), 'the language list did not open');
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.ENTER, ms);
}

test('i18n: the dictionary has a non-empty text in all four languages for every key, and the same {n} placeholders', () => {
  const app = createApp({});
  const table = ev(app, 'I18n.table()'), bad = [];
  for (const k of Object.keys(table)) {
    const row = table[k];
    if (!Array.isArray(row) || row.length !== 4) { bad.push(k + ': not 4 languages'); continue; }
    const holes = (x) => (typeof x === 'string' ? (x.match(/\{\d\}/g) || []).sort().join() : '');
    row.forEach((x, i) => { if (!x || (Array.isArray(x) && !x.length)) bad.push(k + '[' + i + '] empty'); if (holes(x) !== holes(row[0])) bad.push(k + '[' + i + '] placeholders'); });
  }
  assert.deepEqual(bad, []);
});

test('i18n: Russian by default — the menu and «⚙ Настройки» are Russian', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  assert.equal(langOf(app), 'ru');
  const g = groupNames(app);
  assert.ok(g.indexOf('Все каналы') >= 0 && g.indexOf('⚙ Настройки') >= 0 && g.indexOf('📡 Провайдеры') >= 0, JSON.stringify(g));
});

test('i18n: in «⚙ Настройки» → «Язык интерфейса» the next language picked from the list each time — Українська, עברית, English, Русский; each choice is saved and a fresh app starts in it', () => {
  const seen = [];
  let app = withLang('ru');
  for (let i = 0; i < 4; i++) {
    openSettings(app);
    pickNext(app, 600);
    assert.equal(app.events.filter((e) => e.type === 'reload').length, 1, 'no restart after the language change');
    const lang = JSON.parse(app.storage.raw.get('lang'));
    seen.push(lang);
    app = successor(app);                             // the app as it starts again after the reload, from what was saved
    assert.equal(langOf(app), lang);
    if (lang === 'en') assert.ok(groupNames(app).indexOf('⚙ Settings') >= 0);
  }
  assert.deepEqual(seen, ['uk', 'he', 'en', 'ru']);
});

test('i18n: in English the menu, «Providers» and the free playlists are English; channel names stay as the provider gives them', () => {
  const app = withLang('en');
  const g = groupNames(app);
  for (const n of ['🔍 Search', 'All channels', '📡 Providers', '⚙ Settings']) assert.ok(g.indexOf(n) >= 0, n + ' missing: ' + JSON.stringify(g));
  const rows = ev(app, 'Sources.list().map(function (r) { return r.name; })');
  assert.match(rows[1], /^iptv-org — free channels/);
  const pls = ev(app, 'Sources.list()[1].playlists.map(function (p) { return p.name; })');
  assert.equal(pls[0], 'The whole list — channels from around the world');
  const names = ev(app, 'Channels.groups()[1].items.map(function (i) { return Channels.at(i).name; })');
  const provider = Object.values(JSON.parse(app.fixture.list.body)).map((c) => c.channel_name);
  assert.ok(names.length && names.every((n) => provider.indexOf(n) >= 0), 'a channel name was changed: ' + JSON.stringify(names));
  app.press(KEYS.YELLOW, 300);
  assert.match(app.text('toast') || '', /Added to favourites|Removed from favourites/);
});

const IPTV = 'https://iptv-org.github.io/iptv/countries/il.m3u';
function playlistApp(url, body, lang) {
  const app = f.m3uApp({ boot: false, storage: { lang: JSON.stringify(lang), playlistUrl: JSON.stringify(url) } });
  app.net.route((u) => u === url, () => ({ body, delay: 100 }));
  app.boot();
  app.advance(3000);
  return app;
}
const PL = ['#EXTM3U', '#EXTINF:-1 tvg-id="Kan11.il@SD" group-title="General;News",Kan 11 (1080p)', 'http://iptv.example.test/live/1/index.m3u8',
  '#EXTINF:-1 tvg-id="Inter.ua@SD" group-title="Kids",Inter (576p)', 'http://iptv.example.test/live/2/index.m3u8',
  '#EXTINF:-1,', 'http://iptv.example.test/live/3/index.m3u8', ''].join('\n');

test('i18n: in English an iptv-org playlist shows its groups as given; Israel and Ukraine pinned groups are English', () => {
  const g = groupNames(playlistApp(IPTV, PL, 'en'));
  for (const n of ['Israel', 'Ukraine', 'News', 'Kids']) assert.ok(g.indexOf(n) >= 0, n + ' missing: ' + JSON.stringify(g));
});

test('i18n: groups the provider gives are shown as given in every language — iptv-org\'s «News» and «Kids», any playlist\'s; our own groups are translated', () => {
  for (const url of [IPTV, 'http://my-provider.test/list.m3u']) {
    for (const [lang, own] of [['ru', ['Израиль', 'Украина', 'Все каналы']], ['he', ['ישראל', 'אוקראינה', 'כל הערוצים']], ['en', ['Israel', 'Ukraine', 'All channels']]]) {
      const g = groupNames(playlistApp(url, PL, lang));
      for (const n of ['News', 'Kids'].concat(own)) assert.ok(g.indexOf(n) >= 0, lang + ' ' + url + ': ' + n + ' missing in ' + JSON.stringify(g));
    }
  }
});

test('i18n: an entry with no name keeps the same key in every language (a favourite outlives a language change)', () => {
  const keys = ['ru', 'en', 'he'].map((lang) => ev(playlistApp(IPTV, PL, lang), 'Channels.groups()[1].items.map(function (i) { return Channels.at(i); }).filter(function (c) { return c.unnamed; }).map(function (c) { return [c.key, c.name]; })'));
  assert.equal(keys[0].length, 1);
  assert.deepEqual(keys.map((k) => k[0][0]), [keys[0][0][0], keys[0][0][0], keys[0][0][0]]);
  assert.equal(keys[0][0][0].indexOf('m3u:канал|'), 0);
  assert.deepEqual(keys.map((k) => k[0][1]), ['Канал', 'Channel', 'ערוץ']);
});

test('i18n: the language switch keeps the channel being watched, and a double OK moves one language only', () => {
  const app = f.untilPlaying(f.ottApp({ channels: 8 }));
  app.press(KEYS.RIGHT, 1400);
  const watching = ev(app, 'Playback.current().key');
  app.press(KEYS.RIGHT, 50);                       // the next channel has played 50 ms: no landing save yet
  const now = ev(app, 'Playback.current().key');
  assert.notEqual(now, watching);
  openSettings(app);
  pickNext(app, 100);
  app.press(KEYS.ENTER, 100);
  assert.equal(JSON.parse(app.storage.raw.get('lang')), 'uk', 'a second OK before the restart skipped a language');
  assert.equal(JSON.parse(app.storage.raw.get('lastCh'))[10], now, 'the restart would come back to an older channel');
  assert.equal(app.events.filter((e) => e.type === 'reload').length, 0);
  app.advance(1000);
  assert.equal(app.events.filter((e) => e.type === 'reload').length, 1);
  // The app started again from what was saved: the same channel plays, in Ukrainian.
  const next = successor(app);
  assert.equal(langOf(next), 'uk');
  assert.equal(ev(next, 'Playback.current().key'), now, 'the restarted app plays another channel');
});

test('i18n: a language change keeps the channel and the group: three restarts in a row, each from the previous app\'s storage, come back to the same channel in the same group', () => {
  let app = f.untilPlaying(f.ottApp({ channels: 12 }));
  app.press(KEYS.ENTER, 300);
  app.press(KEYS.LEFT, 100);
  for (let i = 0; i < 4; i++) app.press(KEYS.DOWN, 50);         // a provider group
  app.press(KEYS.RIGHT, 100);
  app.press(KEYS.DOWN, 50);
  app.press(KEYS.ENTER, 2500);                                // a channel picked in it: the zap group
  const want = ev(app, '[Playback.current().key, Channels.groups()[Zap.group()].key]');
  assert.ok(/^grp:/.test(want[1]), 'not a provider group: ' + want[1]);
  for (let i = 0; i < 3; i++) {
    openSettings(app);
    pickNext(app, 600);
    app = successor(app);
    assert.deepEqual([langOf(app)].concat(ev(app, '[Playback.current().key, Channels.groups()[Zap.group()].key]')), [['uk', 'he', 'en'][i]].concat(want));
  }
});

test('i18n: every I18n key the code uses is in the dictionary', () => {
  const fs = require('node:fs'), path = require('node:path');
  const root = path.join(__dirname, '..'), table = ev(createApp({}), 'I18n.table()'), missing = [];
  const files = ['index.html'].concat(fs.readdirSync(path.join(root, 'js')).filter((x) => x.endsWith('.js')).map((x) => 'js/' + x),
    fs.readdirSync(path.join(root, 'js/overlays')).map((x) => 'js/overlays/' + x));
  let used = 0;
  for (const file of files) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    for (const re of [/I18n\.(?:t|n|list)\('([a-zA-Z0-9.]*[a-zA-Z0-9])'/g, /data-tp?="([a-zA-Z0-9.]+)"/g, /label: '([a-z]+\.[a-zA-Z0-9.]+)'/g, /(?:on|off): '([a-z]+\.[a-zA-Z]+)'/g]) {
      let m;
      while ((m = re.exec(src))) { used++; if (!table[m[1]]) missing.push(file + ': ' + m[1]); }
    }
  }
  assert.ok(used > 100, 'only ' + used + ' uses found: the scan is broken');
  assert.deepEqual(missing, []);
});

test('i18n: the Ukrainian, Hebrew and English texts carry no Russian, and Hebrew and English carry no Cyrillic at all', () => {
  const table = ev(createApp({}), 'I18n.table()'), bad = [];
  const RU_ONLY = /[ЫыЭэЪъЁё]/, CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;
  const ALLOW = /Ярослав|Руденко|Ярослав Руденко/;
  for (const k of Object.keys(table)) {
    const [, uk, he, en] = table[k].map((x) => [].concat(x).join(' '));
    if (RU_ONLY.test(uk)) bad.push(k + ' uk: ' + uk);
    for (const [l, x] of [['he', he], ['en', en]]) if (CYR.test(x.replace(ALLOW, ''))) bad.push(k + ' ' + l + ': ' + x);
  }
  assert.deepEqual(bad, []);
});

test('i18n: Russian and Hebrew plural forms', () => {
  const ru = withLang('ru'), he = withLang('he');
  assert.deepEqual(ev(ru, '[1, 2, 5, 11, 21, 22, 25].map(function (n) { return I18n.n(n, "channel"); })'),
    ['1 канал', '2 канала', '5 каналов', '11 каналов', '21 канал', '22 канала', '25 каналов']);
  assert.deepEqual(ev(he, '[1, 2, 5, 11, 21].map(function (n) { return I18n.n(n, "channel"); })'), ['1 ערוץ', '2 ערוצים', '5 ערוצים', '11 ערוצים', '21 ערוצים']);
  assert.deepEqual(ev(he, '[1, 3].map(function (n) { return I18n.n(n, "day"); })'), ['1 יום', '3 ימים']);
});

test('i18n: Hebrew is written right to left; Ukrainian uses its own plural forms', () => {
  const he = withLang('he');
  assert.equal(he.document.documentElement.getAttribute('dir'), 'rtl');
  assert.equal(he.document.documentElement.getAttribute('lang'), 'he');
  assert.ok(groupNames(he).indexOf('כל הערוצים') >= 0, JSON.stringify(groupNames(he)));
  const uk = withLang('uk');
  assert.equal(uk.document.documentElement.getAttribute('dir'), 'ltr');
  assert.deepEqual(ev(uk, '[1, 2, 5, 11, 21, 22].map(function (n) { return I18n.n(n, "playlist"); })'),
    ['1 плейлист', '2 плейлисти', '5 плейлистів', '11 плейлистів', '21 плейлист', '22 плейлисти']);
  assert.deepEqual(ev(withLang('en'), '[1, 2].map(function (n) { return I18n.n(n, "channel"); })'), ['1 channel', '2 channels']);
});

// ---- batch 2026-10-27: the direction of provider texts, technical texts, the Hebrew wording ----
const LRM = '‎', RLM = '‏', LRE = '‪', RLE = '‫', PDF = '‬';
const iso = (app, x) => ev(app, 'I18n.iso(' + JSON.stringify(x) + ')');
const dirOf = (app, x) => ev(app, 'I18n.otherDir(' + JSON.stringify(x) + ')');

test('iso: a text\'s direction is its first letter\'s — emoji and flags (surrogate pairs), digits (Arabic-Indic too) and punctuation are skipped', () => {
  const he = createApp({ storage: { lang: JSON.stringify('he') } }), ru = createApp({});
  // In Hebrew: a Hebrew name after an emoji or a flag is Hebrew (as given); a Latin one is embedded left to right.
  for (const x of ['🔍 חיפוש', '📡 ספקים', '🇮🇱 כאן 11', '٣ ערוץ', '۱۲ قناة', '«כאן» 11', '★ כאן']) assert.equal(iso(he, x), x, x);
  assert.equal(iso(he, '🇺🇦 Inter'), RLM + LRE + '🇺🇦 Inter' + PDF + RLM);
  assert.equal(iso(he, '×2 Channel'), RLM + LRE + '×2 Channel' + PDF + RLM, '× is not a letter');
  // In Russian: a Hebrew name after an emoji or a flag is embedded right to left; a Cyrillic or Latin one is as given.
  for (const x of ['📺 ערוץ 11', '🇮🇱 כאן 11']) assert.equal(iso(ru, x), LRM + RLE + x + PDF + LRM, x);
  for (const x of ['📺 Канал 5', '🎬 Kino', '٣ Канал']) assert.equal(iso(ru, x), x, x);
  assert.deepEqual(['🇮🇱 כאן', '📺 Channel', '123', '٣٤'].map((x) => dirOf(ru, x)), ['rtl', '', '', '']);
});

test('iso: a text with no letter at all (digits, signs) reads left to right — embedded so in Hebrew, as given otherwise', () => {
  const he = createApp({ storage: { lang: JSON.stringify('he') } }), en = createApp({ storage: { lang: JSON.stringify('en') } });
  for (const x of ['123 · 456', '24/7', '+1 (2)']) {
    assert.equal(iso(he, x), RLM + LRE + x + PDF + RLM, x);
    assert.equal(dirOf(he, x), 'ltr');
    assert.equal(iso(en, x), x);
    assert.equal(dirOf(en, x), '');
  }
});

test('iso: a non-spacing mark (Unicode Mn / Me) a text starts with is no letter — «ँ כאן» is Hebrew, «ࣣ Channel» is Latin (review 4, Codex 6)', () => {
  const he = createApp({ storage: { lang: JSON.stringify('he') } }), en = createApp({ storage: { lang: JSON.stringify('en') } });
  assert.deepEqual(['ँ כאן', 'ࣣ Channel', 'ְ́ Kan', '́ כאן'].map((x) => dirOf(he, x)), ['', 'ltr', 'ltr', '']);
  assert.deepEqual(['ँ כאן', 'ࣣ Channel', 'ְ́ Kan', '́ כאן'].map((x) => dirOf(en, x)), ['rtl', '', '', 'rtl']);
  assert.equal(iso(he, 'ँ כאן'), 'ँ כאן', 'a Hebrew name after a mark was embedded as Latin');
});

test('iso: the marks skipped are exactly Unicode\'s non-spacing marks (Mn, Me) among the letters — every other letter decides', () => {
  // Each character c read before a letter of the other direction: it decides when it is in one of the two letter
  // classes of js/i18n.js and not a mark; otherwise the letter after it decides. Node's Unicode data is the reference.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'i18n.js'), 'utf8');
  const cls = (name) => new RegExp(src.match(new RegExp('var ' + name + ' = /(.*)/;'))[1]);
  const R = cls('RTL_LETTER'), L = cls('LTR_LETTER'), mark = /^[\p{Mn}\p{Me}]$/u;
  const he = createApp({ storage: { lang: JSON.stringify('he') } }), ru = createApp({});
  const scan = '(function () { var out = []; for (var c = 0x80; c < 0xFFFF; c++) { if (c >= 0xD800 && c <= 0xDFFF) continue;' +
    ' var ch = String.fromCharCode(c); out.push(I18n.otherDir(ch + "א") + I18n.otherDir(ch + "A")); } return out; }())';
  const inHe = ev(he, scan), inRu = ev(ru, scan), wrong = [];
  let k = 0, marks = 0;
  for (let c = 0x80; c < 0xFFFF; c++) {
    if (c >= 0xD800 && c <= 0xDFFF) continue;
    const ch = String.fromCharCode(c), isMark = mark.test(ch);
    // he: «c א» → 'ltr' only when c is an LTR letter; ru: «c A» → 'rtl' only when c is an RTL letter.
    const decides = inHe[k] === 'ltrltr' || inRu[k] === 'rtlrtl'; k++;
    if (isMark && (R.test(ch) || L.test(ch))) marks++;
    if (decides !== ((R.test(ch) || L.test(ch)) && !isMark)) wrong.push('U+' + c.toString(16) + (isMark ? ' mark' : '') + (decides ? ' decides' : ' skipped'));
  }
  assert.deepEqual(wrong.slice(0, 20), []);
  assert.ok(marks > 700, 'marks in the letter classes: ' + marks);
});

test('i18n: our rows with an icon are «<icon> <name>» in every language (the menu boxes the icon so their names share one edge)', () => {
  const table = ev(createApp({}), 'I18n.table()');
  for (const [k, icon] of [['g.search', '🔍'], ['g.fav', '★'], ['g.providers', '📡'], ['g.settings', '⚙']]) {
    assert.deepEqual(table[k].map((x) => x.indexOf(icon + ' ') === 0 && x.indexOf(' ', icon.length + 1) !== icon.length + 1), [true, true, true, true], k);
  }
});

test('i18n: a provider of one\'s own (a host name) and the picture size read left to right in Hebrew; a track\'s language is wrapped as provider text', () => {
  const host = 'http://ספק.example/list.m3u';
  const he = f.untilPlaying(f.ottApp({ channels: 8, storage: { lang: JSON.stringify('he'), userPlaylists: JSON.stringify([host]) } }));
  const row = ev(he, 'Sources.list().filter(function (r) { return r.kind === "user"; })[0].name');
  assert.equal(row, RLM + LRE + 'ספק.example · list' + PDF + RLM);
  const av = (lang, ex) => ev(lang, '[AvTracks.streamInfo({ getCurrentStreamInfo: function () { return [{ type: "VIDEO", extra_info: JSON.stringify({ Width: 1920, Height: 1080, Bit_rate: 2500000 }) }]; } }),' +
    ' AvTracks.audioTracks({ getTotalTrackInfo: function () { return [{ type: "AUDIO", index: 1, extra_info: JSON.stringify(' + JSON.stringify(ex) + ') }]; } })[0].label]');
  assert.deepEqual(av(he, { language: 'eng' }), [RLM + LRE + '1920×1080' + PDF + RLM + ' · 2.5 Mbps', RLM + LRE + 'eng' + PDF + RLM]);
  const ru = f.untilPlaying(f.ottApp({ channels: 8, storage: { userPlaylists: JSON.stringify([host]) } }));
  assert.deepEqual(av(ru, { language: 'עברית' }), ['1920×1080 · 2,5 Мбит/с', LRM + RLE + 'עברית' + PDF + LRM]);
  const uk = f.untilPlaying(f.ottApp({ channels: 8, storage: { lang: JSON.stringify('uk') } }));
  const en = f.untilPlaying(f.ottApp({ channels: 8, storage: { lang: JSON.stringify('en') } }));
  assert.deepEqual([uk, en].map((a) => ev(a, 'AvTracks.mbps(2500000)')), ['2,5 Мбіт/с', '2.5 Mbps']);
});

test('i18n: the language row starts with 🌐 in every language, so it can be found in a language one cannot read', () => {
  assert.deepEqual(ev(createApp({}), 'I18n.table()["st.language"]').map((x) => x.indexOf('🌐 ') === 0), [true, true, true, true]);
});

test('i18n: Hebrew uses one quotation style (") and its arrow pairs are pinned left to right', () => {
  const table = ev(createApp({}), 'I18n.table()'), he = Object.keys(table).map((k) => [k, [].concat(table[k][2]).join(' ')]);
  assert.deepEqual(he.filter(([, x]) => /[«»]/.test(x)).map(([k]) => k), []);
  for (const [k, x] of he) for (const pair of ['◀ ▶', '▲ ▼', '← →', '▲▼']) if (x.indexOf(pair) >= 0) assert.ok(x.indexOf(LRM + pair + LRM) >= 0, k + ': ' + pair + ' not pinned');
  assert.ok(table['h.search'][2].indexOf('הקלידו שם ← OK') === 0);
});

test('i18n: an entry with no name is not taken for an Israeli channel in Hebrew (its placeholder «ערוץ» is not its name)', () => {
  const url = 'http://my-provider.test/list.m3u', body = '#EXTM3U\n#EXTINF:-1,\nhttp://iptv.example.test/live/9/index.m3u8\n#EXTINF:-1 tvg-id="x",Inter\nhttp://iptv.example.test/live/8/index.m3u8\n';
  const app = f.m3uApp({ boot: false, storage: { lang: JSON.stringify('he'), playlistUrl: JSON.stringify(url) } });
  app.net.route((u) => u === url, () => ({ body, delay: 100 }));
  app.boot(); app.advance(3000);
  assert.deepEqual(ev(app, '[Channels.at(0).name, Channels.at(0).il, Channels.at(1).name]'), ['ערוץ', false, 'Inter']);
});

test('i18n: the «⚙ Настройки» screen is titled as its menu row — in Russian, Ukrainian, Hebrew and English (owner 2026-10-28: «экран - Настройки»)', () => {
  for (const lang of ['ru', 'uk', 'he', 'en']) {
    const app = withLang(lang);
    for (const [screen, key] of [['settings', 'g.settings'], ['about', 'g.about']]) {
      vm.runInContext('Overlay.open("' + screen + '")', app.ctx);
      assert.ok(app.visible('about'), lang + ' ' + screen);
      assert.equal(app.text('about-title'), ev(app, 'I18n.t("' + key + '")'), lang + ' ' + screen);
      assert.ok(groupNames(app).indexOf(app.text('about-title')) >= 0, lang + ' ' + screen + ': not the menu row\'s name');
    }
  }
});
