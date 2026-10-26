// The automatic use cases of docs/TESTING.md. Each case drives the app only with remote keys (plus
// read-only inspection) except where a setup step names the module call it uses; each returns result
// rows { id, channel, measured, result } with result PASS | FAIL | DRY-SKIP (needs a picture: TV only).
const K = { ENTER: 13, BACK: 10009, UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, PG_DOWN: 34, PG_UP: 33, INFO: 457,
  PLAY_PAUSE: 10252, STOP: 413, YELLOW: 405 };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// The app shows the tech line for TECH_LINE_MS (5 s) once the player has described the stream, which can
// take a while after the first frame: it is read right after the first frame, polled up to this long.
const TECH_WAIT_MS = 15000;
const hasText = (hay, needle) => norm(hay).indexOf(norm(needle)) >= 0;
const row = (id, channel, measured, ok) => ({ id, channel, measured, result: ok === null ? 'DRY-SKIP' : ok ? 'PASS' : 'FAIL' });

export function helpers(d, opt) {
  const st = () => d.ev('__TT.st()');
  async function waitFor(expr, ms, step) {
    const t0 = Date.now();
    for (;;) { const v = await d.ev(expr); if (v && !v.__error) return v; if (Date.now() - t0 > ms) return null; await d.sleep(step || 200); }
  }
  async function keys(code, n, gap) { for (let i = 0; i < n; i++) { await d.key(code); await d.sleep(gap == null ? 60 : gap); } }
  async function closeAll() { for (let i = 0; i < 3; i++) { const s = await st(); if (s.overlay === 'none') return; await d.key(K.BACK); await d.sleep(250); } }
  // The first frame of the stream opened after `t` (TV); in dry mode there is no picture: null.
  async function firstFrame(t, ms) {
    if (d.mode === 'dry') { await d.sleep(1500); return null; }
    const v = await waitFor(`(function(){var s=__TT.st();return s.av==='PLAYING'&&s.media>0?Date.now():0})()`, ms || 10000, 50);
    return v ? v - t : -1;
  }
  // The channel's full guide (INFO asks for it; on the TV the first frame does too).
  async function guideLoaded() { await d.key(K.INFO); await d.sleep(2500); }
  // A fresh "on air" reference (see page-helper apiStart); returns { asked, at, ended, size } (data stays in the page).
  async function api() {
    await d.ev('__TT.apiStart()');
    return waitFor('(function(){var a=__TT.api;return a?{asked:a.asked,at:a.at,ended:a.ended,size:a.size}:null})()', 20000, 200);
  }
  // Opens the menu on group index g (cursor on its first channel).
  async function openGroup(g) {
    await closeAll();
    await d.key(K.ENTER); await d.sleep(400);
    await d.key(K.LEFT); await d.sleep(150);
    const cur = (await st()).group;
    await keys(g > cur ? K.DOWN : K.UP, Math.abs(g - cur), 80);
    await d.key(K.RIGHT); await d.sleep(300);
    // When the group did not change, the cursor stays where it was (the playing channel): page up to the top.
    let prevTop = null;
    for (let i = 0; i < 80; i++) {
      const top = ((await d.ev("__TT.rows('channels')")).find((r) => r.focus) || {}).num;
      if (top === prevTop) break;
      prevTop = top; await d.key(K.PG_UP); await d.sleep(120);
    }
  }
  return { st, waitFor, keys, closeAll, firstFrame, api, openGroup, guideLoaded };
}

