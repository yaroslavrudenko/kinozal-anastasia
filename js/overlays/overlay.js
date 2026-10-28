// The overlay manager: exactly one overlay is open at a time (or none). Opening one closes the
// current one, cancels a pending number entry and hides the banner. Keys and desktop clicks go to the
// open overlay. Each overlay registers { open(arg, from), close(), onKey(k, e), onClick(el) }; from: the mode it was
// opened from ('none': from the picture).
var Overlay = (function () {
  var overlays = {}, aliases = {}, mode = 'none', beforeOpen = null, lastKeyAt = 0, quietTimer = null;

  function register(name, impl) { overlays[name] = impl; }
  // A name that stands for whichever overlay fn(from) names when it is opened from `from`, or prepared (as from the
  // picture): 'menu' is the channel menu in the layout chosen in «⚙ Настройки» (BasicMenu), decided at each open —
  // every caller keeps saying 'menu'.
  function alias(name, fn) { aliases[name] = fn; }
  function resolve(name, from) { return aliases[name] ? aliases[name](from) : name; }
  // fn runs before any overlay opens (number entry is cancelled there).
  function onBeforeOpen(fn) { beforeOpen = fn; }

  function open(name, arg) {
    var from = mode;
    name = resolve(name, from);
    close();
    if (beforeOpen) beforeOpen();
    UI.hideBanner();
    mode = name;
    overlays[name].open(arg, from);
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
    lastKeyAt = Date.now();
    overlays[mode].onKey(k, e);
    return true;
  }
  // New data (list, guide, health): the open overlay redraws itself if it shows such data.
  function refresh() { if (mode !== 'none' && overlays[mode].render) overlays[mode].render(); }
  // The same, but never in the middle of key presses: while keys come in, each key's own render already
  // shows the new data; the redraw runs once OVERLAY_QUIET_MS have passed without a key.
  function refreshQuiet() {
    clearTimeout(quietTimer);
    var wait = lastKeyAt + CONFIG.OVERLAY_QUIET_MS - Date.now();
    if (wait > 0) quietTimer = setTimeout(refreshQuiet, wait); else refresh();
  }
  // Builds an overlay's screen ahead of time (at idle), if it can.
  function prepare(name) { var o = overlays[resolve(name, 'none')]; if (o.prepare) o.prepare(); }
  function onClick(target) {
    if (mode !== 'none' && overlays[mode].onClick) overlays[mode].onClick(target);
  }

  return {
    register: register, alias: alias, onBeforeOpen: onBeforeOpen, open: open, close: close, onKey: onKey, onClick: onClick, refresh: refresh, refreshQuiet: refreshQuiet, prepare: prepare,
    mode: function () { return mode; }, isNone: function () { return mode === 'none'; }
  };
}());
