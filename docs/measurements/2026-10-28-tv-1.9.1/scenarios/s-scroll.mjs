// Scrolling the channel list onto rows whose logos were never drawn (cold) vs back over rows already drawn (warm).
// Run: node $S/tv5/cdp.mjs <port> $S/perf-degradation/s-scroll.mjs [variant...]   — on a FRESH launch (cold logos).
// The menu is opened, the group column is moved to «All channels» (browsing only: the zap group, the channel and the
// language are not changed), then the phases below run; the menu is closed at the end and every wrapper removed.
// Variants (in-page, applied before the first key): nowant (Logos.want no-op: no new downloads) · csshide (row logos
// hidden by CSS: downloaded, never painted) · noflex (the 1.8.4 text layout: no nested flex in the text cells) ·
// nodir (I18n.otherDir → '') · ping (MessageChannel heartbeat: main-thread stretches > 8 ms) · trace (CDP Tracing over
// the cold phases; raw JSON written next to this file).
import fs from 'node:fs';
import path from 'node:path';
import { INSTALL, applyVariants, removeVariants, runSeq, summarize, startTrace, stopTrace } from './lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, CH_UP: 427, CH_DOWN: 428 };
const rep = (k, n) => Array(n).fill(k);

export default async function (c, args) {
  const opt = new Set(args || []);
  const st = `(function(){var p=Playback.current();return {ch:p?p.key:null,name:p?p.num+' '+p.name:null,grp:Zap.group(),lang:window.I18n?I18n.code():'(1.8.4: none)',state:window.webapis?webapis.avplay.getState():'DESKTOP',mode:Overlay.mode()}})()`;
  let s; for (let i = 0; i < 60; i++) { s = await c.ev(st); if (s && (s.state === 'PLAYING' || s.state === 'DESKTOP')) break; await c.sleep(1000); }
  const orig = s;
  c.log('start', JSON.stringify(orig), 'variants', [...opt].join(',') || 'none');
  if (orig.mode !== 'none') { c.log('ABORT: an overlay is open at start'); return; }
  await c.sleep(4000);
  for (let i = 0; i < 20 && !(await c.ev('!!ListView.shown("channels")')); i++) { if (orig.state === 'DESKTOP' && i === 5) await c.ev('Overlay.prepare("menu"),1'); await c.sleep(500); }
  c.log('env', JSON.stringify(await c.ev(`({ua:navigator.userAgent,rIC:typeof requestIdleCallback,logos:!!window.Logos,rtl:!!(window.I18n&&I18n.rtl()),i18n:!!window.I18n,version:(function(){try{return tizen.application.getCurrentApplication().appInfo.version}catch(e){return 'n/a'}})(),groups:Channels.groups().length,allIdx:Channels.allIdx(),
    allSize:Channels.groups()[Channels.allIdx()].items.length,keep:CONFIG.LOGO_KEEP,parallel:CONFIG.LOGO_PARALLEL,dwell:CONFIG.LOGO_DWELL_MS})`)));
  const variants = await applyVariants(c, opt);
  c.log('install', await c.ev(INSTALL), 'variants', variants.join(',') || 'none');
  const rtl = await c.ev('!!(window.I18n&&I18n.rtl())');
  const toGroups = rtl ? K.RIGHT : K.LEFT, toChannels = rtl ? K.LEFT : K.RIGHT;
  // The group the menu opens on (as menu.js place()): the zap group when the playing channel is in it, else «All».
  const gi = await c.ev(`(function(){var gi=Zap.group(),g=Channels.groups()[gi],p=Playback.current(),pi=p?Channels.indexOfKey(p.key):-1;return g&&g.items.indexOf(pi)>=0?gi:Channels.allIdx()})()`);
  const allIdx = await c.ev('Channels.allIdx()');
  const d = allIdx - gi;
  const toAll = [toGroups, ...rep(d > 0 ? K.DOWN : K.UP, Math.abs(d)), toChannels];

  const phase = async (name, codes, interval, settle, traced) => {
    let tr = null;
    if (traced && opt.has('trace')) { tr = await startTrace(c); if (tr.error) { c.log('Tracing.start failed', JSON.stringify(tr.error)); tr = null; } else await c.sleep(300); }
    const res = await runSeq(c, codes, interval, settle, opt);
    if (!res) { c.log(name, 'NO RESULT'); return; }
    const sum = summarize(res);
    sum.where = await c.ev(`(function(){var v=ListView.shown('channels');return {mode:Overlay.mode(),first:v&&v.first,total:v&&v.total}})()`);
    c.log(name.padEnd(36), JSON.stringify(sum));
    if (tr) {
      const file = path.join(HERE, `trace-${name.replace(/\W+/g, '_')}-${Date.now()}.json`);
      c.log('trace', name, file, JSON.stringify(await stopTrace(c, tr, file, fs)));
    }
  };

  await phase('open menu (OK)', [K.ENTER], 0, 1500);
  await phase('to «All channels»', toAll, 120, 3000);
  await phase('warm: ▼ ×6 inside the page (350)', rep(K.DOWN, 6), 350, 1000);
  await phase('▼ ×14 steps, window scrolls (350)', rep(K.DOWN, 14), 350, 1500);
  await phase('cold: ▼ held ×30 (80) + release', rep(K.DOWN, 30), 80, 2500, true);
  await phase('cold: CH− ×6 pages (250)', rep(K.CH_DOWN, 6), 250, 2500, true);
  await phase('cold: CH− ×6 pages (600)', rep(K.CH_DOWN, 6), 600, 2500, true);
  await phase('warm: CH+ ×12 back (250)', rep(K.CH_UP, 12), 250, 1500);
  await phase('warm: ▲ held ×30 (80) back', rep(K.UP, 30), 80, 1500);
  await phase('groups: ◀ + ▼ ×6 (350)', [toGroups, ...rep(K.DOWN, 6)], 350, 2000);
  await phase('groups: ▲ ×6 back (350)', rep(K.UP, 6), 350, 1500);

  // Restore: menu closed (Back works from either column), wrappers and variants removed; channel, group, language untouched.
  for (let i = 0; i < 3 && (await c.ev('Overlay.mode()')) !== 'none'; i++) { await c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${K.BACK};document.dispatchEvent(e);return 1})()`); await c.sleep(800); }
  c.log('unwrap', await c.ev('window.__unwrap ? __unwrap() : "none"'), 'variants removed', await removeVariants(c));
  const end = await c.ev(st);
  c.log('restored', JSON.stringify({ name: end.name, sameChannel: end.ch === orig.ch, sameGroup: end.grp === orig.grp, lang: end.lang, sameLang: end.lang === orig.lang, state: end.state, mode: end.mode,
    imageIsNative: await c.ev('Image.toString().indexOf("native")>=0') }));
}
