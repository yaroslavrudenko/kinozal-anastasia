'use strict';
// Groups by id, the upgrade from 1.8.4, the offline copy and the freshness of the list (batch 2026-10-27).
//  - Owner: «То, что возвращается провайдером, не переводим»: a provider group named «Undefined» or «Без группы» is
//    shown as given; only our own group for channels with no group is translated, under an id ('' / key 'none')
//    that no provider text can take.
//  - 1.8.4 saved the remembered group and the offline copy under Russian names of iptv-org's categories
//    («Новостные» for News): after the upgrade the same group is found again.
//  - The offline copy is a fallback and a first paint only (owner: «избыточного кеширования тоже не должно быть»):
//    the fresh list always downloads at boot and on schedule, and replaces it.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const f = require('./fixtures');

const ev = (app, js) => JSON.parse(vm.runInContext('JSON.stringify(' + js + ')', app.ctx));
const groups = (app) => ev(app, 'Channels.groups().map(function (g) { return [g.key, g.name]; })');
const URL = f.M3U_URL;
const ROWS = [
  ['#EXTINF:-1 tvg-id="Kan11.il@SD" group-title="General;News",Kan 11 (1080p)', 'http://iptv.example.test/live/1/index.m3u8'],
  ['#EXTINF:-1 tvg-id="Und.us@SD" group-title="Undefined",Undefined One', 'http://iptv.example.test/live/2/index.m3u8'],
  ['#EXTINF:-1 tvg-id="Lit.ru@SD" group-title="Без группы",Literal One', 'http://iptv.example.test/live/3/index.m3u8'],
  ['#EXTINF:-1 tvg-id="None.us@SD",No Group One', 'http://iptv.example.test/live/4/index.m3u8'],
  ['#EXTINF:-1 tvg-id="Toon.us@SD" group-title="Animation;Kids",Toon (720p)', 'http://iptv.example.test/live/5/index.m3u8'],
  ['#EXTINF:-1,', 'http://iptv.example.test/live/6/index.m3u8'],
  ['#EXTINF:-1 group-title="News",Plain News', 'http://iptv.example.test/live/7/index.m3u8'],
  ['#EXTINF:-1 tvg-id="pipe|id" group-title="Movies" catchup="default" catchup-days="3" catchup-source="?utc={utc}",Pipe Id', 'http://iptv.example.test/live/8/index.m3u8'],
  ['#EXTINF:-1 tvg-id="Dup.us@SD" group-title="Music",Dup', 'http://iptv.example.test/live/9/index.m3u8'],
  ['#EXTINF:-1 tvg-id="Dup.us@SD" group-title="Music",Dup', 'http://iptv.example.test/live/10/index.m3u8'],
  ['#EXTINF:-1 tvg-id="Inter.ua@SD" group-title="Undefined",Інтер', 'http://iptv.example.test/live/11/index.m3u8']
];
const PL = '#EXTM3U\n' + ROWS.map((r) => r.join('\n')).join('\n') + '\n';

// An M3U app booted with `storage` (raw strings) whose playlist answers `body` (or HTTP 500 when down).
function app(opts) {
  const o = Object.assign({ body: PL, lang: 'ru', down: false, headers: null, storage: {} }, opts);
  const a = f.m3uApp({ boot: false, storage: Object.assign({ lang: JSON.stringify(o.lang), playlistUrl: JSON.stringify(URL) }, o.storage) });
  a.state = { body: o.body, down: o.down, headers: o.headers };
  a.net.route((u) => u === URL, () => (a.state.down ? { status: 500, body: 'down', delay: 100 } : { body: a.state.body, delay: 100, headers: a.state.headers }));
  a.boot();
  a.advance(3000);
  return a;
}
// One scheduled list refresh from now (CONFIG.PLAYLIST_REFRESH_MS) and the download's own time.
const refresh = (a) => ev(a, 'CONFIG.PLAYLIST_REFRESH_MS') + 5000;
// The storage of a finished app, as the next launch (or the app after an upgrade) finds it.
const carry = (a) => Object.fromEntries(a.storage.raw);

test('groups: a provider group named «Undefined» or «Без группы» is shown as given; only channels with no group go to our «No group» (key none), translated', () => {
  for (const [lang, ours] of [['ru', 'Без группы'], ['en', 'No group'], ['he', 'ללא קבוצה'], ['uk', 'Без групи']]) {
    const g = groups(app({ lang }));
    assert.deepEqual(g.filter(([k]) => k === 'grp:Undefined' || k === 'grp:Без группы' || k === 'none'),
      [['grp:Undefined', 'Undefined'], ['grp:Без группы', 'Без группы'], ['none', ours]], lang + ': ' + JSON.stringify(g));
  }
});

