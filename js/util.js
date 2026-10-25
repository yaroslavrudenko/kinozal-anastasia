// ES5 only: the Tizen 3.0 web engine (Chromium 47) has no let/const, arrow functions or fetch.
var Util = (function () {
  function get(url, timeoutMs, onOk, onErr) {
    var xhr = new XMLHttpRequest();
    var done = false;
    xhr.open('GET', url, true);
    xhr.timeout = timeoutMs;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || done) return;
      done = true;
      if (xhr.status >= 200 && xhr.status < 300) onOk(xhr.responseText);
      else onErr('HTTP ' + xhr.status);
    };
    xhr.ontimeout = function () { if (!done) { done = true; onErr('timeout'); } };
    xhr.onerror = function () { if (!done) { done = true; onErr('network'); } };
    xhr.send();
    return xhr;
  }

  function store(key, value) {
    try {
      if (arguments.length === 1) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
    return value;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.className = el.className.replace(/\s*hidden/g, '') + (on ? '' : ' hidden'); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  return { get: get, store: store, hhmm: hhmm, $: $, show: show, esc: esc };
}());
