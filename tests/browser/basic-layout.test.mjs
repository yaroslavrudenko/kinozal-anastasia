// «Вид меню: крупный» (Basic) measured in headless Chrome at the TV's 1920×1080, as the owner decided it after the review
// of 1.9.4 (COMMON-DECISION O1–O7, B1, B7, B13, B15):
//  - the cards (O1): 3 × 3 inside the safe area with equal gaps; on every card the name on one centre line and the count
//    on one bottom line; weight 600; a name is one line and never cut; focus a gentle outline — no yellow ring, no bar;
//  - the list (O2–O4): whole rows only, each on its own band 8 px apart; logo 120 × 80; name 46 px, "now" line 33 px,
//    number and «ещё N мин» 34 px with the progress under them as wide as their column; focus the soft fill alone (no
//    outline), ≥ 3:1 against the band; nothing moves when the focus moves; a 2-line title leaves every row whole (B1);
//  - Hebrew mirrored, a Latin name on the start edge (B15); header, rows and help bar on one text edge (B15);
//  - only the layout in use is laid out (B7);
//  - ⚙ / 📡 / ℹ large in both layouts and inside 1080 px (O6), the free channels' notice on screen (O7);
//  - the help bar 72 px with 36 px text on one line in ru, uk, he, en; a toast lies on the help bar.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, f, K, LONG_NAMES, longData } from './app-page.mjs';

const opened = [];
after(async () => { for (const a of opened) await a.close(); });
const CH = { UP: 427, DOWN: 428 }, YELLOW = 405;
const LONG_GROUPS = ['Развлекательные', 'Информационно-развлекательные', 'Музыкальные клипы 80-х и 90-х', 'Суспільне Культура: документальні фільми, театр і музика',
  'ערוצי ילדים ונוער בעברית', 'Documentary & Science HD', 'Достопримечательности мира', 'Познавательные'];

// WCAG contrast of two rgb() colours.
const lum = (c) => { const v = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((x) => { x = x / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// The app in the Basic layout; OK opens the list (O5). cards: Back to the cards.
async function basic(lang, data, cards) {
  const a = await openApp({ lang, data: data || longData(40, Date.now()), guide: (id) => f.ottGuide(id) });
  opened.push(a);
  await a.page.evaluate(() => { Overlay.close(); BasicMenu.setOn(true); });
  await a.press(K.ENTER);
  if (cards) await a.press(K.BACK);
  return a;
}
const firstCard = (a) => a.press(CH.UP, CH.UP, CH.UP, CH.UP, CH.UP, CH.UP);
const cardsView = (a) => a.page.evaluate(() => Array.from(document.querySelectorAll('#cards-grid .card')).filter((c) => c.style.visibility !== 'hidden').map((c) => {
  const b = c.getBoundingClientRect(), x = c.querySelector('.t .x'), s = c.querySelector('.s'), xb = x.getBoundingClientRect(), sb = s.getBoundingClientRect(), cs = getComputedStyle(c.querySelector('.t'));
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, focus: /\bfocus\b/.test(c.className), name: x.textContent, cls: c.className,
    nameMid: Math.round((xb.top + xb.bottom) / 2 - b.top), nameH: Math.round(xb.height), countTop: Math.round(sb.top - b.top), font: cs.fontSize, weight: cs.fontWeight,
    nameW: Math.round(xb.width), room: Math.round(c.querySelector('.t').getBoundingClientRect().width), lineH: parseFloat(cs.lineHeight) };
}));
const rect = (a, sel) => a.page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: b.height }; }, sel);
// A word broken across lines (split at spaces and after hyphens).
const brokenWords = (a, sel) => a.page.evaluate((sel) => {
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    if (!el.offsetParent || !el.firstChild) continue;
    const text = el.textContent, node = el.firstChild, re = /[^\s-]+-?/g;
    let m;
    while ((m = re.exec(text))) {
      const r = document.createRange();
      r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
      if (new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top))).size > 1) out.push(m[0] + ' in ' + text);
    }
  }
  return out;
}, sel);

