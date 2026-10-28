// The channel menu: groups on the left, channels on the right. Browsing groups changes nothing until a
// channel is picked: the group it is picked in becomes the group ◀ ▶ zap through (Zap.group).
(function () {
  var focus = 'channels', cursor = 0, browsed = '';    // browsed: the group shown, by identity
  var seenKey = null, seenItems = null;                 // the channel under the cursor at the last render, and its group's items

  function groups() { return Channels.groups(); }
  function groupIdx() { return Channels.groupOrAll(browsed); }
  function group() { return groups()[groupIdx()]; }
  function browse(i) { var g = groups()[i]; browsed = g ? g.key : ''; seenKey = null; }   // another group: nothing to follow

  // The zap group and the cursor on the playing channel (else «Все каналы»), fresh windows.
  function place() {
    ListView.reset('groups');
    ListView.reset('channels');
    focus = 'channels';
    browse(Zap.group());
    var playing = ChannelView.playing(), at = group() ? group().items.indexOf(playing) : -1;
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
  var prepared = false, ahead = false;
  // Also when the layout was just switched back to this one while «⚙ Настройки» is open (B4): it is hidden then too.
  function prepare() { if (!prepared && Channels.count() && Overlay.mode() !== 'menu') { prepared = true; place(); ahead = true; render(); ahead = false; } }
  function close() { NowLines.watch(null); UI.show('guide', false); }

  // The channel ids of the rows on screen (whose "now" lines must stay current).
  function visibleIds() { var g = group(); return g ? ChannelView.ids('channels', g.items) : []; }

  function render() {
    var g = group(), gi = groupIdx();
    if (!g) return;
    if (g.items !== seenItems) cursor = ChannelView.follow(g, seenKey, cursor);   // rebuilt (a refresh, a favourite): the same channel
    // A group highlighted in the groups column: its logos load first among the background ones (owner: «загружать при
    // выделении группы»); looked up in idle time, so the key's task stays as it was.
    if (focus === 'groups') Logos.want('highlight', function () { return Channels.logos(gi); });
    ListView.columns([{ name: 'groups', view: { total: groups().length, cursor: gi, active: focus === 'groups', row: groupRow } },
      { name: 'channels', view: ChannelView.channels(g, cursor, { active: focus === 'channels', ahead: ahead }) }]);
    var c = Channels.at(g.items[cursor]);
    seenKey = c ? c.key : null; seenItems = g.items;
    // Where the viewer is in each column: the scroll bars (owner 2026-10-27: «по ползункам уже понятно, где мы» —
    // the «▼ ещё N …» lines under the menu's columns are gone; the search results keep theirs).
    UI.scrollBar('groups-bar', ListView.shown('groups'));
    UI.scrollBar('channels-bar', ListView.shown('channels'));
    NowLines.update();
  }
  function groupRow(i) { return ChannelView.group(groups()[i]); }

  // Search, «📡 Провайдеры», «⚙ Настройки» and «ℹ О программе» are rows of the group column that open their own screens.
  function openSpecial(g) {
    if (!g.screen) return false;
    Overlay.open(g.screen);
    return true;
  }

  function onKey(k, e) {
    e.preventDefault();
    var g = group();
    if ((k === K.UP || k === K.DOWN) && ListView.scrollWithin(focus, k === K.UP ? -1 : 1)) return;   // a row taller than the column
    if (k === K.UP) move(-1);
    else if (k === K.DOWN) move(1);
    else if (k === K.CH_UP || k === K.PG_UP) page(-1);
    else if (k === K.CH_DOWN || k === K.PG_DOWN) page(1);
    else if (k === (I18n.rtl() ? K.RIGHT : K.LEFT)) focus = 'groups';           // toward the groups column, on whichever side it is
    else if (k === (I18n.rtl() ? K.LEFT : K.RIGHT)) { if (focus === 'groups' && openSpecial(g)) return; focus = 'channels'; }
    else if (k === K.ENTER) {
      if (focus === 'groups') { if (openSpecial(g)) return; focus = 'channels'; cursor = 0; }
      else { var c = Channels.at(g.items[cursor]), gi = groupIdx(); Overlay.close(); if (c) Zap.pick(c, gi); return; }
    }
    else if (k === K.YELLOW || k === K.F || k === K.PLAY_PAUSE) toggleFav();
    else if (k === K.BLUE) { Overlay.open('sources'); return; }
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
    if (focus === 'groups') { browse(Util.clamp(groupIdx() + d, groups().length)); cursor = 0; }
    else cursor = Util.clamp(cursor + d, group().items.length);
  }

  // The cursor stays on the same channel, in the same group.
  function toggleFav() {
    var c = Channels.at(group().items[cursor]);
    if (c) ChannelView.toggleFav(c);
  }

  // Desktop preview: a click selects a group or tunes a channel.
  function onClick(row) {
    var i = +row.getAttribute('data-i'), col = row.parentNode.id;
    if (col === 'groups') { focus = 'groups'; browse(i); cursor = 0; render(); }
    else if (col === 'channels') { focus = 'channels'; cursor = i; onKey(K.ENTER, { preventDefault: function () {} }); }
  }

  Overlay.register('menu', { open: open, close: close, onKey: onKey, onClick: onClick, render: render, prepare: prepare });
}());