// ---------- U0 / M1 / M11: every group, every row's "now" == on air per the API; banner on landing == row ----------
export async function U0(d, opt, onlyAll) {
  const h = helpers(d, opt), out = [];
  const groups = (await d.ev('__TT.groups()')).filter((g) => !g.special && (!onlyAll || g.name === 'Все каналы'));
  for (const g of groups) {
    // Sweep start (local clock) and how long the menu had been closed before it.
    const sweep = await d.ev("(function(){var n=Date.now();return {at:new Date(n).toTimeString().slice(0,8),closed:Math.round((n-__TT.menuClosedAt)/1000),open:!/(^|\\s)hidden(\\s|$)/.test(document.getElementById('guide').className)}})()");
    await h.openGroup(g.i);
    // Each page is compared with a fresh reference asked right after the page was read (≤ 10 s apart).
    const seen = new Map(), refs = [];
    let empty = 0, wrong = 0, noApi = 0, byGuide = 0, badRef = 0, prevRef = null, prev = '';
    const wrongSince = [];
    const examples = [];
    async function checkPage() {
      const readAt = await d.ev('Date.now()');
      const rows = (await d.ev("__TT.rows('channels')")).filter((r) => r.full && !seen.has(r.num));
      if (!rows.length) return;
      const ref = await h.api();
      refs.push({ lag: ref ? ref.at - readAt : -1, ended: ref ? ref.ended : -1 });
      // A reference that failed (timeout, empty) or came too late is not evidence: the page is re-read later.
      if (!ref || !ref.size || ref.at - readAt > 10000) { badRef++; return; }
      for (const r of rows) {
        seen.set(r.num, r);
        const c = await d.ev(`__TT.chByNum(${JSON.stringify(r.num)})`);
        const a = c && await d.ev(`__TT.apiNow(${JSON.stringify(c.id)})`);
        if (!a) { noApi++; continue; }
        if (!norm(r.sub)) { empty++; if (examples.length < 4) examples.push(r.num + ' ' + r.title + ': empty, on air «' + a.title + '»'); continue; }
        // A show that began after the page was read: the row may still name the previous one.
        if (!hasText(r.sub, a.title) && !(a.start > readAt - 10000 && prevRef && prevRef[c.id] && hasText(r.sub, prevRef[c.id]))) {
          // The list API and the row disagree: the channel's own guide decides what is on air at the read time.
          await d.ev(`__TT.guideStart(${JSON.stringify(c.id)})`);
          await h.waitFor(`__TT.guide[${JSON.stringify(c.id)}]`, 15000);
          const g = await d.ev(`__TT.guideAt(${JSON.stringify(c.id)}, ${readAt})`);
          if (g.cur && hasText(r.sub, g.cur)) { byGuide++; continue; }
          // How long ago the show changed: the guide's start of the show on air, else the fresh list's.
          const since = Math.round((readAt - (g.curStart || a.start)) / 1000);
          wrong++; wrongSince.push(since); if (examples.length < 30) examples.push(r.num + ' ' + norm(r.title) + ': «' + norm(r.sub) + '» ≠ on air «' + a.title + '» (guide: «' + (g.cur || '—') + '») · changed ' + since + ' s before the read');
        }
      }
      prevRef = await d.ev('(function(){var o={},k,a=__TT.api.data;for(k in a)if(a[k])o[k]=a[k].name;return o})()');
    }
    for (let p = 0; p < 80; p++) {
      await checkPage();
      await d.key(K.PG_DOWN); await d.sleep(250);
      const now = (await d.ev("__TT.rows('channels')")).filter((r) => r.full).map((r) => r.num).join(',');
      if (now === prev) break;
      prev = now;
    }
    await checkPage();
    const refNote = refs.length ? ` · reference: ${refs.length} fresh fetches (${badRef} failed or > 10 s, those pages not judged), ≤ ${Math.max(...refs.map((x) => x.lag))} ms after each page read, ended shows in it ≤ ${Math.max(...refs.map((x) => x.ended))} · ${byGuide} rows differed from the list API but matched the channel's guide` : '';
    out.push(row('U0.rows', g.name, `sweep ${sweep.at}, menu ${sweep.open ? 'already open' : 'closed ' + sweep.closed + ' s before'} · ${seen.size}/${g.count} rows seen · empty ${empty} · not on air ${wrong} (${wrongSince.filter((x) => x < 60).length} of them < 60 s after the show changed) · no API programme ${noApi}` + refNote + (examples.length ? ' · ' + examples.join(' | ') : ''),
      seen.size === g.count && empty === 0 && wrong === 0 && badRef === 0));
    if (!onlyAll || opt.landings) out.push(...await landings(d, opt, g, h));
  }
  await h.closeAll();
  return out;
}

