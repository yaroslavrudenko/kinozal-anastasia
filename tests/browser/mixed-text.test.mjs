// Mixed texts (owner, 2026-10-27: «Нужно убедиться, что смешанные тексты меню и названий выглядят одинаково … не
// создают проблем и правильно отображаются»). Provider texts in another script than the interface (Hebrew in a Russian
// or English menu, Latin and Cyrillic in a Hebrew one), names that start with an emoji or a flag, names with no letter
// at all, and names long enough to wrap: each reads as it is written, wrapped ones keep one edge for all their lines,
// our ★ ▶ marks stay at the interface's ends, single-line rows start at one edge in one font. The same on every
// screen that shows provider text beside ours: the banner, search («group · programme»), the programme panel, the
// archive slider's title, and our «(… until HH:MM)» around an ended programme.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, f, K } from './app-page.mjs';

const WRAP_HE = 'כאן 11 — תאגיד השידור הישראלי, שידור חי ומבזקי חדשות לאורך כל שעות היום';
const WRAP_RU = 'Наше новое кино — фильмы российских режиссёров в высоком качестве и без рекламы';
const EMOJI = ['🇮🇱 כאן 11 חינוכית', '📺 Channel 5', '🎬 Кино 24'];
const DIGITS = ['24/7 · 365', '123 · 456'];
const NAMES = ['Channel 9 [RU]', 'כאן 11 (HD)', 'Kan 11 (1080p)', '1+1', 'Первый канал (+2)', 'i24NEWS עברית', 'ערוץ 14 – עכשיו', 'Суспільне 24/7',
  '(HD) Discovery', 'מכאן [ערבית]'].concat(EMOJI, DIGITS, [WRAP_HE, WRAP_RU]);
// Titles whose edges are neutral or numeric («!», a bracket, a leading time) are the ones the bidi algorithm alone
// gets wrong next to our text: they prove the embedding.
const PROGS = ['Новости (23:00)', 'החדשות — 20:00 (שידור חי)', 'Live: World News (part 2)', 'מבט 2025: סיכום', 'שידור חי!', '20:00 החדשות', 'Live!', '(HD) Discovery'];
// «Paramount+» ends in a neutral sign: beside a Hebrew programme in a Hebrew sentence it reads «+Paramount» unless it is
// embedded (review 4, F3) — the brackets of «Кино (HD)» are paired by the bidi algorithm and never show that.
const GROUPS = ['Кино (HD)', 'News', 'חדשות (24/7)', 'Paramount+'];
const PANEL = ['הסרט הלילה: מסע ארוך אל הצפון הקר עם הצוות המלא של התוכנית ואורחים מיוחדים', 'Большое путешествие по Транссибирской магистрали: от Москвы до Владивостока за семь дней', 'Evening news (live)'];
function data(now) {
  const d = JSON.parse(f.ottChannelList(NAMES.length, { now, padChars: 0 }).body);
  Object.keys(d).forEach((id, i) => {
    d[id].channel_name = NAMES[i]; d[id].name = PROGS[i % PROGS.length];
    d[id].category = { class: 'g' + (i % GROUPS.length), name: GROUPS[i % GROUPS.length] };
  });
  return d;
}
function guide(id, now) {
  const g = JSON.parse(f.ottGuide(id, { now, descrChars: 0 }));
  g.epg_data.forEach((p, i) => { p.name = PANEL[i % PANEL.length]; });
  return JSON.stringify(g);
}

const opened = [];
after(async () => { for (const a of opened) await a.close(); });