test('basic layout (O1): the cards — 3 × 3 inside the safe area, equal gaps; the name on one centre line and the count on one bottom line on every card; weight 600 — ru, uk, he, en', async () => {
  for (const lang of ['ru', 'uk', 'he', 'en']) {
    const a = await basic(lang, null, true);
    for (const page of [0, 1]) {
      if (page) await a.press(CH.DOWN);
      else await firstCard(a);
      const cards = await cardsView(a), head = await rect(a, '#cards .b-head'), hint = await rect(a, '#cards-hint');
      assert.equal(cards.length, 9, lang + ': ' + cards.length + ' cards');
      const lefts = [...new Set(cards.map((c) => Math.round(c.left)))].sort((x, y) => x - y), tops = [...new Set(cards.map((c) => Math.round(c.top)))].sort((x, y) => x - y);
      assert.ok(lefts.length === 3 && tops.length === 3 && lefts[1] - lefts[0] === lefts[2] - lefts[1] && tops[1] - tops[0] === tops[2] - tops[1], lang + ': not an even 3 × 3');
      assert.deepEqual([...new Set(cards.map((c) => c.nameMid))].length, 1, lang + ': names at ' + cards.map((c) => c.nameMid));
      assert.deepEqual([...new Set(cards.map((c) => c.countTop))].length, 1, lang + ': counts at ' + cards.map((c) => c.countTop));
      for (const c of cards) {
        assert.ok(c.left >= 96 && c.right <= 1824 && c.top >= head.bottom && c.bottom <= hint.top, lang + ': «' + c.name + '» outside its place');
        assert.equal(c.weight, '600');
        assert.ok(c.nameH <= c.lineH + 1 && c.nameW <= c.room, lang + ': «' + c.name + '» not on one line inside its card');
      }
      const first = cards.find((c) => c.focus);
      if (!page) assert.equal(Math.round(lang === 'he' ? first.right : first.left), lang === 'he' ? Math.max(...cards.map((c) => Math.round(c.right))) : lefts[0], lang + ': the first card is not on the start side');
    }
  }
});

test('basic layout (O1, O2): card focus is a gentle outline over a dark gap — no yellow ring, no white bar, no scaling, no transition — never clipped, at the corners, ru and he', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await basic(lang, null, true);
    await firstCard(a);
    const ring = () => a.page.evaluate(() => {
      const c = document.querySelector('#cards-grid .card.focus'), b = c.getBoundingClientRect(), cs = getComputedStyle(c), clipped = [];
      for (let p = c.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflow === 'visible') continue;
        const r = p.getBoundingClientRect();
        if (b.left - 6 < r.left || b.right + 6 > r.right || b.top - 6 < r.top || b.bottom + 6 > r.bottom) clipped.push(p.id || p.className);
      }
      return { shadow: cs.boxShadow, transition: cs.transitionDuration, transform: cs.transform, focused: document.querySelectorAll('#cards-grid .card.focus').length, clipped };
    });
    const keys = lang === 'he' ? { next: K.LEFT, prev: K.RIGHT } : { next: K.RIGHT, prev: K.LEFT };
    for (const step of [[], [keys.next, keys.next], [K.DOWN, K.DOWN], [keys.prev, keys.prev], [CH.DOWN, CH.DOWN, CH.DOWN, CH.DOWN, CH.DOWN]]) {
      await a.press(...step);
      const r = await ring();
      assert.ok(!/255, 212, 0/.test(r.shadow), lang + ': a yellow ring');
      assert.ok(!/inset/.test(r.shadow), lang + ': a bar inside the card');
      assert.match(r.shadow, /rgba\(201, 214, 240, 0\.7\) 0px 0px 0px 6px/, lang + ': no gentle outline');
      assert.equal(r.focused, 1);
      assert.deepEqual(r.clipped, [], lang + ': the outline is clipped by ' + r.clipped);
      assert.equal(r.transition, '0s'); assert.equal(r.transform, 'none');
    }
  }
});

