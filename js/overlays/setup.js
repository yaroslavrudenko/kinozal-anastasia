// First run (and BLUE in the menu): enter an OTT Club key or a playlist link. Each opening is a session
// with its own token: a check still running when the viewer leaves can neither save nor start anything,
// and OK pressed again while a check runs is ignored.
(function () {
  var FOCUS_DELAY_MS = 300;
  var token = 0, check = null, changingKey = false, focusTimer = null;

  function field() { return Util.$('key-input'); }
  function say(text) { Util.$('setup-err').textContent = text; }

  // arg: { changingKey } — changing the key keeps the current one until a new one passes the check.
  function open(arg) {
    token++;
    changingKey = !!(arg && arg.changingKey);
    if (changingKey) { field().value = ''; say('Сейчас используется сохранённый ключ. Введите новый или нажмите «Назад».'); }
    UI.show('setup', true);
    focusTimer = setTimeout(function () { field().focus(); }, FOCUS_DELAY_MS);
  }
  function close() {
    token++;
    clearTimeout(focusTimer);
    if (check) { check.abort(); check = null; }
    field().blur();
    UI.show('setup', false);
  }

  function submit() {
    if (check) return;
    var text = field().value, key = OttClub.extractKey(text), my = token;
    if (key) {
      say('Проверяю ключ…');
      check = OttClub.checkKey(key, function (ok) {
        check = null;
        if (my !== token) return;
        if (!ok) { say('Ключ не подошёл. Проверьте и вставьте ещё раз.'); return; }
        finish(function () { Sources.setOtt(key); });
      });
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
