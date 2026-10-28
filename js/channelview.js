// The view models of the channel menus, shared by both layouts (Advanced: overlays/menu.js; Basic: overlays/basic.js)
// and search: a group's row, a group's channel list as a ListView view, the channel ids a list shows, and the favourite
// key. It reads the stores and writes no DOM of its own (the favourite's toast goes through UI).
var ChannelView = (function () {
  // The index of the channel on screen in the channel list (-1: none).
  function playing() { var c = Playback.current(); return c ? Channels.indexOfKey(c.key) : -1; }

  // A group as a row: own — a provider's group. Our rows with an icon («🔍 Поиск», «★ Избранное», «📡 Провайдеры»,
  // «⚙ Настройки», «ℹ О программе» — I18n's «<icon> <name>») show it in a box of its own (css .grow .t > i), so a small ⚙
  // and a wide 🔍 leave their names on one edge (review 4, D6); sub: the channel count, none for our screens.
  function group(g) {
    var icon = g.screen || g.fav ? g.name.indexOf(' ') + 1 : 0;
    return { num: '', logo: '', pre: g.name.substring(0, icon), title: g.name.substring(icon), own: !!g.own, sub: g.screen ? '' : g.items.length };
  }

  // Group g's channels as a ListView view. opts: { active, ahead, timed } — timed: Basic's rows, "a reduced status banner":
  // the "now" line with its time span (the banner's text), the minutes left and the progress.
  function channels(g, cursor, opts) {
    var now = Date.now(), at = playing();
    return { total: g.items.length, cursor: cursor, active: opts.active, ahead: opts.ahead, logo: function (i) { return Channels.at(g.items[i]).logo; }, row: function (i) {
      // The banner's lookup and text too; a programme on air is the provider's text alone, an ended one is ours around it.
      var c = Channels.at(g.items[i]), sh = EPG.shown(c.id, now), onAir = !!sh && !sh.ended;
      var m = { num: c.num, key: c.key, logo: c.logo, pre: Favs.has(c.key) ? '★ ' : '', title: c.name, own: true, post: g.items[i] === at ? '  ▶' : '',
        sub: onAir ? sh.p.title : EPG.label(sh), subOwn: onAir, playing: g.items[i] === at };
      if (opts.timed) timed(m, sh, now);
      return m;
    } };
  }
  // The time cells: «21:00–22:00  title» (one sentence of ours, as the banner's), «ещё 25 мин» and the share gone.
  function timed(m, sh, now) {
    if (!sh) return;
    var p = sh.p;
    m.sub = Util.span(p.start, p.stop) + '  ' + EPG.label(sh);
    m.subOwn = false;
    if (sh.ended) return;
    m.left = I18n.t('bl.left', Math.max(1, Math.ceil((p.stop - now) / Util.MIN_MS)));
    m.prog = Math.max(0, Math.min(1, (now - p.start) / (p.stop - p.start))).toFixed(3);
  }

  // The channel ids of the rows completely visible in list column `name` showing `items` (whose "now" lines must stay current).
  function ids(name, items) {
    var v = ListView.shown(name), out = [];
    for (var i = v ? v.first : 0; v && i < v.first + v.count && i < items.length; i++) out.push(Channels.at(items[i]).id);
    return out;
  }

  // YELLOW on channel c: its favourite flips, the groups are rebuilt (each kept by identity) and a toast says so. The
  // list's cursor stays on c through the list's next render (follow).
  function toggleFav(c) {
    var on = Favs.toggle(c.key);
    Channels.rebuild();
    UI.toast(I18n.t(on ? 'm.favAdded' : 'm.favRemoved'));
  }

  // Where a list's cursor is after its group was rebuilt (an hourly list, a favourite, a group gone and «Все каналы» shown
  // instead): on the channel with `key` while g holds it, else the same place, clamped. Both layouts (B3).
  function follow(g, key, cursor) {
    var at = g.items.indexOf(Channels.indexOfKey(key));
    return at >= 0 ? at : Util.clamp(cursor, g.items.length);
  }

  return { playing: playing, group: group, channels: channels, ids: ids, toggleFav: toggleFav, follow: follow };
}());
