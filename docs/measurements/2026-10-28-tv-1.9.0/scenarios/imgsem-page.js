// Image semantics the logo design depends on, measured in the page (desktop Chrome and the TV's Chromium 47).
// window.__imgsem(aUrl, slowUrl, wUrl, done): aUrl a picture that loads, slowUrl one that does not arrive within 150 ms
// (desktop: a 1.5 s server; TV: a blackhole address), wUrl a fast picture (a query is appended to each to make it new).
// Checks:
//  Q1 swap:   an <img> showing A gets src = B (B slow): does it keep painting A until B arrives? (naturalWidth, complete)
//  Q2 clear:  removeAttribute('src') then src = B in one task: is A gone at once (naturalWidth 0)?
//  Q3 warm:   a URL loaded by a kept Image(): a NEW <img> given that src — complete synchronously (same-frame paint)?
//  Q4 dropped: the same after the only holder was let go and 50 pictures more were loaded (memory cache kept it?)
//  Q5 decode: img.decode present? createImageBitmap present?
// ES5 only (Chromium 47).
window.__imgsem = function (aUrl, slowUrl, wUrl, done) {
  var r = {}, box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:100px;z-index:99999;background:#000';
  document.body.appendChild(box);
  function img() { var i = document.createElement('img'); i.style.cssText = 'width:72px;height:48px'; box.appendChild(i); return i; }
  function later(ms, fn) { setTimeout(fn, ms); }
  var a = img();
  a.onload = function () {
    r.a = { w: a.naturalWidth, complete: a.complete };
    a.onload = null;
    a.src = slowUrl + '?q1=' + Date.now();          // Q1
    r.q1_sync = { w: a.naturalWidth, complete: a.complete };
    later(150, function () {
      r.q1_150ms = { w: a.naturalWidth, complete: a.complete };
      var b = img();
      b.onload = function () {
        b.onload = null;
        b.removeAttribute('src'); b.src = slowUrl + '?q2=' + Date.now();   // Q2
        r.q2_sync = { w: b.naturalWidth, complete: b.complete };
        later(150, function () {
          r.q2_150ms = { w: b.naturalWidth, complete: b.complete };
          var warmUrl = wUrl + '?q3=' + Date.now(), keep = new Image();
          keep.onload = function () {
            var c = img(); c.src = warmUrl;                                         // Q3
            r.q3_sync = { complete: c.complete, w: c.naturalWidth };
            var t0 = performance.now(); c.onload = function () { r.q3_onloadMs = Math.round(performance.now() - t0); };
            var dropUrl = wUrl + '?q4=' + Date.now(), held = new Image();
            held.onload = function () {
              held = null;                                                          // Q4: let go, load 50 more
              var n = 0;
              for (var k = 0; k < 50; k++) { var x = new Image(); x.onload = x.onerror = function () { if (++n === 50) q4(); }; x.src = wUrl + '?fill=' + k + '_' + Date.now(); }
              function q4() {
                var d = img(); d.src = dropUrl;
                r.q4_sync = { complete: d.complete, w: d.naturalWidth };
                r.q5 = { decode: typeof d.decode, createImageBitmap: typeof window.createImageBitmap, ua: navigator.userAgent };
                later(300, function () { document.body.removeChild(box); done(r); });
              }
            };
            held.src = dropUrl;
          };
          keep.src = warmUrl;
        });
      };
      b.src = aUrl + '?b=' + Date.now();
    });
  };
  a.src = aUrl + '?a=' + Date.now();
};
