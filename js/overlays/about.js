// Two screens of the channel menu's last rows, drawn in one panel (owner 2026-10-28: «у нас "Настройки" и отдельно
// "О программе", чтобы не мешать всё вместе»):
// - «⚙ Настройки»: the interface language (OK opens the list of languages — overlays/lang.js), the full-screen picture
//   (default on), adult channels, fast channel switching and the menu layout («Вид меню», overlays/basic.js);
// - «ℹ О программе»: the dedication, what the app and the TV are, and the author (OK opens his LinkedIn profile in the
//   TV's browser).
// ▲▼ choose, OK switches / opens, BACK returns to the menu.
(function () {
  var cursor = 0, page, first = 0, atEnd = true;   // first: the table's first row shown; atEnd: its last row is on screen
  var AUTHOR_URL = 'https://www.linkedin.com/in/yaroslav-rudenko-2303';
  var SETTINGS = [
    { label: 'st.language', state: function () { return I18n.t('st.languageState', I18n.name()); },
      press: function () { Overlay.open('lang'); } },
    { label: 'st.full', get: function () { return Player.fullScreen(); }, set: function (on) { Player.setFullScreen(on); },
      on: 'st.fullOn', off: 'st.fullOff', said: ['st.fullSaidOn', 'st.fullSaidOff'] },
    { label: 'st.adult', get: function () { return Channels.showAdult(); }, set: function (on) { Channels.setShowAdult(on); },
      on: 'st.adultOn', off: 'st.adultOff', said: ['st.adultSaidOn', 'st.adultSaidOff'] },
    { label: 'st.fast', get: function () { return Player.fastSwitch(); }, set: function (on) { Player.setFastSwitch(on); },
      on: 'st.fastOn', off: 'st.fastOff', said: ['st.fastSaidOn', 'st.fastSaidOff'] },
    // Last, so the rows above keep their places: on = «Крупный» (Basic); it applies at the next opening of the menu.
    { label: 'st.layout', get: function () { return BasicMenu.on(); }, set: function (on) { BasicMenu.setOn(on); },
      on: 'st.layoutBasic', off: 'st.layoutAdvanced', said: ['st.layoutSaidBasic', 'st.layoutSaidAdvanced'] }
  ];
  var ABOUT = [
    { label: 'st.author', state: function () { return I18n.t('st.authorState', I18n.t('st.authorName'), 'linkedin.com/in/yaroslav-rudenko-2303'); },
      press: function () {
        UI.toast(I18n.t('st.opening', AUTHOR_URL), 4000);
        Util.openUrl(AUTHOR_URL, function (why) { UI.toast(I18n.t('st.notOpened', why), 5000); });
      } }
  ];
  var PAGES = {
    settings: { title: 'g.settings', hint: 'st.hint', items: SETTINGS, info: false },
    about: { title: 'g.about', hint: 'ab.hint', items: ABOUT, info: true }
  };

  function opener(name) {
    return function () {
      page = PAGES[name];
      cursor = 0;
      first = 0;
      Util.$('about-title').textContent = I18n.t(page.title);   // each screen is named as its menu row (owner 2026-10-28)
      Util.$('about-hint').textContent = I18n.t(page.hint);
      Util.$('about-dedication').style.display = page.info ? '' : 'none';
      UI.show('about', true);
      render();
      if (page.info) Device.model(function () { if (Overlay.mode() === name) render(); });
    };
  }
  function close() { UI.show('about', false); }

  function info() {
    var ua = navigator.userAgent, tizen = (/Tizen\s*([\d.]+)/.exec(ua) || [])[1], chromium = (/Chrome\/([\d]+)/.exec(ua) || [])[1];
    var st = Channels.stats(), c = Playback.current();
    var build = CONFIG.BUILD.indexOf('__') === 0 ? I18n.t('st.local') : CONFIG.BUILD;
    var model = '';
    Device.model(function (m) { model = m; });
    return [
      [I18n.t('st.version'), CONFIG.VERSION],
      [I18n.t('st.build'), build],
      [I18n.t('st.tv'), (model || 'Samsung') + (tizen ? ' · Tizen ' + tizen : '') + (chromium ? ' · ' + I18n.t('st.engine', chromium) : '')],
      [I18n.t('st.player'), I18n.t(window.webapis ? 'st.playerTv' : 'st.playerWeb')],
      [I18n.t('st.provider'), Sources.mode() === 'ott' ? 'OTT Club (' + CONFIG.OTT_SERVER + ')' : Sources.activeName()],
      [I18n.t('st.free'), I18n.t('src.freeNote')],
      [I18n.t('st.channels'), I18n.t('st.channelsState', st.total, Channels.providerGroupCount())],
      [I18n.t('st.archive'), I18n.t('st.archiveState', I18n.n(CONFIG.ARCHIVE_DAYS, 'day'))],
      [I18n.t('st.now'), (c ? I18n.iso(c.name) + ' · ' : '') + (Player.streamInfo(true) || I18n.t('st.noInfo'))],
      [I18n.t('st.buffer'), I18n.t('st.bufferState', CONFIG.BUFFER_PLAY_S, CONFIG.BUFFER_RESUME_S, CONFIG.BUFFER_TIMEOUT_MS / 1000, CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS / 1000)]
    ];
  }

  function render() {
    UI.about(page.info ? info() : [], page.items.map(function (x) {
      if (x.press) return { label: I18n.t(x.label), link: true, state: x.state() };
      var on = x.get();
      return { label: I18n.t(x.label), on: on, state: I18n.t(on ? x.on : x.off) };
    }), cursor);
    fitRows();
    UI.scrollBar('about-bar', UI.listShown(Util.$('about-table')));
  }
  // Large (owner 2026-10-28), «ℹ О программе» is taller than its room: the rows that fit whole from row `first` are shown,
  // the others taken out of the layout (never cut, nothing left under the hint bar), and ▲▼ move it a row at a time. The
  // heights are read once per render, before any row is taken out, on these screens only.
  function fitRows() {
    var t = Util.$('about-table'), rows = t.children, h = t.clientHeight, out = [], i;
    if (!h) return;
    first = Math.max(0, Math.min(first, rows.length - 1));
    var top = rows[first].offsetTop;
    atEnd = true;
    for (i = 0; i < rows.length; i++) {
      var fits = i >= first && rows[i].offsetTop + rows[i].offsetHeight - top <= h;
      if (!fits) out.push(rows[i]);
      if (i >= first && !fits) atEnd = false;
    }
    for (i = 0; i < out.length; i++) out[i].style.display = 'none';
  }

  function onKey(k, e) {
    if ((k === K.UP || k === K.DOWN) && page.info) { e.preventDefault(); if (k === K.UP ? first > 0 : !atEnd) { first += k === K.UP ? -1 : 1; render(); } }
    else if (k === K.UP || k === K.DOWN) { e.preventDefault(); cursor = (cursor + (k === K.UP ? -1 : 1) + page.items.length) % page.items.length; render(); }
    else if (k === K.ENTER) {
      e.preventDefault();
      var x = page.items[cursor];
      if (x.press) { x.press(); return; }
      var on = !x.get();
      x.set(on);
      render();
      UI.toast(I18n.t(x.said[on ? 0 : 1]));
    } else if (Keys.isBack(k)) { e.preventDefault(); Overlay.open('menu'); }
  }

  Overlay.register('settings', { open: opener('settings'), close: close, onKey: onKey, render: render });
  Overlay.register('about', { open: opener('about'), close: close, onKey: onKey, render: render });
}());
