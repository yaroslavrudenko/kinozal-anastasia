// Digits on the remote: up to 4 digits, then the channel with that number.
var NumEntry = (function () {
  var MAX_DIGITS = 4;
  var text = '', timer = null;

  function digit(d) {
    text = (text + d).substr(0, MAX_DIGITS);
    UI.numEntry(text);
    clearTimeout(timer);
    timer = setTimeout(tune, CONFIG.NUMBER_ENTRY_MS);
  }

  function tune() {
    var n = parseInt(text, 10), c = Channels.byNum(n);
    cancel();
    if (c && Channels.isEligible(c)) Zap.pick(c); else UI.toast('Нет канала ' + n);
  }

  function cancel() { clearTimeout(timer); timer = null; text = ''; UI.numEntry(''); }

  return { digit: digit, cancel: cancel };
}());
