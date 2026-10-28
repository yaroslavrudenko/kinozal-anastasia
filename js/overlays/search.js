// Search (first row of the channel menu): typing filters by name (digits also match the number);
// OK / Done / ▼ enters the results, ▲ from the first result returns to the field, OK tunes, BACK
// returns to the menu.
(function () {
  var FOCUS_DELAY_MS = 200;
  var result = { items: [], total: 0 }, cursor = 0, inList = false, focusTimer = null;

  function input() { return Util.$('search-input'); }

  function open() {
    var field = input();
    ListView.reset('search');
    field.value = '';
    cursor = 0; inList = false;
    UI.show('search', true);
    field.oninput = function () { cursor = 0; filter(); };
    filter();
    NowLines.watch(visibleIds);
    focusTimer = setTimeout(function () { field.focus(); }, FOCUS_DELAY_MS);
  }
  function close() {
    NowLines.watch(null);
    clearTimeout(focusTimer);
    var field = input();
    field.oninput = null;
    field.blur();
    UI.show('search', false);
  }

  function filter() {
    result = Channels.search(input().value.trim().toLowerCase());
    cursor = Math.min(cursor, Math.max(0, result.items.length - 1));
    render();
  }

  function render() {
    var items = result.items, capped = result.total > items.length, cur = Playback.current(), curKey = cur ? cur.key : null, now = Date.now();
    ListView.column('search', { total: items.length, cursor: cursor, active: inList, logo: function (i) { return Channels.at(items[i]).logo; }, row: function (i) {
      var c = Channels.at(items[i]), on = EPG.label(EPG.shown(c.id, now));   // the menu's and the banner's text
      // A capped result says so on its last row instead of hiding the rest silently.
      var sub = capped && i === items.length - 1 ? I18n.t('search.capped', items.length, result.total)
        : (c.groupId ? I18n.iso(c.group) : c.group) + (on ? ' · ' + on : '');   // a provider's group, or our «no group»
      return { num: c.num, key: c.key, logo: c.logo, title: c.name, own: true, sub: sub, playing: c.key === curKey };
    } });
    UI.listEnd('search-more', ListView.rest('search'), ListView.end('search'));
    NowLines.update();
  }

  function onKey(k, e) {
    if (!inList) {
      // Typing goes to the field; OK / Done / ▼ moves into the results.
      if (Keys.isSubmit(k) || k === K.DOWN) {
        e.preventDefault();
        if (result.items.length) { inList = true; input().blur(); render(); }
      } else if (Keys.isTextBack(k)) { e.preventDefault(); Overlay.open('menu'); }
      return;
    }
    e.preventDefault();
    if ((k === K.UP || k === K.DOWN) && ListView.scrollWithin('search', k === K.UP ? -1 : 1)) return;
    if (k === K.UP) { if (cursor === 0) { inList = false; input().focus(); } else cursor--; }
    else if (k === K.DOWN) cursor = Math.min(result.items.length - 1, cursor + 1);
    else if (k === K.CH_UP || k === K.PG_UP || k === K.CH_DOWN || k === K.PG_DOWN) {
      cursor = ListView.page('search', k === K.CH_DOWN || k === K.PG_DOWN ? 1 : -1, { cursor: cursor, total: result.items.length });
    }
    else if (k === K.ENTER) { tune(cursor); return; }
    else if (Keys.isBack(k)) { inList = false; input().focus(); }
    render();
  }

  // The channel ids of the results on screen.
  function visibleIds() {
    var v = ListView.shown('search'), out = [];
    for (var i = v ? v.first : 0; v && i < v.first + v.count && i < result.items.length; i++) out.push(Channels.at(result.items[i]).id);
    return out;
  }

  function tune(i) { var c = Channels.at(result.items[i]); Overlay.close(); if (c) Zap.pick(c); }

  // Desktop preview: a click on a result tunes it.
  function onClick(row) { if (row.parentNode.id === 'search-list') tune(+row.getAttribute('data-i')); }

  Overlay.register('search', { open: open, close: close, onKey: onKey, onClick: onClick, render: render });
}());
