// Archive (catch-up) URLs for the common IPTV schemes: default/append templates, shift, flussonic.
var Catchup = (function () {
  function supported(ch) { return ch.catchupDays > 0 || !!ch.catchup || !!ch.catchupSource; }

  // startMs: wall-clock moment to play from. durationMs: programme length (0 = open-ended).
  function url(ch, startMs, durationMs) {
    var start = Math.floor(startMs / 1000);
    var now = Math.floor(Date.now() / 1000);
    var dur = Math.floor((durationMs || (Date.now() - startMs)) / 1000);
    // Never ask for a recording that ends in the future (a show still on air): the server returns an
    // unfinished recording and the TV player waits on it forever. The player continues at its end.
    if (start + dur > now - 10) dur = Math.max(60, now - 10 - start);
    var type = (ch.catchup || '').toLowerCase();

    if (type === 'ottclub') {
      return ch.url + (ch.url.indexOf('?') < 0 ? '?' : '&') + 'archive=' + start + '&archive_end=' + (start + dur);
    }

    if (type === 'flussonic' || type === 'fs' || (!type && !ch.catchupSource && /\/(index|video|mpegts|mono)\.m3u8/.test(ch.url))) {
      return ch.url.replace(/\/(index|video|mono)(\.m3u8)/, '/$1-' + start + '-' + dur + '$2')
                   .replace(/\/mpegts/, '/timeshift_abs-' + start + '.ts');
    }
    if (ch.catchupSource) {
      var src = fill(ch.catchupSource, start, now, dur);
      if (/^https?:\/\//.test(src)) return src;
      // "append" and "default" with a relative template; keep a single "?" in the query.
      if (src.charAt(0) === '?' && ch.url.indexOf('?') >= 0) src = '&' + src.substring(1);
      return ch.url + src;
    }
    // "shift" and unknown types: the widely used utc/lutc query.
    return ch.url + (ch.url.indexOf('?') < 0 ? '?' : '&') + 'utc=' + start + '&lutc=' + now;
  }

  function fill(t, start, now, dur) {
    var d = new Date(start * 1000);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return t.replace(/\$?\{(utc|start|timestamp)\}/g, start)
            .replace(/\$?\{(lutc|now)\}/g, now)
            .replace(/\$?\{utcend\}|\$?\{end\}/g, start + dur)
            .replace(/\$?\{duration\}/g, dur)
            .replace(/\$?\{offset\}/g, now - start)
            .replace(/\$?\{\(b\)Y\}|\{Y\}/g, d.getFullYear())
            .replace(/\$?\{\(b\)m\}|\{m\}/g, p(d.getMonth() + 1))
            .replace(/\$?\{\(b\)d\}|\{d\}/g, p(d.getDate()))
            .replace(/\$?\{\(b\)H\}|\{H\}/g, p(d.getHours()))
            .replace(/\$?\{\(b\)M\}|\{M\}/g, p(d.getMinutes()))
            .replace(/\$?\{\(b\)S\}|\{S\}/g, p(d.getSeconds()));
  }

  return { supported: supported, url: url };
}());
