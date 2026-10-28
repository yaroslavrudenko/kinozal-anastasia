// Menu-open probe: splits the time from OK to the 2nd animation frame on the FIRST menu open (and on reopens) into parts.
// Run: node $S/tv5/cdp.mjs <port> $S/menu-open-probe/s-openprobe.mjs [variant...]
// Start state (set by the coordinator): a fresh launch playing channel 188 in «Кино». The menu is closed at the end, every
// wrapper and stub is removed, and the channel is not touched (no pick, no zap).
// Variants (args; any combination), applied BEFORE the first open, so each needs its own fresh launch to compare:
//   nologos  Logos.want is a no-op: the open asks for no pictures (the pictures already loaded still show)
//   nonext   Logos.want gets only the page on screen (no next-page prefetch) — what the batch-2 build did on an open
//   scale    the batch-2 focus rule is put back: .focus { transform: scale(1.02) }
//   ping     a MessageChannel heartbeat during the window: every main-thread stretch > 8 ms (a busy task or a frame)
//            with its start (perturbs a little: use in its own run)
//   trace    CDP Tracing over the first open (devtools.timeline + toplevel): main-thread events by name, longest task,
//            image decode; the raw trace is written next to this file (perturbs: use in its own run)
//   forget   adds two same-launch reopens after Logos.retain([]) (every logo state forgotten): logos on, then logos off
//            (Logos.want no-op) — an A/B of the open's logo work under identical rendering; a last normal reopen loads them again
// Times are page performance.now() ms relative to the key dispatch (t=0). No URL is printed (hosts only).
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const K = { ENTER: 13, BACK: 10009 };

