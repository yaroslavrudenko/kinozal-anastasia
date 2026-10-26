// Archive (catch-up): the archive window (SSOT) and URLs for the common IPTV schemes:
// OTT Club, default/append templates, shift, flussonic.
var Catchup = (function () {
  var FLUSSONIC_HLS = /\/(index|video|mono|mpegts)\.m3u8/;
  var FLUSSONIC_TS = /\/mpegts(?=\?|$)/;

  function supported(ch) { return ch.catchupDays > 0 || !!ch.catchup || !!ch.catchupSource; }
  function days(ch) { return ch.catchupDays || CONFIG.ARCHIVE_DAYS; }
  // The earliest moment the app opens: the provider's window minus a safety margin (its oldest minutes
  // are already gone by the time a stream opens — a moment at the very edge never starts, TV test D1).
  function earliest(ch, nowMs) { return nowMs - days(ch) * Util.DAY_MS + CONFIG.ARCHIVE_EDGE_MARGIN_MS; }

  // startMs: wall-clock moment to play from. durationMs: programme length (0 = unknown: no guide there).
  // A request never spans more than ARCHIVE_SPAN_MS: a moment with no guide 7 days back once asked for 7 days
  // up to now, which OTT Club answers with 404 (TV test D1 on 352 Inrating); the player continues at its end.
  function url(ch, startMs, durationMs) {
    var nowMs = Date.now();
    var start = Math.floor(startMs / 1000);
    var now = Math.floor(nowMs / 1000);
    var dur = Math.floor(Math.min(durationMs || CONFIG.ARCHIVE_SPAN_MS, CONFIG.ARCHIVE_SPAN_MS) / 1000);
    // Never ask for a recording that ends in the future (a show still on air): the server returns an
    // unfinished recording and the TV player waits on it forever. The player continues at its end.
    if (start + dur > now - 10) dur = Math.max(60, now - 10 - start);
    var type = (ch.catchup || '').toLowerCase();

    if (type === 'ottclub') {
      return ch.url + (ch.url.indexOf('?') < 0 ? '?' : '&') + 'archive=' + start + '&archive_end=' + (start + dur);
    }
    if (type === 'flussonic' || type === 'fs' || (!type && !ch.catchupSource && FLUSSONIC_HLS.test(ch.url))) {
      if (FLUSSONIC_HLS.test(ch.url)) return ch.url.replace(FLUSSONIC_HLS, '/$1-' + start + '-' + dur + '.m3u8');
      return ch.url.replace(FLUSSONIC_TS, '/timeshift_abs-' + start + '.ts');
    }
    if (ch.catchupSource) {
      var src = fill(ch.catchupSource, { start: start, now: now, dur: dur });
      if (/^https?:\/\//.test(src)) return src;
      // "append" and "default" with a relative template; keep a single "?" in the query.
      if (src.charAt(0) === '?' && ch.url.indexOf('?') >= 0) src = '&' + src.substring(1);
      return ch.url + src;
    }
    // "shift" and unknown types: the widely used utc/lutc query.
    return ch.url + (ch.url.indexOf('?') < 0 ? '?' : '&') + 'utc=' + start + '&lutc=' + now;
  }

  // t: template; v: { start, now, dur } in seconds. Every token may carry a "$" and a "(b)" prefix.
  function fill(t, v) {
    var d = new Date(v.start * 1000);
    var dateTokens = { Y: d.getFullYear(), m: Util.pad2(d.getMonth() + 1), d: Util.pad2(d.getDate()),
      H: Util.pad2(d.getHours()), M: Util.pad2(d.getMinutes()), S: Util.pad2(d.getSeconds()) };
    return t.replace(/\$?\{(utc|start|timestamp)\}/g, v.start)
            .replace(/\$?\{(lutc|now)\}/g, v.now)
            .replace(/\$?\{(utcend|end)\}/g, v.start + v.dur)
            .replace(/\$?\{duration\}/g, v.dur)
            .replace(/\$?\{offset\}/g, v.now - v.start)
            .replace(/\$?\{(?:\(b\))?([YmdHMS])\}/g, function (all, k) { return dateTokens[k]; });
  }

  return { supported: supported, days: days, earliest: earliest, url: url };
}());
