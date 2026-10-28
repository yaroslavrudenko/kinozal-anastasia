// AVPlay's tracks and picture: the technical line, the number of video renditions, audio tracks, and
// the display mode (kept on the device).
var AvTracks = (function () {
  // Full screen first (owner, 2026-10-27: «изображение ложилось чётко на размер экрана, чтобы оно не было уже»):
  // every stream fills the TV's 1920×1080 exactly; GREEN still cycles to the aspect-keeping modes.
  var MODES = ['PLAYER_DISPLAY_MODE_FULL_SCREEN', 'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO', 'PLAYER_DISPLAY_MODE_LETTER_BOX'];
  var NAMES = ['mode.full', 'mode.auto', 'mode.box'];
  var displayIdx = null;

  function extra(track) { try { return JSON.parse(track.extra_info) || {}; } catch (e) { return {}; } }
  function mbps(bps) { return I18n.t('tech.mbps', (bps / 1e6).toFixed(1).replace('.', I18n.t('num.decimal'))); }

  // resolution · codec · frame rate · bitrate · audio. The picture size reads left to right in every language.
  function streamInfo(av) {
    var parts = [], list;
    try { list = av.getCurrentStreamInfo(); } catch (e) { return ''; }
    for (var i = 0; i < list.length; i++) {
      var x = extra(list[i]);
      if (list[i].type === 'VIDEO') {
        parts.unshift(I18n.ltr(x.Width + '×' + x.Height) + (x.fourCC ? ' · ' + String(x.fourCC).toUpperCase() : '') +
          (x.fps ? ' · ' + I18n.t('tech.fps', Math.round(+x.fps)) : '') + (x.Bit_rate ? ' · ' + mbps(+x.Bit_rate) : ''));
      } else if (list[i].type === 'AUDIO') {
        var ac = +x.channels;
        parts.push(I18n.t('tech.sound', ac === 2 ? I18n.t('tech.stereo') : ac === 6 ? '5.1' : ac === 1 ? I18n.t('tech.mono') : ac ? I18n.t('tech.ch', ac) : '') +
          (x.fourCC ? ' ' + String(x.fourCC).toUpperCase() : ''));
      }
    }
    return parts.join(' · ');
  }

  function variantCount(av) {
    try { return av.getTotalTrackInfo().filter(function (t) { return t.type === 'VIDEO'; }).length; } catch (e) { return -1; }
  }

  function audioTracks(av) {
    var out = [], list;
    try { list = av.getTotalTrackInfo(); } catch (e) { return []; }
    for (var i = 0; i < list.length; i++) {
      if (list[i].type !== 'AUDIO') continue;
      var x = extra(list[i]);
      out.push({ index: list[i].index, label: (x.language ? I18n.iso(x.language) : I18n.t('tech.track', out.length + 1)) + (x.channels ? ' · ' + I18n.t('tech.ch', x.channels) : '') });
    }
    return out;
  }

  // true when the TV accepted the track.
  function selectAudio(av, index) {
    try { av.setSelectTrack('AUDIO', index); return true; } catch (e) { Diag.note('audio', (e && e.message) || String(e)); return false; }
  }

  function displayMode() { if (displayIdx === null) displayIdx = Util.load('displayIdx') || 0; return MODES[displayIdx]; }
  function setDisplay(av, idx) {
    displayIdx = idx;
    Util.save('displayIdx', displayIdx);
    if (av) { try { av.setDisplayMethod(MODES[displayIdx]); } catch (e) { Diag.count('settingsRejected'); Diag.note('setting.display', (e && e.message) || String(e)); } }
    return I18n.t(NAMES[displayIdx]);
  }
  // GREEN: the next display mode; returns its name.
  function cycleDisplay(av) { displayMode(); return setDisplay(av, (displayIdx + 1) % MODES.length); }
  // The «Картинка во весь экран» setting: on = full screen (the default), off = the stream's own proportions.
  function fullScreen() { displayMode(); return displayIdx === 0; }
  function setFullScreen(av, on) { return setDisplay(av, on ? 0 : 1); }

  return { streamInfo: streamInfo, variantCount: variantCount, audioTracks: audioTracks, selectAudio: selectAudio,
    displayMode: displayMode, cycleDisplay: cycleDisplay, fullScreen: fullScreen, setFullScreen: setFullScreen, mbps: mbps };
}());
