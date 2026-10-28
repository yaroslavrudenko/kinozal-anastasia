// Parity of 1.9.x against 1.8.4 on the paths the owner named: list load and first picture at start, channel switch
// (▶ ◀ and digits), group switch, menu open / close. Build-agnostic (1.8.4 has no I18n / Logos). One clock: the page's.
// Run on a fresh launch: node $S/tv5/cdp.mjs <port> $S/perf-degradation/s-parity.mjs [noreload]
// Restores the channel and the zap group it found (the language is never touched); the last line asserts it.
//
// 1. cold launch (this process): navigationStart → load event, the channel-list request (Resource Timing, xhr whose URL
//    holds channel_now / .m3u / playlist) start → end. Read after the fact, so it is the real cold start.
// 2. reload (same process, HTTP cache warm; skipped with 'noreload'): Page.reload with an early script injected before the
//    app: list request start/end, the first list JSON.parse > 50 kB, Channels ready (count > 0), first picture
//    (Zap.onFirstFrame), all from navigationStart.
// 3. channel switch ▶ / ◀ ×3 each (alternating, so it ends where it began): key → AVPlay left PLAYING → PLAYING again →
//    spinner off; and key → 2nd frame (the banner).
// 4. digits ×2 each way: the number of the next channel in the zap group, then the starting one; from the LAST digit
//    (CONFIG.NUMBER_ENTRY_MS of waiting is included and printed).
// 5. group switch inside the menu: ◀, then ▼ ▼ ▼ ▲ ▲ ▲ (each browses a group: its column is drawn), ▶, Back: per key → 2nd frame.
// 6. menu open / close ×5: OK → 2nd frame, Back → 2nd frame.
import fs from 'node:fs';
import { INSTALL, runSeq, summarize } from './lib.mjs';

const K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009 };
const EARLY = `(function(){
  if (window.__E) return 'already';
  var E = window.__E = { list: [], parse: [], ready: null, ff: null };
  var P = XMLHttpRequest.prototype, o = P.open, s = P.send;
  P.open = function (m, u) { this.__u = String(u); return o.apply(this, arguments); };
  P.send = function () { var u = this.__u || '', x = this;
    if (/channel_now|\\.m3u|playlist/i.test(u)) { var r = { t: Date.now() }; E.list.push(r); x.addEventListener('loadend', function () { r.e = Date.now(); r.st = x.status; r.n = (x.responseText || '').length; }); }
    return s.apply(this, arguments); };
  var jp = JSON.parse; JSON.parse = function (t) { if (typeof t === 'string' && t.length > 50000 && E.parse.length < 5) { var a = Date.now(); var v = jp.apply(this, arguments); E.parse.push({ t: a, ms: Date.now() - a, n: t.length }); return v; } return jp.apply(this, arguments); };
  window.addEventListener('load', function () {
    var of = Zap.onFirstFrame; Zap.onFirstFrame = function () { if (!E.ff) E.ff = Date.now(); return of.apply(this, arguments); };
    var iv = setInterval(function () { if (window.Channels && Channels.count() > 0) { E.ready = Date.now(); clearInterval(iv); } }, 20);
  }, true);
  return 'ok';
})()`;

// In-page: dispatch keys (digits 150 ms apart), then wait for AVPlay to leave PLAYING and come back, and the spinner to go.
const PLAY = `(function () {
  if (window.__playAfter) return 'had';
  var oSI = window.setInterval, oCI = window.clearInterval, sp = document.getElementById('spinner');
  window.__playAfter = function (codes) {
    var R = window.__PR = { done: false }, i = 0, t0 = 0, left = false;
    function send(c) { var e = document.createEvent('Event'); e.initEvent('keydown', true, true); e.keyCode = c; document.dispatchEvent(e); }
    function next() {
      send(codes[i++]);
      if (i < codes.length) { setTimeout(next, 150); return; }
      t0 = performance.now();
      requestAnimationFrame(function () { requestAnimationFrame(function () { R.r2 = Math.round(performance.now() - t0); }); });
      var poll = oSI.call(window, function () {
        var s = window.webapis ? webapis.avplay.getState() : 'DESKTOP', t = Math.round(performance.now() - t0), on = sp.className.indexOf('hidden') < 0;
        if (s !== 'PLAYING' && !left) { left = true; R.left = t; }
        if (left && s === 'PLAYING' && R.playing === undefined) R.playing = t;
        if (R.playing !== undefined && !on) { R.spinnerOff = t; }
        if ((R.spinnerOff !== undefined) || t > 20000) { oCI.call(window, poll); R.done = true; }
      }, 20);
    }
    next();
    return 1;
  };
  return 'ok';
})()`;

