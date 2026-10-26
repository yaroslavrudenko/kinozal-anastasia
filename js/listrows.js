// The pooled DOM rows of the list columns: built on first use, filled from view models, and written
// cell by cell only when a value changed (moving the cursor rewrites two rows, not the whole column).
var ListRows = (function () {
  var pools = {};
  // Row pools are built on first use (not at start): [container id, rows, row class] per column.
  var POOLS = { channels: ['channels', CONFIG.VISIBLE_ROWS, 'row'], groups: ['groups', CONFIG.VISIBLE_ROWS, 'grow'],
    programmes: ['p-list', CONFIG.VISIBLE_ROWS - 3, 'prow'], search: ['search-list', CONFIG.SEARCH_ROWS, 'row'] };   // panel: room for the hint

  function pool(containerId, n, cls) {
    var container = Util.$(containerId), out = [];
    for (var i = 0; i < n; i++) {
      var r = document.createElement('div');
      r.className = cls;
      r.innerHTML = '<span class="n"></span><img class="logo" alt=""><span class="t"></span><span class="s"></span>';
      container.appendChild(r);
      out.push({ el: r, cls: cls, n: r.children[0], logo: r.children[1], t: r.children[2], s: r.children[3],
        last: { vis: '', cls: cls, i: '', num: '', logo: null, title: '', sub: '' } });   // logo null: the first write always lands
    }
    return out;
  }

  function get(name) { return pools[name] || (pools[name] = pool(POOLS[name][0], POOLS[name][1], POOLS[name][2])); }

  function fill(rows, view, start) {
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k], idx = start + k;
      if (idx >= view.total) { set(r, 'vis', 'hidden'); set(r, 'cls', r.cls); setLogo(r, ''); continue; }
      var m = view.row(idx);
      set(r, 'vis', 'inherit');           // never 'visible': it would show the row through a menu hidden by visibility
      set(r, 'cls', r.cls + (idx === view.cursor ? (view.active ? ' focus' : ' sel') : '') + (m.past ? ' past' : '') + (m.playing ? ' playing' : ''));
      set(r, 'i', String(idx));            // list index, for mouse clicks in the desktop preview
      set(r, 'num', m.num === undefined ? '' : String(m.num));
      setLogo(r, m.logo || '');
      set(r, 'title', m.title || '');
      set(r, 'sub', m.sub === undefined ? '' : String(m.sub));
    }
  }

  function hideFrom(rows, k) { for (; k < rows.length; k++) { set(rows[k], 'vis', 'hidden'); setLogo(rows[k], ''); } }

  function set(r, field, v) {
    if (r.last[field] === v) return;
    r.last[field] = v;
    if (field === 'vis') r.el.style.visibility = v;
    else if (field === 'cls') r.el.className = v;
    else if (field === 'i') r.el.setAttribute('data-i', v);
    else if (field === 'num') r.n.textContent = v;
    else if (field === 'title') r.t.textContent = v;
    else r.s.textContent = v;
  }

  // The logo sets its own visibility: 'hidden' without a picture, else 'inherit' — the row's or the menu's
  // hidden still hides it (an inline 'visible' overrode the menu's .guide.hidden, so its text stayed on the picture).
  function setLogo(r, src) {
    if (r.last.logo === src) return;
    r.last.logo = src;
    r.logo.style.visibility = src ? 'inherit' : 'hidden';
    if (src) r.logo.src = src; else r.logo.removeAttribute('src');
  }

  return { get: get, fill: fill, hideFrom: hideFrom };
}());
