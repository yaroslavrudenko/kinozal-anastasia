// «О программе» (last row of the channel menu): the author (OK opens his LinkedIn profile in the TV's browser) and
// the settings: the picture fills the screen (default on) and adult channels. ▲▼ choose, OK opens / switches,
// BACK returns to the menu.
(function () {
  var cursor = 0;
  var AUTHOR_URL = 'https://www.linkedin.com/in/yaroslav-rudenko-2303';
  var SETTINGS = [
    { label: 'Автор', link: AUTHOR_URL, state: 'Ярослав Руденко · linkedin.com/in/yaroslav-rudenko-2303 · OK — открыть в браузере' },
    { label: 'Картинка во весь экран', get: function () { return Player.fullScreen(); }, set: function (on) { Player.setFullScreen(on); },
      on: 'да — изображение точно по размеру экрана', off: 'нет — в пропорциях потока',
      said: ['Картинка во весь экран', 'Картинка в пропорциях потока'] },
    { label: 'Каналы для взрослых', get: function () { return Channels.showAdult(); }, set: function (on) { Channels.setShowAdult(on); },
      on: 'показываются в меню', off: 'скрыты',
      said: ['Группа «Для взрослых» добавлена в меню', 'Группа «Для взрослых» скрыта'] }
  ];
  function open() {
    cursor = 0;
    UI.show('about', true);
    render();
    Device.model(function () { if (Overlay.mode() === 'about') render(); });
  }
  function close() { UI.show('about', false); }

  function render() {
    var ua = navigator.userAgent, tizen = (/Tizen\s*([\d.]+)/.exec(ua) || [])[1], chromium = (/Chrome\/([\d]+)/.exec(ua) || [])[1];
    var st = Channels.stats(), c = Playback.current();
    var build = CONFIG.BUILD.indexOf('__') === 0 ? 'локальная' : CONFIG.BUILD;
    var model = '';
    Device.model(function (m) { model = m; });
    UI.about([
      ['Версия', CONFIG.VERSION],
      ['Сборка', build],
      ['Телевизор', (model || 'Samsung') + (tizen ? ' · Tizen ' + tizen : '') + (chromium ? ' · веб-движок Chromium ' + chromium : '')],
      ['Плеер', window.webapis ? 'аппаратный Samsung AVPlay' : 'браузер (hls.js)'],
      ['Провайдер', Sources.mode() === 'ott' ? 'OTT Club (' + CONFIG.OTT_SERVER + ')' : Sources.activeName()],
      ['Каналы', st.total + ' · групп: ' + Channels.providerGroupCount()],
      ['Архив', CONFIG.ARCHIVE_DAYS + ' дней · перемотка ползунком (▲)'],
      ['Сейчас', (c ? c.name + ' · ' : '') + (Player.streamInfo(true) || 'нет данных о потоке')],
      ['Буфер', 'старт ' + CONFIG.BUFFER_PLAY_S + ' с · после подгрузки ' + CONFIG.BUFFER_RESUME_S + ' с · переподключение через ' +
        CONFIG.BUFFER_TIMEOUT_MS / 1000 + ' с (архив ' + CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS / 1000 + ' с)']
    ], SETTINGS.map(function (x) {
      if (x.link) return { label: x.label, link: true, state: x.state };
      var on = x.get();
      return { label: x.label, on: on, state: on ? x.on : x.off };
    }), cursor);
  }

  function onKey(k, e) {
    if (k === K.UP || k === K.DOWN) { e.preventDefault(); cursor = (cursor + (k === K.UP ? -1 : 1) + SETTINGS.length) % SETTINGS.length; render(); }
    else if (k === K.ENTER) {
      e.preventDefault();
      var x = SETTINGS[cursor];
      if (x.link) { UI.toast('Открываю в браузере: ' + x.link, 4000); Util.openUrl(x.link, function (why) { UI.toast('Браузер не открылся (' + why + ')', 5000); }); return; }
      var on = !x.get();
      x.set(on);
      render();
      UI.toast(x.said[on ? 0 : 1]);
    } else if (Keys.isBack(k)) { e.preventDefault(); Overlay.open('menu'); }
  }

  Overlay.register('about', { open: open, close: close, onKey: onKey, render: render });
}());
