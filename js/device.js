// The TV model from the TV's own local API (no extra privilege needed). Asked lazily, once, for
// «⚙ Настройки»; nothing is requested at start.
var Device = (function () {
  var API = 'http://127.0.0.1:8001/api/v2/', TIMEOUT_MS = 5000;
  var model = null, waiting = null;

  // cb(text): 'Samsung <model> · сеть Wi-Fi' or '' when unknown.
  function get(cb) {
    if (model !== null || !window.webapis) { cb(model || ''); return; }
    if (waiting) { waiting.push(cb); return; }
    waiting = [cb];
    Net.get({ url: API, timeoutMs: TIMEOUT_MS }, function (err, text) {
      model = '';
      if (!err) {
        try {
          var d = JSON.parse(text).device;
          model = 'Samsung ' + d.modelName + (d.networkType ? ' · ' + I18n.t('st.network', d.networkType === 'wireless' ? 'Wi‑Fi' : I18n.t('st.wired')) : '');
        } catch (e) { Diag.note('device', 'unreadable answer'); }
      }
      var subs = waiting;
      waiting = null;
      for (var i = 0; i < subs.length; i++) subs[i](model);
    });
  }

  return { model: get };
}());
