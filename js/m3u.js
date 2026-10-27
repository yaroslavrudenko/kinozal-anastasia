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
      if (!ch.rawGroup) ch.rawGroup = group;
      ch.group = groupName(ch.rawGroup);
      // Playlist-wide catch-up defaults apply to channels that declare none.
      if (!ch.catchup) ch.catchup = header.catchup || header['catchup-type'] || '';
      if (!ch.catchupSource) ch.catchupSource = header['catchup-source'] || '';
      if (!ch.catchupDays) ch.catchupDays = parseInt(header['catchup-days'] || '0', 10) || 0;
      ch.num = channels.length + 1;
      // The key keeps the playlist's own group text, so saved favourites and last channels outlive
      // the menu's group names.
      ch.key = uniqueKey('m3u:' + (ch.id || ch.nameLc) + '|' + (ch.rawGroup || 'Без группы'));
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
      done(channels.length ? { channels: countriesFirst(channels), epgUrl: epgUrl } : null);
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
      rawGroup: a['group-title'] || '',
      catchup: a.catchup || a['catchup-type'] || '',
      catchupSource: a['catchup-source'] || '',
      catchupDays: parseInt(a['catchup-days'] || a['tvg-rec'] || a.timeshift || '0', 10) || 0,
      dead: false
    };
  }

  // The owner's priority in any playlist: Israeli channels open the list, Ukrainian ones follow, the rest
  // keep the playlist's order; numbers follow the new order.
  function countriesFirst(list) {
    var il = [], ua = [], rest = [];
    for (var i = 0; i < list.length; i++) (list[i].il ? il : list[i].ua ? ua : rest).push(list[i]);
    var out = il.concat(ua, rest);
    for (var j = 0; j < out.length; j++) out[j].num = j + 1;
    return out;
  }

  // "General;News" (iptv-org lists several categories) -> the most specific one; common English
  // category names read in Russian like the rest of the menu.
  var GROUP_RU = Util.dict(), GROUP_RU_LIST = { news: 'Новостные', kids: 'Детские', animation: 'Детские', music: 'Музыкальные', movies: 'Кино',
    series: 'Сериалы', sports: 'Спорт', documentary: 'Познавательные', science: 'Познавательные', education: 'Познавательные',
    entertainment: 'Развлекательные', comedy: 'Развлекательные', general: 'Общие', religious: 'Религиозные',
    culture: 'Культура', lifestyle: 'Образ жизни', travel: 'Путешествия', cooking: 'Кулинария', business: 'Бизнес',
    legislative: 'Парламент', weather: 'Погода', shop: 'Магазины', outdoor: 'Природа', auto: 'Авто', classic: 'Классика',
    family: 'Семейные', public: 'Общественные', relax: 'Отдых', undefined: 'Без группы' };
  for (var g in GROUP_RU_LIST) GROUP_RU[g] = GROUP_RU_LIST[g];
  var VAGUE_GROUP = /^(general|undefined)$/i;
  function groupName(raw) {
    var parts = raw.split(';'), pick = '';
    for (var i = 0; i < parts.length && !pick; i++) {
      var p = parts[i].trim();
      if (p && !VAGUE_GROUP.test(p)) pick = p;
    }
    pick = pick || parts[0].trim();
    return GROUP_RU[pick.toLowerCase()] || pick || 'Без группы';
  }

  return { parse: parse };
}());