test('groups: «General;News» is «News», «Animation;Kids» is «Animation»; no provider group is translated', () => {
  const g = groups(app({ lang: 'en' })).map(([k]) => k);
  for (const k of ['grp:News', 'grp:Animation', 'grp:Movies', 'grp:Music']) assert.ok(g.indexOf(k) >= 0, k + ' missing in ' + JSON.stringify(g));
});

test('upgrade: a group remembered by 1.8.4 under its Russian name («Новостные», «Детские», «Без группы») is found again and remembered by its key', () => {
  // With the last channel watched in that group (1.8's lastCh row), as the upgraded TV has it.
  const last = { 'grp:Новостные': ['Kan11.il@SD', 'Kan 11 (1080p)', 'Новостные', 'm3u:Kan11.il@SD|General;News', 1],
    'grp:Детские': ['Toon.us@SD', 'Toon (720p)', 'Детские', 'm3u:Toon.us@SD|Animation;Kids', 5], 'grp:Без группы': ['None.us@SD', 'No Group One', 'Без группы', 'm3u:None.us@SD|Без группы', 4] };
  const lastCh = ([id, name, group, key, n]) => JSON.stringify([id, name, '', group, 'http://iptv.example.test/live/' + n + '/index.m3u8', '', '', 0, 0, 0, key, n]);
  for (const [old, now] of [['grp:Новостные', 'grp:News'], ['grp:Детские', 'grp:Animation'], ['grp:Без группы', 'none']]) {
    // (A provider group literally named «Без группы» would be matched as it is — so this list has none.)
    const a = app({ lang: 'en', body: PL.replace('group-title="Без группы",Literal One', 'group-title="Sports",Literal One'), storage: { zapGroup: JSON.stringify(old), lastCh: lastCh(last[old]) } });
    assert.equal(ev(a, 'Playback.current().key'), last[old][3]);
    assert.equal(ev(a, 'Channels.groups()[Zap.group()].key'), now, old);
    assert.equal(JSON.parse(a.storage.raw.get('zapGroup')), now, old + ' was not remembered anew');
  }
  // One old name for two of today's groups («Детские»: Kids and Animation): the one holding the channel watched
  // (above: Toon in Animation); with none of them watched, the first of them in the menu.
  const both = app({ lang: 'en', body: PL.replace('group-title="Без группы",Literal One', 'group-title="Kids",Literal One'),
    storage: { zapGroup: JSON.stringify('grp:Детские'), lastCh: lastCh(last['grp:Новостные']) } });
  const order = ev(both, 'Channels.groups().map(function (g) { return g.key; })').filter((k) => k === 'grp:Kids' || k === 'grp:Animation');
  assert.equal(ev(both, 'Channels.groups()[Zap.group()].key'), order[0]);
  // A group of the provider's own (OTT Club's Russian «Кино») is never re-mapped.
  const recs = JSON.parse(f.ottChannelList(12).body), kino = Object.keys(recs).find((id) => recs[id].category && recs[id].category.name === 'Кино');
  const ott = f.untilPlaying(f.ottApp({ channels: 12, storage: { zapGroup: JSON.stringify('grp:Кино'),
    lastCh: JSON.stringify([kino, recs[kino].channel_name, '', 'Кино', '', '', '', 0, 0, 0, 'ott:' + kino, 1]) } }));
  assert.equal(ev(ott, 'Channels.groups()[Zap.group()].key'), 'grp:Кино');
});

test('upgrade: a 1.8.4 «Новостные» on a list holding both iptv-org\'s «News» and a group literally named «Новостные» — the one holding the channel watched (review 4, Codex 4)', () => {
  const body = PL.replace('group-title="Без группы",Literal One', 'group-title="Новостные",Literal One');
  const last = (id, name, group, key, n) => JSON.stringify([id, name, '', group, 'http://iptv.example.test/live/' + n + '/index.m3u8', '', '', 0, 0, 0, key, n]);
  // Watching Kan 11 (in News): «Новостные» was 1.8.4's name for News.
  const news = app({ lang: 'en', body, storage: { zapGroup: JSON.stringify('grp:Новостные'), lastCh: last('Kan11.il@SD', 'Kan 11 (1080p)', 'Новостные', 'm3u:Kan11.il@SD|General;News', 1) } });
  assert.equal(ev(news, 'Channels.groups()[Zap.group()].key'), 'grp:News');
  assert.equal(JSON.parse(news.storage.raw.get('zapGroup')), 'grp:News');
  // Watching the channel of the literal «Новостные»: that group is kept.
  const lit = app({ lang: 'en', body, storage: { zapGroup: JSON.stringify('grp:Новостные'), lastCh: last('Lit.ru@SD', 'Literal One', 'Новостные', 'm3u:Lit.ru@SD|Новостные', 3) } });
  assert.equal(ev(lit, 'Channels.groups()[Zap.group()].key'), 'grp:Новостные');
  assert.equal(JSON.parse(lit.storage.raw.get('zapGroup')), 'grp:Новостные');
});

