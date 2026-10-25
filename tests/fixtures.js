'use strict';
// One builder per entity (SSOT): provider channel lists, guides, playlists and ready-booted apps.
// Every key here is FAKE. The harness never reads build.local.env, .preview/ or .buildResult/.

const { createApp, DEFAULT_NOW } = require('./harness');

const FAKE_KEY = 'FAKEKEY0001';
const OTT = 'http://myott.top';
const HOUR = 3600000;
const DAY = 24 * HOUR;

const NAMES = ['Дом Кино', 'Первый канал', 'Россия 1', 'НТВ', 'Пятый канал', 'Кинопремьера', 'Кино ТВ', 'Мульт',
  'Карусель', 'Матч ТВ', 'Discovery Channel', 'National Geographic', 'Euronews', 'Animal Planet', 'Дом Кино Премиум',
  'Наше новое кино', 'Киносерия', 'Мир', 'ТНТ', 'СТС', 'Channel 9', 'Kan 11', 'Keshet 12', 'Reshet 13', 'ICTV',
  '1+1', 'Інтер', 'СТБ', 'Еспресо', 'Суспільне'];
const GROUPS = ['Кино', 'Национальные', 'Познавательные', 'Новостные', 'Детские', 'Спорт'];

function channelName(i) {
  const base = NAMES[i % NAMES.length];
  return i < NAMES.length ? base : base + ' ' + (Math.floor(i / NAMES.length) + 1);
}

// /api/channel_now body. ids: '1001'…; every channel has an archive (rec '1') and a "now" show.
function ottChannelList(count, opts) {
  // padChars: the provider's real entries are ~1.1 KB each (389 channels ≈ 445 KB); `descr` pads to that size.
  const o = Object.assign({ now: DEFAULT_NOW, firstId: 1001, skip: [], padChars: 1000 }, opts || {});
  const data = {};
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = String(o.firstId + i);
    if (o.skip.indexOf(id) >= 0) continue;
    const showStart = Math.floor(o.now / HOUR) * HOUR;
    data[id] = {
      ch_id: id, channel_name: channelName(i), img: 'logo-' + id + '.png', rec: '1',
      category: { class: 'c' + (i % GROUPS.length), name: GROUPS[i % GROUPS.length] },
      name: 'Вечерние новости ' + id, time: showStart / 1000, time_to: (showStart + HOUR) / 1000,
      descr: 'Выпуск новостей и обзор событий дня. '.repeat(Math.ceil(o.padChars / 36)).slice(0, o.padChars)
    };
    ids.push(id);
  }
  return { body: JSON.stringify(data), ids };
}

// /api/channel/<id> body: hourly shows from 7 days back to 1 day ahead, with descriptions.
function ottGuide(id, opts) {
  const o = Object.assign({ now: DEFAULT_NOW, descrChars: 400 }, opts || {});
  const first = Math.floor((o.now - 7 * DAY) / HOUR) * HOUR;
  const epg = [];
  for (let t = first; t < o.now + DAY; t += HOUR) {
    epg.push({ name: 'Передача ' + id + ' ' + new Date(t).toISOString().slice(5, 13),
      descr: 'Описание выпуска. '.repeat(Math.ceil(o.descrChars / 18)).slice(0, o.descrChars),
      time: t / 1000, time_to: (t + HOUR) / 1000 });
  }
  return JSON.stringify({ epg_data: epg });
}

// HLS master playlists. `ottAlive`: the provider's normal answer; `ottDead`: its "removed" clip;
// `genericBandwidthOnly`: a valid master from another provider that lists only BANDWIDTH.
const MASTER = {
  ottAlive: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"\nhd/index.m3u8\n',
  ottDead: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200000\nhttp://myott.top/system/notkey.m3u8\n',
  genericBandwidthOnly: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1280000\nlow/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2560000\nmid/index.m3u8\n'
};

// A generic M3U playlist. channels: [{ id, name, group }] or a count.
function m3uPlaylist(channels, opts) {
  const o = Object.assign({ epgUrl: '', catchupDays: 7 }, opts || {});
  const list = typeof channels === 'number'
    ? Array.from({ length: channels }, (_, i) => ({ id: 'ch' + (i + 1), name: channelName(i), group: GROUPS[i % GROUPS.length] }))
    : channels;
  let text = '#EXTM3U' + (o.epgUrl ? ' url-tvg="' + o.epgUrl + '"' : '') + '\n';
  for (const c of list) {
    text += '#EXTINF:-1 tvg-id="' + c.id + '" tvg-logo="http://img.example.test/' + c.id + '.png" group-title="' + c.group +
      '" catchup="default" catchup-days="' + o.catchupDays + '" catchup-source="?utc={utc}&lutc={lutc}",' + c.name + '\n' +
      m3uStreamUrl(c.id) + '\n';
  }
  return text;
}
function m3uStreamUrl(id) { return 'http://iptv.example.test/live/' + id + '/index.m3u8'; }

function xmltvTime(ms) {
  const d = new Date(ms);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '00 +0000';
}

