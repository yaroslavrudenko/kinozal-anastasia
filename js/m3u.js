// Extended M3U parser: #EXTM3U url-tvg, #EXTINF attributes, #EXTGRP.
var M3U = (function () {
  var ATTR = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

  function parse(text) {
    var lines = text.split(/\r?\n/);
    var channels = [];
    var epgUrl = '';
    var pending = null;
    var group = '';
    var header = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\s+|\s+$/g, '');
      if (!line) continue;
      if (line.indexOf('#EXTM3U') === 0) {
        var h = attrs(line);
        epgUrl = h['url-tvg'] || h['x-tvg-url'] || '';
        header = h;
      } else if (line.indexOf('#EXTINF') === 0) {
        var a = attrs(line);
        var comma = line.lastIndexOf(',');
        pending = {
          name: comma >= 0 ? line.substring(comma + 1) : 'Канал',
          id: a['tvg-id'] || a['tvg-name'] || '',
          logo: a['tvg-logo'] || '',
          group: a['group-title'] || '',
          catchup: a.catchup || a['catchup-type'] || '',
          catchupSource: a['catchup-source'] || '',
          catchupDays: parseInt(a['catchup-days'] || a['tvg-rec'] || a.timeshift || '0', 10) || 0
        };
      } else if (line.indexOf('#EXTGRP:') === 0) {
        group = line.substring(8);
      } else if (line.charAt(0) !== '#' && pending) {
        pending.url = line;
        if (!pending.group) pending.group = group || 'Без группы';
        // Playlist-wide catch-up defaults apply to channels that declare none.
        if (!pending.catchup) pending.catchup = header.catchup || header['catchup-type'] || '';
        if (!pending.catchupSource) pending.catchupSource = header['catchup-source'] || '';
        if (!pending.catchupDays) pending.catchupDays = parseInt(header['catchup-days'] || '0', 10) || 0;
        pending.num = channels.length + 1;
        channels.push(pending);
        pending = null;
        group = '';
      }
    }
    return { channels: channels, epgUrl: epgUrl, groups: groupsOf(channels) };
  }

  function attrs(line) {
    var out = {}, m;
    ATTR.lastIndex = 0;
    while ((m = ATTR.exec(line)) !== null) out[m[1]] = m[2];
    return out;
  }

  function groupsOf(channels) {
    var order = [], map = {};
    for (var i = 0; i < channels.length; i++) {
      var g = channels[i].group;
      if (!map[g]) { map[g] = []; order.push(g); }
      map[g].push(i);
    }
    var all = [];
    for (var k = 0; k < channels.length; k++) all.push(k);
    var groups = [{ name: 'Все каналы', items: all }];
    for (var j = 0; j < order.length; j++) groups.push({ name: order[j], items: map[order[j]] });
    return groups;
  }

  return { parse: parse };
}());