test('basic layout (O1, B5): a card name is one line, never cut, never broken inside a word — the longest real group names, ru, uk, he, en', async () => {
  for (const lang of ['ru', 'uk', 'he', 'en']) {
    const data = longData(40, Date.now(), (ch, i) => { ch.category = { class: 'g' + (i % LONG_GROUPS.length), name: LONG_GROUPS[i % LONG_GROUPS.length] }; });
    const a = await basic(lang, data, true);
    await firstCard(a);
    const seen = new Map(), broken = [];
    for (let page = 0; page < 4; page++) {
      for (const c of await cardsView(a)) seen.set(c.name, c);
      broken.push(...await brokenWords(a, '#cards-grid .card .t .x'));
      await a.press(CH.DOWN);
    }
    assert.deepEqual(broken, [], lang + ': words broken inside');
    // One line; only a word too wide even at 36 px wraps — at a hyphen or space, whole, above the count.
    for (const c of seen.values()) {
      const oneLine = c.nameH <= c.lineH + 1, smallest = /\blongest\b/.test(c.cls);
      assert.ok(c.nameW <= c.room && (oneLine || smallest) && c.nameMid + c.nameH / 2 <= c.countTop, lang + ': «' + c.name + '» (' + c.cls + ') ' + c.nameW + ' of ' + c.room + ' px, ' + c.nameH + ' px high');
    }
    assert.ok(seen.has('Развлекательные') && seen.has('Достопримечательности'), lang + ': ' + [...seen.keys()]);
  }
});

const listLook = (a) => a.page.evaluate(() => {
  const clip = document.querySelector('#clist .b-clip').getBoundingClientRect();
  return Array.from(document.querySelectorAll('#clist-rows .brow')).filter((r) => r.style.visibility !== 'hidden').map((r) => {
    const b = r.getBoundingClientRect(), cs = getComputedStyle(r), logo = r.querySelector('.logo').getBoundingClientRect(), t = r.querySelector('.t'), s = r.querySelector('.s');
    const left = r.querySelector('.left'), lt = r.querySelector('.lt'), pg = r.querySelector('.pg'), lb = left.getBoundingClientRect(), ltb = lt.getBoundingClientRect(), pgb = pg.getBoundingClientRect();
    const tb = t.getBoundingClientRect(), sb = s.getBoundingClientRect();
    return { num: r.children[0].textContent, focus: /\bfocus\b/.test(r.className), top: b.top, bottom: b.bottom, inClip: b.top >= clip.top - 0.5 && b.bottom <= clip.bottom + 0.5,
      gap: parseFloat(cs.borderBottomWidth), band: cs.backgroundColor, shadow: cs.boxShadow, transition: cs.transitionDuration,
      logo: [Math.round(logo.width), Math.round(logo.height), Math.round(logo.left), Math.round(logo.top)],
      name: [getComputedStyle(t).fontSize, getComputedStyle(t).fontWeight], now: [getComputedStyle(s).fontSize, getComputedStyle(s).color],
      num: [r.children[0].textContent, getComputedStyle(r.children[0]).fontSize][0], numFont: getComputedStyle(r.children[0]).fontSize, leftFont: getComputedStyle(lt).fontSize,
      pg: { under: pgb.top >= ltb.bottom - 0.5, width: Math.round(pgb.width), col: Math.round(lb.width), track: getComputedStyle(pg).backgroundColor, shown: getComputedStyle(pg).visibility },
      under: sb.top >= tb.bottom - 1, logoAtStart: document.documentElement.dir === 'rtl' ? logo.left > tb.right : logo.right < tb.left };
  });
});

test('basic layout (O2–O4): the list — whole rows on bands 8 px apart; logo 120 × 80; name 46 px bold, the grey "now" line 33 px under it, number and «ещё N мин» 34 px with the progress under them as wide as their column; focus the soft fill alone, ≥ 3:1 against the band; nothing moves — ru and he', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await basic(lang);
    const rows = await listLook(a);
    assert.ok(rows.length >= 4 && rows.length <= 8, lang + ': ' + rows.length + ' rows');
    const band = rows.find((r) => !r.focus).band, focus = rows.find((r) => r.focus);
    for (const r of rows) {
      assert.ok(r.inClip, lang + ': row ' + r.num + ' not whole');
      assert.equal(r.gap, 8, lang + ': no 8 px gap under row ' + r.num);
      assert.deepEqual(r.logo.slice(0, 2), [120, 80]);
      assert.deepEqual(r.name, ['46px', '700']);
      assert.equal(r.now[0], '33px');
      assert.deepEqual([r.numFont, r.leftFont], ['34px', '34px']);
      assert.ok(r.under && r.logoAtStart, lang + ': row ' + r.num + ' out of its order');
      if (r.pg.shown !== 'hidden') assert.ok(r.pg.under && r.pg.width === r.pg.col, lang + ': the progress is not under «ещё N мин» at its width: ' + JSON.stringify(r.pg));
      assert.equal(r.transition, '0s');
      if (!r.focus) assert.equal(r.now[1], 'rgb(180, 191, 208)');
    }
    assert.equal(focus.shadow, 'none', lang + ': the focused row has an outline: ' + focus.shadow);
    assert.ok(ratio(focus.band, band) >= 3, lang + ': focus fill ' + focus.band + ' vs band ' + band + ' = ' + ratio(focus.band, band).toFixed(2));
    assert.ok(ratio(focus.band, 'rgb(255, 255, 255)') >= 4.5, lang + ': text on the focus fill');
    if (focus.pg.shown !== 'hidden') assert.ok(ratio(focus.pg.track, focus.band) >= 3, lang + ': the progress track vanishes on focus (B15): ' + focus.pg.track);
    const before = rows.map((r) => r.logo.join());
    for (let i = 1; i < rows.length; i++) await a.press(K.DOWN);
    for (let i = 1; i < rows.length; i++) await a.press(K.UP);
    assert.deepEqual((await listLook(a)).map((r) => r.logo.join()), before, lang + ': the focus moved a row or a logo');
  }
});

