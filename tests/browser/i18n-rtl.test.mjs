// The interface language in a real browser (owner, 2026-10-27: «Мы переводим интерфейс. Название канала возвращает
// провайдер»). The harness's fake DOM finds no [data-t] element, so the page's own texts, the right-to-left Hebrew
// layout and the remote's arrows are pinned here, on the real page.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, K } from './app-page.mjs';

const opened = [];
after(async () => { for (const a of opened) await a.close(); });
async function app(lang) {
  const now = Date.now();
  const a = await openApp({ lang, data: longData(30, now), guide: (id) => longGuide(id, now) });
  opened.push(a);
  return a;
}
const CYRILLIC = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const pageTexts = (page) => page.evaluate(() => ({
  hints: Array.from(document.querySelectorAll('[data-t]')).map((e) => e.textContent),
  placeholder: document.getElementById('search-input').getAttribute('placeholder'),
  dir: document.documentElement.getAttribute('dir'), lang: document.documentElement.getAttribute('lang')
}));

// The page's own texts are the dictionary's in the language, and really in it: Hebrew letters in every Hebrew text,
// Latin and no Hebrew or Cyrillic in every English one (an empty or untranslated text fails, not only Russian).
const SAMPLES = { en: { placeholder: 'Channel name or number', 'src.title': 'Providers', 'search.title': '🔍 Find a channel' },
  he: { placeholder: 'שם ערוץ או מספר', 'src.title': 'ספקים', 'search.title': '🔍 חיפוש ערוץ' } };
for (const lang of ['en', 'he']) {
  test('i18n browser: in ' + lang + ' every [data-t] text and the search placeholder are the dictionary\'s, in ' + lang + ' (no Russian left)', async () => {
    const { page } = await app(lang);
    const t = await pageTexts(page);
    assert.equal(t.lang, lang);
    assert.equal(t.dir, lang === 'he' ? 'rtl' : 'ltr');
    assert.ok(t.hints.length >= 8, 'too few [data-t] elements: ' + t.hints.length);
    const russian = t.hints.concat([t.placeholder]).filter((x) => CYRILLIC.test(x));
    assert.deepEqual(russian, []);
    const keyed = await page.evaluate(() => Array.from(document.querySelectorAll('[data-t]')).map((e) => [e.getAttribute('data-t'), e.textContent, I18n.t(e.getAttribute('data-t'))]));
    assert.deepEqual(keyed.filter(([, shown, want]) => shown !== want), [], 'a [data-t] text is not the dictionary\'s');
    const inLang = lang === 'he' ? (x) => /[\u05D0-\u05EA]/.test(x) : (x) => /[A-Za-z]/.test(x) && !/[\u05D0-\u05EA]/.test(x);
    assert.deepEqual(t.hints.concat([t.placeholder]).filter((x) => !inLang(x)), [], 'texts not in ' + lang);
    assert.equal(t.placeholder, SAMPLES[lang].placeholder);
    for (const k of ['src.title', 'search.title']) assert.ok(keyed.some(([key, shown]) => key === k && shown === SAMPLES[lang][k]), k);
  });
}

// A Hebrew line reads right to left: what comes first in it stands rightmost. x of the character at `i` of the text in el.
const xOf = (page, sel, find) => page.evaluate((sel, find) => {
  const el = document.querySelector(sel), it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out = {};
  for (let n; (n = it.nextNode());) for (const f of find) { const i = n.data.indexOf(f); if (i >= 0 && out[f] === undefined) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + f.length); const b = r.getBoundingClientRect(); out[f] = b.width ? b.left + b.width / 2 : null; } }
  return out;
}, sel, find);