// Enters the first, middle and last channel of group g from the menu and checks the banner.
async function landings(d, opt, g, h) {
  const out = [], picks = [...new Set([0, Math.floor((g.count - 1) / 2), g.count - 1])];
  for (const k of picks) {
    await h.openGroup(g.i);
    if (k === g.count - 1 && k > 0) { for (let i = 0; i < 60; i++) { await d.key(K.PG_DOWN); await d.sleep(120); } }
    else await h.keys(K.DOWN, k, 40);
    await d.sleep(300);
    const r = (await d.ev("__TT.rows('channels')")).find((x) => x.focus);
    if (!r) { out.push(row('U0.landing', g.name + ' #' + k, 'no highlighted row', false)); continue; }
    const c = await d.ev(`__TT.chByNum(${JSON.stringify(r.num)})`);
    await d.ev(`__TT.guideStart(${JSON.stringify(c.id)})`);
    const t = Date.now();
    await d.key(K.ENTER);
    const ff = await h.firstFrame(t);
    // The tech line first: it is on screen only for TECH_LINE_MS, so it is read before the slower checks.
    let tech = '', techDelay = null;
    if (d.mode === 'tv' && ff >= 0) {
      const frameAt = t + ff;
      tech = await h.waitFor(`(function(){var s=__TT.st();return s.bTech&&s.bTech!=='…'?s.bTech:''})()`, TECH_WAIT_MS, 100) || '';
      if (tech) techDelay = Date.now() - frameAt;
    }
    // The banner's «Далее» comes with the channel's guide, which the app loads after the first frame.
    await h.waitFor("(function(){var s=__TT.st();return s.bNext?1:0})()", d.mode === 'tv' ? 4000 : 500, 100);
    const s = await h.st();
    await h.waitFor(`__TT.guide[${JSON.stringify(c.id)}]`, 15000);
    const ref = await h.api();                                    // fresh reference, right after the banner was read
    const a = await d.ev(`__TT.apiNow(${JSON.stringify(c.id)})`);
    const gn = await d.ev(`__TT.guideAt(${JSON.stringify(c.id)}, Date.now())`);
    const where = g.name + ' · ' + c.num + ' ' + c.name;
    const clockOk = /^\d\d:\d\d$/.test(norm(s.bClock));
    // The programme line is required when the provider has a programme on air (API or the channel's guide).
    const needNow = !!a || !!gn.cur;
    // Dry mode has no first frame, so the app never loads this channel's guide: a programme only the guide
    // knows cannot be on the banner yet.
    const dryGuideOnly = d.mode === 'dry' && !a && !!gn.cur && !norm(s.bNow);
    out.push(row('U0.banner-fields', where, `num «${s.bNum}» · title «${norm(s.bTitle).slice(0, 50)}» · now «${norm(s.bNow).slice(0, 60)}» · next «${norm(s.bNext).slice(0, 50)}» · clock «${s.bClock}» · shown ${s.banner}`,
      (s.banner && s.bNum === String(c.num) && norm(s.bTitle).indexOf(norm(c.name)) === 0 && (!needNow || /\d\d:\d\d\D{1,3}\d\d:\d\d/.test(s.bNow)) && clockOk) ? true : dryGuideOnly ? null : false));
    out.push(row('U0.banner==row', where, `menu «${norm(r.sub).slice(0, 60)}» · banner «${norm(s.bNow).slice(0, 60)}» · API on air «${a ? a.title : '—'}» (fresh, ${ref.at - s.now} ms after the banner, ${ref.ended} ended in it)`,
      hasText(s.bNow, r.sub) && (!a || hasText(s.bNow, a.title))));
    // Without a first frame (dry mode) the app does not load the guide, so an empty «Далее» proves nothing.
    const nextOk = !gn.next || (hasText(s.bNext, 'Далее') && hasText(s.bNext, gn.next));
    out.push(row('U0.next', where, `guide next «${gn.next || '—'}» · banner «${norm(s.bNext).slice(0, 60)}»`, d.mode === 'dry' && !norm(s.bNext) ? null : nextOk));
    out.push(row('U0.first-frame', where, ff === null ? 'no picture in dry mode' : ff < 0 ? 'no first frame within 10 s' : ff + ' ms', ff === null ? null : ff >= 0 && ff <= 10000));
    if (d.mode === 'tv') {
      out.push(row('U0.tech-line', where, ff < 0 ? 'no first frame' : tech ? `${tech} · ${techDelay} ms after the first frame` : `empty for ${TECH_WAIT_MS / 1000} s after the first frame`, ff >= 0 && !!tech));
    } else out.push(row('U0.tech-line', where, 'no picture in dry mode', null));
  }
  return out;
}

