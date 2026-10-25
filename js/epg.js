// XMLTV program guide, parsed in small time slices so the UI never freezes.
// Only channels present in the playlist and programmes in [now-3h, now+24h] are kept.
var EPG = (function () {
  var byId = {};
  var ready = false;
  var PROG = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  var TITLE = /<title[^>]*>([\s\S]*?)<\/title>/;

  function load(url, wantedIds, onDone) {
    if (!url) return;
    Util.get(url, 60000, function (xml) { parseSliced(xml, wantedIds, onDone); }, function () {});
  }

  function parseSliced(xml, wanted, onDone) {
    // Keep the archive window (7 days back) so past programmes can be played from the guide.
    var from = Date.now() - 7 * 86400000, to = Date.now() + 24 * 3600000;
    var tmp = {};
    PROG.lastIndex = 0;
    function slice() {
      var t0 = Date.now(), m;
      while ((m = PROG.exec(xml)) !== null) {
        var head = m[1];
        var ch = attr(head, 'channel');
        if (wanted[ch]) {
          var start = parseTime(attr(head, 'start')), stop = parseTime(attr(head, 'stop'));
          if (stop > from && start < to) {
            var tm = TITLE.exec(m[2]);
            (tmp[ch] || (tmp[ch] = [])).push({ start: start, stop: stop, title: tm ? unxml(tm[1]) : '' });
          }
        }
        if (Date.now() - t0 > 12) { setTimeout(slice, 0); return; }
      }
      for (var k in tmp) tmp[k].sort(function (a, b) { return a.start - b.start; });
      byId = tmp; ready = true; xml = null;
      if (onDone) onDone();
    }
    slice();
  }

  function attr(s, name) {
    var i = s.indexOf(name + '="');
    if (i < 0) return '';
    i += name.length + 2;
    return s.substring(i, s.indexOf('"', i));
  }

  // "20261025183000 +0300"
  function parseTime(s) {
    var d = Date.UTC(+s.substr(0, 4), +s.substr(4, 2) - 1, +s.substr(6, 2), +s.substr(8, 2), +s.substr(10, 2), +s.substr(12, 2) || 0);
    var tz = s.substr(15, 5);
    if (tz) {
      var sign = tz.charAt(0) === '-' ? -1 : 1;
      d -= sign * (+tz.substr(1, 2) * 60 + +tz.substr(3, 2)) * 60000;
    }
    return d;
  }

  function unxml(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }

  // Returns up to `count` programmes starting with the current one.
  function upcoming(id, count) {
    var list = byId[id];
    if (!list) return [];
    var now = Date.now();
    for (var i = 0; i < list.length; i++) if (list[i].stop > now) return list.slice(i, i + count);
    return [];
  }

  // The programme on air at moment `t` (for the archive banner).
  function at(id, t) {
    var list = byId[id];
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].start <= t && list[i].stop > t) return list[i];
    return null;
  }

  // Programmes of one calendar day (dayOffset 0 = today, -1 = yesterday ...).
  function day(id, dayOffset) {
    var list = byId[id] || [];
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var from = d0.getTime() + dayOffset * 86400000, to = from + 86400000;
    var out = [];
    for (var i = 0; i < list.length; i++) if (list[i].start >= from && list[i].start < to) out.push(list[i]);
    return out;
  }

  return { load: load, upcoming: upcoming, at: at, day: day, isReady: function () { return ready; } };
}());
