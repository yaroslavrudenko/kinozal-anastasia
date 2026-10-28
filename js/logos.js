// Channel logos: every picture is requested once in the app's life and kept, so a row (or the banner) that shows it
// again shows it at once, in the frame its name is drawn in — logos behave like the names (owner, 2026-10-28: «как
// будто они были и есть»). A picture not loaded yet leaves its box empty (the box is fixed: nothing moves) and appears
// when it arrives; another channel's picture is never shown in its place. A logo that fails (404, a host that does not
// answer within LOGO_TIMEOUT_MS) is asked for again once per hourly list, never within the hour
// (DEC-2026-10-28-logo-retry-hourly: a passing failure — Wi-Fi not up after standby — is not kept for the page's life).
var Logos = (function () {
  var OK = 1, BAD = 2;
  var state = Util.dict();        // url -> OK | BAD | the Image loading it
  var kept = Util.dict();         // url -> the loaded Image: keeps the picture in the page's memory cache
  var used = Util.dict(), keptN = 0, tick = 0;   // url -> last use (eviction order), how many are kept
  var wishes = Util.dict(), inFlight = 0, imgs = [];      // consumer -> { urls, i, open }: each consumer replaces only its own

  // The one way a logo is put into an <img>: shown when loaded, else its box empty until it is. key: the channel the
  // <img> shows (a pooled row passes from channel to channel); the same channel's previous picture stays until a new URL
  // of its logo has arrived (an hourly list that changed it) — another channel's never does, even when both want the
  // same URL (review 7, Codex C7-1).
  function put(img, url, key) {
    var same = !!key && img.logoKey === key;
    if (img.logoWant === url && same) return;
    img.logoWant = url;
    img.logoKey = key;
    if (url && state[url] === OK) { used[url] = ++tick; if (img.getAttribute('src') !== url) img.src = url; img.style.visibility = 'inherit'; }
    else if (!same || !url || state[url] === BAD) img.style.visibility = 'hidden';
  }
  function track(img) { img.onerror = Util.hideBrokenImage; imgs.push(img); }

  // The pictures a consumer (a list column, the banner) wants now, most urgent first; it replaces that consumer's previous
  // wish only (pictures not started yet are dropped, pictures on their way finish into the map) — the banner's logo and
  // the menu's page never drop each other (review 7, F3, R7-P2). open(): false once the screen asking has gone.
  function want(who, urls, open) { wishes[who] = { urls: urls, i: 0, open: open }; pump(); }
  // The banner's one logo first, then the lists'.
  function pump() { serve('banner'); for (var who in wishes) serve(who); }
  function serve(who) {
    var w = wishes[who];
    if (!w) return;
    if (w.open && !w.open()) w.i = w.urls.length;
    while (inFlight < CONFIG.LOGO_PARALLEL && w.i < w.urls.length) { var url = w.urls[w.i++]; if (url && !state[url]) load(url); }
    if (w.i >= w.urls.length) delete wishes[who];
  }
  function load(url) {
    var im = new Image();
    state[url] = im;
    inFlight++;
    // A host that does not answer holds a slot until the browser gives up (minutes): after LOGO_TIMEOUT_MS the download is
    // given up, its slot freed, and the URL waits for the next hourly list like a failure (review 7, F2; PF-13 T3).
    var timer = setTimeout(function () { im.onload = im.onerror = null; drop(url, im); done(url, im, false); }, CONFIG.LOGO_TIMEOUT_MS);
    im.onload = function () { clearTimeout(timer); done(url, im, true); };
    im.onerror = function () { clearTimeout(timer); done(url, im, false); };
    im.src = url;
    // The rows waiting for it load it too (the same download): each paints it the moment it arrives, without
    // waiting for this script; their earlier picture is dropped first, so it never shows in its place. (One still showing
    // its channel's previous picture keeps it until this one has arrived: done().)
    for (var i = 0; i < imgs.length; i++) if (imgs[i].logoWant === url && imgs[i].style.visibility === 'hidden') { imgs[i].removeAttribute('src'); imgs[i].src = url; imgs[i].style.visibility = 'inherit'; }
  }
  // Every element sharing the download lets it go, so the browser can close it.
  function drop(url, im) {
    im.removeAttribute('src');
    for (var i = 0; i < imgs.length; i++) if (imgs[i].getAttribute('src') === url) imgs[i].removeAttribute('src');
  }
  function done(url, im, ok) {
    inFlight--;
    if (state[url] !== im) { pump(); return; }   // forgotten meanwhile (the list dropped it)
    state[url] = ok ? OK : BAD;
    if (ok) { kept[url] = im; used[url] = ++tick; if (++keptN > CONFIG.LOGO_KEEP) evict(); }
    for (var i = 0; i < imgs.length; i++) if (imgs[i].logoWant === url) { imgs[i].logoWant = null; put(imgs[i], url, imgs[i].logoKey); }
    pump();
  }
  // The least recently shown pictures beyond the limit are let go (the HTTP cache still has them).
  function evict() {
    var urls = Object.keys(kept).sort(function (a, b) { return used[a] - used[b]; });
    for (var i = 0; i < urls.length - CONFIG.LOGO_KEEP + CONFIG.LOGO_EVICT; i++) forget(urls[i]);
  }
  function forget(url) { if (kept[url]) keptN--; delete kept[url]; delete used[url]; delete state[url]; }
  // A new list: what it no longer has is forgotten; an unchanged URL keeps its picture (no request); a URL that failed
  // is forgotten too, so it is asked for once more when it is wanted (DEC-2026-10-28-logo-retry-hourly).
  function retain(channels) {
    var live = Util.dict();
    for (var i = 0; i < channels.length; i++) if (channels[i].logo) live[channels[i].logo] = 1;
    for (var url in state) if (!live[url] || state[url] === BAD) forget(url);
  }

  return { put: put, track: track, want: want, retain: retain, ready: function (url) { return state[url] === OK; } };
}());