// ---------- M2: the menu opens on the playing channel, which carries the playing marker ----------
export async function M2(d) {
  const h = helpers(d), s0 = await h.st();
  await h.closeAll(); await d.key(K.ENTER); await d.sleep(500);
  const rows = await d.ev("__TT.rows('channels')"), f = rows.find((r) => r.focus);
  await h.closeAll();
  const ok = !!f && s0.ch && f.num === String(s0.ch.num) && f.playing;
  return [row('M2.open-on-playing', s0.ch ? s0.ch.num + ' ' + s0.ch.name : '—', f ? `cursor on ${f.num} ${f.title} · playing marker ${f.playing}` : 'no cursor', ok)];
}

// ---------- M4: ▼ panel — cursor on air == API, days, a past programme plays ----------
export async function M4(d, opt) {
  const h = helpers(d), out = [], s0 = await h.st(), where = s0.ch ? s0.ch.num + ' ' + s0.ch.name : '—';
  await h.closeAll(); await h.api(); await h.guideLoaded();
  await d.key(K.DOWN); await d.sleep(2500);
  const rows = await d.ev("__TT.rows('p-list')"), f = rows.find((r) => r.focus), a = s0.ch && await d.ev(`__TT.apiNow(${JSON.stringify(s0.ch.id)})`);
  out.push(row('M4.cursor-on-air', where, f ? `${f.num} «${norm(f.title).slice(0, 50)}» ${f.sub} · API «${a ? a.title : '—'}»` : 'no cursor', !!f && f.sub === 'в эфире' && (!a || hasText(f.title, a.title))));
  await d.key(K.LEFT); await d.sleep(500);
  const y = await h.st();
  out.push(row('M4.day-back', where, y.progTitle, /Вчера/.test(y.progTitle)));
  await d.key(K.RIGHT); await d.sleep(400);
  await d.key(K.UP); await d.sleep(300);
  const pr = (await d.ev("__TT.rows('p-list')")).find((r) => r.focus);
  const t = Date.now();
  await d.key(K.ENTER);
  const ff = await h.firstFrame(t, 15000);
  const s = await h.st();
  out.push(row('M4.past-plays', where, `«${pr ? norm(pr.title).slice(0, 40) : '?'}» → mode ${s.mode} · banner «${norm(s.bTitle).slice(0, 60)}» · ${ff === null ? 'dry' : ff + ' ms'}`,
    s.mode === 'archive' && /Архив/.test(s.bTitle) && (ff === null || ff >= 0)));
  await d.key(K.STOP); await d.sleep(1500);
  out.push(...await panelAcrossMidnight(d, h));
  return out;
}

// P8: a programme that started before local midnight and is still on air must be the panel's «в эфире»
// row (not a future programme). Runs on up to 3 such channels; none exist before midnight → not applicable.
async function panelAcrossMidnight(d, h) {
  const out = [];
  await h.api();
  const picks = await d.ev(`(function(){var d0=new Date();d0.setHours(0,0,0,0);var t0=d0.getTime(),now=Date.now(),o=[],i,n=Channels.count();
    for(i=0;i<n&&o.length<3;i++){var c=Channels.at(i);if(!Channels.isEligible(c))continue;var a=__TT.apiNow(c.id);if(a&&a.start<t0&&a.stop>now)o.push({key:c.key,num:c.num,name:c.name,title:a.title})}return o})()`);
  if (!picks.length) return [row('M4.after-midnight (P8)', '—', 'no programme on air started before midnight (run after 00:00)', null)];
  for (const c of picks) {
    await h.closeAll();
    await d.ev(`Zap.pick(Channels.get(${JSON.stringify(c.key)}))`);   // setup: tune it directly
    await h.firstFrame(Date.now(), 10000);
    await h.guideLoaded();
    await d.key(K.DOWN); await d.sleep(2500);
    const f = (await d.ev("__TT.rows('p-list')")).find((r) => r.focus), title = (await h.st()).progTitle;
    await h.api();                                                // a fresh reference within seconds of the read
    const fresh = await d.ev(`__TT.apiNow(${JSON.stringify(c.key.replace(/^ott:/, ''))})`);
    if (fresh) c.title = fresh.title;
    out.push(row('M4.after-midnight (P8)', c.num + ' ' + c.name, `on air «${c.title}» (started before 00:00) · panel «${title}» cursor ${f ? f.num + ' «' + norm(f.title).slice(0, 40) + '» ' + f.sub : 'none'}`,
      !!f && f.sub === 'в эфире' && hasText(f.title, c.title)));
    await h.closeAll();
  }
  return out;
}

