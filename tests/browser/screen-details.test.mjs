// Screen details from the designer's review of 1.9.0 (review 4, 2026-10-27), measured in headless Chrome at 1920×1080:
//  - D1: the Hebrew dedication is upright (Hebrew has no italic; a slant shears it Latin-style).
//  - D7: the key prompt wraps inside the TV's safe area (Ukrainian ran 1761 px wide), centred.
//  - D6: our rows with an icon (🔍 ★ 📡 ⚙) start their names on one edge — a small ⚙ no longer pulls «Настройки» 14 px in.
//  - D9: a message over the channel menu lies over its hint band, never over its rows.
//  - D10: a logo that does not load is hidden, its box kept (no broken-picture icon, nothing moves); the row's next
//    picture shows again. The stand answers no logo request, so every logo here fails to load.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, f, K, LONG_NAMES } from './app-page.mjs';

const opened = [];
after(async () => { for (const a of opened) await a.close(); });
async function app(lang) {
  const a = await openApp({ lang, data: JSON.parse(f.ottChannelList(30).body), guide: (id) => f.ottGuide(id) });
  opened.push(a);
  await a.page.evaluate(() => Overlay.close());
  return a;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('screen details: the dedication in «⚙ Настройки» is upright in Hebrew, italic in Russian (review 4, D1)', async () => {
  const style = async (lang) => {
    const a = await app(lang);
    await a.page.evaluate(() => Overlay.open('about'));
    return a.page.evaluate(() => getComputedStyle(document.querySelector('.about-dedication')).fontStyle);
  };
  assert.equal(await style('he'), 'normal');
  assert.equal(await style('ru'), 'italic');
});

test('screen details: the key prompt wraps within 1400 px, centred, inside the safe area — Ukrainian, Russian, Hebrew, English, first launch and later (review 4, D7, D8)', async () => {
  for (const lang of ['uk', 'ru', 'he', 'en']) {
    const a = await app(lang);
    for (const first of [true, false]) {
      const m = await a.page.evaluate((first) => {
        Overlay.open('setup', { mode: 'key', first });
        const el = document.getElementById('setup-text'), b = el.getBoundingClientRect(), r = document.createRange();
        r.selectNodeContents(el);
        const t = r.getBoundingClientRect();
        return { width: b.width, left: t.left, right: t.right, align: getComputedStyle(el).textAlign, text: el.textContent };
      }, first);
      assert.ok(m.width <= 1400, lang + ' prompt box ' + m.width + ' px');
      assert.ok(m.left >= 96 && m.right <= 1824, lang + ' text runs ' + m.left + '–' + m.right + ' (safe area 96–1824)');
      assert.equal(m.align, 'center');
      assert.equal(/сохран|збереж|השמור|saved/.test(m.text), !first, lang + (first ? ' first launch speaks of a saved key: ' : ' prompt: ') + m.text);
    }
  }
});

test('screen details: «🔍 Поиск», «★ Избранное», «📡 Провайдеры», «⚙ Настройки» start their names on one edge — ru and he (review 4, D6)', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await app(lang);
    await a.page.evaluate(() => { Favs.toggle(Channels.at(0).key); Channels.rebuild(); });
    await a.press(K.ENTER);
    await a.press(lang === 'he' ? K.RIGHT : K.LEFT);              // the groups column
    // The column from its top and from its end (the last rows are «📡» and «⚙»); the focused row is scaled, so not measured.
    const look = () => a.page.evaluate(() => {
      const rtl = document.documentElement.dir === 'rtl', out = [];
      for (const row of document.querySelectorAll('#groups .grow')) {
        if (row.style.visibility === 'hidden' || /\bfocus\b/.test(row.className) || row.getBoundingClientRect().bottom > row.parentNode.getBoundingClientRect().bottom) continue;
        const pre = row.querySelector('.t > i:first-child'), x = row.querySelector('.t .x'), b = x.getBoundingClientRect();
        out.push([pre.textContent + x.textContent, Math.round(rtl ? b.right : b.left), !!pre.textContent]);
      }
      return out;
    });
    const seen = new Map();
    for (const x of await look()) seen.set(x[0], x);
    for (let i = 0; i < 30; i++) await a.key(K.DOWN);
    await a.settle();
    for (const x of await look()) seen.set(x[0], x);
    await a.key(K.UP);
    await a.settle();
    for (const x of await look()) seen.set(x[0], x);
    const m = { icons: [...seen.values()].filter((x) => x[2]), plain: [...seen.values()].filter((x) => !x[2]) };
    assert.deepEqual(m.icons.map((x) => x[0].slice(0, 2)).sort(), ['★ ', '⚙ ', '📡', '🔍'].sort(), lang + ': ' + JSON.stringify(m.icons));
    const edges = m.icons.map((x) => x[1]);
    assert.ok(Math.max(...edges) - Math.min(...edges) <= 1, lang + ': names start at ' + JSON.stringify(m.icons));
    // A provider group has no icon box: its name starts at the row's start edge, as before.
    assert.ok(m.plain.length >= 3);
  }
});

