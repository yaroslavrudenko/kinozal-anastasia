// Shared in-page instrumentation for the perf-degradation scenarios (ES5 inside the page; Chromium 47, no awaitPromise).
// window.__Q: a timeline of what ran on the main thread while a key sequence plays, plus every animation frame.
//   ev: [label, t, ms, extra] — t in ms from the sequence start (page clock).
//   Labels: key (the keydown handler: the app's whole JS for the key), ListView.columns, ListRows.fill, Logos.put,
//   Logos.want, NowLines.update, UI.scrollBar, I18n.otherDir, idle (Util.idle callbacks), timeout / interval (timers
//   >= 0.5 ms), xhr (Net.get answers), img.start (a Logos download started), logo.done / logo.fail (Logos' onload /
//   onerror handler), row.img.load (a row's <img> finished loading = its picture can be painted), busy (ping mode:
//   a main-thread stretch > 8 ms seen by a MessageChannel heartbeat).
export const INSTALL = `(function () {
  if (window.__Q) return 'had';
  var Q = window.__Q = { on: false, t0: 0, ev: [], raf: [], keys: [], restore: [], done: false };
  var oST = window.setTimeout, oSI = window.setInterval;
  function now() { return performance.now(); }
  function r(t) { return Math.round((t - Q.t0) * 10) / 10; }
  function push(label, s, d, x) { Q.ev.push([label, r(s), Math.round(d * 100) / 100, x === undefined ? '' : x]); }
  function src(fn) { return String(fn).replace(/\\s+/g, ' ').slice(0, 60); }
  function wrap(obj, name, label) {
    if (!obj || typeof obj[name] !== 'function') return;
    var f = obj[name];
    obj[name] = function () { if (!Q.on) return f.apply(this, arguments); var s = now(); try { return f.apply(this, arguments); } finally { push(label, s, now() - s); } };
    Q.restore.push(function () { obj[name] = f; });
  }
  wrap(ListView, 'columns', 'ListView.columns'); wrap(ListRows, 'fill', 'ListRows.fill');
  if (window.Logos) { wrap(Logos, 'put', 'Logos.put'); wrap(Logos, 'want', 'Logos.want'); }
  wrap(NowLines, 'update', 'NowLines.update'); wrap(UI, 'scrollBar', 'UI.scrollBar');
  if (window.I18n && I18n.otherDir) wrap(I18n, 'otherDir', 'I18n.otherDir');
  function timed(kind, fn) {
    return function () {
      if (!Q.on) return fn.apply(this, arguments);
      var s = now();
      try { return fn.apply(this, arguments); } finally { var d = now() - s; if (kind === 'idle' || d >= 0.5) push(kind, s, d, src(fn)); }
    };
  }
  var oi = Util.idle;
  Util.idle = function (fn, to) { return oi.call(Util, timed('idle', fn), to); };
  Q.restore.push(function () { Util.idle = oi; });
  window.setTimeout = function (fn, ms) { if (typeof fn !== 'function') return oST.apply(window, arguments); var a = Array.prototype.slice.call(arguments, 2), w = timed('timeout', fn); return oST.call(window, function () { return w.apply(this, a); }, ms); };
  window.setInterval = function (fn, ms) { if (typeof fn !== 'function') return oSI.apply(window, arguments); var a = Array.prototype.slice.call(arguments, 2), w = timed('interval', fn); return oSI.call(window, function () { return w.apply(this, a); }, ms); };
  Q.restore.push(function () { window.setTimeout = oST; window.setInterval = oSI; });
  var og = Net.get;
  Net.get = function (req, done) { return og.call(Net, req, timed('xhr', done)); };
  Q.restore.push(function () { Net.get = og; });
  // Logos' downloads: the start, and the time its own onload / onerror handler takes (done(): state, kept, the rows put).
  function hook(im, type, label) {
    var h = null;
    try {
      Object.defineProperty(im, 'on' + type, { configurable: true, enumerable: true, get: function () { return h; }, set: function (f) { h = f; } });
      im.addEventListener(type, function (e) { if (!h) return; var s = now(); try { h.call(im, e); } finally { if (Q.on) push(label, s, now() - s); } });
    } catch (e) { Q.hookFailed = String(e); }
  }
  var RI = window.Image;
  var WI = function () { var im = new RI(); if (Q.on) push('img.start', now(), 0); hook(im, 'load', 'logo.done'); hook(im, 'error', 'logo.fail'); return im; };
  WI.prototype = RI.prototype; window.Image = WI;
  Q.restore.push(function () { window.Image = RI; });
  // A row's <img> (or the banner's) finishing its load: from then on its picture can be painted.
  var onLoad = function (e) { var t = e.target; if (Q.on && t && t.tagName === 'IMG') push(t.className === 'logo' ? 'row.img.load' : 'img.load', now(), 0); };
  document.addEventListener('load', onLoad, true);
  Q.restore.push(function () { document.removeEventListener('load', onLoad, true); });
  // The user-visible part, every animation frame: channel rows on screen whose channel has a logo URL but whose logo box
  // shows no picture (empty), and boxes that went from empty to painted while the same channel stayed in the same row
  // (a logo seen arriving). Build-agnostic: the URL comes from the row's number (Channels.byNum), not from the logo code.
  var rowsEl = document.getElementById('channels'), guide = document.getElementById('guide'), urlByNum = {};
  function rowUrl(t) { var u = urlByNum[t]; if (u === undefined) { var ch = t ? Channels.byNum(+t) : null; u = urlByNum[t] = ch && ch.logo ? ch.logo : ''; } return u; }
  function scan(t) {
    if (!rowsEl || !guide || guide.className.indexOf('hidden') >= 0) { Q.vis.push([t, -1]); return; }
    var rs = rowsEl.children, empty = 0;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (r.style.visibility === 'hidden') { r.__lv = -1; continue; }
      var num = r.children[0] ? r.children[0].textContent : '', u = rowUrl(num);
      if (!u) { r.__lv = -1; continue; }
      var im = r.children[1], ok = !!im && im.getAttribute('src') === u && im.complete && im.naturalWidth > 0 && im.style.visibility !== 'hidden';
      if (!ok) empty++;
      if (ok && r.__ln === num && r.__lv === 0) Q.arrived.push(t);
      r.__ln = num; r.__lv = ok ? 1 : 0;
    }
    Q.vis.push([t, empty]);
  }
  function heartbeat() {
    var ch = new MessageChannel(), last = now();
    ch.port1.onmessage = function () { var t = now(); if (t - last > 8) push('busy', last, t - last); last = t; if (Q.on) ch.port2.postMessage(0); };
    ch.port2.postMessage(0);
  }
  // Plays the key codes 'interval' ms apart from inside the page (one clock, no CDP round trips), then waits 'settle' ms
  // with the frames and the main thread still recorded (the pictures arriving after the keys).
  window.__seq = function (codes, interval, settle, ping, stamp) {
    Q.ev = []; Q.raf = []; Q.keys = []; Q.vis = []; Q.arrived = []; Q.done = false; Q.t0 = now(); Q.on = true;
    if (ping) heartbeat();
    if (stamp && console.timeStamp) console.timeStamp('SEQ_START');
    (function loop() { if (!Q.on) return; var t = r(now()); Q.raf.push(t); scan(t); requestAnimationFrame(loop); })();
    var i = 0;
    function one() {
      var code = codes[i++], rec = { k: code }, e = document.createEvent('Event');
      e.initEvent('keydown', true, true); e.keyCode = code;
      var s = now(); rec.t = r(s);
      document.dispatchEvent(e);
      rec.js = Math.round((now() - s) * 10) / 10;
      Q.keys.push(rec);
      requestAnimationFrame(function () { requestAnimationFrame(function () { rec.r2 = Math.round((now() - s) * 10) / 10; }); });
      if (i < codes.length) oST.call(window, one, interval); else oST.call(window, finish, settle);
    }
    function finish() { Q.on = false; if (stamp && console.timeStamp) console.timeStamp('SEQ_END'); Q.done = true; }
    one();
    return codes.length;
  };
  window.__collect = function () { return Q.done ? { ev: Q.ev, raf: Q.raf, keys: Q.keys, vis: Q.vis, arrived: Q.arrived, hookFailed: Q.hookFailed || null } : null; };
  window.__unwrap = function () { while (Q.restore.length) Q.restore.pop()(); delete window.__Q; delete window.__seq; delete window.__collect; delete window.__unwrap; return 'restored'; };
  return 'ok';
})()`;