// ---------- M5: ▲ slider — position after a scrub, start of recording, 7-day edge (D1), to live ----------
export async function M5(d, opt) {
  const h = helpers(d), out = [], s0 = await h.st(), where = s0.ch ? s0.ch.num + ' ' + s0.ch.name : '—';
  const parseKnob = (txt, ref) => { const m = /(\d\d):(\d\d):(\d\d)/.exec(txt); if (!m) return null; const x = new Date(ref); x.setHours(+m[1], +m[2], +m[3], 0); if (x.getTime() > ref + 60000) x.setDate(x.getDate() - 1); return x.getTime(); };
  async function scrub(code, n, gap) {
    await h.closeAll(); await d.key(K.UP); await d.sleep(600);
    await h.keys(code, n, gap);
    await d.sleep(300);
    const s = await h.st(), target = parseKnob(s.scrubTime, s.now);
    const t = Date.now();
    await d.key(K.ENTER);
    const ff = await h.firstFrame(t, 15000);
    await d.sleep(500);
    const p = await h.st();
    return { knob: s.scrubTime, target, pos: p.pos, mode: p.mode, ff, fails: p.fails };
  }
  const a = await scrub(K.LEFT, 6, 500);                 // 6 single steps of 30 s
  out.push(row('M5.scrub-back', where, `knob ${a.knob} · position ${new Date(a.pos).toTimeString().slice(0, 8)} · ${a.ff === null ? 'dry' : a.ff + ' ms'}`,
    a.mode === 'archive' && a.target && Math.abs(a.pos - a.target) <= 10000 && (a.ff === null || a.ff >= 0)));
  const b = await scrub(K.LEFT, 1100, 100);              // held (steps grow to 10 min): to the earliest moment (7-day edge)
  out.push(row('M5.7-day-edge (D1)', where, `knob ${b.knob} · mode ${b.mode} · ${b.ff === null ? 'no picture in dry mode' : b.ff < 0 ? 'no first frame in 15 s' : b.ff + ' ms'}`, b.ff === null ? null : b.ff >= 0));
  const c = await scrub(K.RIGHT, 1100, 100);             // held forward: to live
  out.push(row('M5.to-live', where, `knob ${c.knob} · mode ${c.mode}`, c.mode === 'live'));
  return out;
}

// ---------- M7: single zap first frame; burst of 10 → right channel, ≤ 3 app requests ----------
export async function M7(d, opt) {
  const h = helpers(d), out = [];
  await h.closeAll();
  for (let i = 0; i < (d.mode === 'tv' ? 10 : 3); i++) {
    await d.sleep(d.mode === 'tv' ? 4000 : 1500);
    const t = Date.now();
    await d.key(K.RIGHT);
    const ff = await h.firstFrame(t);
    const s = await h.st();
    out.push(row('M7.single', s.ch ? s.ch.num + ' ' + s.ch.name : '—', ff === null ? 'no picture in dry mode' : ff < 0 ? 'no first frame in 10 s' : ff + ' ms', ff === null ? null : ff >= 0 && ff <= 3000));
  }
  await d.sleep(3000);
  const s0 = await h.st();
  const expected = await d.ev(`(function(){var k=${JSON.stringify(s0.ch && s0.ch.key)},i;for(i=0;i<10;i++)k=Channels.nextVisible(k,1,Zap.group());var c=Channels.get(k);return c?c.num+' '+c.name:''})()`);
  const t0 = await d.ev('Date.now()');
  await h.keys(K.RIGHT, 10, 120);
  await d.sleep(4000);
  const s = await h.st(), urls = await d.ev(`__TT.reqListSince(${t0})`);
  out.push(row('M7.burst', `from ${s0.ch.num} ${s0.ch.name}`, `landed ${s.ch.num} ${s.ch.name} (expected ${expected}) · ${urls.length} app requests`, s.ch.num + ' ' + s.ch.name === expected && urls.length <= 3));
  return out;
}

