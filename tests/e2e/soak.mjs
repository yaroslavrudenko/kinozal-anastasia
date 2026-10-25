// Soak: watch one channel for N minutes and count stalls. Without a real key the provider serves its
// "no key" clip, so on the keyless BASE_URL this measures the player loop, not the real stream.
// Usage: node tests/e2e/soak.mjs [minutes=10] [channel number=1]
import { openApp, waitTuned, sleep, BASE_URL } from './common.mjs';

const minutes = +(process.argv[2] || 10);
const channel = String(process.argv[3] || '1');
const { page, errors, close, throttle } = await openApp();
await page.goto(BASE_URL, { waitUntil: 'load' });
await waitTuned(page);
for (const c of channel) { await page.keyboard.press(c); await sleep(150); }
await sleep(3000);
await page.evaluate(() => {
  const v = document.getElementById('html-player');
  window.__m = { waiting: 0, started: false, reconnectToasts: 0 };
  v.addEventListener('playing', () => { window.__m.started = true; });
  v.addEventListener('waiting', () => { if (window.__m.started) window.__m.waiting++; });
  new MutationObserver(() => { if (/переподключаюсь/.test(document.getElementById('toast').textContent)) window.__m.reconnectToasts++; })
    .observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true });
});
const t0 = Date.now();
let prev = null; let frozenSeconds = 0; let samples = 0;
while (Date.now() - t0 < minutes * 60000) {
  const t = await page.evaluate(() => document.getElementById('html-player').currentTime);
  if (prev !== null && t - prev < 0.5) frozenSeconds++;
  prev = t; samples++;
  await sleep(1000);
}
const m = await page.evaluate(() => window.__m);
const failLog = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('failLog')) || []).length; } catch (e) { return -1; } });
console.log(JSON.stringify({ baseUrl: BASE_URL, cpuThrottle: throttle, minutes, channel, samples, frozenSeconds,
  stalls: m.waiting, reconnectToasts: m.reconnectToasts, playerFailures: failLog, started: m.started, errors }, null, 1));
await close();
