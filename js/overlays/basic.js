// «Вид меню: крупный» — the Basic layout of the channel menu, for poor eyesight (owner 2026-10-28: «крупные меню … как в
// OTT Club»). Two full screens instead of the menu's two columns:
//  - clist: one group's channels, full screen, each row a reduced status banner on its own quiet band: the logo, the
//    name, what is on now under it, and the minutes left with the programme's progress under them. OK on the picture
//    opens it on the channel being watched, in its group (owner 2026-10-28: «я должен возвращаться на список каналов»).
//    OK plays (◀ ▶ then zap inside that group, as in the menu); ◀ ▶ page it, ◀ on its first page or Back shows the cards;
//  - cards: every row of the menu's groups column as a card, 3 × 3 on screen, in the menu's order (🔍 first, the groups,
//    then «📡 Провайдеры», «⚙ Настройки», «ℹ О программе»): a provider group by its first word, ours by its name; the name
//    and the count at one place on every card. OK opens a group's list, or our screen as the menu does; Back closes.
// Both end with a help bar. Nothing wraps round: the edges stop. The layout is a setting («⚙ Настройки» → «Вид меню»),
// Advanced by default; 'menu' opens the one chosen (Overlay.alias), decided at each opening, so a change needs no restart.
// The rows, logos and "now" lines are the menu's own (ChannelView, ListRows, ListView, Logos, NowLines).
var BasicMenu = (function () {
  var STORE = 'menuBasic';
  var COLS = CONFIG.BASIC_COLS, CARD_ROWS = CONFIG.BASIC_CARD_ROWS, PAGE = COLS * CARD_ROWS, ROWS = CONFIG.BASIC_ROWS;
  var NO_EVENT = { preventDefault: function () {} };
  var stored = Util.load(STORE), on = typeof stored === 'boolean' ? stored : CONFIG.MENU_BASIC_DEFAULT;
  var cardKey = '', top = null, cursor = 0, prepared = false, ahead = false, minuteTimer = null, els = {};
  var seenKey = null, seenItems = null;   // the channel under the list's cursor at its last render, and its group's items

  // Read once per opening (the alias), never per key. From the picture Basic opens the list, from our screens the cards.
  Overlay.alias('menu', function (from) { return !on ? 'menu' : from === 'none' ? 'clist' : 'cards'; });
  // The layout switched: only the one in use stays laid out, and it is laid out at idle now, so its first opening is a
  // paint, in both directions (B4, B7).
  function setOn(v) {
    on = v;
    Util.save(STORE, v);
    layout(v);
    Util.idle(function () { Overlay.prepare('menu'); });
  }
  function isOn() { return on; }

  function groups() { return Channels.groups(); }
  function cardIdx() { return Channels.groupOrAll(cardKey); }   // the card in focus, by identity («Все каналы» if it is gone)
  function listGroup() { return groups()[cardIdx()]; }
  function $(id) { return els[id] || (els[id] = Util.$(id)); }
  function write(id, text) { var e = $(id); if (e.textContent !== text) e.textContent = text; }

  // While Basic is in use its two screens stay laid out when hidden (css .basic.hidden.ready), so an opening is a paint,
  // and Advanced's menu is not laid out at all (css .guide.hidden.off); while Advanced is in use, the reverse.
  function layout(v) {
    Util.cls($('cards'), 'ready', v);
    Util.cls($('clist'), 'ready', v);
    Util.cls($('guide'), 'off', v);
  }
  function build() {
    layout(true);
    if (!$('cards-hint').children.length) { hint('cards-hint', 'h.cards'); hint('clist-hint', 'h.clist'); }   // the language changes by a reload
  }
  // A help bar: each «<key> — <what>» with the key in bold, a colour key with a dot of its colour before the word.
  function hint(id, key) {
    var parts = I18n.t(key).split(' · '), html = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], at = Math.max(0, p.indexOf(' — ')), k = p.substring(0, at), dot = /^\{([yb])\}/.exec(k);
      html += (i ? '<span class="sep"> · </span>' : '') + (dot ? '<i class="dot ' + dot[1] + '"></i>' : '') +
        '<b>' + Util.esc(dot ? k.substring(3) : k) + '</b><span>' + Util.esc(p.substring(at)) + '</span>';
    }
    $(id).innerHTML = html;
  }
  // Where a screen is (its position «x / y», left to right in Hebrew too) and the time.
  function head(screen, pos) { write(screen + '-pos', I18n.ltr(pos)); write(screen + '-clock', Util.hhmm(new Date())); }

  // From the picture: the group ◀ ▶ zap through when it holds the channel on screen, else «Все каналы» (as the menu); the
  // window of card rows placed afresh.
  function place() {
    var gi = Zap.group(), g = groups()[gi];
    if (!g || g.items.indexOf(ChannelView.playing()) < 0) gi = Channels.allIdx();
    cardKey = groups()[gi].key;
    top = null;
  }

  // ---------- cards ----------
  // from: back from a group's list, or from our screen (🔍 📡 ⚙ ℹ — each keyed by its overlay's name): on the card the
  // viewer was on — the screen's own card only when there was none (B12: «📡» opened by BLUE from a list returns to that
  // list's group); anything else places it afresh. No list yet: nothing to show (B11).
  function openCards(arg, from) {
    if (!groups().length) { Overlay.close(); return; }
    var back = groups()[Channels.groupIndex(from)];
    if (back && back.screen === from) cardKey = cardKey || from;
    else if (from !== 'clist') place();
    build();
    if (Channels.count()) Logos.start();   // a screen whose lists' logos load ahead is open
    UI.show('cards', true);
    renderCards();
    arm();
  }
  function closeCards() { clearTimeout(minuteTimer); UI.show('cards', false); }

  // The window moves one card row at a time, only as far as needed to hold the card in focus (afresh: centred on it).
  // No layout read: the cards' box is fixed.
  function renderCards() {
    var all = groups(), gi = cardIdx(), row = Math.floor(gi / COLS), last = Math.floor((all.length - 1) / COLS);
    cardKey = all[gi].key;                   // a group gone since (★ with its last favourite, adult hidden): «Все каналы»
    top = top === null ? row - Math.floor(CARD_ROWS / 2) : row < top ? row : row >= top + CARD_ROWS ? row - CARD_ROWS + 1 : top;
    top = Math.max(0, Math.min(top, last - CARD_ROWS + 1));
    var rows = ListRows.get('cards'), start = top * COLS;
    if (pen === null) measureRoom(rows[0]);
    ListRows.fill(rows, { total: all.length, cursor: gi, active: true, row: cardRow }, start, 0);
    UI.scrollBar('cards-bar', { first: start, count: Math.min(PAGE, all.length - start), total: all.length });
    head('cards', (gi + 1) + ' / ' + all.length);
    wantLogos(gi);
  }
  // A group's card: its label and its count, our screens what they open instead (the version under «ℹ О программе»), on
  // the group's own hue.
  function cardRow(i) {
    var all = groups(), g = all[i], m = ChannelView.group(g);
    m.sub = g.screen ? I18n.t('bc.' + g.screen, CONFIG.VERSION) : I18n.n(g.items.length, 'channel');
    m.title = labels(all)[i];
    m.cls = fit(m.title) + (g.screen ? ' sp' : ' h' + hue(g.key));
    return m;
  }
  // The cards' names (owner 2026-10-28: «сократить название группы до одного слова»): a provider's group by its first
  // word, its first two where another card would read the same; our own rows by their whole name («Все каналы»,
  // «Избранное», «Израиль» …). Once per groups list (a rebuild makes a new one), so a card keeps its name while the
  // window moves.
  var labelsOf = null, labelList = [];
  function labels(all) {
    if (all === labelsOf) return labelList;
    var out = [], count = Util.dict(), i;
    for (i = 0; i < all.length; i++) {
      var title = ChannelView.group(all[i]).title;
      out.push(all[i].own ? firstWords(title, 1) : title);
      count[out[i]] = (count[out[i]] || 0) + 1;
    }
    for (i = 0; i < all.length; i++) if (all[i].own && count[out[i]] > 1) out[i] = firstWords(ChannelView.group(all[i]).title, 2);
    labelsOf = all; labelList = out;
    return out;
  }
  // The first n words of a name, no separator or punctuation left hanging at the end («Музыкальные /» → «Музыкальные»).
  function firstWords(name, n) {
    var out = name.split(/\s+/).slice(0, n).join(' ').replace(/[\s\/\\|.,:;!?·\-–—]+$/, '');
    return out || name;
  }
  // A group's own hue (0–7), the same on every TV and at every opening: a hash of its key (css .card.hN).
  function hue(key) { for (var h = 0, i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973; return h % 8; }

  // A card's name is one line, never cut and never broken inside a word: 60 px, else 52, 44 or 36 px — the first size it
  // fits at, measured with a canvas (no layout read), once per name, in the card's own font and weight against the room
  // a card gives it (read once; B5).
  var fits = Util.dict(), pen = null, family = '', weight = '600', room = 0;
  function measureRoom(row) {
    var c = document.createElement('canvas'), cs = window.getComputedStyle ? window.getComputedStyle(row.t) : null;
    pen = c.getContext && c.getContext('2d') || false;   // false: none here — measured once either way
    room = row.t.parentNode.clientWidth || 0;
    if (cs) { family = cs.fontFamily; weight = cs.fontWeight; }
  }
  function fit(name) {
    if (fits[name] === undefined && pen && room) fits[name] = width(name, 60) <= room ? '' : width(name, 52) <= room ? 'long' : width(name, 44) <= room ? 'longer' : 'longest';
    return fits[name] || '';
  }
  function width(text, px) { pen.font = weight + ' ' + px + 'px ' + family; return pen.measureText(text).width; }

  // While a card has the focus: the page its list opens on first, then the opening page of each card one key away (◀ ▶
  // ▲ ▼ and CH±), then the rest of its group (the menu's 'highlight'); after them the opening pages of the cards within a
  // screen of it ('cards'). Looked up in idle time, so the key's task stays O(1); a page per card, never whole groups;
  // both end when the layout is switched to Advanced (B2, B10).
  function wantLogos(gi) {
    if (Overlay.mode() === 'cards') Logos.want('highlight', function () {
      var out = pageLogos(gi, ROWS), near = [gi - 1, gi + 1, gi - COLS, gi + COLS, gi - PAGE, gi + PAGE];
      for (var k = 0; k < near.length; k++) out = out.concat(pageLogos(near[k], ROWS));
      return out.concat(pageLogos(gi, CONFIG.LOGO_GROUP_MAX));
    }, isOn);
    Logos.want('cards', function () {
      var out = [];
      for (var d = 1; d <= PAGE; d++) out = out.concat(pageLogos(gi - d, ROWS), pageLogos(gi + d, ROWS));
      return out;
    }, isOn);
  }
  // The logos of group gi's list from the first row it opens with (its first window, the cursor on the playing channel
  // or the first), at most n.
  function pageLogos(gi, n) {
    var g = groups()[gi];
    if (!g || !g.items.length) return [];
    var at = ListView.windowStart(Math.max(0, g.items.indexOf(ChannelView.playing())), g.items.length, ROWS);
    return Channels.logos(gi, Channels.at(g.items[at]).key, n);
  }

  // ▲ ▼ ◀ ▶ move (◀ ▶ in reading order, mirrored in Hebrew), CH± by a screen; nothing wraps. OK opens; Back closes.
  function onCardKey(k, e) {
    e.preventDefault();
    var gi = cardIdx(), n = groups().length;
    if (k === K.UP || k === K.DOWN) gi = vertical(gi, k === K.UP ? -1 : 1, n);
    else if (k === (I18n.rtl() ? K.LEFT : K.RIGHT)) gi = Util.clamp(gi + 1, n);
    else if (k === (I18n.rtl() ? K.RIGHT : K.LEFT)) gi = Util.clamp(gi - 1, n);
    else if (k === K.CH_UP || k === K.PG_UP) gi = Util.clamp(gi - PAGE, n);
    else if (k === K.CH_DOWN || k === K.PG_DOWN) gi = Util.clamp(gi + PAGE, n);
    else if (k === K.ENTER) { Overlay.open(groups()[gi].screen || 'clist'); return; }
    else if (k === K.BLUE) { Overlay.open('sources'); return; }
    else if (Keys.isBack(k) || k === K.CH_LIST) { Overlay.close(); return; }
    else return;
    cardKey = groups()[gi].key;
    renderCards();
  }
  // The card above / below; ▼ into a shorter last row lands on its last card; the first and last rows stop.
  function vertical(gi, dir, n) {
    var t = gi + dir * COLS;
    if (t >= 0 && t < n) return t;
    return dir > 0 && Math.floor(gi / COLS) < Math.floor((n - 1) / COLS) ? n - 1 : gi;
  }
  // Desktop preview: a click opens the card.
  function onCardClick(row) {
    if (row.parentNode.id !== 'cards-grid') return;
    cardKey = groups()[+row.getAttribute('data-i')].key;
    onCardKey(K.ENTER, NO_EVENT);
  }

  // ---------- the list ----------
  // From the picture: the group being watched (place); from a card: that card's group. The cursor on the channel on
  // screen when the group holds it, else on the first.
  function openList(arg, from) {
    if (!groups().length) { Overlay.close(); return; }
    if (from !== 'cards') place();
    build();
    listFrom();
    UI.show('clist', true);
    renderList();
    NowLines.watch(listIds);
    arm();
  }
  function listFrom() {
    cursor = Math.max(0, listGroup().items.indexOf(ChannelView.playing()));
    seenKey = seenItems = null;
    ListView.reset('clist');
  }
  function closeList() { clearTimeout(minuteTimer); NowLines.watch(null); UI.show('clist', false); }
  function listIds() { return ChannelView.ids('clist', listGroup().items); }

  function renderList() {
    var g = listGroup();
    if (g.items !== seenItems) cursor = ChannelView.follow(g, seenKey, cursor);   // rebuilt (a refresh, a favourite): the same channel
    cardKey = g.key;                         // a group gone since: «Все каналы», and Back lands on its card
    var title = $('clist-title');
    if (title.textContent !== g.name) {      // a provider's group name as given, in its own direction — before the rows are
      title.textContent = g.name;            // measured: a title on two lines leaves them less room (B1)
      var d = g.own ? I18n.otherDir(g.name) : '';
      if (d) title.setAttribute('dir', d); else title.removeAttribute('dir');
    }
    ListView.column('clist', ChannelView.channels(g, cursor, { active: true, ahead: ahead, timed: true }));
    var c = Channels.at(g.items[cursor]);
    seenKey = c ? c.key : null; seenItems = g.items;
    head('clist', (cursor + 1) + ' / ' + g.items.length);
    UI.scrollBar('clist-bar', ListView.shown('clist'));
    NowLines.update();
  }

  // ▲ ▼ move (a row taller than the screen scrolls first), CH± page by the rows shown, and so do ▶ (the next page) and ◀
  // (the previous one; mirrored in Hebrew; owner 2026-10-28) — ◀ on the first page shows the cards, ▶ on the last page
  // stays. OK plays and closes, Back shows the cards; YELLOW / F / ⏯ the favourite, BLUE «📡 Провайдеры» — the menu's keys.
  function onListKey(k, e) {
    e.preventDefault();
    var g = listGroup(), n = g.items.length, v = ListView.shown('clist');
    var next = k === (I18n.rtl() ? K.LEFT : K.RIGHT), prev = k === (I18n.rtl() ? K.RIGHT : K.LEFT);
    if ((k === K.UP || k === K.DOWN) && ListView.scrollWithin('clist', k === K.UP ? -1 : 1)) return;
    if (k === K.UP || k === K.DOWN) cursor = Util.clamp(cursor + (k === K.UP ? -1 : 1), n);
    else if (prev && (!v || v.first === 0)) { Overlay.open('cards'); return; }   // the first page: up to the cards
    else if (next && (!v || v.first + v.count >= n)) return;                     // the last page: nothing further
    else if (k === K.CH_UP || k === K.PG_UP || prev) cursor = ListView.page('clist', -1, { cursor: cursor, total: n });
    else if (k === K.CH_DOWN || k === K.PG_DOWN || next) cursor = ListView.page('clist', 1, { cursor: cursor, total: n });
    else if (k === K.ENTER) { var c = Channels.at(g.items[cursor]), gi = cardIdx(); Overlay.close(); if (c) Zap.pick(c, gi); return; }
    else if (Keys.isBack(k)) { Overlay.open('cards'); return; }
    else if (k === K.CH_LIST) { Overlay.close(); return; }
    else if (k === K.YELLOW || k === K.F || k === K.PLAY_PAUSE) { var f = Channels.at(g.items[cursor]); if (f) ChannelView.toggleFav(f); }
    else if (k === K.BLUE) { Overlay.open('sources'); return; }
    else return;
    renderList();
  }
  // Desktop preview: a click on a row plays it.
  function onListClick(row) {
    if (row.parentNode.id !== 'clist-rows') return;
    cursor = +row.getAttribute('data-i');
    onListKey(K.ENTER, NO_EVENT);
  }

  // One timer while a Basic screen is open, at each minute: the clock, and on the list the minutes left and the progress
  // (written only where they changed; no layout read, no request — P-7). A programme's end is NowLines' redraw.
  function arm() { clearTimeout(minuteTimer); minuteTimer = setTimeout(tick, Util.MIN_MS - Date.now() % Util.MIN_MS); }
  function tick() {
    var screen = Overlay.mode(), v = ListView.shown('clist');
    if (screen === 'clist' && v) ListRows.tick(ListRows.get('clist'), ChannelView.channels(listGroup(), cursor, { timed: true }), v.first);
    write(screen + '-clock', Util.hhmm(new Date()));
    arm();
  }

  // At idle after the first picture, or after the layout was switched to Basic, while hidden (as the menu's): the cards
  // and the list of the zap group are laid out as they would open, so the first opening is a paint and that list's page
  // loads first. Never over a Basic screen in use.
  function lay() {
    var m = Overlay.mode();
    if (prepared || !Channels.count() || m === 'cards' || m === 'clist') return;
    prepared = true;
    build();
    place();
    renderCards();
    listFrom();
    ahead = true; renderList(); ahead = false;
    cardKey = '';                            // laid out, not visited: the next opening decides where the viewer is
  }

  Overlay.register('cards', { open: openCards, close: closeCards, onKey: onCardKey, onClick: onCardClick, render: renderCards, prepare: lay });
  Overlay.register('clist', { open: openList, close: closeList, onKey: onListKey, onClick: onListClick, render: renderList, prepare: lay });
  return { on: isOn, setOn: setOn };
}());
