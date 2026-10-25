// Remote-control key codes, Back predicates and registration of the TV's media keys.
var K = {
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACK_DESKTOP: 8, ESC: 27, DONE: 65376,
  CH_UP: 427, CH_DOWN: 428, PG_UP: 33, PG_DOWN: 34, F: 70, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
  PLAY_PAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, REWIND: 412, FF: 417, INFO: 457, CH_LIST: 10073,
  PREV_CH: 10190, DIGIT_0: 48, DIGIT_9: 57
};

var Keys = (function () {
  var MEDIA_KEYS = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown',
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward', 'Info',
    'ChannelList', 'PreviousChannel', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function isBack(k) { return k === K.BACK || k === K.BACK_DESKTOP || k === K.ESC; }
  // Inside a text field Backspace edits the text, so it is not "Back".
  function isTextBack(k) { return k === K.BACK || k === K.ESC; }
  function isSubmit(k) { return k === K.ENTER || k === K.DONE; }
  function isDigit(k) { return k >= K.DIGIT_0 && k <= K.DIGIT_9; }

  function register() {
    if (!window.tizen || !tizen.tvinputdevice) { Diag.note('keys', 'no tvinputdevice (desktop)'); return; }
    var supported = null;            // unknown: every key is tried
    try {
      supported = tizen.tvinputdevice.getSupportedKeys().map(function (x) { return x.name; });
    } catch (e) { Diag.note('keys.supported', (e && (e.code || e.message)) || String(e)); }
    var missing = [];
    for (var i = 0; i < MEDIA_KEYS.length; i++) {
      if (supported && supported.indexOf(MEDIA_KEYS[i]) < 0) { missing.push(MEDIA_KEYS[i]); continue; }
      try { tizen.tvinputdevice.registerKey(MEDIA_KEYS[i]); } catch (e) { missing.push(MEDIA_KEYS[i]); }
    }
    if (missing.length) Diag.note('keys', 'not registered: ' + missing.join(','));
  }

  return { isBack: isBack, isTextBack: isTextBack, isSubmit: isSubmit, isDigit: isDigit, register: register };
}());