const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export default async function (c, args) {
  const opt = new Set(args || []);
  const desktop = await c.ev('!window.webapis');
  const st = `(function(){var p=Playback.current();return {ch:p?p.key:null,num:p?p.num:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),lang:window.I18n?I18n.code():'(1.8.4: none)',state:window.webapis?webapis.avplay.getState():'DESKTOP',mode:Overlay.mode()}})()`;
  const waitPlaying = async (n = 60) => { let s; for (let i = 0; i < n; i++) { s = await c.ev(st); if (s && s.ch && (s.state === 'PLAYING' || s.state === 'DESKTOP')) return s; await c.sleep(500); } return s; };
  const orig = await waitPlaying(120);
  c.log('start', JSON.stringify(orig), 'version', await c.ev(`(function(){try{return tizen.application.getCurrentApplication().appInfo.version}catch(e){return 'n/a'}})()`),
    'numberEntryMs', await c.ev('CONFIG.NUMBER_ENTRY_MS'), 'i18n', await c.ev('!!window.I18n'), 'logos', await c.ev('!!window.Logos'));
  if (!orig || orig.mode !== 'none') { c.log('ABORT: overlay open or nothing playing'); return; }

  // 1. The real cold start of this process, read after the fact.
  c.log('1 cold launch', JSON.stringify(await c.ev(`(function(){var t=performance.timing,n=t.navigationStart,rs=performance.getEntriesByType?performance.getEntriesByType('resource'):[],l=[];
    for(var i=0;i<rs.length;i++){var r=rs[i];if(r.initiatorType==='xmlhttprequest'&&/channel_now|\\.m3u|playlist/i.test(r.name))l.push({start:Math.round(r.startTime),end:Math.round(r.responseEnd)})}
    return {domContentLoaded:t.domContentLoadedEventEnd-n,loadEvent:t.loadEventEnd-n,listRequests:l,resourceEntries:rs.length}})()`)));

  // 2. Reload with the early script (same process).
  if (!opt.has('noreload') && !desktop) {
    let r = await c.call('Page.addScriptToEvaluateOnLoad', { scriptSource: EARLY });
    if (r && r.__error) r = await c.call('Page.addScriptToEvaluateOnNewDocument', { source: EARLY });
    await c.call('Page.enable');
    const t0 = Date.now();
    await c.call('Page.reload', { ignoreCache: false });
    await c.sleep(3000);
    let e = null; for (let i = 0; i < 60; i++) { e = await c.ev(`(function(){var E=window.__E;if(!E||!E.ff)return null;var n=performance.timing.navigationStart;function f(x){return x-n}
      return {listRequests:E.list.map(function(r){return {start:f(r.t),end:r.e?f(r.e):null,status:r.st,chars:r.n}}),bigParses:E.parse.map(function(p){return {at:f(p.t),ms:p.ms,chars:p.n}}),channelsReady:E.ready?f(E.ready):null,firstPicture:f(E.ff)}})()`); if (e) break; await c.sleep(500); }
    c.log('2 reload', JSON.stringify(e), 'wallMs', Date.now() - t0);
    if (r && r.identifier) await c.call('Page.removeScriptToEvaluateOnLoad', { identifier: r.identifier });
    await waitPlaying(60);
    await c.sleep(4000);
  }
  const cur = await c.ev(st);
  if (cur.ch !== orig.ch) c.log('note: after the reload the channel is', cur.name);
  await c.ev(PLAY);
  const play = async (label, codes) => {
    await c.ev(`__playAfter(${JSON.stringify(codes)})`);
    let r = null; for (let i = 0; i < 250 && !(r && r.done); i++) { await c.sleep(100); r = await c.ev('window.__PR'); }
    const now = await c.ev(st);
    c.log(label.padEnd(22), JSON.stringify({ to: now.name, r2: r.r2, leftPlaying: r.left, playing: r.playing, spinnerOff: r.spinnerOff }));
    await c.sleep(3500);
    return r;
  };

  if (!desktop) {
    // 3. ▶ / ◀ (outside the menu: Zap.step within the zap group), alternating.
    const zap = [];
    for (let i = 1; i <= 3; i++) { zap.push(await play(`3 zap ▶ #${i}`, [K.RIGHT])); zap.push(await play(`3 zap ◀ #${i}`, [K.LEFT])); }
    c.log('3 zap summary', JSON.stringify({ medianPlaying: med(zap.map((r) => r.playing)), medianSpinnerOff: med(zap.map((r) => r.spinnerOff)), medianR2: med(zap.map((r) => r.r2)) }));
    // 4. Digits: the next channel of the zap group by number, then back.
    const nums = await c.ev(`(function(){var g=Channels.groups()[Zap.group()],p=Playback.current(),i=g?g.items.indexOf(Channels.indexOfKey(p.key)):-1;var n=g&&g.items.length>1?Channels.at(g.items[(i+1)%g.items.length]).num:null;return {here:p.num,next:n}})()`);
    const digits = (n) => String(n).split('').map((d) => 48 + +d);
    const dg = [];
    if (nums.next) for (let i = 1; i <= 2; i++) { dg.push(await play(`4 digits ${nums.next} #${i}`, digits(nums.next))); dg.push(await play(`4 digits ${nums.here} #${i}`, digits(nums.here))); }
    c.log('4 digits summary', JSON.stringify({ medianPlaying: med(dg.map((r) => r.playing)), medianSpinnerOff: med(dg.map((r) => r.spinnerOff)), note: 'from the last digit; includes NUMBER_ENTRY_MS' }));
  }

  // 5 and 6: menu keys through the shared instrumentation (key → 2nd frame, frames > 34 ms, logo boxes).
  c.log('install', await c.ev(INSTALL));
  const rtl = await c.ev('!!(window.I18n&&I18n.rtl())');
  const toGroups = rtl ? K.RIGHT : K.LEFT, toChannels = rtl ? K.LEFT : K.RIGHT;
  const phase = async (name, codes, interval, settle) => {
    const res = await runSeq(c, codes, interval, settle, opt);
    if (!res) { c.log(name, 'NO RESULT'); return; }
    const s = summarize(res); delete s.totals; s.worstGaps = s.worstGaps.slice(0, 3);
    c.log(name.padEnd(36), JSON.stringify(s));
  };
  // Menu open/close first: #1 is the first opening of this launch (the reload above lays the menu out ahead again).
  for (let i = 1; i <= 5; i++) { await phase(`6 menu open/close #${i}`, [K.ENTER, K.BACK], 900, 900); }
  for (let i = 1; i <= 3; i++) {
    await phase(`5 groups #${i}: OK ◀ ▼▼▼ ▲▲▲ ▶ Back`, [K.ENTER, toGroups, K.DOWN, K.DOWN, K.DOWN, K.UP, K.UP, K.UP, toChannels, K.BACK], 600, 1500);
  }

  // Restore.
  for (let i = 0; i < 3 && (await c.ev('Overlay.mode()')) !== 'none'; i++) { await c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${K.BACK};document.dispatchEvent(e);return 1})()`); await c.sleep(800); }
  c.log('unwrap', await c.ev('window.__unwrap ? __unwrap() : "none"'));
  let end = await c.ev(st);
  if (end.ch !== orig.ch || end.grp !== orig.grp) {
    await c.ev(`(function(k,g){var ch=Channels.get(k);if(ch)Zap.pick(ch,g);return 1})(${JSON.stringify(orig.ch)},${orig.grp})`);
    end = await waitPlaying(40);
  }
  c.log('restored', JSON.stringify({ name: end.name, sameChannel: end.ch === orig.ch, sameGroup: end.grp === orig.grp, lang: end.lang, state: end.state, mode: end.mode }));
}