const INSTALL = `(function () {
  if (window.__P) return 'had';
  var P = window.__P = { on: false, t0: 0, restore: [], ping: null };
  function now() { return performance.now(); }
  function rel(t) { return Math.round((t - P.t0) * 10) / 10; }
  P.rel = rel;
  function wrap(obj, name, label) {
    if (!obj || typeof obj[name] !== 'function') return;
    var f = obj[name];
    obj[name] = function () {
      if (!P.on) return f.apply(this, arguments);
      var s = now(); P.depth++;
      try { return f.apply(this, arguments); } finally { P.depth--; P.marks.push([label, rel(s), Math.round((now() - s) * 10) / 10, P.depth]); }
    };
    P.restore.push(function () { obj[name] = f; });
  }
  P.depth = 0;
  wrap(Overlay, 'open', 'Overlay.open'); wrap(Overlay, 'close', 'Overlay.close');
  wrap(ListView, 'columns', 'ListView.columns'); wrap(ListView, 'reset', 'ListView.reset');
  wrap(ListRows, 'fill', 'ListRows.fill'); wrap(ListRows, 'get', 'ListRows.get'); wrap(ListRows, 'hideFrom', 'ListRows.hideFrom');
  if (window.Logos) { wrap(Logos, 'put', 'Logos.put'); wrap(Logos, 'want', 'Logos.want'); }
  wrap(NowLines, 'watch', 'NowLines.watch'); wrap(NowLines, 'update', 'NowLines.update');
  wrap(UI, 'scrollBar', 'UI.scrollBar'); wrap(UI, 'show', 'UI.show'); wrap(UI, 'hideBanner', 'UI.hideBanner'); wrap(UI, 'banner', 'UI.banner');
  wrap(Overlay, 'refresh', 'Overlay.refresh');
  // Callbacks that RUN inside the window, wherever they were scheduled (idle tasks, timers, intervals, XHR answers):
  // when, how long, and the first characters of their source (to name them). Util.idle also: when it was scheduled and
  // how much idle time the browser gave it.
  function src(fn) { return String(fn).replace(/\\s+/g, ' ').slice(0, 70); }
  function timed(kind, fn, rec) {
    return function () {
      if (!P.on) return fn.apply(this, arguments);
      var s = now(), d = arguments[0];
      if (rec) { rec.start = rel(s); rec.given = d && d.timeRemaining ? Math.round(d.timeRemaining() * 10) / 10 : null; rec.timedOut = d ? !!d.didTimeout : null; }
      try { return fn.apply(this, arguments); } finally {
        var ms = Math.round((now() - s) * 10) / 10;
        if (rec) { rec.dur = ms; if (!rec.listed) { rec.listed = 1; P.idle.push(rec); } }
        else if (ms >= 0.5) P.tasks.push([kind, rel(s), ms, src(fn)]);
      }
    };
  }
  var oi = Util.idle;
  Util.idle = function (fn, to) { var rec = { sched: P.on ? rel(now()) : 'before', fn: src(fn) }; if (P.on) { rec.listed = 1; P.idle.push(rec); } return oi.call(Util, timed('idle', fn, rec), to); };
  P.restore.push(function () { Util.idle = oi; });
  var oST = window.setTimeout, oSI = window.setInterval;
  window.setTimeout = function (fn, ms) { if (typeof fn !== 'function') return oST.apply(window, arguments); var a = Array.prototype.slice.call(arguments, 2), w = timed('timeout', fn); return oST.call(window, function () { return w.apply(this, a); }, ms); };
  window.setInterval = function (fn, ms) { if (typeof fn !== 'function') return oSI.apply(window, arguments); var a = Array.prototype.slice.call(arguments, 2), w = timed('interval', fn); return oSI.call(window, function () { return w.apply(this, a); }, ms); };
  P.restore.push(function () { window.setTimeout = oST; window.setInterval = oSI; });
  var og = Net.get;
  Net.get = function (req, done) { return og.call(Net, req, timed('xhr ' + String(req && req.url).split('/')[2], done)); };
  P.restore.push(function () { Net.get = og; });
  // new Image(): Logos' downloads.
  var RI = window.Image;
  var WI = function (w, h) { var im = arguments.length > 1 ? new RI(w, h) : arguments.length ? new RI(w) : new RI(); if (P.on) P.img.push(rel(now())); return im; };
  WI.prototype = RI.prototype; window.Image = WI;
  P.restore.push(function () { window.Image = RI; });
  // <img>.src writes: in the page (a row or the banner) or not (a Logos download).
  var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (d && d.set && d.configurable) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', { get: d.get, enumerable: d.enumerable, configurable: true,
      set: function (v) { if (P.on) P.src.push([rel(now()), document.documentElement.contains(this) ? 1 : 0]); d.set.call(this, v); } });
    P.restore.push(function () { Object.defineProperty(HTMLImageElement.prototype, 'src', d); });
    P.srcHook = true;
  }
  function startPing() {
    var ch = new MessageChannel(), g = P.ping = { max: 0, last: now(), gaps: [] };
    ch.port1.onmessage = function () {
      var t = now(), gap = t - g.last;
      if (gap > g.max) g.max = gap;
      if (gap > 8) g.gaps.push([rel(g.last), Math.round(gap * 10) / 10]);
      g.last = t;
      if (P.on) ch.port2.postMessage(0);
    };
    ch.port2.postMessage(0);
  }
  function collect() {
    var rs = performance.getEntriesByType ? performance.getEntriesByType('resource') : [], out = [];
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i]; if (r.startTime < P.t0) continue;
      out.push([r.initiatorType, rel(r.startTime), rel(r.responseEnd), (String(r.name).split('/')[2] || '').replace(/^[^@]*@/, '')]);
    }
    P.res = out;
  }
  // The key, exactly as s-fullnav dispatches it (key -> 2nd rAF), plus a rAF loop and a closing collection after windowMs.
  window.__probe = function (code, windowMs, ping) {
    P.marks = []; P.idle = []; P.tasks = []; P.mem0 = performance.memory ? performance.memory.usedJSHeapSize : null; P.img = []; P.src = []; P.raf = []; P.res = null; P.done = false; P.r1 = P.r2 = null; P.ping = null;
    try { if (performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(1000);
      (performance.clearResourceTimings || performance.webkitClearResourceTimings || function () {}).call(performance); } catch (e) {}
    P.t0 = now(); P.on = true;
    if (ping) startPing();
    requestAnimationFrame(function loop() { if (!P.on) return; P.raf.push(rel(now())); requestAnimationFrame(loop); });
    if (console.timeStamp) console.timeStamp('PROBE_KEY');
    var e = document.createEvent('Event'); e.initEvent('keydown', true, true); e.keyCode = code; document.dispatchEvent(e);
    P.keyEnd = rel(now());
    requestAnimationFrame(function () { P.r1 = rel(now()); requestAnimationFrame(function () { P.r2 = rel(now()); if (console.timeStamp) console.timeStamp('PROBE_RAF2'); }); });
    oST.call(window, function () { P.on = false; P.mem1 = performance.memory ? performance.memory.usedJSHeapSize : null; collect(); P.done = true; }, windowMs || 1500);
    return 1;
  };
  window.__probeRestore = function () { while (P.restore.length) P.restore.pop()(); delete window.__probe; delete window.__P; return 'restored'; };
  return 'ok';
})()`;

