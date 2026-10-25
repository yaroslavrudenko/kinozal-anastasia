// Extended M3U parser (#EXTM3U url-tvg, #EXTINF attributes, #EXTGRP), sliced so a long playlist
// never holds the main thread for more than CONFIG.SLICE_MS.
//   M3U.parse(text, function done(result) {}) -> { cancel }
//   result: { channels, epgUrl } or null when the text holds no playable channel.
var M3U = (function () {
  function parse(text, done) {
    var attrRe = /([a-zA-Z0-9_-]+)="([^"]*)"/g;      // local: overlapping parses never share a cursor
    var lines = text.split(/\r?\n/);
    var channels = [], keys = Util.dict();
    var header = Util.dict(), epgUrl = '', pending = null, group = '';
    var i = 0, cancelled = false, timer = null;

    function attrs(line) {
      var out = Util.dict(), m;
      attrRe.lastIndex = 0;
      while ((m = attrRe.exec(line)) !== null) out[m[1]] = m[2];
      return out;
    }

    function line(l) {
      if (!l) return;
      if (l.indexOf('#EXTM3U') === 0) {
        header = attrs(l);
        epgUrl = header['url-tvg'] || header['x-tvg-url'] || '';
      } else if (l.indexOf('#EXTINF') === 0) {
        pending = entry(l, attrs(l));
      } else if (l.indexOf('#EXTGRP:') === 0) {
        group = l.substring(8);
      } else if (l.charAt(0) !== '#' && pending) {
        finish(pending, l);
        pending = null;
        group = '';
      }
    }

    function finish(ch, url) {
      ch.url = url;
      if (!ch.group) ch.group = group || 'Без группы';
      // Playlist-wide catch-up defaults apply to channels that declare none.
      if (!ch.catchup) ch.catchup = header.catchup || header['catchup-type'] || '';
      if (!ch.catchupSource) ch.catchupSource = header['catchup-source'] || '';
      if (!ch.catchupDays) ch.catchupDays = parseInt(header['catchup-days'] || '0', 10) || 0;
      ch.num = channels.length + 1;
      ch.key = uniqueKey('m3u:' + (ch.id || ch.nameLc) + '|' + ch.group);
      var cc = Country.detect(ch);
      ch.il = cc.il; ch.ua = cc.ua;
      channels.push(ch);
    }

    function uniqueKey(k) {
      var key = k, n = 1;
      while (keys[key]) key = k + '#' + (++n);
      keys[key] = true;
      return key;
    }

    function slice() {
      timer = null;
      if (cancelled) return;
      var t0 = Date.now();
      while (i < lines.length) {
        line(lines[i++].trim());
        if (Date.now() - t0 > CONFIG.SLICE_MS) { timer = setTimeout(slice, 0); return; }
      }
      lines = null;
      done(channels.length ? { channels: channels, epgUrl: epgUrl } : null);
    }

    slice();
    return { cancel: function () { cancelled = true; clearTimeout(timer); } };
  }

  // "#EXTINF:-1 tvg-id="x" group-title="a, b",Name, with commas" -> the name is everything after the
  // first comma that is outside a quoted attribute value.
  function entry(l, a) {
    var name = 'Канал', quoted = false;
    for (var c = 0; c < l.length; c++) {
      var ch = l.charAt(c);
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { name = l.substring(c + 1).trim() || name; break; }
    }
    return {
      name: name, nameLc: name.toLowerCase(),
      id: a['tvg-id'] || a['tvg-name'] || '',
      logo: a['tvg-logo'] || '',
      group: a['group-title'] || '',
      catchup: a.catchup || a['catchup-type'] || '',
      catchupSource: a['catchup-source'] || '',
      catchupDays: parseInt(a['catchup-days'] || a['tvg-rec'] || a.timeshift || '0', 10) || 0,
      dead: false
    };
  }

  return { parse: parse };
}());