test('upgrade: the 1.8.4 group is upgraded once — a hourly list that later moves the channel watched out of a kept literal «Новостные» into «News» leaves the remembered group as it is (review 5, NB-1)', () => {
  const body = PL.replace('group-title="Без группы",Literal One', 'group-title="Новостные",Literal One');
  const last = JSON.stringify(['Lit.ru@SD', 'Literal One', '', 'Новостные', 'http://iptv.example.test/live/3/index.m3u8', '', '', 0, 0, 0, 'm3u:Lit.ru@SD|Новостные', 3]);
  const a = f.untilPlaying(app({ lang: 'en', body, storage: { zapGroup: JSON.stringify('grp:Новостные'), lastCh: last } }));
  assert.equal(JSON.parse(a.storage.raw.get('zapGroup')), 'grp:Новостные', 'the first list did not keep the literal group');
  // The provider moves the channel watched into «News» (the literal group is gone): not a 1.8.4 name to upgrade any more.
  a.state.body = body.replace('group-title="Новостные",Literal One', 'group-title="News",Literal One');
  a.advance(refresh(a));
  assert.equal(ev(a, 'Channels.groupIndex("grp:Новостные")'), -1, 'the provider did not move the channel');
  assert.equal(JSON.parse(a.storage.raw.get('zapGroup')), 'grp:Новостные', 'a key kept by the first list was migrated by a later one');
  // Nor after a restart: the next launch, from this one's storage, with the list as the provider serves it now.
  const next = app({ lang: 'en', body: a.state.body, storage: carry(a) });
  assert.equal(JSON.parse(next.storage.raw.get('zapGroup')), 'grp:Новостные', 'a restart migrated it');
  // A group picked in 1.9 by its key is never re-migrated either.
  const b = f.untilPlaying(app({ lang: 'en', body }));
  vm.runInContext('Zap.pick(Channels.get("m3u:Lit.ru@SD|Новостные"), Channels.groupIndex("grp:Новостные"))', b.ctx);
  b.state.body = body.replace('group-title="Новостные",Literal One', 'group-title="News",Literal One');
  b.advance(refresh(b));
  assert.equal(JSON.parse(b.storage.raw.get('zapGroup')), 'grp:Новостные', 'a key picked in 1.9 was migrated by a later list');
});

test('upgrade: a source switched to brings back its own group remembered by 1.8.4 — upgraded then, though another source\'s list was applied first (review 5, NB-1)', () => {
  const kan = JSON.stringify(['Kan11.il@SD', 'Kan 11 (1080p)', '', 'Новостные', 'http://iptv.example.test/live/1/index.m3u8', '', '', 0, 0, 0, 'm3u:Kan11.il@SD|General;News', 1]);
  const ott = f.untilPlaying(f.ottApp({ channels: 12, storage: { lastBySource: JSON.stringify({ ['user:' + URL]: { ch: JSON.parse(kan), url: null, group: 'grp:Новостные' } }) } }));
  vm.runInContext('Sources.switchTo(' + JSON.stringify('user:' + URL) + ')', ott.ctx);
  assert.equal(JSON.parse(ott.storage.raw.get('zapGroup')), 'grp:Новостные', 'the switch did not bring the group back');
  const next = app({ lang: 'en', storage: carry(ott) });
  assert.equal(ev(next, 'Playback.current().key'), 'm3u:Kan11.il@SD|General;News');
  assert.equal(JSON.parse(next.storage.raw.get('zapGroup')), 'grp:News', 'the 1.8.4 group of the source switched to was not upgraded');
});