// ---------- M8: pause — no requests while paused, resumes in place ----------
export async function M8(d, opt) {
  const h = helpers(d), out = [], ms = d.mode === 'tv' ? 60000 : 10000;
  await h.closeAll();
  const s0 = await h.st(), where = s0.ch ? s0.ch.num + ' ' + s0.ch.name : '—';
  await d.key(K.PLAY_PAUSE); await d.sleep(500);
  const p = await h.st(), t0 = await d.ev('Date.now()');
  await d.sleep(ms);
  const urls = await d.ev(`__TT.reqListSince(${t0})`);
  await d.key(K.PLAY_PAUSE);
  const ff = await h.firstFrame(Date.now());
  const r = await h.st();
  out.push(row('M8.paused', where, `mode ${p.mode} · ${urls.length} requests in ${ms / 1000} s`, p.mode === 'paused' && urls.length === 0));
  out.push(row('M8.resume-in-place', where, `paused at ${new Date(p.pos).toTimeString().slice(0, 8)} · resumed at ${new Date(r.pos).toTimeString().slice(0, 8)} (${r.mode})`,
    d.mode === 'dry' ? null : Math.abs(r.pos - p.pos) <= 5000 + (ff > 0 ? ff : 0)));
  await d.key(K.STOP); await d.sleep(1500);
  return out;
}

// ---------- M9: life cycle — away (another app or a simulated hide) and back, live then archive ----------
export async function M9(d, opt) {
  const h = helpers(d), out = [];
  async function away(ms) {
    if (d.mode === 'tv' && opt.away) { await opt.away(ms); return 'another app'; }
    await d.ev("(function(){Object.defineProperty(document,'hidden',{configurable:true,get:function(){return true}});document.dispatchEvent(new Event('visibilitychange'));return 1})()");
    await d.sleep(ms);
    await d.ev("(function(){Object.defineProperty(document,'hidden',{configurable:true,get:function(){return false}});document.dispatchEvent(new Event('visibilitychange'));return 1})()");
    return 'simulated hide';
  }
  for (const kind of ['live', 'archive']) {
    await h.closeAll();
    // Archive setup through the slider (▲, 6 × ◀ = 3 min back), which works at any hour of the day.
    if (kind === 'archive') { await d.key(K.UP); await d.sleep(600); await h.keys(K.LEFT, 6, 500); await d.key(K.ENTER); await h.firstFrame(Date.now(), 15000); await d.sleep(5000); }
    const s0 = await h.st();
    const how = await away(d.mode === 'tv' ? 20000 : 3000);
    const t = Date.now();
    const ff = await h.firstFrame(t, 15000);
    const s = await h.st();
    const ok = s.ch && s0.ch && s.ch.key === s0.ch.key && s.mode === s0.mode && (kind === 'live' || Math.abs(s.pos - s0.pos) <= 15000 + (d.mode === 'tv' ? 20000 : 3000));
    out.push(row('M9.' + kind, (s0.ch ? s0.ch.num + ' ' + s0.ch.name : '—') + ' · ' + how,
      `${s0.mode} → ${s.mode} · position ${new Date(s0.pos).toTimeString().slice(0, 8)} → ${new Date(s.pos).toTimeString().slice(0, 8)} · ${ff === null ? 'dry' : ff < 0 ? 'no first frame in 15 s' : ff + ' ms'}`,
      d.mode === 'dry' ? (ok ? true : false) : ok && ff >= 0));
  }
  await d.key(K.STOP); await d.sleep(1500);
  return out;
}

// ---------- M10: soak — PLAYING all the time, media time advancing, no new failures ----------
export async function M10(d, opt) {
  if (d.mode === 'dry') return [row('M10.soak', '—', 'no picture in dry mode', null)];
  const h = helpers(d), mins = opt.soakMin || 10, s0 = await h.st();
  let frozen = 0, notPlaying = 0, prev = s0.media;
  for (let i = 0; i < mins * 6; i++) { await d.sleep(10000); const s = await h.st(); if (s.av !== 'PLAYING') notPlaying++; if (s.media - prev < 5000) frozen++; prev = s.media; }
  const s = await h.st();
  return [row('M10.soak', s0.ch.num + ' ' + s0.ch.name, `${mins} min · not PLAYING ${notPlaying} samples · frozen ${frozen} · new failures ${s.fails - s0.fails}`, notPlaying === 0 && frozen === 0 && s.fails === s0.fails)];
}

