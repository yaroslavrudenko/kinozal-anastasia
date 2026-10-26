// Virtualised list columns (channels, groups, programmes, search results): which rows of a list are on
// screen, the window, paging and scrolling a tall row; the rows themselves are ListRows. View models in,
// DOM out; it reads no store.
var ListView = (function () {
  var over = {}, last = {};
  var starts = {};             // first row index of each column's window, kept between renders
  var shown = {};              // { first, count, total, bottom } of the rows completely visible after the last render
                               // (bottom: px from the column's top to the last one's bottom; null without a layout)
  var anchor = {};             // the next render's window, set by page(): { top: idx } or { bottom: idx }

  function windowStart(cursor, total, visible) {
    return Math.max(0, Math.min(cursor - Math.floor(visible / 2), total - visible));
  }

  // name: 'groups' | 'channels' | 'programmes' | 'search'
  // view: { total, cursor, active, row: function (i) -> { num, logo, title, sub, past, playing } }
  // The row of the channel on screen carries the class "playing" wherever it scrolls (it follows the
  // channel, not the pooled DOM row).
  // Rows wrap their text, so their heights differ. A row that does not fit the column completely is
  // hidden (never cut) and the window moves so that the cursor's row fits. A cursor row taller than the
  // whole column is shown alone and scrolled within (scrollWithin): every character stays reachable.
  // The window stays where it is while the cursor moves inside it and scrolls only when the cursor
  // leaves it; page() moves it by the rows actually visible (DEC-2026-10-25-paging).
  // One layout read per render (the browser's own frame layout is the second); without a layout (no
  // height) every pooled row is shown.
  function column(name, view) { columns([{ name: name, view: view }]); }

  // Several columns drawn together (the menu's two): all writes first, then one layout read for all of
  // them. A column whose cursor row did not fit is filled once more and placed from the heights already
  // read (an item keeps its height in any pooled row), so it is never read twice.
  function columns(list) {
    var c, i;
    for (i = 0; i < list.length; i++) {
      c = list[i];
      c.rows = ListRows.get(c.name);
      c.start = firstRow(c);
      ListRows.fill(c.rows, c.view, c.start);
    }
    for (i = 0; i < list.length; i++) { c = list[i]; c.h = c.rows[0].el.parentNode.clientHeight; if (c.h) c.box = measure(c.rows); }
    for (i = 0; i < list.length; i++) {
      c = list[i];
      var next = !c.h ? c.start : c.bottom !== undefined ? upTo(c) : startFor(c);
      if (next !== c.start) { c.box = shifted(c.box, next - c.start); c.start = next; ListRows.fill(c.rows, c.view, c.start); }
    }
    for (i = 0; i < list.length; i++) {
      c = list[i];
      var fit = c.h ? fitCount(c.box, c.h) : c.rows.length;
      if (c.bottom !== undefined) fit = Math.min(fit, c.bottom - c.start + 1);   // a page-up page ends at its anchor
      if (c.h) { ListRows.hideFrom(c.rows, fit); scrollState(c); }
      starts[c.name] = c.start;
      shown[c.name] = { first: c.start, count: Math.max(1, Math.min(fit, c.view.total - c.start)), total: c.view.total,
        bottom: c.h && c.box.length ? Math.min(c.h, c.box[Math.min(fit, c.box.length) - 1].bottom) : null };
      last[c.name] = c.view.cursor;
    }
  }

  // The window's first row before measuring: a page anchor, else the previous window (moved only as
  // far as needed to hold the cursor in the pool), else centred on the cursor (first render).
  function firstRow(c) {
    var a = anchor[c.name], n = c.rows.length, cur = c.view.cursor, prev = starts[c.name], s;
    anchor[c.name] = null;
    if (a && a.top !== undefined) s = a.top;
    else if (a) { c.bottom = a.bottom; s = Math.max(0, a.bottom - n + 1); }
    else if (prev === undefined) s = windowStart(cur, c.view.total, n);
    else s = cur < prev ? cur : cur > prev + n - 1 ? cur - n + 1 : prev;
    return Math.max(0, Math.min(s, cur, c.view.total - 1));
  }

  // Page-up render: the window that ends with row c.bottom and holds as many rows above it as fit
  // completely, never starting below the cursor. Heights from the one measurement.
  function upTo(c) {
    var b = c.box, k = c.bottom - c.start, s = 0;
    if (k >= b.length) k = b.length - 1;
    while (s < k && b[k].bottom - b[s].top > c.h) s++;
    return c.start + Math.min(s, c.view.cursor - c.start);
  }

  // CH± / PG± (DEC-2026-10-25-paging): the page turns by the rows completely visible now. Down: the new
  // page starts with the first row not shown, and the cursor lands on it. Up: the new page ends with the
  // row right before the first one shown, and the cursor lands on that row. Every row is completely
  // visible on some page; with one-line rows a page is 12 (owner 2026-10-26: one row fewer, the list-end line in its slot).
  // at: { cursor, total } of the list being paged.
  function page(name, dir, at) {
    var v = shown[name], cursor = at.cursor, total = at.total;
    if (!v) return Math.max(0, Math.min(total - 1, cursor + dir * CONFIG.VISIBLE_ROWS));
    if (dir > 0) {
      if (v.first + v.count >= total) return total - 1;   // the last page: it stays, the cursor goes to its end
      var t = v.first + v.count;
      anchor[name] = { top: t };
      return t;
    }
    if (v.first === 0) { anchor[name] = { top: 0 }; return 0; }
    anchor[name] = { bottom: v.first - 1 };
    return v.first - 1;
  }

  // A screen opens afresh: no window, no tall-row scroll and no "arrived from below" from last time.
  function reset(name) {
    var o = over[name];
    if (o && o.el) { o.el.style.webkitTransform = ''; o.el.style.transform = ''; o.el.style.webkitAlignItems = ''; o.el.style.alignItems = ''; }
    over[name] = null; last[name] = undefined; starts[name] = undefined; anchor[name] = null;
  }

  // The measured boxes of a window moved down by `by` rows: the known heights restacked from the top.
  // Rows beyond what was measured are left out, so they are hidden rather than guessed.
  function shifted(box, by) {
    var out = [], top = box.length ? box[0].top : 0;
    for (var k = by; k < box.length; k++) { out.push({ top: top, bottom: top + box[k].h, h: box[k].h }); top += box[k].h; }
    return out;
  }

  // [{ top, bottom, h }] of the rows shown, from the column's top (offsetTop: the column is positioned).
  function measure(rows) {
    var out = [];
    for (var k = 0; k < rows.length && rows[k].last.vis !== 'hidden'; k++) {
      var el = rows[k].el, top = el.offsetTop, h = el.offsetHeight;
      out.push({ top: top, bottom: top + h, h: h });
    }
    return out;
  }

  // Where the window must start so that the cursor's row fits: unchanged when it already fits; the
  // cursor row alone when it is taller than the column; otherwise the first row that lets it fit, from
  // the heights just measured (no further guessing).
  function startFor(c) {
    var k = c.view.cursor - c.start, b = c.box;
    if (k < 0 || k >= b.length) return c.start;
    if (b[k].h > c.h) return c.view.cursor;
    if (b[k].bottom <= c.h) return c.start;
    var s = 0;
    while (s < k && b[k].bottom - b[s].top > c.h) s++;
    return c.start + s;
  }

  // Rows from the top lying completely inside the column (at least the first one).
  function fitCount(box, h) {
    var k = 1;
    while (k < box.length && box[k].bottom <= h) k++;
    return k;
  }

  // The cursor row taller than its column: remember it, keep its scroll offset while the cursor stays.
  function scrollState(c) {
    var k = c.view.cursor - c.start, b = c.box, o = over[c.name];
    if (o && o.el) { o.el.style.webkitTransform = ''; o.el.style.transform = ''; o.el.style.webkitAlignItems = ''; o.el.style.alignItems = ''; }
    if (k !== 0 || !b.length || b[0].h <= c.h) { over[c.name] = null; return; }
    // Arriving from the row below (▲) starts at its bottom, so reading continues upward without a gap.
    var off = o && o.idx === c.view.cursor ? o.off : (last[c.name] > c.view.cursor ? b[0].h : 0);
    over[c.name] = { idx: c.view.cursor, off: off, rowH: b[0].h, h: c.h, el: c.rows[0].el };
    c.rows[0].el.style.webkitAlignItems = 'flex-start';  // number and logo at the top, where reading starts
    c.rows[0].el.style.alignItems = 'flex-start';
    shift(over[c.name]);
  }
  function shift(o) {
    o.off = Math.max(0, Math.min(o.off, o.rowH - o.h));
    var t = 'translateY(' + -o.off + 'px)';
    o.el.style.webkitTransform = t; o.el.style.transform = t;
  }

  // ▼ / ▲ on an oversized cursor row first scroll through it (a screen-step each), then move on.
  // Returns true when the key was used for scrolling. No layout read: the heights are from the render.
  function scrollWithin(name, dir) {
    var o = over[name];
    if (!o) return false;
    var step = Math.round(o.h * 0.8);
    if (dir > 0 ? o.off + o.h >= o.rowH : o.off <= 0) return false;
    o.off += dir * step;
    shift(o);
    return true;
  }


  // { first, count } of the rows completely visible in a column after its last render (or undefined).
  function shownRows(name) { return shown[name]; }

  // How many rows lie below the last completely visible one after the last render; null for an empty or
  // never drawn list (the list-end line under the column says nothing then).
  function rest(name) {
    var v = shown[name];
    return v && v.total ? Math.max(0, v.total - v.first - v.count) : null;
  }

  // Where the last completely visible row ends, in px from the column's top (null without a layout): the
  // list-end line is drawn right below it, in the room the column leaves under itself (css .list-wrap).
  function end(name) { var v = shown[name]; return v ? v.bottom : null; }

  return { column: column, columns: columns, scrollWithin: scrollWithin, page: page, reset: reset, shown: shownRows, rest: rest, end: end };
}());