test('upgrade: OTT Club\'s own «Новостные» settled does not settle another source\'s 1.8.4 «Новостные» — upgraded to «News» after the switch (review 6, Codex)', () => {
  // OTT Club: its provider group literally named «Новостные», with НТВ (ott:1004) watched in it — settled as it is.
  const ntv = JSON.parse(f.ottChannelList(12).body)['1004'];
  const kan = JSON.stringify(['Kan11.il@SD', 'Kan 11 (1080p)', '', 'Новостные', 'http://iptv.example.test/live/1/index.m3u8', '', '', 0, 0, 0, 'm3u:Kan11.il@SD|General;News', 1]);
  const ott = f.untilPlaying(f.ottApp({ channels: 12, storage: { zapGroup: JSON.stringify('grp:Новостные'),
    lastCh: JSON.stringify(['1004', ntv.channel_name, '', 'Новостные', '', '', '', 0, 0, 0, 'ott:1004', 4]),
    // The playlist's position, as 1.8.4 kept it: its own «Новостные» (1.8.4's name for News), Kan 11 watched.
    lastBySource: JSON.stringify({ ['user:' + URL]: { ch: JSON.parse(kan), url: null, group: 'grp:Новостные' } }) } }));
  assert.equal(ev(ott, 'Channels.groups()[Zap.group()].key'), 'grp:Новостные', 'OTT Club\'s own group was moved');
  vm.runInContext('Sources.switchTo(' + JSON.stringify('user:' + URL) + ')', ott.ctx);
  const next = app({ lang: 'en', storage: carry(ott) });
  assert.equal(ev(next, 'Playback.current().key'), 'm3u:Kan11.il@SD|General;News');
  assert.equal(JSON.parse(next.storage.raw.get('zapGroup')), 'grp:News', 'the playlist\'s 1.8.4 group was taken as settled by OTT Club\'s');
  assert.equal(ev(next, 'Channels.groups()[Zap.group()].key'), 'grp:News');
  // And back: OTT Club's literal «Новостные» is still its own, never moved to a «News» it does not have.
  vm.runInContext('Sources.switchTo("ott")', next.ctx);
  const back = f.untilPlaying(f.ottApp({ channels: 12, boot: true, storage: carry(next) }));
  assert.equal(ev(back, 'Channels.groups()[Zap.group()].key'), 'grp:Новостные');
});

test('upgrade: Zap.group() is a query — reading the zap group writes nothing; the remembered group is upgraded when the list is applied (review 4, F9)', () => {
  const a = app({ lang: 'en', storage: { zapGroup: JSON.stringify('grp:Новостные') } });
  assert.equal(JSON.parse(a.storage.raw.get('zapGroup')), 'grp:News', 'not upgraded with the list');
  vm.runInContext('var __saves = 0, __save = Util.save; Util.save = function (k, v, m) { if (k === "zapGroup") __saves++; return __save(k, v, m); };' +
    // A remembered group not in the list and an upgrade on offer: a query that migrated would write it here.
    ' Channels.groupIndex = function () { return -1; }; Channels.upgradedGroupKey = function () { return "grp:Music"; }; Zap.group(); Zap.group();', a.ctx);
  assert.equal(ev(a, '__saves'), 0, 'Zap.group() wrote the remembered group');
});

test('upgrade: a 1.8.4 offline copy — a provider group «Music#2» keeps its «#2», a repeated entry\'s «#2» is dropped, and the entry with no name is unnamed again, named in the reader\'s language (review 4, Codex 5, F10)', () => {
  const v1 = { v: 1, mode: 'm3u', savedAt: 1, epgUrl: '', channels: [
    ['Mus.us@SD', 'Music Two', '', 'Music#2', 'http://iptv.example.test/live/1/index.m3u8', '', '', 0, 0, 0, 'm3u:Mus.us@SD|Music#2', 1],
    ['Dup.us@SD', 'Dup', '', 'Музыкальные', 'http://iptv.example.test/live/9/index.m3u8', '', '', 0, 0, 0, 'm3u:Dup.us@SD|Music#2', 2],
    ['Mus.us@SD', 'Music Two', '', 'Music#2', 'http://iptv.example.test/live/3/index.m3u8', '', '', 0, 0, 0, 'm3u:Mus.us@SD|Music#2#2', 3],
    ['', 'Канал', '', 'Без группы', 'http://iptv.example.test/live/6/index.m3u8', '', '', 0, 0, 0, 'm3u:канал|Без группы', 4]] };
  const a = app({ lang: 'en', down: true, storage: { playlistSnap: JSON.stringify(v1) } });
  assert.deepEqual(ev(a, '[0, 1, 2, 3].map(function (i) { var c = Channels.at(i); return [c.key, c.groupId, c.name, c.unnamed]; })'), [
    ['m3u:Mus.us@SD|Music#2', 'Music#2', 'Music Two', false], ['m3u:Dup.us@SD|Music#2', 'Music', 'Dup', false],
    ['m3u:Mus.us@SD|Music#2#2', 'Music#2', 'Music Two', false], ['m3u:канал|Без группы', '', 'Channel', true]]);
});

