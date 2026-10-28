// «Провайдеры» (BLUE in the channel menu, or its «📡 Провайдеры» row): OTT Club, the free iptv-org provider
// and the viewer's own providers. A provider that gives separate playlists (iptv-org) opens its own list:
// OK on it shows its playlists, BACK returns to the providers. OK on OTT Club, a playlist or an own provider
// switches (the app starts again on it); BLUE enters or changes the OTT Club key; RED twice removes one of the
// viewer's own providers; BACK returns to the channel menu. Row names are ours (translated) or 'OTT Club', and the
// viewer's own providers' host labels, which Sources gives already pinned left to right.
(function () {
  var REMOVE_ARM_MS = 4000;
  var rows = [], cursor = 0, active = '', armed = '', armTimer = null;
  var provider = null;         // the free provider whose playlists are shown, or null: the providers
  var first = false;           // the first launch: nothing plays yet, Back starts the free channels

  // arg: true (after a removal: the cursor stays where it was, or on the new last row) | { first: true }.
  function open(arg) {
    var keepCursor = arg === true;
    first = !!(arg && arg.first);
    provider = null;
    load(keepCursor ? '' : Sources.activeId());
    if (keepCursor) cursor = Math.min(cursor, rows.length - 1);
    disarm();
    Util.$('sources-hint').textContent = I18n.t(first ? 'src.firstHint' : 'src.hint');
    UI.show('sources', true);
    render();
  }
  // The rows of the current level; the cursor goes to `focusId` (or the row holding it).
  function load(focusId) {
    active = Sources.activeId();
    rows = provider ? provider.playlists : Sources.list().concat([{ id: 'add', kind: 'add', name: I18n.t('src.add') }]);
    cursor = 0;
    for (var i = 0; i < rows.length; i++) if (focusId && (rows[i].id === focusId || holds(rows[i], focusId))) { cursor = i; break; }
    Util.$('sources-title').textContent = provider ? provider.name : I18n.t(first ? 'src.choose' : 'src.title');
  }
  function holds(r, id) { return !!r.playlists && id.indexOf(r.id + '/') === 0; }
  function close() { disarm(); UI.show('sources', false); }

  function sub(r) {
    if (r.id === armed) return I18n.t('src.armed');
    var on = r.id === active || holds(r, active), state = on ? I18n.t('src.now') + ' · ' : '';
    if (r.kind === 'ott') return state + I18n.t(r.ready ? 'src.keySaved' : 'src.keyNeeded');
    if (r.kind === 'free') return state + I18n.t('src.free', I18n.n(r.playlists.length, 'playlist'));
    if (r.kind === 'freepl') return on ? I18n.t('src.now') : '';
    if (r.kind === 'user') return state + I18n.t('src.own');
    return I18n.t('src.addSub');
  }

  function render() {
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], on = r.id === active || holds(r, active);
      html += '<div class="src-row' + (i === cursor ? ' sel' : '') + (on ? ' on' : '') + '">' +
        '<span class="src-t">' + Util.esc(r.name) + '</span><span class="src-s">' + Util.esc(sub(r)) + '</span></div>';
    }
    var list = Util.$('sources-list');
    list.innerHTML = html;
    // The list scrolls with the cursor when it is taller than the screen.
    var sel = list.children[cursor];
    if (sel && sel.offsetTop + sel.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = sel.offsetTop + sel.offsetHeight - list.clientHeight;
    else if (sel && sel.offsetTop < list.scrollTop) list.scrollTop = sel.offsetTop;
  }

  function disarm() { clearTimeout(armTimer); armTimer = null; armed = ''; }

  function choose(r) {
    if (r.kind === 'add') { Overlay.open('setup', { mode: 'playlist', first: first }); return; }
    if (r.kind === 'ott' && !r.ready) { Overlay.open('setup', { mode: 'key', first: first }); return; }
    if (r.kind === 'free') { provider = r; load(active); render(); return; }
    if (r.id === active) { Overlay.close(); return; }
    UI.toast(I18n.t('src.switching', r.name), 3000);
    Sources.switchTo(r.id);
  }

  function remove(r) {
    if (r.kind !== 'user') { UI.toast(I18n.t(r.kind === 'add' ? 'src.nothing' : 'src.builtin'), 2500); return; }
    if (armed !== r.id) {
      disarm();
      armed = r.id;
      armTimer = setTimeout(function () { disarm(); if (Overlay.mode() === 'sources') render(); }, REMOVE_ARM_MS);
      render();
      return;
    }
    disarm();
    Sources.removeUser(r.url);
    UI.toast(I18n.t('src.removed', r.name), 3000);
    open(true);
  }

  function onKey(k, e) {
    e.preventDefault();
    if (k === K.UP || k === K.DOWN) { cursor = (cursor + (k === K.UP ? -1 : 1) + rows.length) % rows.length; disarm(); render(); }
    else if (k === K.ENTER) choose(rows[cursor]);
    else if (k === K.BLUE) Overlay.open('setup', { mode: 'key', first: first });
    else if (k === K.RED) remove(rows[cursor]);
    else if (Keys.isBack(k)) {
      if (provider) { var back = provider.id; provider = null; load(back); render(); }
      else if (first) Sources.switchTo(Sources.firstFreeId());   // no choice made: the free channels, never nothing
      else Overlay.open('menu');
    }
  }

  Overlay.register('sources', { open: open, close: close, onKey: onKey, render: render });
}());
