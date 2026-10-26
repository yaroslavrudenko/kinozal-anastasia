// Injected into the app page by the TV runner (ES5 only: the TV's web engine is Chromium 47).
// Read-only helpers over the DOM and the app's public modules, a request counter, and fetches of the
// provider's public "now" list and per-channel guide (the runner's own requests are not counted).
(function () {
  if (window.__TT) return;
  var T = window.__TT = { req: [], api: null, guide: {}, ver: 1 };
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) {
    if (!this.__tt) T.req.push({ t: Date.now(), url: String(url).replace(/\/stream\/[^\/]+\//, '/stream/<key>/') });
    return open.apply(this, arguments);
  };
  function get(url, done) {
    var x = new XMLHttpRequest();
    x.__tt = true;
    x.open('GET', url, true);
    x.timeout = 20000;
    x.onload = function () { var d = null; try { d = JSON.parse(x.responseText); } catch (e) {} done(d); };
    x.onerror = x.ontimeout = function () { done(null); };
    x.send();
  }
  function base() { return OttClub.sourceUrl().replace(/\/api\/channel_now$/, ''); }
  // The reference for "on air": the provider's FRESH list. The plain /api/channel_now is served from a
  // cache (max-age 60, often minutes old: up to a third of the channels name a show that has ended);
  // `?t=<seconds>` bypasses it. Each reference records when it was asked and answered, and how many of
  // its channels still name an ended show, so a stale reference shows in the results.
  T.apiStart = function () {
    var t0 = Date.now();
    T.api = null;
    get(OttClub.sourceUrl() + '?t=' + Math.floor(t0 / 1000), function (d) {
      var at = Date.now(), ended = 0, k;
      d = d || {};
      for (k in d) if (d[k] && d[k].time_to && d[k].time_to * 1000 <= at) ended++;
      T.api = { asked: t0, at: at, data: d, ended: ended, size: Object.keys(d).length };
    });
    return 1;
  };
  T.guideStart = function (id) { T.guide[id] = null; get(base() + '/api/channel/' + id, function (d) { T.guide[id] = { at: Date.now(), data: (d && d.epg_data) || [] }; }); return 1; };
  // The programme the API says is on air now for channel id (from the last apiStart), or null.
  T.apiNow = function (id) {
    var c = T.api && T.api.data && T.api.data[id], now = Date.now();
    return c && c.name && c.time * 1000 <= now && now < c.time_to * 1000 ? { title: c.name, start: c.time * 1000, stop: c.time_to * 1000 } : null;
  };
  // { cur, next } from the fetched guide of id at moment t.
  T.guideAt = function (id, t) {
    var g = T.guide[id], l = g ? g.data : [], cur = null, next = null, i;
    for (i = 0; i < l.length; i++) if (l[i].time * 1000 <= t && t < l[i].time_to * 1000) cur = l[i];
    if (cur) for (i = 0; i < l.length; i++) if (l[i].time === cur.time_to) next = l[i];
    return { cur: cur && cur.name, next: next && next.name, nextStart: next && next.time * 1000 };
  };
  function clipOf(el) {
    var top = 0, bottom = window.innerHeight, a;
    for (a = el; a && a !== document.body; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
      var r = a.getBoundingClientRect();
      top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom);
    }
    return { top: top, bottom: bottom };
  }
  // Visible rows of a list column: number, name, "now" cell, highlight, playing marker, completely visible.
  T.rows = function (id) {
    var col = document.getElementById(id), out = [], clip = clipOf(col), i;
    for (i = 0; i < col.children.length; i++) {
      var r = col.children[i];
      if (r.style.visibility === 'hidden' || getComputedStyle(r).visibility === 'hidden') continue;
      var b = r.getBoundingClientRect(), cls = ' ' + r.className + ' ';
      out.push({ num: r.children[0].textContent, title: r.children[2].textContent, sub: r.children[3].textContent,
        focus: cls.indexOf(' focus ') >= 0 || cls.indexOf(' sel ') >= 0, playing: cls.indexOf(' playing ') >= 0,
        full: b.height > 0 && b.top >= clip.top - 1 && b.bottom <= clip.bottom + 1 });
    }
    return out;
  };
  T.groups = function () {
    var g = Channels.groups(), out = [], i;
    for (i = 0; i < g.length; i++) out.push({ i: i, name: g[i].name, count: g[i].items.length, special: !!(g[i].search || g[i].about) });
    return out;
  };
  T.chByNum = function (n) { var c = Channels.byNum(+n); return c ? { id: c.id, name: c.name, key: c.key, num: c.num } : null; };
  function text(id) { var e = document.getElementById(id); return e ? e.textContent : ''; }
  function shown(id) { var e = document.getElementById(id); return !!e && !/(^|\s)hidden(\s|$)/.test(e.className); }
  T.st = function () {
    var c = Playback.current(), av = window.webapis && webapis.avplay, s = '';
    try { s = av ? av.getState() : ''; } catch (e) { s = 'ERR'; }
    return { now: Date.now(), overlay: Overlay.mode(), mode: Playback.mode(), pos: Playback.position(), media: Player.mediaTimeMs(),
      av: s, ch: c ? { id: c.id, name: c.name, num: c.num, key: c.key } : null, group: Zap.group(),
      banner: shown('banner'), bNum: text('b-num'), bTitle: text('b-title'), bNow: text('b-now'), bNext: text('b-next'),
      bTech: text('b-tech'), bClock: text('b-clock'), toast: shown('toast') ? text('toast') : '',
      scrubTime: text('s-time'), progTitle: text('p-title'), fails: Diag.snapshot().recent.length, reqs: T.req.length };
  };
  T.reqSince = function (t) { var n = 0, i; for (i = 0; i < T.req.length; i++) if (T.req[i].t >= t) n++; return n; };
  T.reqListSince = function (t) { var o = [], i; for (i = 0; i < T.req.length; i++) if (T.req[i].t >= t) o.push(T.req[i].url); return o; };
}());
