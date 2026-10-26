// «О программе» (last row of the channel menu) with its one setting: adult channels.
// OK toggles the setting, BACK returns to the menu.
(function () {
  function open() {
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
      ['Источник каналов', Sources.mode() === 'ott' ? 'OTT Club (' + CONFIG.OTT_SERVER + ')' : 'M3U-плейлист'],
      ['Каналы', st.total + ' · групп: ' + Channels.providerGroupCount()],
      ['Архив', CONFIG.ARCHIVE_DAYS + ' дней · перемотка ползунком (▲)'],
      ['Сейчас', (c ? c.name + ' · ' : '') + (Player.streamInfo(true) || 'нет данных о потоке')],
      ['Буфер', 'старт ' + CONFIG.BUFFER_PLAY_S + ' с · после подгрузки ' + CONFIG.BUFFER_RESUME_S + ' с · переподключение через ' +
        CONFIG.BUFFER_TIMEOUT_MS / 1000 + ' с (архив ' + CONFIG.ARCHIVE_BUFFER_TIMEOUT_MS / 1000 + ' с)']
    ], Channels.showAdult());
  }

  function onKey(k, e) {
    if (k === K.ENTER) {
      e.preventDefault();
      var on = !Channels.showAdult();
      Channels.setShowAdult(on);
      render();
      UI.toast(on ? 'Группа «Для взрослых» добавлена в меню' : 'Группа «Для взрослых» скрыта');
    } else if (Keys.isBack(k)) { e.preventDefault(); Overlay.open('menu'); }
  }

  Overlay.register('about', { open: open, close: close, onKey: onKey, render: render });
}());