test('basic layout (O3): names and programme titles wrap by whole words, never cut, no ellipsis; at most two name lines — ru and he', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await basic(lang);
    await a.press(CH.UP);                                       // the top of «Все каналы»: the long names are its first channels
    const m = await a.page.evaluate(() => ({
      cut: Array.from(document.querySelectorAll('#clist-rows .brow')).filter((r) => r.style.visibility !== 'hidden')
        .flatMap((r) => Array.from(r.querySelectorAll('.t .x, .s .x')).filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent)),
      ellipsis: Array.from(document.querySelectorAll('#clist *')).filter((e) => getComputedStyle(e).textOverflow === 'ellipsis').length,
      names: Array.from(document.querySelectorAll('#clist-rows .brow')).filter((r) => r.style.visibility !== 'hidden').map((r) => r.querySelector('.t .x').textContent),
      lines: Array.from(document.querySelectorAll('#clist-rows .brow .t')).filter((t) => t.offsetParent).map((t) => Math.round(t.getBoundingClientRect().height / 52)) }));
    assert.deepEqual(m.cut, [], lang + ': cut texts');
    assert.equal(m.ellipsis, 0);
    assert.ok(m.names.some((n) => LONG_NAMES.indexOf(n) >= 0), lang + ': no long name on the first page');
    assert.deepEqual(await brokenWords(a, '#clist-rows .t .x'), [], lang + ': a name broken inside a word');
    assert.ok(m.lines.every((n) => n <= 2), lang + ': a name over two lines ' + m.lines);
  }
});

test('basic layout (B1): a group whose title takes two lines — every row shown is whole inside the list', async () => {
  const title = 'Документальные фильмы, научно-популярные программы и путешествия по всему миру';
  const data = longData(40, Date.now(), (ch, i) => { if (i % 2) ch.category = { class: 'long', name: title }; });
  const a = await basic('ru', data, true);
  await firstCard(a);
  for (let i = 0; i < 30; i++) {
    const n = await a.page.evaluate(() => (document.querySelector('#cards-grid .card.focus .t .x') || {}).textContent);
    if (n === 'Документальные') break;
    await a.press(K.RIGHT);
  }
  await a.press(K.ENTER);
  const m = await a.page.evaluate(() => ({ titleH: document.getElementById('clist-title').getBoundingClientRect().height }));
  assert.ok(m.titleH > 70, 'the title is one line (' + m.titleH + ' px): the test lost its point');
  const rows = await listLook(a);
  assert.ok(rows.length > 0 && rows.every((r) => r.inClip), 'a row is cut under the two-line title: ' + JSON.stringify(rows.map((r) => [r.num, r.top, r.bottom])));
});

