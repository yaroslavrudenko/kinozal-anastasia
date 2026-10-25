// XMLTV parser: a linear indexOf scanner (no backtracking regex), sliced to CONFIG.SLICE_MS per task.
//   XMLTV.parse({ text, wanted, from, to }, function done(byId) {}) -> { cancel }
//   wanted: dict of channel ids to keep (null = all); from/to: the time window kept (ms).
//   byId: dict id -> [{ start, stop, title }] sorted by start. A missing </programme> ends the scan,
//   so a truncated or broken file costs one pass, not a quadratic search.
var XMLTV = (function () {
  var OPEN = '<programme', CLOSE = '</programme>';
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

  function parse(req, done) {
    var text = req.text, wanted = req.wanted, pos = 0, close = -2;   // close: the next </programme> (-2 unknown)
    var byId = Util.dict(), ids = [], s = 0, cancelled = false, timer = null;

    // Returns false when the scan is over.
    function next() {
      var i = text.indexOf(OPEN, pos);
      if (i < 0) return false;
      var headEnd = text.indexOf('>', i);
      if (headEnd < 0) return false;
      // The closing tag found earlier is reused until the scan passes it, so a run of unclosed tags
      // before one distant </programme> costs one search, not one search per tag (linear on any input).
      if (close < headEnd) close = text.indexOf(CLOSE, headEnd);
      if (close < 0) return false;
      var again = text.indexOf(OPEN, headEnd);
      if (again >= 0 && again < close) { pos = again; return true; }   // this one was never closed
      pos = close + CLOSE.length;
      take(text.substring(i + OPEN.length, headEnd), text.substring(headEnd + 1, close));
      return true;
    }

    function take(head, body) {
      var id = attr(head, 'channel');
      if (wanted && !wanted[id]) return;
      var start = parseTime(attr(head, 'start')), stop = parseTime(attr(head, 'stop'));
      if (!(stop > req.from && start < req.to)) return;
      if (!byId[id]) { byId[id] = []; ids.push(id); }
      byId[id].push({ start: start, stop: stop, title: titleOf(body) });
    }

    function scan() {
      timer = null;
      if (cancelled) return;
      var t0 = Date.now();
      while (next()) if (Date.now() - t0 > CONFIG.SLICE_MS) { timer = setTimeout(scan, 0); return; }
      text = null;
      sort();
    }

    // One channel per budget check: a single 7-day guide sorts in well under a slice.
    function sort() {
      timer = null;
      if (cancelled) return;
      var t0 = Date.now();
      while (s < ids.length) {
        byId[ids[s++]].sort(byStart);
        if (Date.now() - t0 > CONFIG.SLICE_MS) { timer = setTimeout(sort, 0); return; }
      }
      done(byId);
    }

    scan();
    return { cancel: function () { cancelled = true; clearTimeout(timer); text = null; } };
  }

  function byStart(a, b) { return a.start - b.start; }

  // name="v" or name='v'
  function attr(head, name) {
    var i = head.indexOf(name + '=');
    if (i < 0) return '';
    var q = head.charAt(i + name.length + 1);
    if (q !== '"' && q !== "'") return '';
    var from = i + name.length + 2, to = head.indexOf(q, from);
    return to < 0 ? '' : head.substring(from, to);
  }

  function titleOf(body) {
    var i = body.indexOf('<title');
    if (i < 0) return '';
    var from = body.indexOf('>', i) + 1, to = body.indexOf('</title>', from);
    return from <= 0 || to < 0 ? '' : decode(body.substring(from, to));
  }

  function decode(s) {
    var cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
    if (cdata) return cdata[1];
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, function (all, e) {
      if (e.charAt(0) !== '#') return NAMED[e];
      var code = e.charAt(1) === 'x' ? parseInt(e.substring(2), 16) : parseInt(e.substring(1), 10);
      return fromCode(code);
    });
  }

  function fromCode(code) {
    if (!(code > 0 && code <= 0x10FFFF)) return '';
    if (code <= 0xFFFF) return String.fromCharCode(code);
    code -= 0x10000;
    return String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
  }

  // "20261025183000 +0300"
  function parseTime(s) {
    var d = Date.UTC(+s.substr(0, 4), +s.substr(4, 2) - 1, +s.substr(6, 2), +s.substr(8, 2), +s.substr(10, 2), +s.substr(12, 2) || 0);
    var tz = s.substr(15, 5);
    if (tz) {
      var sign = tz.charAt(0) === '-' ? -1 : 1;
      d -= sign * (+tz.substr(1, 2) * 60 + +tz.substr(3, 2)) * Util.MIN_MS;
    }
    return d;
  }

  return { parse: parse };
}());
