// «⚙ Настройки» (formerly «О программе»; the last row of the channel menu): the interface language (OK opens the list
// of languages — overlays/lang.js), the full-screen picture (default on), adult channels and the author (OK opens his
// LinkedIn profile in the TV's browser), then what the app and the TV are. ▲▼ choose, OK switches / opens, BACK returns
// to the menu.
(function () {
  var cursor = 0;
  var AUTHOR_URL = 'https://www.linkedin.com/in/yaroslav-rudenko-2303';
  var SETTINGS = [
    { label: 'st.language', state: function () { return I18n.t('st.languageState', I18n.name()); },
      press: function () { Overlay.open('lang'); } },
    { label: 'st.full', get: function () { return Player.fullScreen(); }, set: function (on) { Player.setFullScreen(on); },
      on: 'st.fullOn', off: 'st.fullOff', said: ['st.fullSaidOn', 'st.fullSaidOff'] },
    { label: 'st.adult', get: function () { return Channels.showAdult(); }, set: function (on) { Channels.setShowAdult(on); },
      on: 'st.adultOn', off: 'st.adultOff', said: ['st.adultSaidOn', 'st.adultSaidOff'] },
    { label: 'st.author', state: function () { return I18n.t('st.authorState', I18n.t('st.authorName'), 'linkedin.com/in/yaroslav-rudenko-2303'); },
      press: function () {
        UI.toast(I18n.t('st.opening', AUTHOR_URL), 4000);
        Util.openUrl(AUTHOR_URL, function (why) { UI.toast(I18n.t('st.notOpened', why), 5000); });
      } }
  ];
  function open() {
    cursor = 0;
    Util.$('about-title').textContent = I18n.t('g.settings');   // the screen is named as its menu row (owner 2026-10-28)
    UI.show('about', true);
    render();
    Device.model(function () { if (Overlay.mode() === 'about') render(); });
  }
  function close() { UI.show('about', false); }

  function render() {
    var ua = navigator.userAgent, tizen = (/Tizen\s*([\d.]+)/.exec(ua) || [])[1], chromium = (/Chrome\/([\d]+)/.exec(ua) || [])[1];
    var st = Channels.stats(), c = Playback.current();
    var build = CONFIG.BUILD.indexOf('__') === 0 ? I18n.t('st.local') : CONFIG.BUILD;
    var model = '';
    Device.model(function (m) { model = m; });
    UI.about([
      [I18n.t('st.version'), CONFIG.VERSION],
      [I18n.t('st.build'), build],
      [I18n.t('st.tv'), (model || 'Samsung') + (tizen ? ' · Tizen ' + tizen : '') + (chromium ? ' · ' + I18n.t('st.engine', chromium) : '')],
      [I18n.t('st.player'), I18n.t(window.webapis ? 'st.playerTv' : 'st.playerWeb')],
      [I18n.t('st.provider'), Sources.mode() === 'ott' ? 'OTT Club (' + CONFIG.OTT_SERVER + ')' : Sources.activeName()],
      [I18n.t('st.channels'), I18n.t('st.channelsState', st.total, Channels.providerGroupCount())],
      [I18n.t('st.archive'), I18n.t('st.archiveState', I18n.n(CONFIG.ARCHIVE_DAYS, 'day'))],
      [I18n.t('st.now'), (c ? I18n.iso(c.name) + ' · ' : '') + (Player.streamInfo(true) || I18n.t('st.noInfo'))],
      [I18n.t('st.buffer'), I18n.t('st.bufferState', CONFIG.BUFFER_PLAY_S, CONFIG.BUFFER_RESUME_S, CONFIG.BUFFER_TIMEOUT_MS / 1000, CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS / 1000)]
    ], SETTINGS.map(function (x) {
      if (x.press) return { label: I18n.t(x.label), link: true, state: x.state() };
      var on = x.get();
      return { label: I18n.t(x.label), on: on, state: I18n.t(on ? x.on : x.off) };
    }), cursor);
  }

  function onKey(k, e) {
    if (k === K.UP || k === K.DOWN) { e.preventDefault(); cursor = (cursor + (k === K.UP ? -1 : 1) + SETTINGS.length) % SETTINGS.length; render(); }
    else if (k === K.ENTER) {
      e.preventDefault();
      var x = SETTINGS[cursor];
      if (x.press) { x.press(); return; }
      var on = !x.get();
      x.set(on);
      render();
      UI.toast(I18n.t(x.said[on ? 0 : 1]));
    } else if (Keys.isBack(k)) { e.preventDefault(); Overlay.open('menu'); }
  }

  Overlay.register('about', { open: open, close: close, onKey: onKey, render: render });
}());