// ---------- archives on far high-bitrate movie channels (C2) and the midnight crossing (C5) ----------
export async function C2archive(d, opt) {
  const h = helpers(d), out = [];
  for (const name of opt.c2 || []) {
    const c = await d.ev(`(function(){var i,n=Channels.count();for(i=0;i<n;i++){var c=Channels.at(i);if(c.name===${JSON.stringify(name)})return {key:c.key,num:c.num}}return null})()`);
    if (!c) { out.push(row('C2.archive', name, 'channel not in the list', false)); continue; }
    await h.closeAll();
    await d.ev(`Zap.pick(Channels.get(${JSON.stringify(c.key)}))`);   // setup: tune it directly (the menu path is U0)
    await h.firstFrame(Date.now(), 15000);
    await h.guideLoaded();
    for (const days of [1, 3]) {
      await h.closeAll(); await d.key(K.DOWN); await d.sleep(2500);
      await h.keys(K.LEFT, days, 400);
      await d.sleep(600);
      const pr = (await d.ev("__TT.rows('p-list')")).find((r) => r.focus);
      const t = Date.now();
      await d.key(K.ENTER);
      const ff = await h.firstFrame(t, 15000);
      const s = await h.st();
      out.push(row('C2.archive-' + days + 'd', c.num + ' ' + name, `«${pr ? norm(pr.title).slice(0, 40) : '?'}» · mode ${s.mode} · ${ff === null ? 'no picture in dry mode' : ff < 0 ? 'no first frame in 15 s' : ff + ' ms'}`,
        ff === null ? (s.mode === 'archive' ? null : false) : s.mode === 'archive' && ff >= 0));
    }
    await d.key(K.STOP); await d.sleep(1500);
  }
  return out;
}

// End of a recording continues into the next programme without a jump (D2): starts 60 s before the end of
// the previous programme of the playing channel and checks the position 90 s later.
export async function M6(d, opt) {
  if (d.mode === 'dry') return [row('M6.continuation (D2)', '—', 'no picture in dry mode', null)];
  const h = helpers(d), s0 = await h.st();
  const p = await d.ev(`(function(){var c=Playback.current(),l=EPG.day(c.id,0),now=Date.now(),i;for(i=l.length-1;i>=0;i--)if(l[i].stop<now-300000)return {start:l[i].start,stop:l[i].stop,title:l[i].title};return null})()`);
  if (!p) return [row('M6.continuation (D2)', s0.ch.name, 'no finished programme today', false)];
  const from = p.stop - 60000;
  await d.ev(`Playback.archive(Playback.current(), ${from})`);   // setup: a precise start (the slider path is M5)
  await h.firstFrame(Date.now(), 15000);
  const t = Date.now();
  await d.sleep(90000);
  const s = await h.st();
  const expected = from + (Date.now() - t);
  return [row('M6.continuation (D2)', s0.ch.num + ' ' + s0.ch.name + ' · «' + p.title + '»', `position ${new Date(s.pos).toTimeString().slice(0, 8)} vs expected ${new Date(expected).toTimeString().slice(0, 8)} · mode ${s.mode} · new failures ${s.fails - s0.fails}`,
    Math.abs(s.pos - expected) <= 10000 && s.fails === s0.fails)];
}