test('upgrade: the offline copy written by 1.8.4 (v1, translated group names) opens with the groups by their ids when the list is down', () => {
  // The rows exactly as 1.8.4 packed them: [id, name, logo, group (Russian), url, catchup, catchupSource, catchupDays, il, ua, key, num].
  const v1 = { v: 1, mode: 'm3u', savedAt: 1, epgUrl: '', channels: [
    ['Kan11.il@SD', 'Kan 11 (1080p)', '', 'Новостные', 'http://iptv.example.test/live/1/index.m3u8', '', '', 0, 1, 0, 'm3u:Kan11.il@SD|General;News', 1],
    ['', 'Канал', '', 'Без группы', 'http://iptv.example.test/live/6/index.m3u8', '', '', 0, 0, 0, 'm3u:канал|Без группы', 2],
    ['Und.us@SD', 'Undefined One', '', 'Без группы', 'http://iptv.example.test/live/2/index.m3u8', '', '', 0, 0, 0, 'm3u:Und.us@SD|Undefined', 3],
    ['Toon.us@SD', 'Toon (720p)', '', 'Детские', 'http://iptv.example.test/live/5/index.m3u8', '', '', 0, 0, 0, 'm3u:Toon.us@SD|Animation;Kids#2', 4]] };
  const a = app({ lang: 'en', down: true, storage: { playlistSnap: JSON.stringify(v1), zapGroup: JSON.stringify('grp:Детские'), lastCh: JSON.stringify(v1.channels[3]) } });
  assert.deepEqual(ev(a, '[0, 1, 2, 3].map(function (i) { var c = Channels.at(i); return [c.key, c.groupId, c.group]; })'), [
    ['m3u:Kan11.il@SD|General;News', 'News', 'News'], ['m3u:канал|Без группы', '', 'No group'],
    ['m3u:Und.us@SD|Undefined', 'Undefined', 'Undefined'], ['m3u:Toon.us@SD|Animation;Kids#2', 'Animation', 'Animation']]);
  assert.equal(ev(a, 'Channels.groups()[Zap.group()].key'), 'grp:Animation');
});

test('offline copy: written in one language, read in another — every channel comes back the same (key, number, id, name, group, url, archive, country); unnamed in the reader\'s language', () => {
  const FIELDS = 'key num id name nameLc unnamed logo groupId group url catchup catchupSource catchupDays il ua'.split(' ');
  const pick = 'Channels.groups()[Channels.allIdx()].items.map(function (i) { var c = Channels.at(i); return ' + JSON.stringify(FIELDS) + '.map(function (k) { return c[k]; }); })';
  const ru = f.untilPlaying(app({ lang: 'ru' }));
  ru.advance(30000);                                          // the copy is written after the first frame, at idle
  const copy = JSON.parse(ru.storage.raw.get('playlistSnap'));
  assert.equal(copy.v, 2);
  assert.ok(copy.channels.every((r) => typeof r[0] === 'string' && r[0].indexOf('m3u:') === 0), 'rows do not start with the key');
  assert.equal(copy.channels.length, ROWS.length);
  const fresh = ev(app({ lang: 'en' }), pick);                  // the list parsed in English, for comparison
  const offline = ev(app({ lang: 'en', down: true, storage: { playlistSnap: JSON.stringify(copy) } }), pick);
  assert.deepEqual(offline, fresh);
  assert.ok(offline.some((c) => c[5] === true && c[3] === 'Channel'), 'the unnamed entry is not «Channel» in English');
  assert.ok(offline.some((c) => c[0] === 'm3u:Dup.us@SD|Music#2'), 'the second of two equal entries lost its own key');
  assert.ok(offline.some((c) => c[2] === 'pipe|id' && c[10] === 'default' && c[12] === 3), 'an id with «|» or the archive did not come back');
});

test('offline copy: a group is kept by its id — a mutated copy that kept the shown name would read «Новостные» in English', () => {
  const ru = f.untilPlaying(app({ lang: 'ru' }));
  ru.advance(30000);
  const copy = JSON.parse(ru.storage.raw.get('playlistSnap'));
  const rowOf = (key) => copy.channels.find((r) => r[0] === key);
  assert.equal(rowOf('m3u:Kan11.il@SD|General;News')[3], 'News');
  assert.equal(rowOf('m3u:None.us@SD|Без группы')[3], '', 'our «no group» is written as an empty id');
  const en = app({ lang: 'en', down: true, storage: { playlistSnap: JSON.stringify(copy) } });
  const g = groups(en);
  assert.ok(g.some(([k, n]) => k === 'none' && n === 'No group') && g.some(([k, n]) => k === 'grp:News' && n === 'News'), JSON.stringify(g));
});

test('offline copy: a switch to another provider under way keeps no copy of the one being left (the copy is written in idle steps, review 4, P4-1)', () => {
  const a = f.m3uApp({ boot: false, storage: { lang: JSON.stringify('ru'), playlistUrl: JSON.stringify(URL) } });
  a.net.route((u) => u === URL, () => ({ body: PL, delay: 100 }));
  a.boot();
  // The viewer switches the moment the first frame schedules the copy: its idle steps run after the switch began.
  vm.runInContext('var __first = Sources.onFirstFrame; Sources.onFirstFrame = function () { __first(); Sources.switchTo("free:iptvorg/il"); };', a.ctx);
  f.untilPlaying(a);
  a.advance(30000);
  assert.ok(a.events.some((e) => e.type === 'reload'), 'no switch happened');
  assert.equal(a.storage.raw.get('playlistSnap'), undefined, 'the copy of the provider being left was written during the switch');
});