test('basic layout (B15): header, rows and help bar start their text on one edge; in Hebrew a Latin name sits on the start edge with the others', async () => {
  const a = await basic('ru');
  const x = await a.page.evaluate(() => {
    const at = (el) => { const r = document.createRange(); r.selectNodeContents(el); return Math.round(r.getClientRects()[0].left); };
    return { head: at(document.getElementById('clist-title')), row: at(document.querySelector('#clist-rows .brow .n')), hint: at(document.getElementById('clist-hint').firstChild) };
  });
  assert.ok(Math.abs(x.head - x.row) <= 2 && Math.abs(x.hint - x.row) <= 2, 'text edges ' + JSON.stringify(x));
  const he = await basic('he');
  const edges = await he.page.evaluate(() => Array.from(document.querySelectorAll('#clist-rows .brow')).filter((r) => r.style.visibility !== 'hidden')
    .map((r) => { const x = r.querySelector('.t .x'); const g = document.createRange(); g.selectNodeContents(x); const rs = Array.from(g.getClientRects()); return [x.textContent, Math.round(Math.max(...rs.map((q) => q.right))), x.getAttribute('dir')]; }));   // bidi runs: one rect each
  const latin = edges.filter((e) => e[2] === 'ltr'), heb = edges.filter((e) => e[2] !== 'ltr');
  assert.ok(latin.length && heb.length, 'need both scripts: ' + JSON.stringify(edges));
  for (const e of latin) assert.ok(Math.abs(e[1] - heb[0][1]) <= 2, 'a Latin name off the start edge: ' + JSON.stringify(e) + ' vs ' + JSON.stringify(heb[0]));
});

test('basic layout (B7): only the layout in use is laid out — #guide display none under Basic, back after the switch', async () => {
  const a = await basic('ru', null, true);
  const d = await a.page.evaluate(() => getComputedStyle(document.getElementById('guide')).display);
  assert.equal(d, 'none');
  await a.page.evaluate(() => { Overlay.close(); BasicMenu.setOn(false); });
  assert.deepEqual(await a.page.evaluate(() => [getComputedStyle(document.getElementById('guide')).display, getComputedStyle(document.getElementById('cards')).display]), ['flex', 'none']);
});

test('basic layout (O6, O7): ⚙ Настройки, 📡 Провайдеры, ℹ О программе — large in both layouts (rows 44 px, values 40 px, hint 36 px), inside 1080 px, rows whole; the free channels\' notice on screen — ru and he', async () => {
  for (const lang of ['ru', 'he']) {
    for (const on of [false, true]) {
      const a = await openApp({ lang, data: JSON.parse(f.ottChannelList(30).body), guide: (id) => f.ottGuide(id) });
      opened.push(a);
      await a.page.evaluate((on) => { Overlay.close(); BasicMenu.setOn(on); }, on);
      for (const s of ['settings', 'about', 'sources']) {
        const m = await a.page.evaluate((s) => {
          Overlay.open(s);
          const root = document.getElementById(s === 'settings' ? 'about' : s), table = root.querySelector('.about-table, .src-list'), hint = root.querySelector('.about-hint');
          const t = table.getBoundingClientRect(), h = hint.getBoundingClientRect();
          const rows = Array.from(table.children).filter((r) => getComputedStyle(r).visibility !== 'hidden' && getComputedStyle(r).display !== 'none');
          const k = root.querySelector('.about-setting .about-k, .src-row .src-t, .about-row .about-k'), v = root.querySelector('.about-setting .about-v span:last-child, .src-row .src-s, .about-row .about-v');
          const note = root.querySelector('.src-w');
          const lowest = Math.max(...Array.from(root.querySelectorAll('*')).filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect().bottom));
          return { k: getComputedStyle(k).fontSize, v: getComputedStyle(v).fontSize, hint: getComputedStyle(hint).fontSize, lowest,
            whole: rows.every((r) => { const b = r.getBoundingClientRect(); return b.top >= t.top - 0.5 && b.bottom <= t.bottom + 0.5; }), rows: rows.length, above: t.bottom <= h.top,
            note: note ? { bottom: note.getBoundingClientRect().bottom, hintTop: h.top, text: note.textContent } : null };
        }, s);
        const where = lang + ' ' + (on ? 'Basic' : 'Advanced') + ' ' + s;
        assert.deepEqual([m.k, m.v, m.hint], ['44px', '40px', '36px'], where);
        assert.ok(m.lowest <= 1080 && m.above && m.whole && m.rows > 0, where + ': ' + JSON.stringify(m));
        if (s === 'sources') assert.ok(m.note && m.note.bottom <= m.note.hintTop && /OTT Club/.test(m.note.text), where + ': the notice ' + JSON.stringify(m.note));
      }
      // ℹ О программе is taller than the room: ▼ shows the next rows, each whole, up to the last (the notice among them).
      const seen = await a.page.evaluate(async () => {
        Overlay.open('about');
        const key = (c) => { const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true }); Object.defineProperty(e, 'keyCode', { get: () => c }); document.dispatchEvent(e); };
        const t = document.getElementById('about-table'), texts = new Set();
        let cut = 0;
        for (let i = 0; i < 20; i++) {
          const tb = t.getBoundingClientRect();
          for (const r of t.children) if (getComputedStyle(r).display !== 'none') { const b = r.getBoundingClientRect(); if (b.top < tb.top - 0.5 || b.bottom > tb.bottom + 0.5) cut++; texts.add(r.textContent); }
          key(40);
        }
        return { cut, all: t.children.length, seen: texts.size, note: Array.from(texts).some((x) => x.indexOf(I18n.t('src.freeNote')) >= 0) };
      });
      assert.ok(seen.cut === 0 && seen.seen === seen.all && seen.note, lang + ' About scrolling: ' + JSON.stringify(seen));
    }
  }
});

