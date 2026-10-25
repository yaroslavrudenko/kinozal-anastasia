// Long tasks (> 50 ms) on the main thread from navigation until the first channel is tuned + 10 s.
// Usage: CPU_THROTTLE=6 node tests/e2e/startup-longtasks.mjs
import { openApp, waitTuned, sleep, BASE_URL } from './common.mjs';

const { page, errors, close, throttle } = await openApp();
await page.evaluateOnNewDocument(() => {
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration) }); })
      .observe({ type: 'longtask', buffered: true });
  } catch (e) { window.__longTasks = null; }
});
await page.goto(BASE_URL, { waitUntil: 'load' });
const tuned = await waitTuned(page);
await sleep(10000);
const tasks = await page.evaluate(() => window.__longTasks);
const result = {
  baseUrl: BASE_URL, cpuThrottle: throttle, firstTuneMs: tuned.ms,
  longTasks: tasks ? tasks.length : 'unsupported',
  longestMs: tasks && tasks.length ? Math.max(...tasks.map((t) => t.ms)) : 0,
  totalLongMs: tasks ? tasks.reduce((s, t) => s + t.ms, 0) : 0,
  tasks, errors
};
console.log(JSON.stringify(result, null, 1));
await close();