test('offline copy: a switch under way stops the copy at the next idle step — begun before the rows: no rows, no JSON; begun while the rows were built: no JSON (review 5, NB-3)', () => {
  // when: 'first' — the switch starts as the first frame schedules the copy; 'rows' — while its rows are being built.
  const run = (when) => {
    const a = f.m3uApp({ boot: false, storage: { lang: JSON.stringify('ru'), playlistUrl: JSON.stringify(URL) } });
    a.net.route((u) => u === URL, () => ({ body: PL, delay: 100 }));
    a.boot();
    // A channel nobody plays (its fields are read only to build the copy's rows) counts the rows step.
    vm.runInContext('var __when = ' + JSON.stringify(when) + ', __rows = 0, __json = 0, __str = JSON.stringify;' +
      ' JSON.stringify = function (v) { if (v && v.channels && v.mode) __json++; return __str.apply(JSON, arguments); };' +
      ' var __first = Sources.onFirstFrame; Sources.onFirstFrame = function () { var c = Channels.at(5), u = c.catchupSource;' +
      ' Object.defineProperty(c, "catchupSource", { get: function () { if (!__rows++ && __when === "rows") Sources.switchTo("free:iptvorg/il"); return u; } });' +
      ' __first(); if (__when === "first") Sources.switchTo("free:iptvorg/il"); };', a.ctx);
    f.untilPlaying(a);
    a.advance(30000);
    assert.ok(a.events.some((e) => e.type === 'reload'), when + ': no switch happened');
    assert.equal(a.storage.raw.get('playlistSnap'), undefined, when + ': the copy of the provider being left was written');
    return ev(a, '[__rows, __json]');
  };
  assert.deepEqual(run('first'), [0, 0], 'the copy\'s rows or JSON were built for the provider being left');
  assert.equal(run('rows')[1], 0, 'the copy\'s JSON was built after the switch began');
});

// Copy writes of the offline list (Util.saveJson to «playlistSnap»), and parses, counted from now.
function countCopy(a) {
  vm.runInContext('var __snaps = 0, __sj = Util.saveJson; Util.saveJson = function (k, j, m) { if (k === "playlistSnap") __snaps++; return __sj(k, j, m); };' +
    ' var __parses = 0, __parse = M3U.parse; M3U.parse = function (t, d) { __parses++; return __parse(t, d); };' +
    ' var __applied = 0, __replace = Channels.replace; Channels.replace = function (c) { __applied++; return __replace(c); };', a.ctx);
}

test('offline copy (freshness): a downloaded list byte-identical to the one the copy was written from is parsed and applied, and the copy is not written again; the first list of a page life always writes it (review 5, N5-2)', () => {
  const a = f.m3uApp({ boot: false, storage: { lang: JSON.stringify('en'), playlistUrl: JSON.stringify(URL) } });
  a.state = { body: PL };
  a.net.route((u) => u === URL, () => ({ body: a.state.body, delay: 100 }));
  countCopy(a);
  a.boot();
  f.untilPlaying(a);
  a.advance(30000);
  assert.equal(ev(a, '__snaps'), 1, 'the first list of the page life did not write the copy');
  a.advance(2 * refresh(a));                                   // two hourly lists, byte for byte the same
  assert.deepEqual(ev(a, '[__parses, __applied, __snaps]'), [3, 3, 1], 'an identical list was skipped, or its copy written again');
  // One byte changed, the same length: written.
  a.state.body = PL.replace('Plain News', 'Plain Nexs');
  a.advance(refresh(a));
  assert.equal(ev(a, '__snaps'), 2, 'a changed list (same length) did not write its copy');
  assert.ok(JSON.parse(a.storage.raw.get('playlistSnap')).channels.some((r) => r[1] === 'Plain Nexs'));
  assert.equal(ev(a, 'Channels.search("plain nexs").total'), 1);
});

test('offline copy (freshness): a list B whose copy is still being built when the list A the copy was written from comes back — B\'s copy is dropped, A\'s stays (review 5, N5-2)', () => {
  const a = f.untilPlaying(app({ lang: 'en' }));
  a.advance(30000);
  const b = PL.replace('Plain News', 'Plain Nexs');
  vm.runInContext('var __q = []; Util.idle = function (fn) { __q.push(fn); }; var __snaps = 0, __set = localStorage.setItem;' +
    ' localStorage.setItem = function (k) { if (k === "playlistSnap") __snaps++; return __set.apply(this, arguments); };', a.ctx);
  a.state.body = b;
  a.advance(refresh(a));                                       // B applied, its copy waits for idle time
  a.state.body = PL;
  a.advance(refresh(a));                                       // A again: the copy on disk is A's
  vm.runInContext('for (var __i = 0; __q.length && __i < 50; __i++) __q.shift()();', a.ctx);
  const names = JSON.parse(a.storage.raw.get('playlistSnap')).channels.map((r) => r[1]);
  assert.ok(names.indexOf('Plain News') >= 0 && names.indexOf('Plain Nexs') < 0, 'the copy holds B while A is on screen');
  assert.equal(ev(a, '__snaps'), 0, 'the copy on disk (A\'s) was written again');
});