// ---------- M11 (menu left open): the visible rows stay equal to the programme on air for N minutes ----------
// Checked every minute against the API fetched at that moment; a row may lag an ended programme ≤ 10 s.
export async function menuOpenFreshness(d, minutes) {
  const h = helpers(d), out = [];
  await h.closeAll(); await d.key(K.ENTER); await d.sleep(800);
  let bad = 0, checks = 0, maxEnded = 0, maxLag = 0, badRefs = 0, byGuide = 0; const examples = [], mism = [];
  for (let m = 1; m <= minutes; m++) {
    await d.sleep(60000);
    if ((await h.st()).overlay !== 'menu') { out.push(row('M11.menu-open', '—', 'the menu closed by itself at +' + m + ' min', false)); return out; }
    const readAt = await d.ev('Date.now()');
    const got = await d.ev("__TT.rows('channels')");
    if (!Array.isArray(got)) { out.push(row('M11.menu-open', '—', 'the page could not be read at +' + m + ' min: ' + JSON.stringify(got).slice(0, 160), false)); return out; }
    const rows = got.filter((r) => r.full);
    const ref = await h.api();
    if (!ref || !ref.size || ref.at - readAt > 10000) { badRefs++; continue; }   // no fresh reference this minute
    maxEnded = Math.max(maxEnded, ref.ended); maxLag = Math.max(maxLag, ref.at - readAt);
    for (const r of rows) {
      const c = await d.ev(`__TT.chByNum(${JSON.stringify(r.num)})`), a = c && await d.ev(`__TT.apiNow(${JSON.stringify(c.id)})`);
      if (!a) continue;
      checks++;
      if (!hasText(r.sub, a.title) && Date.now() - a.start > 10000) {
        // Tie-breaker: the channel's own guide at the read time; elapsed since the show changed.
        await d.ev(`__TT.guideStart(${JSON.stringify(c.id)})`);
        await h.waitFor(`__TT.guide[${JSON.stringify(c.id)}]`, 15000);
        const g = await d.ev(`__TT.guideAt(${JSON.stringify(c.id)}, ${readAt})`);
        if (g.cur && hasText(r.sub, g.cur)) { byGuide++; continue; }
        const since = Math.round((readAt - (g.curStart || a.start)) / 1000);
        bad++; mism.push({ num: r.num, since });
        if (examples.length < 40) examples.push('+' + m + ' min ' + r.num + ' ' + norm(r.title) + ': «' + norm(r.sub) + '» ≠ «' + a.title + '» (guide «' + (g.cur || '—') + '») · ' + since + ' s');
      }
    }
  }
  await h.closeAll();
  out.push(row('M11.menu-open', minutes + ' min', `${checks} row checks · ${bad} not on air (${mism.filter((x) => x.since < 60).length} of them < 60 s after the show changed) · ${byGuide} resolved by the guide · reference fresh, ≤ ${maxLag} ms after each read, ended shows in it ≤ ${maxEnded} · ${badRefs} minutes without a usable reference` + (examples.length ? ' · ' + examples.join(' | ') : ''), bad === 0 && checks > 0));
  return out;
}

// ---------- diagnostic: a cold open of 348 Stingray iConcerts, typed as its number ----------
// Records over 30 s: the AVPlay state and the media clock every 200 ms, spinner (buffering) on/off
// transitions, the player's rebuffer counter and failure-log lines, and the time to the first frame.
export async function cold348(d) {
  const h = helpers(d);
  await h.closeAll();
  const c = await d.ev('__TT.chByNum(348)');
  const before = await d.ev('(function(){var s=Diag.snapshot();return {rebuffer:s.counters.rebuffer||0,fails:s.recent.length}})()');
  const t = Date.now();
  for (const k of [51, 52, 56]) { await d.key(k); await d.sleep(150); }    // digits 3 4 8
  const states = [], spin = [];
  let lastState = '', lastSpin = null, ff = -1;
  while (Date.now() - t < 30000) {
    const s = await d.ev("(function(){var a=window.webapis&&webapis.avplay,st='';try{st=a?a.getState():'html'}catch(e){st='ERR'}var sp=document.getElementById('spinner');return {st:st,media:Player.mediaTimeMs(),spin:!!sp&&!/(^|\\s)hidden(\\s|$)/.test(sp.className),ch:(Playback.current()||{}).num}})()");
    const at = Date.now() - t;
    if (s.st !== lastState) { states.push(at + 'ms ' + s.st); lastState = s.st; }
    if (s.spin !== lastSpin) { spin.push(at + 'ms ' + (s.spin ? 'buffering' : 'clear')); lastSpin = s.spin; }
    if (ff < 0 && s.st === 'PLAYING' && s.media > 0) ff = at;
    await d.sleep(200);
  }
  const after = await d.ev('(function(){var s=Diag.snapshot();return {rebuffer:s.counters.rebuffer||0,fails:s.recent.length,last:s.recent.slice(-3)}})()');
  const where = c ? c.num + ' ' + c.name : '348 (not in the list)';
  const measured = `first frame ${ff < 0 ? 'none in 30 s' : ff + ' ms after the first digit'} · states ${states.join(' → ')} · spinner ${spin.join(', ')} · rebuffers +${after.rebuffer - before.rebuffer} · new failures +${after.fails - before.fails}` + (after.fails > before.fails ? ' · ' + after.last.join(' | ') : '');
  return [row('M2.cold-348', where, measured, d.mode === 'dry' ? null : ff >= 0)];
}