test('basic layout: the help bar — 72 px, 36 px text on one line, below the cards and the rows — ru, uk, he, en (H-1, H-2)', async () => {
  for (const lang of ['ru', 'uk', 'he', 'en']) {
    const a = await basic(lang);
    for (const screen of ['clist', 'cards']) {
      if (screen === 'cards') await a.press(K.BACK);
      const m = await a.page.evaluate((id) => {
        // One line: every word of the bar lies in one band no taller than a line of 36 px text.
        const bar = document.getElementById(id + '-hint'), b = bar.getBoundingClientRect(), r = document.createRange();
        r.selectNodeContents(bar);
        const rects = Array.from(r.getClientRects()).filter((x) => x.height > 20), spread = Math.max(...rects.map((x) => x.bottom)) - Math.min(...rects.map((x) => x.top));
        const above = document.querySelector('#' + id + ' .b-body').getBoundingClientRect(), key = bar.querySelector('b');
        return { height: b.height, font: getComputedStyle(bar).fontSize, oneLine: spread <= 1.5 * 36, fits: bar.scrollWidth <= bar.clientWidth, top: b.top, aboveBottom: above.bottom,
          hints: bar.querySelectorAll('b').length, dot: !!bar.querySelector('.dot'), keyColor: getComputedStyle(key).color, left: b.left, right: b.right };
      }, screen);
      assert.equal(m.height, 72, lang + ' ' + screen);
      assert.equal(m.font, '36px');
      assert.ok(m.oneLine && m.fits, lang + ' ' + screen + ': not one line inside the bar');
      assert.ok(m.top >= m.aboveBottom, lang + ' ' + screen + ': the bar overlaps the cards or rows');
      assert.ok(m.hints <= 4 && m.dot, lang + ' ' + screen);
      assert.equal(m.keyColor, 'rgb(255, 255, 255)');
      assert.ok(m.left >= 96 && m.right <= 1824);
    }
  }
});

test('basic layout: a message over the list lies on its help bar, never over the rows (as the menu, review 4 D9)', async () => {
  const a = await basic('ru');
  await a.press(YELLOW);
  const m = await a.page.evaluate(() => {
    const t = document.getElementById('toast').getBoundingClientRect(), hint = document.getElementById('clist-hint').getBoundingClientRect(), rows = document.getElementById('clist-rows').getBoundingClientRect();
    return { toast: [t.top, t.bottom], hint: [hint.top, hint.bottom], rowsBottom: rows.bottom, text: document.getElementById('toast').textContent };
  });
  assert.equal(m.text, 'Добавлено в избранное');
  assert.ok(m.toast[0] >= m.rowsBottom, 'the message covers rows: ' + JSON.stringify(m));
  assert.ok(Math.abs(m.toast[1] - m.hint[1]) <= 1 && m.toast[0] <= m.hint[0] + 1, 'not on the help bar: ' + JSON.stringify(m));
});

