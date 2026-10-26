// First run (and BLUE in the menu, at any time): enter an OTT Club key or a playlist link. The key is
// saved and used at once, with no check of the app's own: the provider judges it, and a key it refuses
// gets the provider's error in the stream (owner, 2026-10-26: «Ключ проверяет сам провайдер»).
(function () {
  var FOCUS_DELAY_MS = 300;
  var changingKey = false, focusTimer = null;

  function field() { return Util.$('key-input'); }
  function say(text) { Util.$('setup-err').textContent = text; }

  // arg: { changingKey } — changing the key keeps the current one until a new one is entered.
  function open(arg) {
    changingKey = !!(arg && arg.changingKey);
    if (changingKey) { field().value = ''; say('Сейчас используется сохранённый ключ. Введите новый или нажмите «Назад».'); }
    UI.show('setup', true);
    focusTimer = setTimeout(function () { field().focus(); }, FOCUS_DELAY_MS);
  }
  function close() {
    clearTimeout(focusTimer);
    field().blur();
    UI.show('setup', false);
  }

  function submit() {
    var text = field().value, key = OttClub.extractKey(text);
    if (key) {
      finish(function () { Sources.setOtt(key); });
    } else if (/^https?:\/\//.test(text.trim())) {
      finish(function () { Sources.setM3u(text.trim()); });
    } else {
      say('Это не похоже на ключ или ссылку.');
    }
  }

  function finish(saveSource) {
    saveSource();
    if (changingKey) { window.location.reload(); return; }
    Overlay.close();
    Sources.start();
  }

  function onKey(k, e) {
    if (Keys.isSubmit(k)) { e.preventDefault(); submit(); }
    else if (Keys.isTextBack(k) && changingKey) Overlay.close();
  }

  Overlay.register('setup', { open: open, close: close, onKey: onKey });
}());
