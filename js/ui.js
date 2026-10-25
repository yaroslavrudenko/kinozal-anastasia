// Rendering only. The channel list is virtualised: a fixed pool of rows is re-filled on scroll,
// so a 1000-channel playlist costs the same as a 13-channel one.
var UI = (function () {
  var $ = Util.$;
  var rows = [], groupRows = [], progRows = [];
  var toastTimer = null, bannerTimer = null;

  function pool(container, n, cls) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var r = document.createElement('div');
      r.className = cls;
      r.innerHTML = '<span class="n"></span><img class="logo" alt=""><span class="t"></span><span class="s"></span>';
      container.appendChild(r);
      out.push({ el: r, n: r.children[0], logo: r.children[1], t: r.children[2], s: r.children[3], src: '' });
    }
    return out;
  }

  function init() {
    rows = pool($('channels'), CONFIG.VISIBLE_ROWS, 'row');
    groupRows = pool($('groups'), CONFIG.VISIBLE_ROWS, 'grow');
    progRows = pool($('d-list'), CONFIG.VISIBLE_ROWS - 1, 'prow');
  }

  function windowStart(cursor, total, visible) {
    var s = cursor - Math.floor(visible / 2);
    return Math.max(0, Math.min(s, total - visible));
  }

  // list: array of items; fill(row, item, index); cursor: highlighted index; active: column has focus
  function renderList(poolRows, list, cursor, active, fill) {
    var start = Math.max(0, windowStart(cursor, list.length, poolRows.length));
    for (var i = 0; i < poolRows.length; i++) {
      var r = poolRows[i], idx = start + i;
      // The logo sets its own visibility, which would override the hidden row, so clear it too.
      if (idx >= list.length) { r.el.style.visibility = 'hidden'; setLogo(r, ''); continue; }
      r.el.style.visibility = 'visible';
      r.el.className = r.el.className.split(' ')[0] + (idx === cursor ? (active ? ' focus' : ' sel') : '');
      r.el.setAttribute('data-i', idx);       // list index, for mouse clicks in the desktop preview
      fill(r, list[idx], idx);
    }
  }

  function setLogo(r, src) {
    if (r.src === src) return;
    r.src = src;
    r.logo.style.visibility = src ? 'visible' : 'hidden';
    if (src) r.logo.src = src; else r.logo.removeAttribute('src');
  }

  function guide(show) { Util.show($('guide'), show); }

  function groups(list, cursor, active) {
    renderList(groupRows, list, cursor, active, function (r, g) {
      r.n.textContent = '';
      setLogo(r, '');
      r.t.textContent = g.name;
      r.s.textContent = g.items.length;
    });
  }

  function channels(list, cursor, active, all, playingIdx, favs) {
    renderList(rows, list, cursor, active, function (r, chIdx) {
      var ch = all[chIdx];
      var now = EPG.upcoming(ch.id, 1)[0];
      r.n.textContent = ch.num;
      setLogo(r, ch.logo);
      r.t.textContent = (favs[ch.url] ? '★ ' : '') + ch.name + (chIdx === playingIdx ? '  ▶' : '');
      r.s.textContent = ch.dead ? 'отключён провайдером' : (now ? now.title : '');
    });
  }

  function programs(title, list, cursor, active, nowMs, archive) {
    $('d-title').textContent = title;
    renderList(progRows, list, cursor, active, function (r, p) {
      var past = p.stop <= nowMs, live = p.start <= nowMs && p.stop > nowMs;
      r.n.textContent = Util.hhmm(new Date(p.start));
      setLogo(r, '');
      r.t.textContent = p.title;
      r.s.textContent = live ? 'в эфире' : (past && archive ? '● архив' : '');
      r.el.className += past ? ' past' : '';
    });
  }

  function banner(ch, line1, line2, progress, extra) {
    $('b-num').textContent = ch.num;
    $('b-logo').style.visibility = ch.logo ? 'visible' : 'hidden';
    if (ch.logo) $('b-logo').src = ch.logo;
    $('b-title').textContent = ch.name + (extra ? '   ·   ' + extra : '');
    $('b-now').textContent = line1 || '';
    $('b-next').textContent = line2 || '';
    $('b-progress').style.width = Math.max(0, Math.min(100, progress || 0)) + '%';
    $('b-clock').textContent = Util.hhmm(new Date());
    Util.show($('banner'), true);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { Util.show($('banner'), false); }, CONFIG.BANNER_MS);
  }
  function hideBanner() { Util.show($('banner'), false); }

  function toast(text, ms) {
    $('toast').textContent = text;
    Util.show($('toast'), true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { Util.show($('toast'), false); }, ms || 2500);
  }

  function spinner(on) { Util.show($('spinner'), on); }
  function numEntry(text) { $('numentry').textContent = text; Util.show($('numentry'), !!text); }
  function fatal(text) { $('fatal').textContent = text; Util.show($('fatal'), !!text); }

  return {
    init: init, guide: guide, groups: groups, channels: channels, programs: programs,
    banner: banner, hideBanner: hideBanner, toast: toast, spinner: spinner, numEntry: numEntry, fatal: fatal
  };
}());
