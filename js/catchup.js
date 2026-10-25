// Archive (catch-up): the archive window (SSOT) and URLs for the common IPTV schemes:
// OTT Club, default/append templates, shift, flussonic.
var Catchup = (function () {
  var FLUSSONIC_HLS = /\/(index|video|mono|mpegts)\.m3u8/;
  var FLUSSONIC_TS = /\/mpegts(?=\?|$)/;

  function supported(ch) { return ch.catchupDays > 0 || !!ch.catchup || !!ch.catchupSource; }
  function days(ch) { return ch.catchupDays || CONFIG.ARCHIVE_DAYS; }
  // The earliest moment the provider keeps for this channel.
  function earliest(ch, nowMs) { return nowMs - days(ch) * Util.DAY_MS; }

  // startMs: wall-clock moment to play from. durationMs: programme length (0 = open-ended).
  function url(ch, startMs, durationMs) {
    var nowMs = Date.now();
    var start = Math.floor(startMs / 1000);
    var now = Math.floor(nowMs / 1000);
    var dur = Math.floor((durationMs || (nowMs - startMs)) / 1000);
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
