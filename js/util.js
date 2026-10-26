// Platform helpers: storage, DOM, time, dictionaries, idle scheduling.
// ES5 only: the Tizen 3.0 web engine (Chromium 47) has no let/const, arrow functions or fetch.
// This is the only file that touches localStorage.
var Util = (function () {
  var MIN_MS = 60000, DAY_MS = 86400000;
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  var HIDDEN = /(^|\s)hidden(\s|$)/;
  var saveFailed = {};

  // A missing or unreadable value is null.
  function load(key) {
    var raw;
    try { raw = localStorage.getItem(key); } catch (e) { return null; }
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // false when the value could not be kept (quota, private mode; recorded once per key) or when its
  // JSON is longer than maxChars (optional; serialised once, the length checked before writing).
  function save(key, value, maxChars) {
    try {
      var json = JSON.stringify(value);
      if (maxChars && json.length > maxChars) { Diag.note('save.' + key, 'too big: ' + json.length + ' chars'); return false; }
      localStorage.setItem(key, json);
      return true;
    } catch (e) {
      if (!saveFailed[key] && window.Diag) Diag.note('save.' + key, (e && e.name) || 'error');
      saveFailed[key] = true;
      return false;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { if (window.Diag) Diag.note('remove.' + key, (e && e.name) || 'error'); }
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function $(id) { return document.getElementById(id); }

  // Toggles exactly the class "hidden"; other classes (even ones containing the word) are kept.
  function show(el, on) {
    var hidden = HIDDEN.test(el.className);
    if (hidden !== !!on) return;
    el.className = on ? el.className.replace(/(^|\s)hidden(?=\s|$)/g, '').trim() : (el.className ? el.className + ' hidden' : 'hidden');
  }

  // Russian plural: forms = [1, 2–4, 5+] («канал», «канала», «каналов»); 11–14 take the third form.
  function plural(n, forms) {
    var d = n % 10, h = n % 100;
    return forms[d === 1 && h !== 11 ? 0 : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 1 : 2];
  }

  function escChar(c) { return ESC[c]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, escChar); }

  // A map keyed by provider text: no prototype, so "constructor" or "__proto__" are ordinary keys.
  function dict() { return Object.create(null); }

  // Runs fn when the main thread is idle (or soon, where requestIdleCallback is missing).
  function idle(fn, timeoutMs) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: timeoutMs || 2000 });
    else setTimeout(fn, 1);
  }

  // Calendar arithmetic in local time, so a day across a DST change has 23 or 25 hours.
  function dayStart(t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function addDays(t, n) {
    var d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).getTime();
  }

  // The one retry delay of the app. Attempt n (0-based) waits min(maxMs, minMs·2^n) plus up to 25 %
  // random spread, so retries never synchronise, not even at the cap. Below the cap a delay never shrinks
  // (one step's spread stays below the next step's base); at the cap it varies within [maxMs, 1.25·maxMs].
  function backoff(n, minMs, maxMs) {
    return Math.round(Math.min(maxMs, minMs * Math.pow(2, n)) * (1 + Math.random() / 4));
  }

  return {
    MIN_MS: MIN_MS, DAY_MS: DAY_MS,
    load: load, save: save, remove: remove, pad2: pad2, hhmm: hhmm, $: $, show: show, plural: plural, esc: esc, dict: dict,
    idle: idle, dayStart: dayStart, addDays: addDays, backoff: backoff
  };
}());