test('screen details: a message over the channel menu lies over its hint band, never over its rows — ru and he (review 4, D9)', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await app(lang);
    await a.press(K.ENTER);
    const m = await a.page.evaluate(() => {
      UI.toast(I18n.t('m.favAdded'));
      const t = document.getElementById('toast').getBoundingClientRect(), hint = document.querySelector('#guide .hint').getBoundingClientRect();
      let bottom = 0;
      for (const row of document.querySelectorAll('#channels .row, #groups .grow')) {
        if (row.style.visibility === 'hidden') continue;
        const b = row.getBoundingClientRect();
        if (b.top < 1080) bottom = Math.max(bottom, Math.min(b.bottom, row.parentNode.getBoundingClientRect().bottom));
      }
      return { top: t.top, bottom: t.bottom, left: t.left, right: t.right, rows: bottom, hint: hint.toJSON() };
    });
    assert.ok(m.top > m.rows, lang + ': the message (top ' + m.top + ') covers rows (down to ' + m.rows + ')');
    assert.ok(m.top <= m.hint.top && m.bottom >= m.hint.bottom - 1 && Math.abs(m.left - m.hint.left) <= 1 && Math.abs(m.right - m.hint.right) <= 1,
      lang + ': not over the hint band ' + JSON.stringify(m));
  }
});

// Every message the app shows as a toast: the keys on the lines that show one (UI.toast, the notice hook) and the
// settings' «said» messages — read from the code, so a new message is measured too.
function toastKeys() {
  const dir = path.resolve(import.meta.dirname, '../../js'), keys = new Set();
  const files = [...fs.readdirSync(dir).map((x) => path.join(dir, x)), ...fs.readdirSync(path.join(dir, 'overlays')).map((x) => path.join(dir, 'overlays', x))];
  for (const file of files.filter((x) => x.endsWith('.js'))) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!/UI\.toast\(|onNotice\(|said: \[/.test(line)) continue;
      for (const m of line.matchAll(/'((?:m|st|src|h)\.[A-Za-z]+)'/g)) keys.add(m[1]);
    }
  }
  return [...keys];
}

test('screen details: a message over the channel menu ends where its hint band ends, one line exactly as tall; every message, in all four languages, wraps in at most 2 lines and never reaches the rows (review 5, NB-4, D-N1)', async () => {
  const keys = toastKeys();
  assert.ok(keys.length >= 30 && keys.includes('m.favAdded') && keys.includes('st.adultSaidOn') && keys.includes('m.oldList'), 'messages found: ' + keys.length);
  for (const lang of ['ru', 'uk', 'he', 'en']) {
    const a = await app(lang);
    await a.press(K.ENTER);
    const m = await a.page.evaluate((keys, arg) => {
      const el = document.getElementById('toast'), hint = document.querySelector('#guide .hint').getBoundingClientRect(), out = [];
      let rows = 0;
      for (const row of document.querySelectorAll('#channels .row, #groups .grow')) {
        if (row.style.visibility === 'hidden') continue;
        const b = row.getBoundingClientRect();
        if (b.top < 1080) rows = Math.max(rows, Math.min(b.bottom, row.parentNode.getBoundingClientRect().bottom));
      }
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      for (const k of ['m.favAdded'].concat(keys)) {
        UI.toast(I18n.t(k, arg));
        const t = el.getBoundingClientRect(), r = document.createRange();
        r.selectNodeContents(el);
        out.push({ k, top: t.top, bottom: t.bottom, lines: Math.round(r.getBoundingClientRect().height / lh), text: el.textContent });
      }
      return { out, rows, hint: hint.toJSON() };
    }, keys, LONG_NAMES[0]);
    const one = m.out[0];
    assert.ok(Math.abs(one.top - m.hint.top) <= 1 && Math.abs(one.bottom - m.hint.bottom) <= 1, lang + ': a one-line message ' + one.top + '–' + one.bottom + ', the hint band ' + m.hint.top + '–' + m.hint.bottom);
    for (const x of m.out) {
      assert.ok(x.lines <= 2, lang + ' ' + x.k + ': ' + x.lines + ' lines «' + x.text + '»');
      assert.ok(x.top > m.rows && Math.abs(x.bottom - m.hint.bottom) <= 1, lang + ' ' + x.k + ': ' + x.top + '–' + x.bottom + ', rows down to ' + m.rows);
    }
  }
});