// Well-formed XMLTV: `perChannel` consecutive 10-minute shows per channel, ending around now.
function xmltv(channelIds, perChannel, opts) {
  const o = Object.assign({ now: DEFAULT_NOW, version: 'v1' }, opts || {});
  const start0 = o.now - perChannel * 600000 + 3 * HOUR;
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<tv>'];
  for (const id of channelIds) {
    for (let i = 0; i < perChannel; i++) {
      const s = start0 + i * 600000;
      parts.push('<programme start="' + xmltvTime(s) + '" stop="' + xmltvTime(s + 600000) + '" channel="' + id + '">' +
        '<title lang="ru">' + o.version + ' Выпуск ' + i + '</title><desc lang="ru">Документальный цикл</desc></programme>');
    }
  }
  parts.push('</tv>');
  return parts.join('\n');
}

// Malformed XMLTV: `count` <programme> tags that are never closed (a truncated or broken guide).
function xmltvUnclosed(count, opts) {
  const o = Object.assign({ now: DEFAULT_NOW }, opts || {});
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<tv>'];
  for (let i = 0; i < count; i++) {
    const s = o.now + i * 600000;
    parts.push('<programme start="' + xmltvTime(s) + '" stop="' + xmltvTime(s + 600000) + '" channel="c1"><title>Выпуск ' + i + '</title>');
  }
  parts.push('</tv>');
  return parts.join('\n');
}

const isList = (u) => u === OTT + '/api/channel_now';
const isGuide = (u) => u.indexOf(OTT + '/api/channel/') === 0;
const isStream = (u) => u.indexOf(OTT + '/stream/') === 0;
const streamIdOf = (u) => (/\/stream\/[^/]+\/([^/.]+)\.m3u8/.exec(u) || [])[1];
const guideIdOf = (u) => (/\/api\/channel\/([^/?]+)/.exec(u) || [])[1];

// An app in OTT Club mode (fake key), booted. Routes can be overridden afterwards via app.net.route().
// opts: channels (count), list ({ body }), guide ('ok' | 'fail' | 'malformed'), stream ('alive' | 'hang'),
//       latency per route, plus any createApp option.
function ottApp(opts) {
  const o = Object.assign({ channels: 30, guide: 'ok', stream: 'alive', listLatency: 100, guideLatency: 300,
    streamLatency: 300, boot: true }, opts || {});
  const app = createApp(Object.assign({}, o, { storage: Object.assign({ ottKey: JSON.stringify(FAKE_KEY) }, o.storage || {}) }));
  const list = o.list || ottChannelList(o.channels);
  app.fixture = { list };
  app.net.route((u) => isList(u), () => ({ body: app.fixture.list.body, delay: o.listLatency }));
  app.net.route((u) => isGuide(u), (req) => {
    if (o.guide === 'fail') return { status: 500, body: 'Internal Server Error', delay: o.guideLatency };
    if (o.guide === 'malformed') return { status: 200, body: '<html><body>502 Bad Gateway</body></html>', delay: o.guideLatency };
    return { body: ottGuide(guideIdOf(req.url)), delay: o.guideLatency };
  });
  app.net.route((u) => isStream(u), () => (o.stream === 'hang' ? { hang: true } : { body: MASTER.ottAlive, delay: o.streamLatency }));
  if (o.boot) app.boot();
  return app;
}

// An app in generic M3U mode (playlist URL saved on the device), booted.
function m3uApp(opts) {
  const o = Object.assign({ channels: 5, master: MASTER.ottAlive, boot: true }, opts || {});
  const url = 'http://playlist.example.test/get.php?user=anastasia&type=m3u';
  const app = createApp(Object.assign({}, o, { storage: Object.assign({ playlistUrl: JSON.stringify(url) }, o.storage || {}) }));
  app.fixture = { playlist: m3uPlaylist(o.channels, o.m3u) };
  app.net.route((u) => u === url, () => ({ body: app.fixture.playlist, delay: 100 }));
  app.net.route((u) => u.indexOf('http://iptv.example.test/') === 0, () => ({ body: o.master, delay: 100 }));
  if (o.boot) app.boot();
  return app;
}

// The first av.open of a channel's live stream has been followed by play().
function startedPlaying(app) { return app.av.calls.some((c) => c.fn === 'play'); }
// Lets the booted app load its list and start the first channel; fails loudly if it never plays.
function untilPlaying(app, maxMs) {
  if (!app.advanceUntil(() => startedPlaying(app), maxMs || 5000)) throw new Error('the first channel never started playing');
  return app;
}
function lastOpenUrl(app) { const opens = app.av.calls.filter((c) => c.fn === 'open'); return opens.length ? opens[opens.length - 1].args[0] : null; }
function archiveStartOf(url) { const m = /[?&]archive=(\d+)/.exec(url || ''); return m ? +m[1] * 1000 : null; }

module.exports = {
  FAKE_KEY, OTT, HOUR, DAY, MASTER, DEFAULT_NOW,
  ottChannelList, ottGuide, m3uPlaylist, m3uStreamUrl, xmltv, xmltvUnclosed,
  isList, isGuide, isStream, streamIdOf, guideIdOf,
  ottApp, m3uApp, startedPlaying, untilPlaying, lastOpenUrl, archiveStartOf
};