test('basic layout: the screens are opaque; card text white on its hue, the count ≥ 7:1 (C-1, C-4)', async () => {
  const a = await basic('ru', null, true);
  assert.equal(await a.page.evaluate(() => getComputedStyle(document.getElementById('cards')).backgroundColor), 'rgb(5, 7, 11)');
  const c = await a.page.evaluate(() => Array.from(document.querySelectorAll('#cards-grid .card')).filter((x) => x.style.visibility !== 'hidden')
    .map((x) => [getComputedStyle(x).backgroundColor, getComputedStyle(x.querySelector('.t')).color, getComputedStyle(x.querySelector('.s')).color]));
  for (const [bg, t, s] of c) assert.ok(ratio(bg, t) >= 7 && ratio(bg, s) >= 7, bg + ' / ' + t + ' / ' + s);
});

// Owner 2026-10-28 (on the TV): «везде где есть список должен быть ползунок который показывает положение в списке».
test('scroll bars: every list shows its scroll bar when it does not fit — hidden when it fits; the thumb follows the cursor; beside the list on the end side, mirrored in Hebrew — both layouts', async () => {
  const SCREENS = [
    // [name, open (page script), list, bar, overflows, keys that move]
    ['ℹ О программе', () => Overlay.open('about'), '#about-table', '#about-bar', true, [40, 40, 40]],
    ['⚙ Настройки', () => Overlay.open('settings'), '#about-table', '#about-bar', false, [40]],
    ['📡 Провайдеры (14 own)', () => { localStorage.setItem('userPlaylists', JSON.stringify(Array.from({ length: 14 }, (_, i) => 'http://provider' + i + '.test/list.m3u'))); Overlay.open('sources'); }, '#sources-list', '#sources-bar', true, [40, 40, 40, 40, 40, 40, 40, 40, 40, 40]],
    ['📡 Провайдеры', () => { localStorage.removeItem('userPlaylists'); Overlay.open('sources'); }, '#sources-list', '#sources-bar', false, [40]],
    ['language list', () => Overlay.open('lang'), '#lang-list', '#lang-bar', false, [40]],
    ['search', () => { Overlay.open('search'); const i = document.getElementById('search-input'); i.value = ''; i.dispatchEvent(new Event('input')); }, '#search-list', '#search-bar', true, [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40]],
    ['programme guide', () => Overlay.open('panel'), '#p-list', '#p-bar', true, [38, 38, 38, 38, 38, 38, 38, 38, 38, 38, 38, 38]],
    ['Advanced channels', () => Overlay.open('menu'), '#channels', '#channels-bar', true, [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40]],
    ['Basic list', () => { BasicMenu.setOn(true); Overlay.open('menu'); }, '#clist-rows', '#clist-bar', true, [40, 40, 40, 40, 40, 40, 40, 40, 40]],
    ['Basic cards', () => { BasicMenu.setOn(true); Overlay.open('cards'); }, '#cards-grid', '#cards-bar', true, [428, 428]]
  ];
  for (const lang of ['ru', 'he']) {
    const now = Date.now(), a = await openApp({ lang, data: longData(40, now), guide: (id) => f.ottGuide(id, { now }) });   // today's guide
    opened.push(a);
    for (const [name, open, list, bar, overflows, keys] of SCREENS) {
      await a.page.evaluate(() => { Overlay.close(); BasicMenu.setOn(false); });
      await a.page.evaluate(`(${open})()`);
      await a.settle();
      // A list that loads (the guide): its rows first.
      await a.page.waitForFunction((list) => Array.from(document.querySelector(list).children).filter((r) => r.style.visibility !== 'hidden').length > 1, { timeout: 10000 }, list);
      await a.settle();
      const look = () => a.page.evaluate((list, bar) => {
        const b = document.querySelector(bar), l = document.querySelector(list).getBoundingClientRect(), r = b.getBoundingClientRect();
        return { on: getComputedStyle(b).visibility === 'visible', thumb: b.children[0].style.transform, height: b.children[0].style.height,
          side: document.documentElement.dir === 'rtl' ? r.right <= l.left + 1 : r.left >= l.right - 1, along: r.top < l.bottom && r.bottom > l.top };
      }, list, bar);
      const before = await look();
      const where = lang + ' ' + name;
      assert.equal(before.on, overflows, where + ': the bar is ' + (before.on ? 'shown' : 'hidden'));
      if (!overflows) continue;
      assert.ok(before.side && before.along, where + ': the bar is not beside the list on the end side ' + JSON.stringify(before));
      await a.press(...keys);
      const after = await look();
      assert.notEqual(after.thumb, before.thumb, where + ': the thumb did not move with the cursor');
    }
  }
});
