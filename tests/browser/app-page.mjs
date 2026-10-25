// Shared by the browser pins: the app (KINOZAL_ROOT) in headless Chrome at the TV's 1920×1080, with every
// request answered by interception — app files from KINOZAL_ROOT, the provider API from the given test
// data. No server, FAKE key, streams refused (no playback is needed to measure layout).
//   PUPPETEER_CORE_DIR  a folder whose node_modules holds puppeteer-core (nothing is installed here)
//   CHROME              Chrome executable (default: macOS Google Chrome)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const f = require('../fixtures.js');
const { ROOT } = require('../harness.js');

export const ORIGIN = 'http://kinozal.test';
// Real-looking long titles in the three scripts the owner watches.
export const LONG = {
  ru: 'Большое путешествие по Транссибирской магистрали: от Москвы до Владивостока за семь дней, серия двенадцатая',
  ua: 'Голос країни: прямий ефір фіналу, виступи всіх учасників і рішення тренерів — повна версія без скорочень',
  he: 'החדשות הערב: סיכום מלא של אירועי היום בישראל ובעולם עם פרשנות של מומחים ואורחים באולפן'
};
export const LONG_NAMES = ['Наше новое кино — фильмы российских режиссёров в высоком качестве', 'Суспільне Культура: документальні фільми, театр і музика',
  'כאן 11 — תאגיד השידור הישראלי, שידור חי'];
export const TITLES = [LONG.ru, LONG.ua, LONG.he];
export const K = { ENTER: 13, BACK: 10009, UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, PG_DOWN: 34, INFO: 457 };

function loadPuppeteer() {
  const dir = process.env.PUPPETEER_CORE_DIR;
  const req = createRequire(dir ? path.join(dir, 'noop.js') : import.meta.url);
  try { return req('puppeteer-core'); } catch (e) {
    throw new Error('puppeteer-core not found: set PUPPETEER_CORE_DIR (browser pins fail rather than skip). ' + e.message);
  }
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*' };

// opts: { data (the /api/channel_now object), guide(id) -> body string }
export async function openApp(opts) {
  const puppeteer = loadPuppeteer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kinozal-browser-'));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', userDataDir: profile, args: ['--window-size=1920,1080'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const listHits = [];                                      // when each channel-list request was answered (ms)
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    let done;
    if (url.startsWith(ORIGIN + '/')) {
      const rel = decodeURIComponent(url.slice(ORIGIN.length + 1).split('?')[0]) || 'index.html';
      const file = path.join(ROOT, rel);
      done = !file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile() ? req.respond({ status: 404, body: '' })
        : req.respond({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    } else if (f.isList(url)) { listHits.push(Date.now()); done = req.respond({ status: 200, contentType: 'application/json', headers: JSON_HEADERS, body: JSON.stringify(opts.data) }); }
    else if (f.isGuide(url)) done = req.respond({ status: 200, contentType: 'application/json', headers: JSON_HEADERS, body: opts.guide(f.guideIdOf(url)) });
    else done = req.abort();
    Promise.resolve(done).catch(() => {});
  });
  await page.evaluateOnNewDocument((k) => { localStorage.setItem('ottKey', JSON.stringify(k)); }, f.FAKE_KEY);
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('b-title') && document.getElementById('b-title').textContent, { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));            // the guide of the first channel arrives

  // A remote key, as the TV delivers it (keydown with keyCode on document).
  const key = (code) => page.evaluate((c) => {
    const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => c });
    document.dispatchEvent(e);
  }, code);
  const settle = () => new Promise((r) => setTimeout(r, 150));
  async function press(...codes) { for (const c of codes) { await key(c); await settle(); } }
  async function closeAll() { for (let i = 0; i < 4; i++) await press(K.BACK); }
  async function close() { await browser.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  return { browser, page, key, settle, press, closeAll, close, listHits };
}

// The provider list: CHANNELS channels whose "now" lines are long (and the first few names long too).
export function longData(count, now, edit) {
  const data = JSON.parse(f.ottChannelList(count, { now, padChars: 0 }).body);
  Object.keys(data).forEach((id, i) => {
    if (i < LONG_NAMES.length) data[id].channel_name = LONG_NAMES[i];
    data[id].name = TITLES[i % TITLES.length];
    if (edit) edit(data[id], i);
  });
  return data;
}
export function longGuide(id, now) {
  const g = JSON.parse(f.ottGuide(id, { now, descrChars: 50 }));
  g.epg_data.forEach((p, i) => { p.name = TITLES[i % TITLES.length]; });
  return JSON.stringify(g);
}

// One look at a list column (#channels, #search-list, #p-list): the highlighted row's number cell and
// text, and the number cells of every row that is completely visible (inside every clipping ancestor).
export function columnView(page, containerId) {
  return page.evaluate((id) => {
    const col = document.getElementById(id);
    let clip = { top: 0, bottom: window.innerHeight };
    for (let a = col; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect();
      clip = { top: Math.max(clip.top, r.top), bottom: Math.min(clip.bottom, r.bottom) };
    }
    const rows = Array.from(col.children).filter((r) => r.style.visibility !== 'hidden' && getComputedStyle(r).visibility !== 'hidden');
    const out = { focusNum: null, focusText: null, fully: [] };
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      if (/(^|\s)(focus|sel)(\s|$)/.test(r.className)) { out.focusNum = r.children[0].textContent; out.focusText = r.textContent; }
      const focused = /(^|\s)(focus|sel)(\s|$)/.test(r.className);
      // A highlighted row taller than the column is shown alone and scrolled: it counts as the page.
      const oversized = focused && b.height > clip.bottom - clip.top + 1;
      if (oversized || (b.top >= clip.top - 1 && b.bottom <= clip.bottom + 1 && b.height > 0)) out.fully.push(r.children[0].textContent);
    }
    return out;
  }, containerId);
}

// The part of the row text containing `marker` (in #containerId) that is on screen, in the text's own
// coordinates: { from, to, height } (null when no such row is shown).
export function visibleRange(page, containerId, marker) {
  return page.evaluate((id, m) => {
    const col = document.getElementById(id);
    const row = Array.from(col.children).find((r) => r.style.visibility !== 'hidden' && r.textContent.indexOf(m) >= 0);
    if (!row) return null;
    const cell = Array.from(row.children).find((c) => c.textContent.indexOf(m) >= 0) || row;
    let top = 0, bottom = window.innerHeight;
    for (let a = cell.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect();
      top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom);
    }
    const r = cell.getBoundingClientRect();
    return { from: Math.max(0, top - r.top), to: Math.min(r.height, bottom - r.top), height: r.height };
  }, containerId, marker);
}