test('screen details: a focused group does not grow — «⚙ Настройки» draws its icon and count where the unfocused row does, its band within the column, both ends round — ru and he (review 5, D-N2; review 6)', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await app(lang);
    await a.press(K.ENTER);
    await a.press(lang === 'he' ? K.RIGHT : K.LEFT);
    for (let i = 0; i < 30; i++) await a.key(K.DOWN);                 // the cursor on the last row, «⚙»
    await a.settle();
    const geo = () => a.page.evaluate(() => {
      const rtl = document.documentElement.dir === 'rtl', card = document.getElementById('groups').getBoundingClientRect();
      const row = [...document.querySelectorAll('#groups .grow')].find((r) => r.style.visibility !== 'hidden' && /⚙/.test(r.textContent));
      const b = row.getBoundingClientRect(), i = row.querySelector('.t > i:first-child').getBoundingClientRect(), s = row.querySelector('.s').getBoundingClientRect();
      return { focus: /\bfocus\b/.test(row.className), edge: rtl ? i.right : i.left, count: rtl ? s.left : s.right, band: [b.left, b.right], card: [card.left, card.right],
        transform: getComputedStyle(row).transform };
    });
    const focused = await geo();
    await a.key(K.UP);
    await a.settle();
    const plain = await geo();
    const all = lang + ': ' + JSON.stringify([focused, plain]);
    assert.ok(focused.focus && !plain.focus, all);
    assert.equal(focused.transform, 'none', all);
    assert.ok(Math.abs(focused.edge - plain.edge) <= 1, lang + ': the icon starts at ' + focused.edge + ' focused, ' + plain.edge + ' not');
    assert.ok(Math.abs(focused.count - plain.count) <= 1, lang + ': the count ends at ' + focused.count + ' focused, ' + plain.count + ' not');
    // The column clips what lies outside it (overflow: hidden): a band past either edge loses its round end there.
    assert.ok(focused.band[0] >= focused.card[0] - 0.5 && focused.band[1] <= focused.card[1] + 0.5, lang + ': the band ' + focused.band + ' passes the column ' + focused.card);
  }
});

test('screen details: a logo that does not load is hidden with its box kept; the row\'s next picture shows again; the banner\'s too (review 4, D10)', async () => {
  const a = await app('ru');
  await a.press(K.ENTER);
  await wait(800);                                            // every logo request has been refused
  const m = await a.page.evaluate(() => {
    const rows = [...document.querySelectorAll('#channels .row')].filter((r) => r.style.visibility !== 'hidden');
    return rows.map((r) => { const img = r.querySelector('.logo'), b = img.getBoundingClientRect(), t = r.querySelector('.t').getBoundingClientRect();
      // A logo that failed once is not asked for again (DEC-2026-10-28-logos-page-plus-next): the row keeps its channel's
      // logo URL but may never have been given it as src — what matters is that it has one and nothing shows.
      return { logo: !!Channels.byNum(+r.querySelector('.n').textContent).logo, vis: getComputedStyle(img).visibility, w: Math.round(b.width), title: Math.round(t.left), focus: /\bfocus\b/.test(r.className) }; });
  });
  assert.ok(m.length >= 12 && m.every((x) => x.logo), 'rows with a logo: ' + JSON.stringify(m.slice(0, 3)));
  assert.deepEqual(m.filter((x) => x.vis !== 'hidden'), [], 'a broken logo shows');
  const plain = m.filter((x) => !x.focus);                    // the focused row is scaled (css .focus)
  assert.ok(plain.length >= 11 && plain.every((x) => x.w === 72) && new Set(plain.map((x) => x.title)).size === 1, 'the logo box moved: ' + JSON.stringify(plain.slice(0, 3)));
  // The row's next picture (one that loads) shows again.
  const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await a.page.evaluate((dot) => { const g = Channels.groups()[Channels.allIdx()]; Channels.at(g.items[1]).logo = dot; Overlay.refresh(); }, DOT);
  await wait(1600);
  const again = await a.page.evaluate((dot) => { const img = [...document.querySelectorAll('#channels .row .logo')].find((x) => x.getAttribute('src') === dot);
    return img ? getComputedStyle(img).visibility : 'no row'; }, DOT);
  assert.equal(again, 'visible', 'the row\'s next picture stayed hidden');
  // The banner: a failed logo is hidden, and stays so when the banner is drawn again for the channel.
  await a.page.evaluate(() => Overlay.close());
  await a.press(K.INFO);
  await wait(800);
  const banner = async () => a.page.evaluate(() => getComputedStyle(document.getElementById('b-logo')).visibility);
  assert.equal(await banner(), 'hidden');
  await a.press(K.INFO);
  assert.equal(await banner(), 'hidden', 'redrawn, the banner showed the broken logo again');
});