// Logo readiness of the page the menu opens on and of the page after it (the same choice of group as the menu's place()).
const LOGO_STATE = `(function () {
  if (!window.Logos) return null;
  var gi = Zap.group(), g = Channels.groups()[gi], p = Playback.current(), pi = p ? Channels.indexOfKey(p.key) : -1;
  if (!g || g.items.indexOf(pi) < 0) { gi = Channels.allIdx(); g = Channels.groups()[gi]; }
  var v = ListView.shown('channels'), n = CONFIG.VISIBLE_ROWS, first = v ? v.first : 0;
  function count(a, b) { var urls = 0, ready = 0; for (var i = a; i < b && i < g.items.length; i++) { var u = Channels.at(g.items[i]).logo; if (u) { urls++; if (Logos.ready(u)) ready++; } } return ready + '/' + urls; }
  return { group: g.name, groupSize: g.items.length, first: first, page: count(first, first + n), next: count(first + n, first + 2 * n) };
})()`;

const COLLECT = `(function () {
  var P = window.__P; if (!P || !P.done) return null;
  return { keyEnd: P.keyEnd, r1: P.r1, r2: P.r2, raf: P.raf, marks: P.marks, idle: P.idle, tasks: P.tasks, mem: [P.mem0, P.mem1], img: P.img, src: P.src, srcHook: !!P.srcHook, res: P.res,
    ping: P.ping ? { max: Math.round(P.ping.max * 10) / 10, gaps: P.ping.gaps } : null, mode: Overlay.mode() };
})()`;

function summarize(r) {
  const r2 = r.r2, js = {};
  // Per wrapped function: calls, total ms (inclusive: a nested call is also inside its caller's ms), first call, calls before the 2nd rAF.
  for (const [label, at, ms] of r.marks) {
    const o = js[label] || (js[label] = { n: 0, ms: 0, first: at, beforeRaf2: 0 });
    o.n++; o.ms += ms;
    if (at < r2) o.beforeRaf2++;
  }
  for (const k in js) js[k].ms = Math.round(js[k].ms * 10) / 10;
  const gaps = []; let prev = 0; for (const t of r.raf) { gaps.push(Math.round((t - prev) * 10) / 10); prev = t; }
  const between = r.marks.filter(([, at]) => at >= r.r1 && at < r2).map(([l, at, ms, d]) => `${l}@${at}+${ms}${d ? ' (nested)' : ''}`);
  const imgRes = (r.res || []).filter((x) => x[0] === 'img');
  return {
    keyToRaf2Ms: r2, keyTaskMs: r.keyEnd, raf1: r.r1, gapRaf1ToRaf2: r.r1 != null && r2 != null ? Math.round((r2 - r.r1) * 10) / 10 : null,
    frameGapsFirst8: gaps.slice(0, 8), longestFrameGapMs: Math.max(...gaps.slice(0, 30)), framesInWindow: r.raf.length,
    js,
    jsBetweenRaf1AndRaf2: between,
    idleCallbacks: r.idle,
    tasksRunInWindow: r.tasks,
    heapMB: r.mem.map((x) => (x == null ? null : Math.round(x / 1e5) / 10)),
    newImage: { total: r.img.length, beforeRaf2: r.img.filter((t) => t < r2).length, at: r.img.slice(0, 26) },
    srcWrites: r.srcHook ? { total: r.src.length, inPage: r.src.filter((x) => x[1]).length, beforeRaf2: r.src.filter((x) => x[0] < r2).length, at: r.src.slice(0, 30).map((x) => x[0] + (x[1] ? 'p' : 'd')) } : 'no hook',
    imgResources: { n: imgRes.length, startedBeforeRaf2: imgRes.filter((x) => x[1] < r2).length, finishedBeforeRaf2: imgRes.filter((x) => x[2] < r2).length,
      hosts: [...new Set(imgRes.map((x) => x[3]))], timeline: imgRes.slice(0, 26).map((x) => `${x[1]}→${x[2]}`) },
    otherResources: (r.res || []).filter((x) => x[0] !== 'img').map((x) => `${x[0]} ${x[3]} ${x[1]}→${x[2]}`),
    ping: r.ping,
    mode: r.mode,
  };
}