test('offline copy (freshness): a list whose copy could not be kept (too big) leaves none — the list the old copy came from, downloaded again, writes it again (review 5, N5-2)', () => {
  const a = f.untilPlaying(app({ lang: 'en' }));
  a.advance(30000);
  const size = a.storage.raw.get('playlistSnap').length;
  vm.runInContext('CONFIG.SNAPSHOT_MAX_CHARS = ' + (size + 200), a.ctx);
  a.state.body = PL + ROWS.map((r) => r.join('\n').replace(/tvg-id="([^"]*)"/, 'tvg-id="$1.more"')).join('\n') + '\n';
  a.advance(refresh(a));
  assert.equal(a.storage.raw.get('playlistSnap'), undefined, 'the bigger list\'s copy was kept, or the older one');
  a.state.body = PL;
  a.advance(refresh(a));
  assert.equal(JSON.parse(a.storage.raw.get('playlistSnap')).channels.length, ROWS.length, 'the list on screen has no copy');
});

test('offline copy: a copy longer than SNAPSHOT_MAX_CHARS is not kept at all (an older one would be stale), and why is recorded', () => {
  const big = f.untilPlaying(f.m3uApp({ channels: 40, config: { SNAPSHOT_MAX_CHARS: 2000 }, storage: { playlistSnap: JSON.stringify({ v: 2, mode: 'm3u', channels: [['m3u:old|x', 'Old']] }) } }));
  big.advance(30000);
  assert.equal(big.storage.raw.get('playlistSnap'), undefined, 'a copy over the cap was written, or the older one kept');
  assert.match(ev(big, 'Diag.snapshot().notes["save.playlistSnap"]') || '', /^too big: \d+ chars$/);
  const fits = f.untilPlaying(f.m3uApp({ channels: 40 }));
  fits.advance(30000);
  assert.equal(JSON.parse(fits.storage.raw.get('playlistSnap')).channels.length, 40, 'the same list under the default cap is kept');
});

test('offline copy (freshness): with a copy saved, the fresh list still downloads at boot and replaces it at once', () => {
  const ru = f.untilPlaying(app({ lang: 'ru' }));
  ru.advance(30000);
  const storage = carry(ru);
  const changed = PL.replace('Plain News', 'Plain News Today');
  const next = app({ lang: 'ru', body: changed, storage });
  assert.equal(next.net.requests((r) => r.url === URL).length, 1, 'the list was not downloaded at boot');
  assert.ok(ev(next, 'Channels.search("plain news today").total') === 1, 'the fresh list did not replace the copy');
});

test('refresh (freshness): every downloaded playlist is parsed and applied — one rewritten with the same length under the same Last-Modified too (review 4, Codex 1: no validator stands in for the text)', () => {
  const H = { 'Last-Modified': 'Tue, 27 Oct 2026 00:16:54 GMT' };
  const a = f.untilPlaying(app({ lang: 'en', headers: H }));
  vm.runInContext('var __parses = 0, __parse = M3U.parse; M3U.parse = function (t, d) { __parses++; return __parse(t, d); };', a.ctx);
  const downloads = () => a.net.requests((r) => r.url === URL).length;
  const d0 = downloads();
  a.advance(refresh(a));                                       // the scheduled refresh, the list as it was
  assert.equal(downloads(), d0 + 1, 'the scheduled download did not happen');
  assert.equal(ev(a, '__parses'), 1, 'a downloaded list was not parsed');
  // The provider rewrites the list: a name and a stream link, the same length, the same Last-Modified.
  const KEY = 'm3u:Kan11.il@SD|General;News';
  a.state.body = PL.replace('Kan 11 (1080p)', 'Kan 12 (1080p)').replace('live/1/index', 'live/0/index');
  assert.equal(a.state.body.length, PL.length);
  a.advance(refresh(a));
  assert.equal(downloads(), d0 + 2);
  assert.equal(ev(a, '__parses'), 2);
  assert.deepEqual(ev(a, '[Channels.get(' + JSON.stringify(KEY) + ').name, Channels.get(' + JSON.stringify(KEY) + ').url]'),
    ['Kan 12 (1080p)', 'http://iptv.example.test/live/0/index.m3u8'], 'the rewritten list was not applied');
});