// Variants: in-page toggles applied before the first key, removed at the end. Each returns a cleanup into window.__VR.
export const VARIANTS = {
  nowant: `if(window.Logos){var w=Logos.want;Logos.want=function(){};__VR.push(function(){Logos.want=w})}`,
  csshide: `(function(){var st=document.createElement('style');st.textContent='.row .logo{visibility:hidden !important}';document.head.appendChild(st);__VR.push(function(){st.parentNode.removeChild(st)})})()`,
  // The 1.8.4 text layout: no nested flex in the text cells (the cells' children laid out inline, as one block).
  noflex: `(function(){var st=document.createElement('style');st.textContent='.row .t,.row .s,.grow .t,.prow .t{display:block !important}.t>i,.x{display:inline !important}';document.head.appendChild(st);__VR.push(function(){st.parentNode.removeChild(st)})})()`,
  nodir: `if(window.I18n&&I18n.otherDir){var od=I18n.otherDir;I18n.otherDir=function(){return ''};__VR.push(function(){I18n.otherDir=od})}`,
};

export async function applyVariants(c, opt) {
  const list = Object.keys(VARIANTS).filter((k) => opt.has(k));
  await c.ev(`(function(){window.__VR=[];${list.map((k) => VARIANTS[k]).join(';')};return __VR.length})()`);
  return list;
}
export const removeVariants = (c) => c.ev('(function(){var n=0;while(window.__VR&&__VR.length){__VR.pop()();n++}delete window.__VR;return n})()');

