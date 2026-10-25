// P-A on a real browser: requests the APP sends during 10 ▶ presses 100 ms apart (target ≤ 3).
// Usage: node tests/e2e/zap-burst.mjs            (see common.mjs for BASE_URL / PUPPETEER_CORE_DIR)
// Caveat: with the FAKE key every stream probe returns the provider's "no key" clip, which the app treats
// as a removed channel and skips — so keyless runs also count that skip cascade. The controlled number
// (all channels alive) is the unit test tests/zap.test.js.
import { openApp, waitTuned, sleep, BASE_URL, redact } from './common.mjs';

const { page, requests, errors, close, throttle } = await openApp();
await page.goto(BASE_URL, { waitUntil: 'load' });
const tuned = await waitTuned(page);
await sleep(5000);                              // let the first channel's own requests finish
const from = requests.length;
for (let i = 0; i < 10; i++) { await page.keyboard.press('ArrowRight'); await sleep(100); }
await sleep(3000);
const burst = requests.slice(from);
const app = burst.filter((r) => r.fromApp);
const result = {
  baseUrl: BASE_URL, cpuThrottle: throttle, firstTuneMs: tuned.ms,
  appRequests: app.length,
  appGuideRequests: app.filter((r) => /\/api\/channel\//.test(r.url)).length,
  appStreamProbes: app.filter((r) => /\/stream\//.test(r.url)).length,
  appBytes: app.reduce((s, r) => s + r.bytes, 0),
  playerRequests: burst.length - app.length,      // hls.js manifests/segments (desktop player only)
  appUrls: app.map((r) => redact(r.url)),
  errors
};
console.log(JSON.stringify(result, null, 1));
await close();
process.exit(result.appRequests <= 3 ? 0 : 1);
