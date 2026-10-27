// Lists never reach the bottom hint bar, on any screen size (owner, 2026-10-27: «Есть телевизоры меньше, поэтому я
// хочу, чтобы списки отделялись от самой нижней строки … на всех размерах экранов списки не должны доходить до
// нижней подсказки, как в главном меню, так и в других местах … например, в меню «О программе»»). The app is laid
// out on a fixed 1920×1080 canvas that every screen scales as a whole (viewport width=1920 on the TV, a transform on
// the desktop); here the gap is measured at full size and on a 1280×720 screen, on every screen with a hint bar.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, K } from './app-page.mjs';

let app, page, press, closeAll;
before(async () => {
  const now = Date.now();
  app = await openApp({ data: longData(60, now), guide: (id) => longGuide(id, now) });
  ({ page, press, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

// The lowest visible pixel of every row (clipped by its scrolling ancestors) and the hint bar's top, in screen px.
function measure(rowSel, hintSel) {
  return page.evaluate((rowSel, hintSel) => {
    const clipBottom = (el) => {
      let b = window.innerHeight;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') b = Math.min(b, a.getBoundingClientRect().bottom);
      }
      return b;
    };
    const rows = Array.from(document.querySelectorAll(rowSel)).filter((r) => getComputedStyle(r).visibility !== 'hidden' && r.getBoundingClientRect().height > 0);
    const bottoms = rows.map((r) => { const b = r.getBoundingClientRect(); return b.top < clipBottom(r) ? Math.min(b.bottom, clipBottom(r)) : -1; }).filter((x) => x >= 0);
    const hint = document.querySelector(hintSel).getBoundingClientRect();
    const k = document.body.getBoundingClientRect().width / 1920;
    return { rows: bottoms.length, lowest: Math.max(...bottoms), hintTop: hint.top, k };
  }, rowSel, hintSel);
}

const SCREENS = [
  { name: 'channel menu', open: async () => { await press(K.ENTER); }, rows: '#groups .grow, #channels .row', hint: '#guide .hint' },
  { name: '«О программе»', open: async () => { await page.evaluate(() => Overlay.open('about')); }, rows: '#about .about-row', hint: '#about .about-hint' },
  { name: '«Провайдеры»', open: async () => { await page.evaluate(() => { localStorage.setItem('userPlaylists', JSON.stringify(Array.from({ length: 14 }, (_, i) => 'http://provider' + i + '.test/list.m3u'))); Overlay.open('sources'); }); }, rows: '#sources .src-row', hint: '#sources .about-hint' },
  { name: 'search', open: async () => { await page.evaluate(() => Overlay.open('search')); await page.evaluate(() => { const i = document.getElementById('search-input'); i.value = ''; i.dispatchEvent(new Event('input')); }); }, rows: '#search-list .row', hint: '.search-hint' }
];

for (const size of [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }]) {
  for (const s of SCREENS) {
    test('hint gap: on a ' + size.w + '×' + size.h + ' screen the ' + s.name + ' rows end at least 8 px (scaled) above the hint bar', async () => {
      await closeAll();
      await page.setViewport({ width: size.w, height: size.h });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await s.open();
      await new Promise((r) => setTimeout(r, 400));
      const m = await measure(s.rows, s.hint);
      assert.ok(m.rows > 0, s.name + ': no rows measured');
      assert.ok(m.hintTop - m.lowest >= 8 * m.k - 0.5, s.name + ' at ' + size.w + '×' + size.h + ': rows end ' + m.lowest.toFixed(1) + ', the hint starts ' + m.hintTop.toFixed(1) + ' (gap ' + (m.hintTop - m.lowest).toFixed(1) + ' px, scale ' + m.k.toFixed(3) + ')');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    });
  }
}
