// The pooled DOM rows of the list columns: built on first use, filled from view models, and written
// cell by cell only when a value changed (moving the cursor rewrites two rows, not the whole column).
var ListRows = (function () {
  var pools = {}, logoTimer = null, pending = null;
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
      Logos.track(r.children[1]);
      var t = r.children[2];
      out.push({ el: r, cls: cls, n: r.children[0], logo: r.children[1], pre: t.children[0], t: t.children[1], post: t.children[2], s: r.children[3].children[0],
        last: { vis: '', cls: cls, i: '', num: '', pre: '', title: '', post: '', tdir: '', sub: '', sdir: '' } });   // null: the first write always lands
    }
    out.filledAt = 0;
    out.name = name;
    return out;
  }

  function get(name) { return pools[name] || (pools[name] = pool(name, POOLS[name][0], POOLS[name][1], POOLS[name][2])); }

  // view rows: { num, key, logo, pre, title, own, post, sub, subOwn, past, playing } — own / subOwn: the text is one
  // provider text (a name, a programme), laid out in its own direction. dir: the way the cursor moved in this render
  // (-1 up, 1 down, 0 not at all), the same for every fill of the render (ListView).
  function fill(rows, view, start, dir) {
    var now = Date.now();
    if (now - rows.filledAt >= CONFIG.LOGO_DWELL_MS) rows.restAt = now;   // a first drawing, a step after a pause (and a refill in the same key)
    var rest = rows.restAt === now;
    rows.filledAt = now;
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k], idx = start + k;
      if (idx >= view.total) { set(r, 'vis', 'hidden'); set(r, 'cls', r.cls); setLogo(r, '', ''); continue; }
      var m = view.row(idx), title = m.title || '', sub = m.sub === undefined ? '' : String(m.sub);
      set(r, 'vis', 'inherit');           // never 'visible': it would show the row through a menu hidden by visibility
      set(r, 'cls', r.cls + (idx === view.cursor ? (view.active ? ' focus' : ' sel') : '') + (m.past ? ' past' : '') + (m.playing ? ' playing' : ''));
      set(r, 'i', String(idx));            // list index, for mouse clicks in the desktop preview
      set(r, 'num', m.num === undefined ? '' : String(m.num));
      setLogo(r, m.logo || '', m.key || '');
      set(r, 'pre', m.pre || '');
      set(r, 'title', title);
      set(r, 'tdir', m.own ? I18n.otherDir(title) : '');
      set(r, 'post', m.post || '');
      set(r, 'sub', sub);
      set(r, 'sdir', m.subOwn ? I18n.otherDir(sub) : '');
    }
    schedule(rows, view, start, rest, dir);
  }

  function hideFrom(rows, k) { for (; k < rows.length; k++) { set(rows[k], 'vis', 'hidden'); setLogo(rows[k], '', ''); } }

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
  // its picture while a new URL of its logo loads. What to load is decided once the cursor dwells (schedule).
  function setLogo(r, src, key) { Logos.put(r.logo, src, key); }
  // The pictures of the page on screen, then of the next page the way the cursor moves; asked for at once after a
  // pause, else once the cursor has stayed LOGO_DWELL_MS (keys held: pages passed ask for none). O(1) here: the
  // URLs are looked up when the timer fires.
  // The direction is the cursor's, kept from the last move when it did not move: never the window's own correction
  // (a page up whose layout moves the window down again asked for the page below; review 7, Codex C7-2).
  function schedule(rows, view, start, rest, dir) {
    if (!view.logo) return;
    var p = pending = { rows: rows, view: view, start: start, dir: rows.dir = dir || rows.dir || 1 };
    clearTimeout(logoTimer);
    // After a pause: once the frame with the new rows is out (idle), so the key's frame carries no logo work.
    if (rest) Util.idle(function () { if (p === pending) wantPending(); }, CONFIG.LOGO_DWELL_MS);
    else logoTimer = setTimeout(wantPending, CONFIG.LOGO_DWELL_MS);
  }
  function wantPending() {
    var p = pending, n = p.rows.length, mode = POOLS[p.rows.name][3], urls = [];
    clearTimeout(logoTimer);
    logoTimer = null;
    // The menu laid out ahead at the first frame (view.ahead) gets its page's pictures as before, not the next page's;
    // any other screen not open asks for none (review 4, P4-5; review 5, Codex 15).
    var open = function () { return Overlay.mode() === mode || p.view.ahead && Overlay.isNone(); };
    // Not open: nothing to ask for; this column's earlier wish is dropped by its own gate (no empty wish that would drop
    // another consumer's — review 7, F3). At the top there is nothing above: the next page is the one below.
    if (!open()) return;
    var up = p.dir < 0 && p.start > 0;
    for (var k = 0; k < n; k++) urls.push(logoAt(p.view, p.start + k));
    for (k = 0; k < n && !p.view.ahead; k++) urls.push(logoAt(p.view, up ? p.start - 1 - k : p.start + n + k));
    Logos.want(p.rows.name, urls, open);
  }
  function logoAt(view, i) { return i >= 0 && i < view.total ? view.logo(i) : ''; }

  return { get: get, fill: fill, hideFrom: hideFrom };
}());