// In the page: helpers that measure how a text inside an element is laid out.
function install(page) {
  return page.evaluate(() => {
    // W: the characters compared — every visible one in the BMP (letters, digits, brackets, «!», dashes); emoji and
    // flags (surrogate pairs) are drawn as one glyph and left out.
    const R = /[א-ת]/, L = /[A-Za-zА-яЁёІіЇїЄєҐґ]/, W = /^[^\s\uD800-\uDFFF]$/;
    const own = (s) => { for (const c of s) { if (R.test(c)) return 'rtl'; if (L.test(c)) return 'ltr'; } return 'ltr'; };
    const textNode = (el, w) => { const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = it.nextNode())) if (n.data.indexOf(w) >= 0) return n; return null; };
    const box = (node, i) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return r.getBoundingClientRect(); };
    // The visual left-to-right order of the visible characters of w (emoji, marks and spaces are left out).
    const order = (node, at, w) => [...w].map((c, k) => [c, k]).filter(([c]) => W.test(c)).map(([c, k]) => {
      const i = at + [...w].slice(0, k).join('').length, b = box(node, i); return [b.left + b.width / 2, b.top, k];
    });
    // ok | wrapped | missing | hidden | WRONG <got> / <want>
    window.__reads = (el, w) => {
      const node = el && textNode(el, w); if (!node) return 'missing';
      const got = order(node, node.data.indexOf(w), w);
      if (!got.length || got.every((g) => g[0] === 0)) return 'hidden';        // not laid out: nothing to compare
      if (new Set(got.map((g) => Math.round(g[1] / 10))).size > 1) return 'wrapped';
      const ref = document.createElement('div'), cs = getComputedStyle(node.parentElement);
      ref.dir = own(w); ref.style.cssText = 'position:absolute;top:-500px;left:0;white-space:nowrap;font:' + cs.font;
      ref.textContent = w; document.body.appendChild(ref);
      const want = order(ref.firstChild, 0, w); ref.remove();
      const seq = (a) => a.slice().sort((x, y) => x[0] - y[0]).map((x) => x[2]).join(',');
      return seq(got) === seq(want) ? 'ok' : 'WRONG ' + seq(got) + ' / ' + seq(want);
    };
    // The lines of a wrapped text element: each line's start edge in the text's own direction, and that direction.
    window.__lines = (el) => {
      const node = el.firstChild, d = getComputedStyle(el).direction, rows = new Map();
      for (let i = 0; i < node.length; i++) {
        if (/\s/.test(node.data[i])) continue;
        const b = box(node, i); if (!b.width) continue;
        const k = Math.round(b.top / 10), r = rows.get(k) || { l: Infinity, r: -Infinity }; r.l = Math.min(r.l, b.left); r.r = Math.max(r.r, b.right); rows.set(k, r);
      }
      const ls = [...rows.values()];
      return { dir: d, count: ls.length, starts: ls.map((x) => Math.round(d === 'rtl' ? x.r : x.l)), box: el.getBoundingClientRect().toJSON() };
    };
  });
}

// One look at the menu's channel column: each wanted name's reading, its cell direction, wrapped lines, marks, edges.
function channelColumn(page, names) {
  return page.evaluate((names) => {
    const uiRtl = document.documentElement.dir === 'rtl', out = { names: {}, edges: [], fonts: new Set(), marks: [] };
    for (const row of document.querySelectorAll('#channels .row')) {
      if (row.style.visibility === 'hidden' || !row.getBoundingClientRect().height) continue;
      const x = row.querySelector('.t .x'), name = x.textContent, pre = row.querySelector('.t > i:first-child'), post = row.querySelector('.t > i:last-child');
      const cs = getComputedStyle(x); out.fonts.add(cs.fontFamily + '|' + cs.fontSize + '|' + cs.fontWeight);
      const lines = window.__lines(x);
      // The focused row is scaled up (css .focus): its edge is not compared.
      if (lines.count === 1 && !pre.textContent && !/\bfocus\b/.test(row.className)) out.edges.push(Math.round(uiRtl ? x.getBoundingClientRect().right : x.getBoundingClientRect().left));
      if (names.indexOf(name) >= 0) out.names[name] = { reads: window.__reads(x, name), dir: x.getAttribute('dir') || '', lines };
      const xb = x.getBoundingClientRect();
      if (pre.textContent) { const b = pre.getBoundingClientRect(); out.marks.push('★ ' + (uiRtl ? b.left >= xb.right - 1 : b.right <= xb.left + 1)); }
      if (post.textContent) { const b = post.getBoundingClientRect(); out.marks.push('▶ ' + (uiRtl ? b.right <= xb.left + 1 : b.left >= xb.right - 1)); }
    }
    out.fonts = [...out.fonts];
    return out;
  }, names);
}

