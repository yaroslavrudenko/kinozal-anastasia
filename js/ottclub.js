// OTT Club source: channel list, logos and guide from the public API; streams need the subscriber key.
//   GET http://<server>/api/channel_now      -> { "<id>": { channel_name, img, rec, category{class,name}, name, time, time_to } }
//   GET http://<server>/api/channel/<id>     -> { epg_data: [{ name, descr, time, time_to }] }   (7 days)
//   stream:  http://<server>/stream/<KEY>/<id>.m3u8   archive: ?archive=<start>&archive_end=<end>
var OttClub = (function () {
  function base() { return 'http://' + CONFIG.OTT_SERVER; }

  function enabled() { return !!CONFIG.OTT_KEY && CONFIG.OTT_KEY.indexOf('__') !== 0; }
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
    // Group order follows the provider's category numbering; channel order inside a group is the provider's.
    ids.sort(function (a, b) {
      return (+data[a].category['class'] - +data[b].category['class']) || 0;
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
        url: base() + '/stream/' + CONFIG.OTT_KEY + '/' + c.ch_id + '.m3u8',
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

  return { enabled: enabled, sourceUrl: sourceUrl, parse: parse, guide: guide };
}());