test('i18n browser: in Hebrew the slider\'s «1 h 5 min behind live» reads right to left between its left-to-right ends', async () => {
  const { page } = await app('he');
  await page.evaluate(() => { document.getElementById('s-start').textContent = '18:00'; document.getElementById('s-end').textContent = '19:00';
    document.getElementById('s-delta').textContent = I18n.t('sc.behind', I18n.t('sc.hm', 1, 5)); UI.show('scrub', true); });
  const x = await xOf(page, '#s-delta', ['1 ', '5 ', 'אחרי', 'החי']);
  const dir = await page.evaluate(() => getComputedStyle(document.getElementById('s-delta')).direction);
  await page.evaluate(() => UI.show('scrub', false));
  assert.equal(dir, 'rtl');
  assert.ok(x['1 '] > x['5 '] && x['5 '] > x['אחרי'] && x['אחרי'] > x['החי'], 'the sentence does not read right to left: ' + JSON.stringify(x));
});

test('i18n browser: in Hebrew the hints\' arrow pairs look as on the remote (◀ left of ▶, ▲ before ▼) and the search arrow points from the name to OK', async () => {
  const { page } = await app('he');
  await page.evaluate(() => { UI.show('guide', true); UI.show('prog', true); UI.show('scrub', true); UI.show('search', true); });
  const menu = await xOf(page, '#guide .hint', ['◀', '▶']);
  const prog = await xOf(page, '#prog .prog-hint', ['◀', '▶', '▲', '▼']);
  const scrub = await xOf(page, '#scrub .scrub-hint', ['◀', '▶', '▲', '▼']);
  const search = await xOf(page, '.search-hint', ['הקלידו', '←', 'OK']);
  await page.evaluate(() => { UI.show('guide', false); UI.show('prog', false); UI.show('scrub', false); UI.show('search', false); });
  for (const [name, x] of [['menu', menu], ['programmes', prog], ['slider', scrub]]) assert.ok(x['◀'] < x['▶'], name + ': ' + JSON.stringify(x));
  for (const [name, x] of [['programmes', prog], ['slider', scrub]]) assert.ok(x['▲'] < x['▼'], name + ': ' + JSON.stringify(x));
  assert.ok(search['הקלידו'] > search['←'] && search['←'] > search['OK'], 'search: ' + JSON.stringify(search));
  // «OTT Club · iptv-org בחינם · …»: the two Latin names are two items, not one left-to-right run (OTT Club first, at the right).
  await page.evaluate(() => Overlay.open('sources'));
  const note = await xOf(page, '#sources .src-note', ['OTT Club', 'iptv-org', 'בחינם']);
  await page.evaluate(() => Overlay.close());
  assert.ok(note['OTT Club'] > note['iptv-org'] && note['iptv-org'] > note['בחינם'], 'providers note: ' + JSON.stringify(note));
});

test('i18n browser: the search results have no divider line beside them (no groups column there)', async () => {
  const { page } = await app('he');
  const d = await page.evaluate(() => [getComputedStyle(document.querySelector('.search-wrap'), ':before').display, getComputedStyle(document.querySelector('#guide .list-wrap'), ':before').display]);
  assert.deepEqual(d, ['none', 'block']);
});

for (const lang of ['ru', 'uk', 'he', 'en']) {
  test('i18n browser: in ' + lang + ' a message in «⚙ Settings» and «📡 Providers» covers neither the icon, the title nor a row', async () => {
    const { page } = await app(lang);
    const hits = [];
    for (const screen of ['settings', 'about', 'lang', 'sources']) {
      const r = await page.evaluate((screen) => {
        Overlay.open(screen);
        UI.toast(I18n.t('m.languageSet', I18n.name()) + ' · ' + I18n.t('st.opening', 'https://www.linkedin.com/in/yaroslav-rudenko-2303'), 5000);
        const t = document.getElementById('toast').getBoundingClientRect();
        const root = document.getElementById(screen === 'settings' ? 'about' : screen);
        const parts = Array.from(root.querySelectorAll('.about-icon, .about-title, .src-note, .about-row, .src-row')).map((e) => [e.className, e.getBoundingClientRect()]);
        const over = parts.filter(([, b]) => b.height && b.left < t.right && b.right > t.left && b.top < t.bottom && b.bottom > t.top).map(([c]) => c);
        Overlay.close();
        return { over, toast: [Math.round(t.top), Math.round(t.bottom)] };
      }, screen);
      if (r.over.length) hits.push(screen + ' ' + JSON.stringify(r));
    }
    assert.deepEqual(hits, []);
  });
}

