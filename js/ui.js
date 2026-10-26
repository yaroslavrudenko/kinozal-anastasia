// Rendering only: view models in, DOM out. It reads no store. Banner, toast, spinner, number entry,
// slider, «О программе» and the screens' visibility; the list columns are ListView.
var UI = (function () {
  var STICKY = 0;              // toast(text, UI.STICKY): stays until the next toast
  var el = {}, toastTimer = null, bannerTimer = null, scrubBarPx = 0;
  var IDS = ['banner', 'b-num', 'b-logo', 'b-title', 'b-state', 'b-now', 'b-next', 'b-tech', 'b-progress', 'b-clock', 'toast',
    'spinner', 'numentry', 'fatal', 'guide', 'prog', 'p-title', 'scrub', 's-title', 's-time', 's-start', 's-end',
    's-delta', 's-played', 's-now', 's-knob', 'about', 'about-table', 'search', 'setup'];

  // Desktop check only: fit the 1920×1080 TV layout into the browser window.
  function fitDesktop() {
    if (window.webapis) return;
    var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transformOrigin = '0 0';
    document.body.style.transform = 'scale(' + k + ')';
  }

  function init() { for (var i = 0; i < IDS.length; i++) el[IDS[i]] = Util.$(IDS[i]); }

  function show(id, on) { Util.show(el[id], on); }

  // m: { num, logo, title, now, next, progress, tech }
  // holdMs: how long it stays (default BANNER_MS; STICKY: until the next banner or hideBanner).
  function banner(m, holdMs) {
    el['b-num'].textContent = m.num;
    el['b-logo'].style.visibility = m.logo ? 'inherit' : 'hidden';   // never 'visible': a hidden banner must hide it
    if (m.logo) el['b-logo'].src = m.logo;
    el['b-title'].textContent = m.title;
    el['b-now'].textContent = m.now || '';
    el['b-next'].textContent = m.next || '';
    el['b-tech'].textContent = m.tech || '';
    el['b-state'].textContent = m.state || '';
    el['b-progress'].style.width = Math.max(0, Math.min(100, m.progress || 0)) + '%';
    el['b-clock'].textContent = Util.hhmm(new Date());
    show('banner', true);
    clearTimeout(bannerTimer);
    if (holdMs !== STICKY) bannerTimer = setTimeout(hideBanner, holdMs || CONFIG.BANNER_MS);
  }
  function bannerTech(text) { el['b-tech'].textContent = text; }
  function hideBanner() { clearTimeout(bannerTimer); show('banner', false); }
  function bannerShown() { return !/(^|\s)hidden(\s|$)/.test(el.banner.className); }

  function toast(text, ms) {
    el.toast.textContent = text;
    show('toast', true);
    clearTimeout(toastTimer);
    if (ms !== STICKY) toastTimer = setTimeout(function () { show('toast', false); }, ms || CONFIG.TOAST_MS);
  }

  function spinner(on) { show('spinner', on); }
  function numEntry(text) { el.numentry.textContent = text; show('numentry', !!text); }
  function fatal(text) { el.fatal.textContent = text; show('fatal', !!text); }
  function panelTitle(text) { el['p-title'].textContent = text; }

  // m: { title, time, start, end, delta, playedPct, nowPct (null = off the bar), knobPct }
  function scrub(m) {
    if (!scrubBarPx) scrubBarPx = el['s-played'].parentNode.offsetWidth || 0;
    el['s-title'].textContent = m.title;
    el['s-time'].textContent = m.time;
    el['s-start'].textContent = m.start;
    el['s-end'].textContent = m.end;
    el['s-delta'].textContent = m.delta;
    el['s-played'].style.width = m.playedPct + '%';
    el['s-now'].style.display = m.nowPct === null ? 'none' : 'block';
    if (m.nowPct !== null) moveX(el['s-now'], m.nowPct);
    moveX(el['s-knob'], m.knobPct);
  }
  // Compositor-only movement (no layout): translateX in pixels of the bar.
  function moveX(node, pct) {
    var t = 'translateX(' + Math.round(pct * scrubBarPx / 100) + 'px)';
    node.style.webkitTransform = t;
    node.style.transform = t;
  }

  // rows: [[label, value]]; then the one setting, highlighted because OK toggles it.
  function about(rows, adultOn) {
    var html = '';
    for (var r = 0; r < rows.length; r++) {
      html += '<div class="about-row"><span class="about-k">' + Util.esc(rows[r][0]) + '</span><span class="about-v">' + Util.esc(rows[r][1]) + '</span></div>';
    }
    html += '<div class="about-row about-setting"><span class="about-k">Каналы для взрослых</span>' +
      '<span class="about-v"><span class="switch' + (adultOn ? ' on' : '') + '" id="adult-switch"><i></i></span>' +
      '<span id="adult-state">' + (adultOn ? 'показываются в меню' : 'скрыты') + '</span></span></div>';
    el['about-table'].innerHTML = html;
  }

  return {
    STICKY: STICKY, init: init, fitDesktop: fitDesktop, show: show, banner: banner, bannerTech: bannerTech, hideBanner: hideBanner, bannerShown: bannerShown,
    toast: toast, spinner: spinner, numEntry: numEntry, fatal: fatal, panelTitle: panelTitle, scrub: scrub, about: about
  };
}());
