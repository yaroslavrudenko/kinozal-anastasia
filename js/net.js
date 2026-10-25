// The only transport: an abortable GET.
//   Net.get({ url, timeoutMs, maxBytes? }, function done(err, text) {}) -> { abort }
//   err: null | 'timeout' | 'network' | 'HTTP <status>' | 'too-large'. After abort() done is never called.
//   An exception thrown by done is recorded, never left to escape into the XHR event.
var Net = (function () {
  function get(req, done) {
    var xhr = new XMLHttpRequest();
    var finished = false;

    function end(err, text) {
      if (finished) return;
      finished = true;
      try { done(err, text); } catch (e) { Diag.note('callback', (e && e.message) || String(e)); }
    }

    xhr.open('GET', req.url, true);
    xhr.timeout = req.timeoutMs || 0;
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) end(null, xhr.responseText);
      else end('HTTP ' + xhr.status);
    };
    xhr.onerror = function () { end('network'); };
    xhr.ontimeout = function () { end('timeout'); };
    if (req.maxBytes) {
      xhr.onprogress = function (e) {
        if (e.loaded <= req.maxBytes || finished) return;
        stop();
        finished = false;
        end('too-large');
      };
    }
    xhr.send();

    function stop() {
      if (finished) return;
      finished = true;
      try { xhr.abort(); } catch (e) { Diag.note('abort', (e && e.message) || String(e)); }
    }
    return { abort: stop };
  }

  return { get: get };
}());