export async function runSeq(c, codes, interval, settle, opt) {
  await c.ev(`__seq(${JSON.stringify(codes)},${interval},${settle},${opt.has('ping') ? 1 : 0},1)`);
  const wait = codes.length * interval + settle + 3000;
  for (let t = 0; t < wait + 10000; t += 100) { await c.sleep(100); const r = await c.ev('__collect()'); if (r) return r; }
  return null;
}

const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const r1 = (x) => Math.round(x * 10) / 10;
// Per phase: key → 2nd frame; every frame gap > 34 ms with what ran in it; totals; the heartbeat's long stretches.
export function summarize(res, gapMs = 34) {
  const keys = res.keys.map((k) => k.r2);
  const js = res.keys.map((k) => k.js);
  const bucket = (a, b) => {
    const o = {};
    for (const [l, t, ms] of res.ev) if (t >= a && t < b && l !== 'busy') { const x = o[l] || (o[l] = [0, 0]); x[0]++; x[1] += ms; }
    for (const k of res.keys) if (k.t >= a && k.t < b) { const x = o.key || (o.key = [0, 0]); x[0]++; x[1] += k.js; }
    return Object.entries(o).sort((p, q) => q[1][1] - p[1][1]).map(([l, [n, ms]]) => `${l}×${n}=${r1(ms)}`).join(' ');
  };
  const gaps = [];
  for (let i = 1; i < res.raf.length; i++) { const g = res.raf[i] - res.raf[i - 1]; if (g > gapMs) gaps.push({ at: res.raf[i - 1], ms: r1(g), ran: bucket(res.raf[i - 1], res.raf[i]) }); }
  const tot = {};
  for (const [l, , ms] of res.ev) { const x = tot[l] || (tot[l] = [0, 0]); x[0]++; x[1] += ms; }
  const busy = res.ev.filter((e) => e[0] === 'busy' && e[2] > gapMs).map((e) => ({ at: e[1], ms: r1(e[2]), ran: bucket(e[1], e[1] + e[2]) }));
  const lastKey = res.keys.length ? res.keys[res.keys.length - 1].t : 0;
  return {
    keys: keys.length, medianMs: med(keys), maxMs: Math.max(...keys), all: keys.join(' '), keyJsMedian: med(js), keyJsMax: Math.max(...js),
    framesOver34: gaps.length, framesOver34AfterKeys: gaps.filter((g) => g.at > lastKey + 100).length,
    longestGap: gaps.length ? Math.max(...gaps.map((g) => g.ms)) : 0,
    totals: Object.fromEntries(Object.entries(tot).map(([l, [n, ms]]) => [l, `${n}/${r1(ms)}ms`])),
    worstGaps: gaps.sort((a, b) => b.ms - a.ms).slice(0, 8),
    busyOver34: busy.sort((a, b) => b.ms - a.ms).slice(0, 8),
    hookFailed: res.hookFailed,
    visible: visible(res, lastKey),
  };
}

// The user-visible metric: frames with the menu up in which a row on screen shows an empty logo box although its channel
// has a logo, how many boxes at most, the row·frames summed, logos seen arriving (empty → painted in place), and how
// long after the last key the screen first had every logo painted (null: never within the phase).
function visible(res, lastKey) {
  const v = (res.vis || []).filter((x) => x[1] >= 0);
  const withEmpty = v.filter((x) => x[1] > 0);
  const after = v.filter((x) => x[0] >= lastKey);
  const firstFull = after.find((x) => x[1] === 0);
  return { framesMenuUp: v.length, framesWithEmptyBox: withEmpty.length, maxEmptyBoxes: v.length ? Math.max(...v.map((x) => x[1])) : 0,
    emptyBoxFrames: v.reduce((p, x) => p + x[1], 0), logosSeenArriving: (res.arrived || []).length,
    allPaintedMsAfterLastKey: firstFull ? r1(firstFull[0] - lastKey) : null, emptyAtEnd: v.length ? v[v.length - 1][1] : null };
}

