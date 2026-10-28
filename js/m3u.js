// Extended M3U parser (#EXTM3U url-tvg, #EXTINF attributes, #EXTGRP), sliced so a long playlist
// never holds the main thread for more than CONFIG.SLICE_MS.
//   M3U.parse(text, function done(result) {}) -> { cancel }
//   result: { channels, epgUrl } or null when the text holds no playable channel.
var M3U = (function () {
  // Frozen parts of the channel keys (favourites and last channels saved since 1.8 keep them): an entry with no
  // name and one with no group are keyed by these words in every interface language (1.8.4 also showed them so).
  var KEY_UNNAMED = 'канал', KEY_NO_GROUP = 'Без группы';
  var REPEAT = /#\d+$/;               // «#2» … ending the key of a repeated entry (uniqueKey)
  function parse(text, done) {
    var unnamedName = I18n.t('m.channel');           // shown for an entry without a name, in the interface language
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
        pending = entry(l, attrs(l), unnamedName);
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
      ch.groupId = groupId(ch.rawGroup);
      ch.group = I18n.group(ch.groupId);
      // Playlist-wide catch-up defaults apply to channels that declare none.
      if (!ch.catchup) ch.catchup = header.catchup || header['catchup-type'] || '';
      if (!ch.catchupSource) ch.catchupSource = header['catchup-source'] || '';
      if (!ch.catchupDays) ch.catchupDays = parseInt(header['catchup-days'] || '0', 10) || 0;
      ch.num = channels.length + 1;
      // The key keeps the playlist's own group text, so saved favourites and last channels outlive
      // the menu's group names.
      ch.key = uniqueKey('m3u:' + (ch.id || (ch.unnamed ? KEY_UNNAMED : ch.nameLc)) + '|' + (ch.rawGroup || KEY_NO_GROUP));
      // An entry with no name is judged by its group and id only: «ערוץ», its Hebrew placeholder, is not a name.
      var cc = Country.detect({ name: ch.unnamed ? '' : ch.name, groupId: ch.groupId, id: ch.id });
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
  function entry(l, a, unnamedName) {
    var name = '', quoted = false;
    for (var c = 0; c < l.length; c++) {
      var ch = l.charAt(c);
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { name = l.substring(c + 1).trim(); break; }
    }
    var unnamed = !name;                 // the key uses KEY_UNNAMED in every language; only the shown name is translated
    if (unnamed) name = unnamedName;
    return {
      name: name, nameLc: name.toLowerCase(), unnamed: unnamed,
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

  // "General;News" (iptv-org lists several categories) -> the most specific one: the group's id, kept in the
  // provider's own words (keys, the remembered group and the offline copy use it); I18n.group names it. A playlist
  // with no group gives '' (our «Без группы»); «Undefined» alone is the provider's own word and stays.
  var VAGUE_GROUP = /^(general|undefined)$/i;
  function groupId(raw) {
    var parts = raw.split(';'), pick = '';
    for (var i = 0; i < parts.length && !pick; i++) {
      var p = parts[i].trim();
      if (p && !VAGUE_GROUP.test(p)) pick = p;
    }
    return pick || parts[0].trim();
  }

  // The group id of a channel saved before 1.9.0 (the offline copy then kept its translated group name): read back
  // from its key, which holds the playlist's own group text since 1.8. A «#N» at the key's end is a repeated entry's,
  // unless it is the group's own («Music#2»): the name 1.8.4 showed (`shown`) is that group's text then (review 4,
  // Codex 5). null: not a key of this parser.
  function groupIdOfKey(key, id, nameLc, shown) {
    var head = 'm3u:' + (id || nameLc) + '|';
    if (key.indexOf(head) !== 0) return null;
    var raw = key.substring(head.length);
    if (groupId(raw) !== shown) raw = raw.replace(REPEAT, '');
    return raw === KEY_NO_GROUP ? '' : groupId(raw);
  }

  return { KEY_UNNAMED: KEY_UNNAMED, KEY_NO_GROUP: KEY_NO_GROUP, parse: parse, groupIdOfKey: groupIdOfKey };
}());
