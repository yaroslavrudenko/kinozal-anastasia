// Entering a provider, from «Провайдеры»: mode 'key' (enter or change the OTT Club key) or mode 'playlist'
// (add one's own provider by its M3U link). What is entered is saved and used at once through the one switch, with no
// check of the app's own: the provider judges it, and a key it refuses gets the provider's error in the
// stream (owner, 2026-10-26: «Ключ проверяет сам провайдер»). The key is kept exactly as typed.
(function () {
  var FOCUS_DELAY_MS = 300;
  var mode = 'key', focusTimer = null, first = false;   // first: opened from the first launch's «Провайдеры»

  function field() { return Util.$('key-input'); }
  function say(text) { Util.$('setup-err').textContent = text; }

  // arg: { mode: 'key' | 'playlist', first }.
  function open(arg) {
    mode = arg && arg.mode === 'playlist' ? 'playlist' : 'key';
    first = !!(arg && arg.first);
    field().value = '';
    say('');
    // On the first launch no key is in use yet, and Back returns to the choice (review 4, D8).
    Util.$('setup-text').textContent = I18n.t(mode === 'playlist' ? 'set.playlist' : first ? 'set.keyFirst' : 'set.key');
    UI.show('setup', true);
    focusTimer = setTimeout(function () { field().focus(); }, FOCUS_DELAY_MS);
  }
  function close() {
    clearTimeout(focusTimer);
    field().blur();
    UI.show('setup', false);
  }

  function submit() {
    var raw = field().value, text = raw.trim(), url = /^https?:\/\//i.test(text) ? text : '';
    var key = mode === 'playlist' || !text ? '' : url ? OttClub.extractKey(url) : raw;
    if (key) { OttClub.saveKey(key); Sources.switchTo('ott'); return; }
    if (url && mode === 'playlist') { Sources.addUser(url); Sources.switchTo(Sources.idOfUrl(url)); return; }
    say(I18n.t(mode === 'playlist' ? 'set.needLink' : url ? 'set.isLink' : 'set.empty'));
  }

  function onKey(k, e) {
    if (Keys.isSubmit(k)) { e.preventDefault(); submit(); }
    else if (Keys.isTextBack(k)) Overlay.open('sources', first ? { first: true } : undefined);
  }

  Overlay.register('setup', { open: open, close: close, onKey: onKey });
}());