// ---- Tracing (Chromium 47 timeline names; matched loosely) ----
export const TRACE_CATS = 'devtools.timeline,disabled-by-default-devtools.timeline,toplevel,blink.console,cc,disabled-by-default-cc.debug';
export function startTrace(c) {
  const events = []; let done;
  const finished = new Promise((res) => { done = res; });
  c.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...(m.params.value || [])); if (m.method === 'Tracing.tracingComplete') done(); });
  return c.call('Tracing.start', { categories: TRACE_CATS, options: 'record-as-much-as-possible', bufferUsageReportingInterval: 1000 })
    .then((r) => (r && r.__error ? { error: r.__error } : { events, finished }));
}
export function traceSummary(events) {
  const names = {}; for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args && e.args.name;
  const stamp = (m) => events.find((e) => e.name === 'TimeStamp' && e.args && e.args.data && e.args.data.message === m);
  const s0 = stamp('SEQ_START'), s1 = stamp('SEQ_END');
  if (!s0) return { error: 'no SEQ_START TimeStamp in the trace', events: events.length, threads: names };
  const main = s0.pid + ':' + s0.tid, a = s0.ts, b = s1 ? s1.ts : a + 30e6;
  const iv = [], open = {};
  for (const e of events.slice().sort((x, y) => x.ts - y.ts)) {
    const th = e.pid + ':' + e.tid;
    if (e.ph === 'X') iv.push({ th, name: e.name, s: e.ts, e: e.ts + (e.dur || 0) });
    else if (e.ph === 'B') (open[th] || (open[th] = [])).push(e);
    else if (e.ph === 'E') { const x = (open[th] || []).pop(); if (x) iv.push({ th, name: x.name, s: x.ts, e: e.ts }); }
  }
  const win = iv.filter((x) => x.e > a && x.s < b);
  const tname = (th) => (th === main ? 'main' : names[th] || th);
  const RE = /Decode|Resize|Raster|Paint|Image|GC|Layout|Recalc|UpdateLayoutTree|UpdateLayer|Composite|Style|Draw|Commit|BeginFrame|FireAnimationFrame|FunctionCall|EventDispatch|TimerFire|FireIdleCallback|Resource/;
  const agg = {};
  for (const x of win) { if (!RE.test(x.name)) continue; const k = tname(x.th) + ' | ' + x.name; const o = agg[k] || (agg[k] = []); o.push((x.e - x.s) / 1000); }
  const stats = Object.entries(agg).map(([k, v]) => { const s = v.slice().sort((p, q) => p - q); return [k, v.length, r1(v.reduce((p, q) => p + q, 0)), r1(s[Math.floor(s.length / 2)]), r1(s[s.length - 1])]; })
    .sort((p, q) => q[2] - p[2]).slice(0, 50);
  // Main-thread tasks longer than 34 ms and their largest children.
  const tasks = win.filter((x) => x.th === main && /RunTask|ProcessTaskFromWorkQueue|MessageLoop/.test(x.name) && x.e - x.s > 34000);
  const longTasks = tasks.slice(0, 30).map((t) => {
    const kids = win.filter((x) => x.th === main && x !== t && x.s >= t.s && x.e <= t.e && !/RunTask|ProcessTaskFromWorkQueue|MessageLoop/.test(x.name) && x.e - x.s > 1000)
      .sort((p, q) => (q.e - q.s) - (p.e - p.s)).slice(0, 6).map((x) => `${x.name} ${r1((x.e - x.s) / 1000)}`);
    return { at: r1((t.s - a) / 1000), ms: r1((t.e - t.s) / 1000), top: kids };
  });
  // Every thread's busiest stretches > 34 ms (the compositor and raster threads too).
  const perThread = {};
  for (const x of win) if (/RunTask|ProcessTaskFromWorkQueue|MessageLoop/.test(x.name) && x.e - x.s > 34000) { const k = tname(x.th); (perThread[k] || (perThread[k] = [])).push(r1((x.e - x.s) / 1000)); }
  return { mainThread: main + ' ' + (names[main] || ''), windowMs: r1((b - a) / 1000), headline: '[thread | event, count, total ms, median ms, max ms]', stats, longMainTasks: longTasks, tasksOver34ByThread: perThread, threads: Object.values(names) };
}

export async function stopTrace(c, tr, file, fs) {
  await c.call('Tracing.end');
  await Promise.race([tr.finished, c.sleep(30000)]);
  fs.writeFileSync(file, JSON.stringify(tr.events));
  return traceSummary(tr.events);
}
