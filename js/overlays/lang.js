// «🌐 Язык интерфейса», opened from «⚙ Настройки» (owner 2026-10-28: «появилось какое-то меню … со всеми возможными
// языками. Я там этот язык выбираю, и он применяется» — one OK used to move to the next language, a restart each).
// Every interface language, each written in itself in its own direction, the current one marked (✓) and under the
// cursor. ▲▼ choose; OK on another language applies it: the app starts again in it, on the same channel and group
// (every screen is built in the language); OK on the current one or BACK returns to the settings, nothing changed.
(function () {
  var cursor = 0, restarting = false;

  function open() {
    cursor = I18n.langs().indexOf(I18n.code());
    Util.$('lang-title').textContent = I18n.t('st.language');
    Util.$('lang-hint').textContent = I18n.t('lang.hint');
    UI.show('lang', true);
    render();
  }
  function close() { UI.show('lang', false); }

  function render() {
    var langs = I18n.langs(), cur = I18n.code(), html = '';
    for (var i = 0; i < langs.length; i++) {
      var l = langs[i];
      html += '<div class="src-row' + (i === cursor ? ' sel' : '') + (l === cur ? ' on' : '') + '">' +
        '<span class="src-t" lang="' + l + '" dir="' + I18n.dirOf(l) + '">' + Util.esc(I18n.name(l)) + '</span>' +
        '<span class="src-s">' + (l === cur ? '✓' : '') + '</span></div>';
    }
    Util.$('lang-list').innerHTML = html;
  }

  function choose(l) {
    if (restarting) return;                    // a second OK before the restart would change it again
    if (l === I18n.code()) { Overlay.open('about'); return; }
    restarting = true;
    var c = Playback.current();                // the landing-save timer would not fire before the reload
    if (c) Sources.rememberLanding(c);
    I18n.set(l);
    UI.toast(I18n.t('m.languageSet', I18n.name()), 3000);
    setTimeout(function () { window.location.reload(); }, CONFIG.SWITCH_PAINT_MS);
  }

  function onKey(k, e) {
    e.preventDefault();
    var n = I18n.langs().length;
    if (k === K.UP || k === K.DOWN) { cursor = (cursor + (k === K.UP ? -1 : 1) + n) % n; render(); }
    else if (k === K.ENTER) choose(I18n.langs()[cursor]);
    else if (Keys.isBack(k)) Overlay.open('about');
  }

  Overlay.register('lang', { open: open, close: close, onKey: onKey, render: render });
}());
