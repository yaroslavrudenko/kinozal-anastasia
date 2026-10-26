// The channel menu: groups on the left, channels on the right. Browsing groups changes nothing until a
// channel is picked: the group it is picked in becomes the group ◀ ▶ zap through (Zap.group).
(function () {
  var focus = 'channels', cursor = 0, browsed = '';    // browsed: the group shown, by identity

  function groups() { return Channels.groups(); }
  function groupIdx() { return Channels.groupOrAll(browsed); }
  function group() { return groups()[groupIdx()]; }
  function browse(i) { var g = groups()[i]; browsed = g ? g.key : ''; }
  function clamp(v, n) { return Math.max(0, Math.min(n - 1, v)); }
  function playingIdx() { var c = Playback.current(); return c ? Channels.indexOfKey(c.key) : -1; }

  // The zap group and the cursor on the playing channel (else «Все каналы»), fresh windows.
  function place() {
    ListView.reset('groups');
    ListView.reset('channels');
    focus = 'channels';
    browse(Zap.group());
    var playing = playingIdx(), at = group() ? group().items.indexOf(playing) : -1;
    if (at < 0) { browse(Channels.allIdx()); at = group() ? Math.max(0, group().items.indexOf(playing)) : 0; }
    cursor = at;
  }
  function open() {
    place();
    UI.show('guide', true);
    render();
    NowLines.watch(visibleIds);
  }
  // Once, at idle after the first picture, while hidden: the rows are built and laid out as the menu would
  // open (the first layout of fonts and the ★ ▶ glyphs is paid here), so the first opening is a paint.
  var prepared = false;
  function prepare() { if (!prepared && Channels.count() && Overlay.isNone()) { prepared = true; place(); render(); } }
  function close() { NowLines.watch(null); UI.show('guide', false); }

  // The channel ids of the rows on screen (whose "now" lines must stay current).
  function visibleIds() {
    var v = ListView.shown('channels'), g = group(), out = [];
    for (var i = v ? v.first : 0; v && g && i < v.first + v.count && i < g.items.length; i++) out.push(Channels.at(g.items[i]).id);
    return out;
  }

  function render() {
    var g = group(), gi = groupIdx();
    if (!g) return;
    cursor = clamp(cursor, g.items.length);            // a refresh may have shortened the group
    var playing = playingIdx(), now = Date.now();
    ListView.columns([{ name: 'groups', view: { total: groups().length, cursor: gi, active: focus === 'groups', row: groupRow } },
      { name: 'channels', view: { total: g.items.length, cursor: cursor, active: focus === 'channels', row: function (i) {
        var c = Channels.at(g.items[i]), on = EPG.label(EPG.shown(c.id, now));   // the banner's lookup and text too
        return { num: c.num, logo: c.logo, title: (Favs.has(c.key) ? '★ ' : '') + c.name + (g.items[i] === playing ? '  ▶' : ''),
          sub: on, playing: g.items[i] === playing };
      } } }]);
    UI.listEnd('channels-more', ListView.rest('channels'), ListView.end('channels'));
    NowLines.update();
  }
  function groupRow(i) {
    var g = groups()[i];
    return { num: '', logo: '', title: g.name, sub: g.search || g.about ? '' : g.items.length };
  }

  // Search and «О программе» are rows of the group column that open their own screens.
  function openSpecial(g) {
    if (g.search) { Overlay.open('search'); return true; }
    if (g.about) { Overlay.open('about'); return true; }
    return false;
  }

  function onKey(k, e) {
    e.preventDefault();
    var g = group();
    if ((k === K.UP || k === K.DOWN) && ListView.scrollWithin(focus, k === K.UP ? -1 : 1)) return;   // a row taller than the column
    if (k === K.UP) move(-1);
    else if (k === K.DOWN) move(1);
    else if (k === K.CH_UP || k === K.PG_UP) page(-1);
    else if (k === K.CH_DOWN || k === K.PG_DOWN) page(1);
    else if (k === K.LEFT) focus = 'groups';
    else if (k === K.RIGHT) { if (focus === 'groups' && openSpecial(g)) return; focus = 'channels'; }
    else if (k === K.ENTER) {
      if (focus === 'groups') { if (openSpecial(g)) return; focus = 'channels'; cursor = 0; }
      else { var c = Channels.at(g.items[cursor]), gi = groupIdx(); Overlay.close(); if (c) Zap.pick(c, gi); return; }
    }
    else if (k === K.YELLOW || k === K.F || k === K.PLAY_PAUSE) toggleFav();
    else if (k === K.BLUE) { Overlay.open('setup', { changingKey: true }); return; }
    else if (Keys.isBack(k) || k === K.CH_LIST) { Overlay.close(); return; }
    else return;
    render();
  }

  // CH± / PG±: channels by the rows actually visible (DEC-2026-10-25-paging); groups by a full column.
  function page(dir) {
    if (focus === 'groups') { move(dir * CONFIG.VISIBLE_ROWS); return; }
    cursor = ListView.page('channels', dir, { cursor: cursor, total: group().items.length });
  }

  function move(d) {
    if (focus === 'groups') { browse(clamp(groupIdx() + d, groups().length)); cursor = 0; }
    else cursor = clamp(cursor + d, group().items.length);
  }

  // The cursor stays on the same channel, in the same group.
  function toggleFav() {
    var g = group(), c = Channels.at(g.items[cursor]);
    if (!c) return;
    var on = Favs.toggle(c.key);
    Channels.rebuild();                  // the browsed group is kept by identity
    var at = group().items.indexOf(Channels.indexOfKey(c.key));
    cursor = at >= 0 ? at : clamp(cursor, group().items.length);
    UI.toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
  }

  // Desktop preview: a click selects a group or tunes a channel.
  function onClick(row) {
    var i = +row.getAttribute('data-i'), col = row.parentNode.id;
    if (col === 'groups') { focus = 'groups'; browse(i); cursor = 0; render(); }
    else if (col === 'channels') { focus = 'channels'; cursor = i; onKey(K.ENTER, { preventDefault: function () {} }); }
  }

  Overlay.register('menu', { open: open, close: close, onKey: onKey, onClick: onClick, render: render, prepare: prepare });
}());
