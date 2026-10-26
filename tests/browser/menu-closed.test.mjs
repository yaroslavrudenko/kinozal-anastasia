// The menu is gone after a channel is picked (owner's bug, 2026-10-26): picking a channel from the menu or
// from search left the menu's text over the picture. The menu is hidden by visibility (.guide.hidden, so
// opening it is a paint), and every shown row carried an inline `visibility: visible`, which beats a hidden
// parent: #guide was hidden, its rows were not. Shown rows now use 'inherit'. Present since 88c1860.
// Here, in a real engine: after a pick, nothing under #guide or #search is visible, and the banner is.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, longData, longGuide, K } from './app-page.mjs';

let app, page, key, settle, press, closeAll;

before(async () => {
  const now = Date.now();
  app = await openApp({ data: longData(45, now), guide: (id) => longGuide(id, now) });
  ({ page, key, settle, press, closeAll } = app);
});
after(async () => { if (app) await app.close(); });

// Every element under #rootId the viewer can see: computed visibility 'visible' and a box on screen.
function visibleUnder(rootId) {
  return page.evaluate((id) => {
    const out = [];
    for (const el of document.getElementById(id).querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).visibility === 'visible' && r.width > 0 && r.height > 0) out.push(el.className + ' «' + (el.textContent || '').trim().slice(0, 40) + '»');
    }
    return out;
  }, rootId);
}
const bannerShown = () => page.evaluate(() => {
  const b = document.getElementById('banner'), r = b.getBoundingClientRect();
  return getComputedStyle(b).visibility === 'visible' && r.width > 0 && r.height > 0 && !!document.getElementById('b-title').textContent;
});
const playingTitle = () => page.evaluate(() => document.getElementById('b-title').textContent);

test('menu closed: after a channel is picked from the menu, nothing under #guide is visible and the banner shows the picked channel', async () => {
  await closeAll();
  await press(K.ENTER);                                     // the menu, on the playing channel
  assert.ok((await visibleUnder('guide')).length > 10, 'the open menu shows its rows (the check sees them)');
  await press(K.DOWN, K.DOWN);
  const picked = await page.evaluate(() => document.querySelector('#channels .focus .t').textContent);
  await press(K.ENTER);                                     // pick: the menu closes, the channel starts
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual((await visibleUnder('guide')).slice(0, 5), [], 'menu text left on the picture');
  assert.ok(await bannerShown(), 'the banner is not shown after the pick');
  assert.equal(await playingTitle(), picked.replace(/^★ /, '').replace(/\s+▶$/, ''));
});

test('menu closed: after a channel is picked from search, nothing under #guide or #search is visible and the banner is shown', async () => {
  await closeAll();
  await press(K.ENTER, K.LEFT);
  for (let i = 0; i < 12; i++) await press(K.UP);           // the search row heads the group column
  await press(K.RIGHT);
  assert.ok((await visibleUnder('search')).length > 0, 'search did not open');
  await page.evaluate(() => { const i = document.getElementById('search-input'); i.value = '1'; i.dispatchEvent(new Event('input')); });
  await settle();
  await press(K.DOWN);                                      // into the results
  assert.ok((await visibleUnder('search')).some((t) => /row/.test(t)), 'no search results to pick');
  await press(K.ENTER);
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual((await visibleUnder('guide')).slice(0, 5), [], 'menu text left on the picture');
  assert.deepEqual((await visibleUnder('search')).slice(0, 5), [], 'search text left on the picture');
  assert.ok(await bannerShown(), 'the banner is not shown after the pick');
});
