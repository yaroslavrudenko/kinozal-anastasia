// Rendering only: view models in, DOM out. It reads no store. Banner, toast, spinner, number entry,
// slider, «⚙ Настройки» and the screens' visibility; the list columns are ListView.
var UI = (function () {
  var STICKY = 0;              // toast(text, UI.STICKY): stays until the next toast
  var el = {}, toastTimer = null, bannerTimer = null, scrubBarPx = 0;
  var IDS = ['banner', 'b-num', 'b-logo', 'b-title', 'b-state', 'b-now', 'b-next', 'b-tech', 'b-progress', 'b-clock', 'toast',
    'spinner', 'numentry', 'fatal', 'guide', 'prog', 'p-title', 'scrub', 's-title', 's-time', 's-start', 's-end',
    's-delta', 's-played', 's-now', 's-knob', 'about', 'about-table', 'lang', 'sources', 'search', 'setup', 'search-more', 'groups-bar', 'channels-bar'];

  // Desktop check only: fit the 1920×1080 TV layout into the browser window. Right to left the canvas overflows
  // the window to the left, so it is scaled toward its right edge (boot sets the language before the first fit).
  function fitDesktop() {
    if (window.webapis) return;
    var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transformOrigin = I18n.rtl() ? '100% 0' : '0 0';
    document.body.style.transform = 'scale(' + k + ')';
  }

  function init() { for (var i = 0; i < IDS.length; i++) el[IDS[i]] = Util.$(IDS[i]); Logos.track(el['b-logo']); }

  function show(id, on) { Util.show(el[id], on); }

  // m: { num, logo, title, now, next, progress, tech }
  // holdMs: how long it stays (default BANNER_MS; STICKY: until the next banner or hideBanner).
  function banner(m, holdMs) {
    el['b-num'].textContent = m.num;
    // Through Logos, as every channel logo: a loaded picture at once, else an empty box (never the previous channel's)
    // until it arrives; a picture loaded or failed once is not asked for again. Shown 'inherit', never 'visible'.
    var logo = el['b-logo'];
    Logos.put(logo, m.logo || '');
    if (m.logo && !Logos.ready(m.logo)) Logos.want('banner', [m.logo]);
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

  // The list-end line, in the list right after its last completely visible row (owner 2026-10-26: «вместо
  // последнего элемента списка»): how many rows are still below the page, or that the list ends here.
  // rest: ListView.rest(column) — null (empty list) leaves the line empty; at: ListView.end(column), px from
  // the column's top (null without a layout). Moved by a transform (no layout); written only when it changes.
  // The thin scroll bar beside a list column: the thumb's length is the share of the list on screen, its
  // place where that window is; hidden when the whole list fits. v: ListView.shown(column) or null.
  function scrollBar(id, v) {
    var e = el[id], all = v && v.total > v.count;
    if ((e.className.indexOf('on') >= 0) !== !!all) e.className = all ? 'bar on' : 'bar';
    if (!all) return;
    // Moved by a transform (no layout); its height is written only when the share changes.
    var thumb = e.children[0], h = Math.max(6, 100 * v.count / v.total), top = Math.min(100 - h, (100 - h) * v.first / Math.max(1, v.total - v.count));
    var hs = h.toFixed(2) + '%', t = 'translateY(' + (100 * top / h).toFixed(2) + '%)';
    if (thumb.style.height !== hs) thumb.style.height = hs;
    if (thumb.style.transform !== t) { thumb.style.webkitTransform = t; thumb.style.transform = t; }
  }

  // The search results' list-end line (the menu's columns show their place with scroll bars instead).
  function listEnd(id, rest, at) {
    var e = el[id], text = rest === null ? '' : rest > 0
      ? I18n.t('list.more', I18n.n(rest, 'channel')) : I18n.t('list.end');
    var t = 'translateY(' + (at || 0) + 'px)';
    if (e.textContent !== text) e.textContent = text;
    if (e.style.transform !== t) { e.style.webkitTransform = t; e.style.transform = t; }
  }

  // rows: [[label, value]]; then the items [{ label, on, state } or { label, link: true, state }], the one under
  // the cursor highlighted (▲▼ choose, OK switches or opens).
  function about(rows, settings, cursor) {
    var html = '';
    for (var r = 0; r < rows.length; r++) {
      html += '<div class="about-row"><span class="about-k">' + Util.esc(rows[r][0]) + '</span><span class="about-v">' + Util.esc(rows[r][1]) + '</span></div>';
    }
    for (var i = 0; i < settings.length; i++) {
      var x = settings[i];
      html += '<div class="about-row about-setting' + (i === cursor ? ' sel' : '') + '"><span class="about-k">' + Util.esc(x.label) + '</span>' +
        '<span class="about-v">' + (x.link ? '' : '<span class="switch' + (x.on ? ' on' : '') + '"><i></i></span>') + '<span>' + Util.esc(x.state) + '</span></span></div>';
    }
    el['about-table'].innerHTML = html;
  }

  return {
    STICKY: STICKY, init: init, fitDesktop: fitDesktop, show: show, banner: banner, bannerTech: bannerTech, hideBanner: hideBanner, bannerShown: bannerShown,
    toast: toast, spinner: spinner, numEntry: numEntry, fatal: fatal, panelTitle: panelTitle, scrub: scrub, about: about,
    listEnd: listEnd, scrollBar: scrollBar
  };
}());
