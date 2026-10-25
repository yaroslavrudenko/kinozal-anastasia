// OTT Club source: channel list, logos and guide from the public API; streams need the subscriber key.
//   GET <scheme>://<server>/api/channel_now   -> { "<id>": { ch_id, channel_name, img, rec, category{class,name}, name, time, time_to } }
//   GET <scheme>://<server>/api/channel/<id>  -> { epg_data: [{ name, descr, time, time_to }] }   (7 days back, 24 h ahead)
//   stream:  <scheme>://<server>/stream/<KEY>/<id>.m3u8   archive: ?archive=<start>&archive_end=<end>
var OttClub = (function () {
  var cachedKey = null;        // read from the device once per session; saveKey() updates it

  function base() { return CONFIG.OTT_SCHEME + '://' + CONFIG.OTT_SERVER; }

  // The key is entered once on the setup screen (or built in) and kept on the device.
  function key() {
    if (cachedKey === null) {
      var k = Util.load('ottKey');
      cachedKey = k || (CONFIG.OTT_KEY && CONFIG.OTT_KEY.indexOf('__') !== 0 ? CONFIG.OTT_KEY : '');
    }
    return cachedKey;
  }
  function enabled() { return !!key(); }
  function saveKey(k) { cachedKey = k; Util.save('ottKey', k); }

  // Accepts a bare key or any OTT Club link that carries it (/stream/<key>/, ?key=, ottkey=, /playlist/<key>/).
  function extractKey(text) {
    var t = String(text).trim();
    var m = /\/stream\/([A-Za-z0-9]+)\//.exec(t) || /[?&](?:ott)?key=([A-Za-z0-9]+)/.exec(t) ||
            /\/(?:playlist|ottplayer|m3u)\/([A-Za-z0-9]{6,})/.exec(t) || /^([A-Za-z0-9]{6,})$/.exec(t);
    return m ? m[1] : '';
  }

  // The provider's answer for a stream, in one place:
  //   'nokey'     the key is wrong or expired: segments point at the provider's /system/<lang>/key.ts clip
  //               (measured 2026-10-26 with a fake key) — the key, not the channel, is the problem
  //   'removed'   the provider's "/system/" placeholder: the channel is gone
  //   'audioOnly' a master listing only audio-like variants: OTT Club's stub for a removed channel
  //   'ok'        anything else
  function classify(text) {
    if (text.indexOf('NOTKEY') >= 0 || /\/system\/(?:[^\/\s?]+\/)*key\.ts/.test(text)) return 'nokey';
    if (text.indexOf('/system/') >= 0) return 'removed';
    if (text.indexOf('#EXT-X-STREAM-INF') >= 0 && text.indexOf('RESOLUTION=') < 0 &&
        text.indexOf('avc1') < 0 && text.indexOf('hvc1') < 0) return 'audioOnly';
    return 'ok';
  }

  // A wrong key still gets a playlist, but it points at the provider's "no key" clip.
  function checkKey(k, done) {
    return Net.get({ url: base() + '/stream/' + k + '/136.m3u8', timeoutMs: CONFIG.KEY_CHECK_TIMEOUT_MS }, function (err, text) {
      done(!err && text.indexOf('#EXTM3U') >= 0 && classify(text) === 'ok');
    });
  }

  function sourceUrl() { return base() + '/api/channel_now'; }
  function streamUrl(id) { return base() + '/stream/' + key() + '/' + id + '.m3u8'; }

  // Text of /api/channel_now -> { channels, seeds, epgUrl: '' }; null when it is not a channel list.
  function parse(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    if (!data || typeof data !== 'object') return null;
    var recs = [], skipped = 0;
    for (var id in data) {
      var c = data[id];
      if (c && typeof c === 'object' && c.ch_id && typeof c.channel_name === 'string') recs.push(c);
      else skipped++;
    }
    if (skipped) Diag.note('list.skipped', skipped);
    return recs.length ? build(recs) : null;
  }

  // Same order as the official app: Israeli channels first by the number in the name, then group rank,
  // the provider's sequence and server order. Sort keys are computed once per channel.
  function build(recs) {
    var k = key(), b = base(), pinCount = ORDER.PINNED.length;
    var rows = [];
    for (var i = 0; i < recs.length; i++) {
      var c = recs[i], group = c.category && c.category.name ? c.category.name : 'Без группы';
      var cc = Country.detect({ name: c.channel_name, group: c.category ? c.category.name : '', id: c.ch_id }, c.name);
      var grp = ORDER.GROUPS.indexOf(group);
      rows.push({ c: c, group: group, cc: cc, pin: pinRank(cc), num: ORDER.nameNumber(c.channel_name),
        grp: grp < 0 ? ORDER.GROUPS.length : grp, seq: ORDER.SEQ[c.ch_id] || 100000, pos: i });
    }
    rows.sort(function (x, y) {
      if (x.pin !== y.pin) return x.pin - y.pin;
      if (x.pin < pinCount) return (x.num - y.num) || (x.pos - y.pos);
      return (x.grp - y.grp) || (x.seq - y.seq) || (x.pos - y.pos);
    });
    var channels = [], seeds = Util.dict();
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j], rec = r.c, archive = rec.rec === '1';
      channels.push({
        key: 'ott:' + rec.ch_id, num: j + 1, id: String(rec.ch_id), name: rec.channel_name,
        nameLc: rec.channel_name.toLowerCase(), logo: rec.img ? b + '/images/' + rec.img : '', group: r.group,
        url: b + '/stream/' + k + '/' + rec.ch_id + '.m3u8', catchup: archive ? 'ottclub' : '', catchupSource: '',
        catchupDays: archive ? CONFIG.ARCHIVE_DAYS : 0, il: r.cc.il, ua: r.cc.ua, dead: false
      });
      if (rec.name && rec.time) seeds[rec.ch_id] = [{ start: rec.time * 1000, stop: rec.time_to * 1000, title: rec.name }];
    }
    return { channels: channels, seeds: seeds, epgUrl: '' };
  }

  // Pinned channels (Israel) open the list.
  function pinRank(cc) {
    for (var p = 0; p < ORDER.PINNED.length; p++) if (ORDER.PINNED[p].numbered && cc[ORDER.PINNED[p].flag]) return p;
    return ORDER.PINNED.length;
  }

  // Full guide of one channel, fetched only when the viewer looks at it. Descriptions are not kept.
  function guide(id, done) {
    return Net.get({ url: base() + '/api/channel/' + id, timeoutMs: CONFIG.GUIDE_TIMEOUT_MS }, function (err, text) {
      if (err) { done(err); return; }
      var d;
      try { d = JSON.parse(text).epg_data; } catch (e) { done('invalid'); return; }
      if (!(d instanceof Array)) { done('invalid'); return; }
      var out = [];
      for (var i = 0; i < d.length; i++) {
        var p = d[i];
        if (p && +p.time > 0 && +p.time_to > +p.time) out.push({ start: p.time * 1000, stop: p.time_to * 1000, title: String(p.name || '') });
      }
      if (out.length) done(null, out); else done('empty');
    });
  }

  return {
    enabled: enabled, extractKey: extractKey, checkKey: checkKey, saveKey: saveKey, classify: classify,
    sourceUrl: sourceUrl, streamUrl: streamUrl, parse: parse, guide: guide
  };
}());
