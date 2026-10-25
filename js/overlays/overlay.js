// The overlay manager: exactly one overlay is open at a time (or none). Opening one closes the
// current one, cancels a pending number entry and hides the banner. Keys and desktop clicks go to the
// open overlay. Each overlay registers { open(arg), close(), onKey(k, e), onClick(el) }.
var Overlay = (function () {
  var overlays = {}, mode = 'none', beforeOpen = null;

  function register(name, impl) { overlays[name] = impl; }
  // fn runs before any overlay opens (number entry is cancelled there).
  function onBeforeOpen(fn) { beforeOpen = fn; }

  function open(name, arg) {
    close();
    if (beforeOpen) beforeOpen();
    UI.hideBanner();
    mode = name;
    overlays[name].open(arg);
  }
  function close() {
    if (mode === 'none') return;
    var o = overlays[mode];
    mode = 'none';
    o.close();
  }

  // true when an overlay took the key.
  function onKey(k, e) {
    if (mode === 'none') return false;
    overlays[mode].onKey(k, e);
    return true;
  }
  // New data (list, guide, health): the open overlay redraws itself if it shows such data.
  function refresh() { if (mode !== 'none' && overlays[mode].render) overlays[mode].render(); }
  function onClick(target) {
    if (mode !== 'none' && overlays[mode].onClick) overlays[mode].onClick(target);
  }

  return {
    register: register, onBeforeOpen: onBeforeOpen, open: open, close: close, onKey: onKey, onClick: onClick, refresh: refresh,
    mode: function () { return mode; }, isNone: function () { return mode === 'none'; }
  };
}());