test('refresh (freshness): the playlist\'s own guide (url-tvg) is handed to the guide with every hourly list, and a changed url-tvg is downloaded on that refresh', () => {
  const G1 = 'http://epg.example.test/one.xml', G2 = 'http://epg.example.test/two.xml', ids = ['Kan11.il@SD', 'Und.us@SD', 'Toon.us@SD'];
  const a = app({ lang: 'en', body: PL.replace('#EXTM3U', '#EXTM3U url-tvg="' + G1 + '"') });
  a.net.route((u) => u === G1 || u === G2, () => ({ body: f.xmltv(ids, 3), delay: 100 }));
  f.untilPlaying(a);
  a.advance(30000);                                            // the first frame: the guide follows it
  const got = (u) => a.net.requests((r) => r.url === u).length;
  assert.equal(got(G1), 1, 'the playlist\'s guide was not read after the first frame');
  vm.runInContext('var __loads = [], __load = EPG.load; EPG.load = function (u, w, d) { __loads.push(u); return __load(u, w, d); };', a.ctx);
  a.advance(refresh(a));
  assert.deepEqual(ev(a, '__loads'), [G1], 'the hourly list did not hand its guide over');
  a.state.body = PL.replace('#EXTM3U', '#EXTM3U url-tvg="' + G2 + '"');
  a.advance(refresh(a));
  assert.deepEqual(ev(a, '__loads'), [G1, G2]);
  assert.equal(got(G2), 1, 'the changed guide was not downloaded on that refresh');
});

test('refresh (freshness): a playlist served without Last-Modified is parsed and applied on every scheduled refresh', () => {
  const a = f.untilPlaying(app({ lang: 'en' }));
  vm.runInContext('var __parses = 0, __parse = M3U.parse; M3U.parse = function (t, d) { __parses++; return __parse(t, d); };', a.ctx);
  a.advance(2 * refresh(a));
  assert.equal(ev(a, '__parses'), 2);
});

test('refresh (freshness): OTT Club\'s list (it carries the «now» lines) is applied on every refresh, never skipped', () => {
  const a = f.untilPlaying(f.ottApp({ channels: 12 }));
  vm.runInContext('var __parses = 0, __parse = OttClub.parse; OttClub.parse = function (t) { __parses++; return __parse(t); };', a.ctx);
  a.advance(refresh(a));
  assert.ok(ev(a, '__parses') >= 1, 'the OTT Club list was not parsed on its refresh');
});

test('menu (freshness pin): while the menu is open the «now» lines are re-read every NOW_OPEN_REREAD_MS (60 s) — 10 in 10 minutes', () => {
  const a = f.untilPlaying(f.ottApp({ channels: 40 }));
  a.advance(20000);
  a.press(13, 50);                                              // ENTER: the menu
  const fresh = () => a.net.requests((r) => f.isList(r.url) && r.url.indexOf('?t=') > 0).length;
  const n0 = fresh();
  a.advance(600000);
  assert.equal(ev(a, 'CONFIG.NOW_OPEN_REREAD_MS'), 60000);
  assert.ok(fresh() - n0 >= 9 && fresh() - n0 <= 11, 'fresh «now» reads in 10 min: ' + (fresh() - n0));
});

test('refresh (owner 2026-10-27: «Нужно сделать раз в час»): the channel list and its groups are downloaded every hour, for every provider; a changed list is applied after one hour', () => {
  const a = f.untilPlaying(app({ lang: 'en', headers: { 'Last-Modified': 'Tue, 27 Oct 2026 00:16:54 GMT' } }));
  assert.equal(ev(a, 'CONFIG.PLAYLIST_REFRESH_MS'), 3600000);
  const downloads = () => a.net.requests((r) => r.url === URL).length, d0 = downloads();
  a.state.body = PL.replace('group-title="Music",Dup', 'group-title="Concerts",Dup');
  a.state.headers = { 'Last-Modified': 'Tue, 27 Oct 2026 01:00:00 GMT' };
  a.advance(3600000 - 60000);
  assert.equal(downloads(), d0, 'downloaded before the hour');
  a.advance(65000);
  assert.equal(downloads(), d0 + 1, 'not downloaded at the hour');
  assert.ok(groups(a).some(([k]) => k === 'grp:Concerts'), 'the changed groups were not applied after one hour');
  const ott = f.untilPlaying(f.ottApp({ channels: 12 }));
  const lists = () => ott.net.requests((r) => f.isList(r.url) && r.url.indexOf('?t=') < 0).length, l0 = lists();
  ott.advance(3600000 + 5000);
  assert.equal(lists(), l0 + 1, 'OTT Club\'s list was not downloaded after one hour');
});
