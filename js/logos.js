// Channel logos: every picture is requested once in the app's life and kept, so a row (or the banner) that shows it
// again shows it at once, in the frame its name is drawn in — logos behave like the names (owner, 2026-10-28: «как
// будто они были и есть»). A picture not loaded yet leaves its box empty (the box is fixed: nothing moves) and appears
// when it arrives; another channel's picture is never shown in its place. A logo that fails (404, a host that does not
// answer within LOGO_TIMEOUT_MS) is asked for again once per hourly list, never within the hour
// (DEC-2026-10-28-logo-retry-hourly: a passing failure — Wi-Fi not up after standby — is not kept for the page's life).
// What loads, and when (DEC-2026-10-28-logos-ahead; owner: «не видеть, как дозагружаются иконки … частями, не всё
// сразу»): the list on screen asks for its page, the two pages ahead and the one behind on every move (no dwell); the zap
// group's logos trickle in at idle after the first picture (before the menu is opened) and the group highlighted in the
// menu goes first among them; a zap pauses the trickle LOGO_ZAP_PAUSE_MS. Downloads start only in idle slots, at most
// LOGO_STARTS_PER_SLOT per slot and LOGO_PARALLEL at once; pictures that arrive together go into the rows on screen at
// most LOGO_PUTS_PER_FRAME per frame; rows of a screen not shown get theirs when they are drawn.
var Logos = (function () {
  var OK = 1, BAD = 2;
  var state = Util.dict();        // url -> OK | BAD | the Image loading it
  var kept = Util.dict();         // url -> the loaded Image: keeps the picture in the page's memory cache
  var used = Util.dict(), keptN = 0, tick = 0;   // url -> last use (eviction order), how many are kept
  var best = Util.dict();          // url -> the highest place a trickle gave it while not loaded yet (P-4)
  var pins = {};                   // trickle -> the page its list opens on (its wish's head): never let go (CODEX-1)
  var wishes = Util.dict(), inFlight = 0, imgs = [];      // consumer -> { urls, i, open }: each consumer replaces only its own
  var started = false, slotAsked = false, wakeTimer = null, holdUntil = 0, paintQ = [], painting = false;
  // Who is served first (DEC-2026-10-28-logos-ahead): the banner, the list on screen (its page, the two pages ahead, the
  // page behind — in its wish's order), then the trickles: the group highlighted in the menu, then the zap group.
  // A consumer missing here would never be served (and keep the idle slots asking): want() refuses it (P-2). Basic's list
  // ('clist') ranks with the lists on screen; its cards' first pages ('cards') with the trickles, after the highlighted group.
  var ORDER = ['banner', 'channels', 'clist', 'search', 'highlight', 'cards', 'group'], TRICKLE = { highlight: 1, cards: 1, group: 1 };
  var frame = window.requestAnimationFrame ? function (fn) { window.requestAnimationFrame(fn); } : function (fn) { setTimeout(fn, 16); };

  // The one way a logo is put into an <img>: shown when loaded, else its box empty until it is. key: the channel the
  // <img> shows (a pooled row passes from channel to channel); the same channel's previous picture stays until a new URL
  // of its logo has arrived (an hourly list that changed it) — another channel's never does, even when both want the
  // same URL (review 7, Codex C7-1). A picture that arrived while its row was not on screen is given to it here.
  // O(1) and no DOM read: the <img>'s src and visibility are mirrored on it (logoSrc, logoVis), and written only when they
  // change — a page key puts 13 rows, most of them unchanged (TV: cold CH− paging, fix batch 8).
  function put(img, url, key) {
    var same = !!key && img.logoKey === key, ok = !!url && state[url] === OK;
    if (img.logoWant === url && same && (!ok || img.logoSrc === url)) return;
    img.logoWant = url;
    img.logoKey = key;
    if (ok) { used[url] = ++tick; if (img.logoSrc !== url) { img.logoSrc = url; img.src = url; } vis(img, 'inherit'); }
    else if (!same || !url || state[url] === BAD) vis(img, 'hidden');
  }
  function vis(img, v) { if (img.logoVis !== v) { img.logoVis = v; img.style.visibility = v; } }
  // shown(): whether the screen holding the <img> is on screen; one that is not gets no picture until it is drawn again.
  // A picture that does not load is hidden, its box kept (as Util.hideBrokenImage), through the mirror.
  function track(img, shown) {
    img.logoSrc = img.getAttribute('src') || '';
    img.onerror = function () { vis(this, 'hidden'); };
    img.logoShown = shown || null;
    imgs.push(img);
  }

  // The pictures a consumer (a list column, the banner, a trickle) wants now, most urgent first: an array, or a function
  // giving it (looked up in idle time, so a key's task stays O(1)). It replaces that consumer's previous wish only
  // (pictures not started yet are dropped, pictures on their way finish into the map) — the banner's logo and the menu's
  // page never drop each other (review 7, F3, R7-P2). open(): false once the screen asking has gone. No download starts
  // here: they start in idle slots (slot()), never in the task of a key.
  function want(who, urls, open) {
    if (ORDER.indexOf(who) < 0) throw new Error('Logos.want: unknown consumer ' + who);
    wishes[who] = { urls: urls, i: 0, open: open }; ask();
  }
  // A zap or a stream start: the trickles wait LOGO_ZAP_PAUSE_MS so the stream has the network first.
  function hold() { holdUntil = Date.now() + CONFIG.LOGO_ZAP_PAUSE_MS; }
  // Nothing loads before the list is applied and the first picture is on screen (or a screen of logos is opened): the
  // boot and the stream start have the network and the thread (fix batch 8: the TV's reload was 290 ms behind 1.8.4).
  function start() { if (!started) { started = true; ask(); } }
  function ask() { if (started && !slotAsked) { slotAsked = true; Util.idle(slot); } }
  // One idle slot: at most LOGO_STARTS_PER_SLOT downloads start, at most LOGO_PARALLEL in flight — a burst of 26 no
  // longer lands on the frames of the next keys (owner: «меню не тормозило и не подвисало на дозагрузках»).
  function slot(d) {
    slotAsked = false;
    if (d && !d.didTimeout && d.timeRemaining() < CONFIG.LOGO_SLOT_MIN_MS) { ask(); return; }
    var budget = CONFIG.LOGO_STARTS_PER_SLOT, k;
    for (k = 0; k < ORDER.length; k++) budget = serve(ORDER[k], budget);
    var more = false, held = false;
    for (var who in wishes) { if (TRICKLE[who] && Date.now() < holdUntil) held = true; else more = true; }
    if (more && inFlight < CONFIG.LOGO_PARALLEL) ask();
    if (held && !wakeTimer) wakeTimer = setTimeout(function () { wakeTimer = null; ask(); }, holdUntil - Date.now() + 1);
  }
  function serve(who, budget) {
    var w = wishes[who];
    if (!w || budget <= 0 || TRICKLE[who] && Date.now() < holdUntil) return budget;
    if (w.open && !w.open()) { delete wishes[who]; return budget; }
    if (typeof w.urls === 'function') w.urls = w.urls();
    if (TRICKLE[who] && w.rank === undefined) pins[who] = w.urls.slice(0, CONFIG.VISIBLE_ROWS);   // its opening page: never let go
    // A trickle's pictures are kept by their place in it, not by when they came: its first ones (the page the menu opens on)
    // are let go last, its far end first — one it finds loaded already is raised to its place (P-4: a trickle of
    // LOGO_GROUP_MAX on a longer list used to let its own first page go).
    if (TRICKLE[who] && w.rank === undefined) { w.rank = tick + w.urls.length + 1; tick = w.rank; }
    while (budget > 0 && inFlight < CONFIG.LOGO_PARALLEL && w.i < w.urls.length) {
      var url = w.urls[w.i++], rank = w.rank ? w.rank - w.i : 0;
      if (!url) continue;
      if (rank && state[url] === OK) { if (used[url] < rank) used[url] = rank; continue; }
      if (rank && state[url] !== BAD && !(best[url] >= rank)) best[url] = rank;   // new or on its way: kept by its best place when it comes
      if (!state[url]) { load(url); budget--; }
    }
    if (w.i >= w.urls.length) delete wishes[who];
    return budget;
  }
  function load(url) {
    var im = new Image();
    state[url] = im;
    inFlight++;
    // A host that does not answer holds a slot until the browser gives up (minutes): after LOGO_TIMEOUT_MS the download is
    // given up, its slot freed, and the URL waits for the next hourly list like a failure (review 7, F2; PF-13 T3).
    var timer = setTimeout(function () { im.onload = im.onerror = null; im.removeAttribute('src'); done(url, im, false); }, CONFIG.LOGO_TIMEOUT_MS);
    im.onload = function () { clearTimeout(timer); done(url, im, true); };
    im.onerror = function () { clearTimeout(timer); done(url, im, false); };
    im.src = url;
  }
  // A download finished: the <img>s on screen that want it get it — at most LOGO_PUTS_PER_FRAME per frame, so pictures
  // arriving together appear over a few frames, not in one heavy one; the others get it when they are drawn (put).
  function done(url, im, ok) {
    var rank = best[url];
    inFlight--;
    delete best[url];
    if (state[url] === im) {                       // else forgotten meanwhile (the list dropped it)
      state[url] = ok ? OK : BAD;
      if (ok) { kept[url] = im; used[url] = rank || ++tick; if (++keptN > CONFIG.LOGO_KEEP) evict(); }
      for (var i = 0; i < imgs.length; i++) if (imgs[i].logoWant === url && (!imgs[i].logoShown || imgs[i].logoShown())) paintQ.push(imgs[i]);
      if (paintQ.length && !painting) { painting = true; frame(paint); }
    }
    ask();
  }
  function paint() {
    for (var n = 0; n < CONFIG.LOGO_PUTS_PER_FRAME && paintQ.length; n++) {
      var img = paintQ.shift(), url = img.logoWant;
      if (url && state[url] && state[url] !== OK && state[url] !== BAD) continue;   // asked for something else meanwhile, still loading
      if (img.logoShown && !img.logoShown()) continue;   // its screen closed since it was queued (a late frame): put when drawn again (CODEX-6)
      img.logoWant = null;
      put(img, url, img.logoKey);
    }
    painting = paintQ.length > 0;
    if (painting) frame(paint);
  }
  // The least recently shown pictures beyond the limit are let go (the HTTP cache still has them) — never one a list's row
  // holds (the page on screen, and the page a menu was laid out on ahead, hidden, waiting to be opened: P-4), nor the page
  // a trickle's list opens on (a later trickle used to let a focused card's prefetched page go: CODEX-1).
  function evict() {
    var held = Util.dict(), i;
    for (i = 0; i < imgs.length; i++) if (imgs[i].logoShown && imgs[i].logoWant) held[imgs[i].logoWant] = 1;
    for (var who in pins) for (var k = 0; k < pins[who].length; k++) held[pins[who][k]] = 1;
    var urls = Object.keys(kept).filter(function (u) { return !held[u]; }).sort(function (a, b) { return used[a] - used[b]; });
    for (i = 0; i < urls.length && keptN > CONFIG.LOGO_KEEP - CONFIG.LOGO_EVICT; i++) forget(urls[i]);
  }
  function forget(url) { if (kept[url]) keptN--; delete kept[url]; delete used[url]; delete state[url]; }
  // A new list: what it no longer has is forgotten; an unchanged URL keeps its picture (no request); a URL that failed
  // is forgotten too, so it is asked for once more when it is wanted (DEC-2026-10-28-logo-retry-hourly).
  function retain(channels) {
    var any = false;
    for (var u in state) { any = true; break; }
    if (!any) return;                              // the first list of a page life: nothing known, nothing to walk
    var live = Util.dict();
    for (var i = 0; i < channels.length; i++) if (channels[i].logo) live[channels[i].logo] = 1;
    for (var url in state) if (!live[url] || state[url] === BAD) forget(url);
  }

  return { put: put, track: track, want: want, hold: hold, start: start, retain: retain, ready: function (url) { return state[url] === OK; } };
}());