for (const lang of ['he', 'en', 'ru']) {
  test('mixed text: ' + lang + ' — channel names (emoji- and flag-first, digits only, wrapped) read as written; ★ before, ▶ after, at the interface ends; one edge and font', async () => {
    const now = Date.now();
    const a = await openApp({ lang, data: data(now), guide: (id) => guide(id, now) });
    opened.push(a);
    await install(a.page);
    await a.page.evaluate(() => { Overlay.close(); Favs.toggle(Channels.at(Playback.current() ? Channels.indexOfKey(Playback.current().key) : 0).key); Channels.rebuild(); });
    await a.press(K.ENTER);
    for (let i = 0; i < 30; i++) await a.key(K.UP);
    await new Promise((r) => setTimeout(r, 300));
    const seen = {}, marks = [], edges = [], fonts = new Set();
    for (let p = 0; p < 4; p++) {
      const c = await channelColumn(a.page, NAMES);
      Object.assign(seen, c.names); marks.push(...c.marks); edges.push(...c.edges); c.fonts.forEach((x) => fonts.add(x));
      await a.press(K.PG_DOWN);
    }
    assert.deepEqual(NAMES.filter((n) => !seen[n]), [], 'names never shown');
    for (const n of NAMES) if (seen[n].reads !== 'wrapped') assert.equal(seen[n].reads, 'ok', n + ' reads ' + seen[n].reads);
    // The direction each provider name is laid out in: its own when it is not the interface's; none for no letter in LTR.
    const want = (n) => (DIGITS.indexOf(n) >= 0 ? (lang === 'he' ? 'ltr' : '') : /[א-ת]/.test([...n].find((c) => /[א-תA-Za-zА-яЁёІі]/.test(c))) ? (lang === 'he' ? '' : 'rtl') : (lang === 'he' ? 'ltr' : ''));
    assert.deepEqual(NAMES.map((n) => [n, seen[n].dir]), NAMES.map((n) => [n, want(n)]));
    // Wrapped names: two lines or more, every line starting at the text's own start edge.
    for (const n of [WRAP_HE, WRAP_RU]) {
      const l = seen[n].lines;
      assert.ok(l.count >= 2, n + ' did not wrap: ' + JSON.stringify(l));
      assert.equal(l.dir, /[א-ת]/.test(n) ? 'rtl' : 'ltr');
      assert.ok(Math.max(...l.starts) - Math.min(...l.starts) <= 2, n + ': its lines start at ' + JSON.stringify(l.starts));
    }
    assert.ok(marks.some((m) => m.startsWith('★')) && marks.some((m) => m.startsWith('▶')), 'no ★ or ▶ measured: ' + JSON.stringify(marks));
    assert.deepEqual(marks.filter((m) => m.endsWith('false')), [], 'a mark on the wrong side of its name');
    assert.equal(fonts.size, 1, 'fonts differ ' + JSON.stringify([...fonts]));
    assert.ok(edges.length >= 6 && Math.max(...edges) - Math.min(...edges) <= 2, 'single-line rows start at ' + JSON.stringify(edges));
    await a.close(); opened.splice(opened.indexOf(a), 1);
  });

  test('mixed text: ' + lang + ' — the «now» lines, the groups, the banner, search «group · programme», the programme panel, the archive title and «(… until HH:MM)» read as written', async () => {
    const now = Date.now();
    const a = await openApp({ lang, data: data(now), guide: (id) => guide(id, now) });
    opened.push(a);
    await install(a.page);
    await a.page.evaluate(() => Overlay.close());
    await a.press(K.ENTER);
    await new Promise((r) => setTimeout(r, 300));
    const r = {};
    // «now» lines and the groups column.
    r.now = await a.page.evaluate((progs) => progs.map((w) => [...document.querySelectorAll('#channels .row .s .x')].map((x) => window.__reads(x, w)).find((v) => v !== 'missing') || 'missing'), PROGS);
    r.groups = await a.page.evaluate((gs) => gs.map((w) => [...document.querySelectorAll('#groups .grow .t .x')].map((x) => window.__reads(x, w)).find((v) => v !== 'missing') || 'missing'), GROUPS);
    // The banner of a channel whose name and programme are in the other script.
    r.banner = await a.page.evaluate(() => {
      Overlay.close();
      const c = Channels.at(Channels.groups()[Channels.allIdx()].items.find((k) => Channels.at(k).name === 'ערוץ 14 – עכשיו'));
      Banner.preview(c);
      const title = window.__reads(document.getElementById('b-title'), c.name);
      const sh = EPG.shown(c.id, Date.now());
      return { title, now: sh ? window.__reads(document.getElementById('b-now'), sh.p.title) : 'no programme' };
    });
    // Search: the sub line is «group · programme» — each reads as written, and the sentence runs in the interface's
    // direction: the group first (on the right in Hebrew), whatever script the group and the programme are in
    // (review 4, F3: an English group beside an English programme read as one left-to-right run in Hebrew).
    r.search = await a.page.evaluate(() => {
      Overlay.open('search'); const inp = document.getElementById('search-input'); inp.value = ''; inp.dispatchEvent(new Event('input'));
      const out = [], order = [], rtl = document.documentElement.dir === 'rtl';
      const span = (node, w) => { const i = node.data.indexOf(w), r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + w.length); return r.getClientRects()[0]; };
      for (const row of document.querySelectorAll('#search-list .row')) {
        if (row.style.visibility === 'hidden') continue;
        const s = row.querySelector('.s .x'), c = Channels.at(+row.getAttribute('data-i') >= 0 ? Channels.search('').items[+row.getAttribute('data-i')] : -1);
        if (!c || s.textContent.indexOf(' · ') < 0) continue;
        const title = EPG.shown(c.id, Date.now()).p.title;
        out.push(window.__reads(s, c.group), window.__reads(s, title));
        const g = span(s.firstChild, c.group), p = span(s.firstChild, title);
        const first = Math.abs(g.top - p.top) > 5 ? g.top < p.top : rtl ? g.left > p.left : g.left < p.left;
        order.push((first ? 'ok' : 'WRONG') + ' ' + c.group + ' · ' + title);
      }
      Overlay.close();
      return out.concat(order.filter((x) => x.indexOf('WRONG') === 0), order.length >= 6 ? [] : ['too few: ' + order.length]);
    });
    // Our «(… until HH:MM)» around an ended programme, and the archive slider's «name · programme».
    r.ended = await a.page.evaluate((progs) => progs.map((w) => {
      UI.show('banner', true);
      const el = document.getElementById('b-now'); el.textContent = EPG.label({ p: { title: w, stop: Date.now() - 60000 }, ended: true });
      const t = window.__reads(el, w), hm = Util.hhmm(new Date(Date.now() - 60000)), time = window.__reads(el, hm);
      return t + ' / ' + time;
    }), PROGS);
    r.scrub = await a.page.evaluate(() => {
      const c = Channels.at(Channels.groups()[Channels.allIdx()].items.find((k) => Channels.at(k).name === 'כאן 11 (HD)'));
      Playback.live(c); Overlay.open('scrub');
      const el = document.getElementById('s-title'), p = EPG.at(c.id, Playback.position());
      const out = [window.__reads(el, c.name), p ? window.__reads(el, p.title) : 'no programme'];
      Overlay.close();
      return out;
    });
    // The programme panel: wrapped titles keep one edge; single-line ones read as written.
    await a.page.evaluate(() => Overlay.open('panel'));
    await a.page.waitForFunction((t) => [...document.querySelectorAll('#p-list .prow .t .x')].some((x) => x.textContent === t), { timeout: 5000 }, PANEL[2]);
    r.panel = await a.page.evaluate((titles) => {
      const out = { reads: [], wrapped: [] };
      for (const x of document.querySelectorAll('#p-list .prow .t .x')) {
        if (x.closest('.prow').style.visibility === 'hidden') continue;
        const w = titles.find((t) => x.textContent === t); if (!w) continue;
        const v = window.__reads(x, w);
        if (v === 'wrapped') { const l = window.__lines(x); out.wrapped.push([w.slice(0, 12), l.dir, Math.max(...l.starts) - Math.min(...l.starts)]); } else out.reads.push(v);
      }
      const title = document.getElementById('p-title'), c = Playback.current();
      out.title = window.__reads(title, c.name);
      Overlay.close();
      return out;
    }, PANEL);

    if (process.env.MIXED_DEBUG) console.error(lang, JSON.stringify(r));
    assert.ok(r.now.filter((v) => v === 'ok').length >= 6, 'now lines: ' + JSON.stringify(r.now));
    assert.deepEqual(r.now.filter((v) => v.startsWith('WRONG')), []);
    assert.deepEqual(r.groups, GROUPS.map(() => 'ok'), 'groups');
    assert.deepEqual(r.banner, { title: 'ok', now: 'ok' }, 'banner');
    assert.ok(r.search.length >= 6, 'search: too little measured ' + JSON.stringify(r.search));
    assert.deepEqual(r.search.filter((v) => v !== 'ok'), [], 'search «group · programme»');
    assert.deepEqual(r.ended, PROGS.map(() => 'ok / ok'), '«(… until HH:MM)»');
    assert.deepEqual(r.scrub, ['ok', 'ok'], 'archive slider title');
    assert.equal(r.panel.title, 'ok', 'panel title');
    assert.ok(r.panel.reads.length >= 1 && r.panel.reads.every((v) => v === 'ok'), 'panel single-line titles ' + JSON.stringify(r.panel.reads));
    assert.ok(r.panel.wrapped.length >= 2, 'panel: no wrapped title measured ' + JSON.stringify(r.panel));
    for (const [w, d, spread] of r.panel.wrapped) assert.ok(spread <= 2, 'panel «' + w + '…» (' + d + '): its lines start ' + spread + ' px apart');
    assert.deepEqual([...new Set(r.panel.wrapped.map((x) => x[1]))].sort(), ['ltr', 'rtl'], 'panel: both directions wrapped');
    await a.close(); opened.splice(opened.indexOf(a), 1);
  });
}