test('i18n browser: in Hebrew the groups column is on the right, and RIGHT/LEFT move toward groups/channels', async () => {
  const { page, press, closeAll } = await app('he');
  await closeAll();
  await press(K.ENTER);
  const x = await page.evaluate(() => ({ g: document.getElementById('groups').getBoundingClientRect().left, c: document.getElementById('channels').getBoundingClientRect().left }));
  assert.ok(x.g > x.c, 'groups at ' + x.g + ', channels at ' + x.c);
  const focused = () => page.evaluate(() => ['groups', 'channels'].filter((id) => document.querySelector('#' + id + ' .focus')));
  assert.deepEqual(await focused(), ['channels']);
  await press(K.RIGHT);
  assert.deepEqual(await focused(), ['groups'], 'RIGHT did not move to the groups column');
  await press(K.LEFT);
  assert.deepEqual(await focused(), ['channels'], 'LEFT did not move back to the channels');
});

test('i18n browser: in Hebrew time runs left to right — the banner bar and the scrub ends (start on the left)', async () => {
  const { page } = await app('he');
  const d = await page.evaluate(() => {
    const ends = document.querySelector('.scrub-ends');
    document.getElementById('s-start').textContent = '18:00';
    document.getElementById('s-end').textContent = '19:00';
    UI.show('scrub', true);
    const r = { start: document.getElementById('s-start').getBoundingClientRect().left, end: document.getElementById('s-end').getBoundingClientRect().left,
      bar: getComputedStyle(document.querySelector('.banner-bar')).direction, ends: getComputedStyle(ends).direction };
    UI.show('scrub', false);
    return r;
  });
  assert.equal(d.bar, 'ltr');
  assert.equal(d.ends, 'ltr');
  assert.ok(d.start < d.end, 'start at ' + d.start + ', end at ' + d.end);
});

test('i18n browser: the language list — all four names start on the interface\'s start edge (±1 px), each written in its own direction; the ✓ of the current one on the interface\'s end — ru and he (REGISTER4 #6)', async () => {
  for (const lang of ['ru', 'he']) {
    const { page } = await app(lang);
    const m = await page.evaluate(() => {
      Overlay.open('lang');
      const rtl = document.documentElement.dir === 'rtl';
      return [...document.querySelectorAll('#lang .src-row')].map((r) => {
        const t = r.querySelector('.src-t'), s = r.querySelector('.src-s'), rg = document.createRange(), cs = getComputedStyle(r);
        rg.selectNodeContents(t);
        const tb = rg.getBoundingClientRect(), rb = r.getBoundingClientRect();
        return { name: t.textContent, dir: t.getAttribute('dir'), off: rtl ? rb.right - parseFloat(cs.paddingRight) - tb.right : tb.left - (rb.left + parseFloat(cs.paddingLeft)),
          mark: s.textContent ? s.getBoundingClientRect().left - rb.left : null, w: rb.width };
      });
    });
    const all = lang + ': ' + JSON.stringify(m);
    assert.deepEqual(m.map((r) => r.name), ['Русский', 'Українська', 'עברית', 'English'], all);
    assert.ok(m.every((r) => Math.abs(r.off) <= 1), all);
    assert.deepEqual(m.map((r) => r.dir), ['ltr', 'ltr', 'rtl', 'ltr'], all);
    const cur = m.find((r) => r.mark !== null);
    assert.ok(cur && (lang === 'he' ? cur.mark < cur.w / 2 : cur.mark > cur.w / 2), all);
    await page.evaluate(() => Overlay.close());
  }
});