// ---- Tracing (optional) ----
const CATS = 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,toplevel,blink.console';
function traceSummary(events) {
  const names = {}; for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args && e.args.name;
  const ks = events.find((e) => e.name === 'TimeStamp' && e.args && e.args.data && e.args.data.message === 'PROBE_KEY');
  const r2 = events.find((e) => e.name === 'TimeStamp' && e.args && e.args.data && e.args.data.message === 'PROBE_RAF2');
  if (!ks) return { error: 'no PROBE_KEY TimeStamp in the trace', events: events.length, threads: names };
  const main = ks.pid + ':' + ks.tid, t0 = ks.ts, tEnd = (r2 ? r2.ts : t0 + 200000) + 100000;   // to 100 ms after the 2nd rAF
  // Complete intervals per thread from X events and B/E pairs.
  const iv = []; const open = {};
  for (const e of events.slice().sort((a, b) => a.ts - b.ts)) {
    const th = e.pid + ':' + e.tid;
    if (e.ph === 'X') iv.push({ th, name: e.name, s: e.ts, e: e.ts + (e.dur || 0), args: e.args });
    else if (e.ph === 'B') (open[th] || (open[th] = [])).push(e);
    else if (e.ph === 'E') { const b = (open[th] || []).pop(); if (b) iv.push({ th, name: b.name, s: b.ts, e: e.ts, args: b.args }); }
  }
  const inWin = iv.filter((x) => x.e > t0 && x.s < tEnd);
  const ms = (us) => Math.round(us / 100) / 10;
  const byName = {}; for (const x of inWin) { const k = (x.th === main ? 'main ' : (names[x.th] || x.th) + ' ') + x.name; const o = byName[k] || (byName[k] = { n: 0, ms: 0 }); o.n++; o.ms += (Math.min(x.e, tEnd) - Math.max(x.s, t0)) / 1000; }
  const top = Object.entries(byName).map(([k, o]) => [k, o.n, Math.round(o.ms * 10) / 10]).sort((a, b) => b[2] - a[2]).slice(0, 40);
  // The main thread's top-level tasks and their largest children, in order (>= 1 ms).
  const mainIv = inWin.filter((x) => x.th === main).sort((a, b) => a.s - b.s || b.e - a.e);
  const tasks = mainIv.filter((x) => /RunTask|ProcessTaskFromWorkQueue|ThreadControllerImpl::RunTask|MessageLoop/.test(x.name));
  const longestTask = tasks.reduce((m, x) => Math.max(m, x.e - x.s), 0);
  const seq = []; let coverEnd = -1;
  for (const x of mainIv) {
    if (/RunTask|ProcessTaskFromWorkQueue|MessageLoop/.test(x.name)) continue;
    if (x.s < coverEnd) continue;           // nested in the previous listed event
    if (x.e - x.s < 1000) continue;
    seq.push(`${ms(x.s - t0)} ${x.name} ${ms(x.e - x.s)}${x.name === 'Decode Image' || x.name === 'DecodeImage' ? '' : ''}`); coverEnd = x.e;
  }
  const decodes = inWin.filter((x) => /Decode|Resize Image|ImageDecode/.test(x.name)).map((x) => `${(x.th === main ? 'main' : names[x.th] || x.th)} ${x.name} @${ms(x.s - t0)} ${ms(x.e - x.s)}`);
  return { mainThread: main + ' ' + (names[main] || ''), keyToRaf2Ms: r2 ? ms(r2.ts - t0) : null, longestMainTaskMs: ms(longestTask), mainTimeline: seq.slice(0, 60), topByName: top, decodes: decodes.slice(0, 40), threads: names };
}

