// A channel row's logo box never moves anything (LOGO-DESIGN §3.5, DEC-2026-10-28-logos-page-plus-next): whether its
// picture is shown, still empty / failed (the stand refuses logo requests), or the channel has no logo at all, the box is
// the same 72×48 and the name starts at the same edge — ru and he. Pictures shown here are data: URIs (no network).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, f, K } from './app-page.mjs';

const opened = [];
after(async () => { for (const a of opened) await a.close(); });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAABQCAIAAABd+SbeAAAAOElEQVR4nO3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgaE0AAB7jJ0swAAAABJRU5ErkJggg==';

test('logo box: shown, empty (failed) and no-logo rows have the same 72×48 box and the same name edge — ru and he (REGISTER4 #5)', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await openApp({ lang, data: JSON.parse(f.ottChannelList(30).body), guide: (id) => f.ottGuide(id) });
    opened.push(a);
    await a.page.evaluate((png) => { for (let i = 0; i < Channels.count(); i++) { const c = Channels.at(i); c.logo = i % 3 === 0 ? png + '#' + i : i % 3 === 2 ? '' : c.logo; } }, PNG);
    await a.press(K.ENTER);
    await new Promise((r) => setTimeout(r, 1200));
    const m = await a.page.evaluate(() => {
      const rtl = document.documentElement.dir === 'rtl', out = {};
      for (const r of document.querySelectorAll('#channels .row')) {
        if (getComputedStyle(r).visibility === 'hidden' || /\bfocus\b/.test(r.className)) continue;   // the focused row has its own scale
        const img = r.children[1], c = Channels.byNum(+r.children[0].textContent), b = img.getBoundingClientRect(), t = r.children[2].getBoundingClientRect();
        const st = !c.logo ? 'none' : getComputedStyle(img).visibility !== 'hidden' && img.complete && img.naturalWidth > 0 ? 'shown' : 'empty';
        (out[st] = out[st] || []).push([Math.round(b.width), Math.round(b.height), Math.round(rtl ? t.right : t.left)]);
      }
      return out;
    });
    const all = lang + ': ' + JSON.stringify(m);
    assert.ok(m.shown && m.empty && m.none, 'every state is on the page: ' + all);
    const shapes = new Set([].concat(m.shown, m.empty, m.none).map((x) => x.join('×')));
    assert.equal(shapes.size, 1, all);
    assert.equal([...shapes][0].split('×').slice(0, 2).join('×'), '72×48', all);
  }
});

test('logo box: the focused channel row does not grow — its logo box and name edge are where the unfocused row has them (±0.5 px), its band inside the column — ru and he (review 7, design N6-1)', async () => {
  for (const lang of ['ru', 'he']) {
    const a = await openApp({ lang, data: JSON.parse(f.ottChannelList(30).body), guide: (id) => f.ottGuide(id) });
    opened.push(a);
    await a.press(K.ENTER);
    await a.press(K.DOWN);                                     // the cursor on the second row
    const geo = () => a.page.evaluate(() => {
      const rtl = document.documentElement.dir === 'rtl', col = document.getElementById('channels').getBoundingClientRect();
      const r = [...document.querySelectorAll('#channels .row')].find((x) => x.getAttribute('data-i') === '1');
      const l = r.children[1].getBoundingClientRect(), t = r.children[2].getBoundingClientRect(), b = r.getBoundingClientRect();
      return { focus: /\bfocus\b/.test(r.className), logo: [l.left, l.top, l.width, l.height], name: rtl ? t.right : t.left, band: [b.left, b.right], col: [col.left, col.right], transform: getComputedStyle(r).transform };
    });
    const focused = await geo();
    await a.press(K.DOWN);
    const plain = await geo();
    const all = lang + ': ' + JSON.stringify([focused, plain]);
    assert.ok(focused.focus && !plain.focus, all);
    assert.equal(focused.transform, 'none', all);
    focused.logo.forEach((v, i) => assert.ok(Math.abs(v - plain.logo[i]) <= 0.5, 'the logo box moved: ' + all));
    assert.ok(Math.abs(focused.name - plain.name) <= 0.5, 'the name moved: ' + all);
    assert.ok(focused.band[0] >= focused.col[0] - 0.5 && focused.band[1] <= focused.col[1] + 0.5, 'the band passes the column: ' + all);
  }
});
