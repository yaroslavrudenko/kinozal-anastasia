// OTT Club source: channel list, logos and guide from the public API; streams need the subscriber key.
//   GET http://<server>/api/channel_now      -> { "<id>": { channel_name, img, rec, category{class,name}, name, time, time_to } }
//   GET http://<server>/api/channel/<id>     -> { epg_data: [{ name, descr, time, time_to }] }   (7 days)
//   stream:  http://<server>/stream/<KEY>/<id>.m3u8   archive: ?archive=<start>&archive_end=<end>
var OttClub = (function () {
  function base() { return 'http://' + CONFIG.OTT_SERVER; }

  // The key is entered once on the setup screen (or built in) and kept on the device.
  function key() {
    var k = Util.store('ottKey');
    if (k) return k;
    return CONFIG.OTT_KEY && CONFIG.OTT_KEY.indexOf('__') !== 0 ? CONFIG.OTT_KEY : '';
  }
  function enabled() { return !!key(); }

  // Accepts a bare key or any OTT Club link that carries it (/stream/<key>/, ?key=, ottkey=, /playlist/<key>/).
  function extractKey(text) {
    var t = String(text).replace(/^\s+|\s+$/g, '');
    var m = /\/stream\/([A-Za-z0-9]+)\//.exec(t) || /[?&](?:ott)?key=([A-Za-z0-9]+)/.exec(t) ||
            /\/(?:playlist|ottplayer|m3u)\/([A-Za-z0-9]{6,})/.exec(t) || /^([A-Za-z0-9]{6,})$/.exec(t);
    return m ? m[1] : '';
  }

  // A wrong key still gets a playlist, but its segments point at the provider's "no key" clip.
  function checkKey(k, done) {
    Util.get(base() + '/stream/' + k + '/136.m3u8', 15000, function (text) {
      done(text.indexOf('#EXTM3U') >= 0 && text.indexOf('NOTKEY') < 0 && text.indexOf('/system/') < 0);
    }, function () { done(false); });
  }
  function saveKey(k) { Util.store('ottKey', k); }
  function sourceUrl() { return base() + '/api/channel_now'; }

  // Text of /api/channel_now -> { channels, groups, epgUrl }; null when the text is not a channel list.
  function parse(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    if (!data || typeof data !== 'object' || !Object.keys(data).length) return null;
    return build(data);
  }

  function build(data) {
    var ids = Object.keys(data);
    var pos = {};
    for (var p = 0; p < ids.length; p++) pos[ids[p]] = p;
    // Same order as the official app: group rank, then the provider's sequence, then server order.
    function groupRank(id) {
      var r = data[id].category ? ORDER.GROUPS.indexOf(data[id].category.name) : -1;
      return r < 0 ? ORDER.GROUPS.length : r;
    }
    function seq(id) { return ORDER.SEQ[id] || 100000; }
    ids.sort(function (a, b) {
      return (groupRank(a) - groupRank(b)) || (seq(a) - seq(b)) || (pos[a] - pos[b]);
    });
    var channels = [];
    for (var i = 0; i < ids.length; i++) {
      var c = data[ids[i]];
      var ch = {
        num: i + 1,
        id: c.ch_id,
        name: c.channel_name,
        logo: c.img ? base() + '/images/' + c.img : '',
        group: c.category ? c.category.name : 'Без группы',
        url: base() + '/stream/' + key() + '/' + c.ch_id + '.m3u8',
        catchup: c.rec === '1' ? 'ottclub' : '',
        catchupSource: '',
        catchupDays: c.rec === '1' ? 7 : 0
      };
      channels.push(ch);
      if (c.name && c.time) EPG.put(c.ch_id, [{ start: c.time * 1000, stop: c.time_to * 1000, title: c.name }], false);
    }
    return { channels: channels, groups: M3U.groupsOf(channels), epgUrl: '' };
  }

  // Full 7-day guide of one channel, fetched only when the viewer looks at it.
  function guide(id, done) {
    Util.get(base() + '/api/channel/' + id, 15000, function (text) {
      var list = [];
      try {
        var d = JSON.parse(text).epg_data || [];
        for (var i = 0; i < d.length; i++) {
          list.push({ start: d[i].time * 1000, stop: d[i].time_to * 1000, title: d[i].name, descr: d[i].descr || '' });
        }
      } catch (e) {}
      EPG.put(id, list, true);
      done();
    }, function () { done(); });
  }

  return {
    enabled: enabled, extractKey: extractKey, checkKey: checkKey, saveKey: saveKey,
    sourceUrl: sourceUrl, parse: parse, guide: guide
  };
}());
