// The pooled DOM rows of the list columns: built on first use, filled from view models, and written
// cell by cell only when a value changed (moving the cursor rewrites two rows, not the whole column).
var ListRows = (function () {
  var pools = {};
  // Row pools are built on first use (not at start): [container id, rows, row class, the overlay showing it] per column.
  var POOLS = { channels: ['channels', CONFIG.VISIBLE_ROWS, 'row', 'menu'], groups: ['groups', CONFIG.VISIBLE_ROWS, 'grow', 'menu'],
    programmes: ['p-list', CONFIG.VISIBLE_ROWS - 3, 'prow', 'panel'], search: ['search-list', CONFIG.SEARCH_ROWS, 'row', 'search'] };   // panel: room for the hint
  // A text cell holds the text in its own element (.x), so a provider text in the other script than the interface
  // is laid out in its own direction: wrapped, its lines keep one edge (css .x). The title's marks (★ before, ▶
  // after) are elements of their own, on the interface's side of it.
  var ROW = '<span class="n"></span><img class="logo" alt=""><span class="t"><i></i><span class="x"></span><i></i></span>' +
    '<span class="s"><span class="x"></span></span>';

  function pool(name, containerId, n, cls) {
    var container = Util.$(containerId), out = [];
    for (var i = 0; i < n; i++) {
      var r = document.createElement('div');
      r.className = cls;
      r.innerHTML = ROW;
      container.appendChild(r);
      Logos.track(r.children[1], shownFn(name));
      var t = r.children[2];
      out.push({ el: r, cls: cls, n: r.children[0], logo: r.children[1], pre: t.children[0], t: t.children[1], post: t.children[2], s: r.children[3].children[0],
        last: { vis: '', cls: cls, i: '', num: '', pre: '', title: '', post: '', tdir: '', sub: '', sdir: '' } });   // null: the first write always lands
    }
    out.name = name;
    return out;
  }

  function shownFn(name) { return function () { return Overlay.mode() === POOLS[name][3]; }; }
  function get(name) { return pools[name] || (pools[name] = pool(name, POOLS[name][0], POOLS[name][1], POOLS[name][2])); }

  // view rows: { num, key, logo, pre, title, own, post, sub, subOwn, past, playing } — own / subOwn: the text is one
  // provider text (a name, a programme), laid out in its own direction. dir: the way the cursor moved in this render
  // (-1 up, 1 down, 0 not at all), the same for every fill of the render (ListView).
  function fill(rows, view, start, dir) {
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k], idx = start + k;
      if (idx >= view.total) { set(r, 'vis', 'hidden'); set(r, 'cls', r.cls); r.nextLogo = r.nextKey = ''; continue; }
      var m = view.row(idx), title = m.title || '', sub = m.sub === undefined ? '' : String(m.sub);
      set(r, 'vis', 'inherit');           // never 'visible': it would show the row through a menu hidden by visibility
      set(r, 'cls', r.cls + (idx === view.cursor ? (view.active ? ' focus' : ' sel') : '') + (m.past ? ' past' : '') + (m.playing ? ' playing' : ''));
      set(r, 'i', String(idx));            // list index, for mouse clicks in the desktop preview
      set(r, 'num', m.num === undefined ? '' : String(m.num));
      r.nextLogo = m.logo || '';
      r.nextKey = m.key || '';
      set(r, 'pre', m.pre || '');
      set(r, 'title', title);
      set(r, 'tdir', m.own ? I18n.otherDir(title) : '');
      set(r, 'post', m.post || '');
      set(r, 'sub', sub);
      set(r, 'sdir', m.subOwn ? I18n.otherDir(sub) : '');
    }
  }

  function hideFrom(rows, k) { for (; k < rows.length; k++) { set(rows[k], 'vis', 'hidden'); rows[k].nextLogo = rows[k].nextKey = ''; } }
  // The logos, once per render after its last fill (ListView): a page up's correcting fill no longer sets every row's
  // picture twice in the key's task (TV: cold CH− key → 2nd frame 56–62 vs 1.8.4 44–54 ms), and a logo never changes
  // the layout read between the fills (its box is fixed).
  function logos(rows, view, start, dir) {
    for (var k = 0; k < rows.length; k++) setLogo(rows[k], rows[k].nextLogo, rows[k].nextKey);
    schedule(rows, view, start, dir);
  }

  function set(r, field, v) {
    if (r.last[field] === v) return;
    r.last[field] = v;
    if (field === 'vis') r.el.style.visibility = v;
    else if (field === 'cls') r.el.className = v;
    else if (field === 'i') r.el.setAttribute('data-i', v);
    else if (field === 'num') r.n.textContent = v;
    else if (field === 'pre') r.pre.textContent = v;
    else if (field === 'title') r.t.textContent = v;
    else if (field === 'post') r.post.textContent = v;
    else if (field === 'tdir') dir(r.t, v);
    else if (field === 'sdir') dir(r.s, v);
    else r.s.textContent = v;
  }
  function dir(el, v) { if (v) el.setAttribute('dir', v); else el.removeAttribute('dir'); }

  // A row's logo goes through Logos (shown at once when loaded, else its box empty until it is); the same channel keeps
  // its picture while a new URL of its logo loads.
  function setLogo(r, src, key) { Logos.put(r.logo, src, key); }
  // What to load, on every fill — keys held too (DEC-2026-10-28-logos-ahead: no dwell; the owner: «не видеть, как
  // дозагружаются иконки»): the page on screen, then the two pages ahead the way the cursor moves, then the page behind.
  // O(1) here: the URLs are looked up in Logos' idle slot. The direction is the cursor's, kept from the last move when it
  // did not move — never the window's own correction (review 7, Codex C7-2); at the top, ahead is below.
  // The menu laid out ahead at the first frame (view.ahead) asks for its own page only; any other screen not open asks
  // for none (review 4, P4-5; review 5, Codex 15).
  function schedule(rows, view, start, dir) {
    if (!view.logo) return;
    var n = rows.length, mode = POOLS[rows.name][3], d = rows.dir = dir || rows.dir || 1, up = d < 0 && start > 0;
    var open = function () { return Overlay.mode() === mode || view.ahead && Overlay.isNone(); };
    if (!open()) return;
    if (Overlay.mode() === mode) Logos.start();   // a screen of logos is open (even if no picture ever came)
    Logos.want(rows.name, function () {
      var urls = [], k;
      for (k = 0; k < n; k++) urls.push(logoAt(view, start + k));
      if (view.ahead) return urls;
      for (k = 0; k < 2 * n; k++) urls.push(logoAt(view, up ? start - 1 - k : start + n + k));
      for (k = 0; k < n; k++) urls.push(logoAt(view, up ? start + n + k : start - 1 - k));
      return urls;
    }, open);
  }
  function logoAt(view, i) { return i >= 0 && i < view.total ? view.logo(i) : ''; }

  return { get: get, fill: fill, hideFrom: hideFrom, logos: logos };
}());
