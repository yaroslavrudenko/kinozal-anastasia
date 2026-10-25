// Shared launcher for the headless-browser checks. Nothing is installed into the repository:
// puppeteer-core is resolved from PUPPETEER_CORE_DIR (a folder whose node_modules has
// puppeteer-core 23.x), or from the normal Node resolution.
//   BASE_URL      the app served without a key (default http://127.0.0.1:8765/ — `python3 -m http.server 8765`
//                 from the repository root). Never point committed runs at a keyed preview.
//   CHROME        Chrome executable (default: the macOS Google Chrome).
//   CPU_THROTTLE  CDP CPU slowdown factor (1 = none; ~6 approximates the 2017 TV's CPU).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FAKE_KEY = 'FAKEKEY0001';
export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8765/';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPuppeteer() {
  const dir = process.env.PUPPETEER_CORE_DIR;
  const req = createRequire(dir ? path.join(dir, 'noop.js') : import.meta.url);
  try { return req('puppeteer-core'); } catch (e) {
    throw new Error('puppeteer-core not found. Set PUPPETEER_CORE_DIR to a folder with node_modules/puppeteer-core (' + e.message + ')');
  }
}

// Opens the app with a FAKE key in a throwaway profile. Returns { browser, page, appRequests }.
export async function openApp({ fakeKey = true } = {}) {
  const puppeteer = loadPuppeteer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kinozal-e2e-'));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', userDataDir: profile, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1280,720']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const throttle = +(process.env.CPU_THROTTLE || 1);
  if (throttle > 1) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  if (fakeKey) await page.evaluateOnNewDocument((k) => { try { localStorage.setItem('ottKey', JSON.stringify(k)); } catch (e) {} }, FAKE_KEY);
  // Every request the page makes, tagged with who started it (the app's own scripts or hls.js).
  const requests = [];
  page.on('request', (r) => {
    const stack = (r.initiator() && r.initiator().stack && r.initiator().stack.callFrames) || [];
    const fromApp = stack.some((fr) => /\/js\/[a-z]+\.js/.test(fr.url));
    requests.push({ url: r.url(), type: r.resourceType(), t: Date.now(), fromApp, bytes: 0 });
  });
  page.on('requestfinished', async (r) => {
    const rec = requests.find((x) => x.url === r.url() && !x.done);
    if (!rec) return;
    rec.done = true;
    // Body size as received (the provider omits Content-Length); hls.js segments are skipped to keep it cheap.
    if (rec.fromApp) { try { rec.bytes = (await r.response().buffer()).length; } catch (e) { rec.bytes = -1; } }
  });
  page.on('requestfailed', (r) => { const rec = requests.find((x) => x.url === r.url() && !x.done); if (rec) { rec.done = true; rec.failed = r.failure() && r.failure().errorText; } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const close = async () => { await browser.close(); fs.rmSync(profile, { recursive: true, force: true }); };
  return { browser, page, requests, errors, close, throttle };
}

// Waits until the channel banner shows a channel name (the list loaded and the first channel was tuned).
export async function waitTuned(page, maxMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const title = await page.evaluate(() => (document.getElementById('b-title') || {}).textContent || '');
    if (title) return { title, ms: Date.now() - t0 };
    await sleep(100);
  }
  throw new Error('the app never tuned a channel within ' + maxMs + ' ms');
}

// Hides the stream key in any URL printed by these scripts.
export const redact = (u) => String(u).replace(/\/stream\/[^/]+\//, '/stream/<key>/');