export default async function (c, args) {
  const opt = new Set(args || []);
  const desktop = await c.ev('!window.webapis');
  const st = `(function(){var p=Playback.current();return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),state:window.webapis?webapis.avplay.getState():'DESKTOP',mode:Overlay.mode()}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && (s.state === 'PLAYING' || s.state === 'DESKTOP')) break; await c.sleep(1000); }
  const orig = s; c.log('start', orig.name, 'group', orig.grp, 'state', orig.state, 'variants', [...opt].join(',') || 'none');
  await c.sleep(4000);
  // The menu is laid out ahead at idle after the first picture; on the desktop (no picture) the app does it after the 4th retry.
  for (let i = 0; i < 20 && !(await c.ev('!!ListView.shown("channels")')); i++) { if (desktop && i === 5) await c.ev('Overlay.prepare("menu"),1'); await c.sleep(500); }
  if (desktop) await c.sleep(3000);
  c.log('env', JSON.stringify(await c.ev(`({ua:navigator.userAgent,rIC:typeof requestIdleCallback,dpr:devicePixelRatio,logos:!!window.Logos,prepared:!!ListView.shown('channels'),
    resTiming:!!(performance.getEntriesByType),clearRT:!!(performance.clearResourceTimings||performance.webkitClearResourceTimings),timeStamp:!!console.timeStamp,
    focusTransform:(function(){var r=document.createElement('div');r.className='row focus';document.body.appendChild(r);var t=getComputedStyle(r).webkitTransform||getComputedStyle(r).transform;document.body.removeChild(r);return t})()})`)));
  if (orig.mode !== 'none') { c.log('ABORT: an overlay is open at start:', orig.mode); return; }

  // Variants, before the instrumentation (so the timings wrap them), removed at the end.
  const variantSetup = [];
  if (opt.has('nologos')) variantSetup.push(`if(window.Logos){var w=Logos.want;Logos.want=function(){};window.__VR.push(function(){Logos.want=w})}`);
  if (opt.has('nonext')) variantSetup.push(`if(window.Logos){var w2=Logos.want;Logos.want=function(who,urls,open){return w2.call(Logos,who,who==='channels'?urls.slice(0,CONFIG.VISIBLE_ROWS):urls,open)};window.__VR.push(function(){Logos.want=w2})}`);
  if (opt.has('scale')) variantSetup.push(`var st=document.createElement('style');st.id='__probeScale';st.textContent='.focus{-webkit-transform:scale(1.02);transform:scale(1.02)}';document.head.appendChild(st);window.__VR.push(function(){st.parentNode.removeChild(st)})`);
  await c.ev(`(function(){window.__VR=[];${variantSetup.join(';')};return window.__VR.length})()`);
  c.log('install', await c.ev(INSTALL));

  // One instrumented key: dispatch, wait for the window, collect.
  const probe = async (label, code, windowMs = 1500) => {
    const before = await c.ev(LOGO_STATE);
    await c.ev(`__probe(${code},${windowMs},${opt.has('ping') ? 1 : 0})`);
    let r = null; for (let i = 0; i < 200 && !r; i++) { await c.sleep(50); r = await c.ev(COLLECT); }
    if (!r) { c.log(label, 'NO RESULT'); return null; }
    const sum = summarize(r);
    sum.logos = { before, after: await c.ev(LOGO_STATE) };
    c.log(label.padEnd(30), JSON.stringify(sum));
    return sum;
  };
  const close = async () => { await c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${K.BACK};document.dispatchEvent(e);return 1})()`); await c.sleep(1500); };

  // P1: the first open, optionally traced.
  let traceEvents = null, traceDone = null;
  if (opt.has('trace')) {
    traceEvents = [];
    traceDone = new Promise((res) => c.on((m) => {
      if (m.method === 'Tracing.dataCollected') traceEvents.push(...(m.params.value || []));
      if (m.method === 'Tracing.tracingComplete') res();
    }));
    const t = await c.call('Tracing.start', { categories: CATS, options: 'record-as-much-as-possible', bufferUsageReportingInterval: 1000 });
    if (t && t.__error) { c.log('Tracing.start failed', JSON.stringify(t.__error)); traceEvents = null; }
    else await c.sleep(300);
  }
  await probe('P1 first open (OK)', K.ENTER, 1500);
  if (traceEvents) {
    await c.call('Tracing.end');
    await Promise.race([traceDone, c.sleep(20000)]);
    const file = path.join(HERE, `trace-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(traceEvents));
    c.log('trace', file, 'events', traceEvents.length);
    c.log('trace summary', JSON.stringify(traceSummary(traceEvents)));
  }
  await close();
  await probe('P2 reopen (OK)', K.ENTER, 1500);
  await close();
  if (opt.has('forget') && (await c.ev('!!window.Logos'))) {
    await c.ev('Logos.retain([]),1');
    await probe('P3 reopen, logos forgotten', K.ENTER, 1500);
    await close();
    await c.ev('Logos.retain([]),1');
    await c.ev('(function(){window.__w=Logos.want;Logos.want=function(){};return 1})()');
    await probe('P4 same, Logos.want off', K.ENTER, 1500);
    await close();
    await c.ev('(function(){Logos.want=window.__w;delete window.__w;return 1})()');
    await probe('P5 reopen, logos back', K.ENTER, 3000);
    await close();
  }

  // Restore: menu closed, wrappers and variants removed, channel untouched.
  if ((await c.ev('Overlay.mode()')) !== 'none') await close();
  c.log('unwrap', await c.ev('window.__probeRestore ? __probeRestore() : "none"'));
  c.log('variants removed', await c.ev('(function(){var n=0;while(window.__VR&&__VR.length){__VR.pop()();n++}delete window.__VR;return n})()'));
  const end = await c.ev(st);
  c.log('restored', JSON.stringify({ name: end.name, sameChannel: end.ch === orig.ch, sameGroup: end.grp === orig.grp, state: end.state, mode: end.mode,
    imageIsNative: await c.ev('Image.toString().indexOf("native")>=0'), srcIsNative: await c.ev('Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src").set.toString().indexOf("native")>=0') }));
}
