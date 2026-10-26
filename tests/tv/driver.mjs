// Drivers for the TV runner. Both expose the same small interface:
//   ev(expr)        evaluate an ES5 expression in the app page, return its value (JSON-able)
//   key(code)       a remote key, delivered as the TV does (keydown with keyCode on document)
//   sleep(ms), mode ('tv' | 'dry'), close(), requestsSince(t) (dry only: requests the page made)
//
// tv:  the installed app on the TV, through the Tizen inspector (CDP over `sdb forward`). Start it with
//      tests/tv/launch.sh, which writes the forwarded port to tests/tv/.port. Nothing here knows the key.
// dry: the app from this repository in headless Chrome at 1920×1080 (no TV needed). App files come from
//      KINOZAL_ROOT (default: the repository), the provider's public list and guide API go to the real
//      network, streams are refused (there is no picture, so playback cases report DRY-SKIP). A FAKE key.
//      puppeteer-core is resolved from PUPPETEER_CORE_DIR; nothing is installed into the repository.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(process.env.KINOZAL_ROOT || path.join(HERE, '..', '..'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Never print a key: stream paths and key-like query values are masked.
export const redact = (u) => String(u || '').replace(/\/stream\/[^/]+\//, '/stream/<key>/').replace(/([?&](key|token|pass\w*|ottkey)=)[^&]*/gi, '$1<x>');

const KEY_JS = (code) => `(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${code};document.dispatchEvent(e);return Date.now()})()`;

export async function tvDriver(port) {
  const p = port || fs.readFileSync(path.join(HERE, '.port'), 'utf8').trim();
  // Right after launch.sh the forwarded inspector may still reset connections: retry for up to 30 s.
  let list = null, lastErr = null;
  for (let i = 0; i < 30 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${p}/json`)).json(); } catch (e) { lastErr = e; await sleep(1000); }
  }
  if (!list) throw new Error('inspector not reachable on port ' + p + ': ' + (lastErr && (lastErr.cause && lastErr.cause.code || lastErr.message)));
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('inspector: ' + (e.message || 'ws error'))); });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  // A dropped inspector (sdb disconnect, app restart) must end every pending call, never leave it hanging.
  let closed = null;
  ws.onclose = () => { closed = 'the inspector connection closed'; for (const [, res] of pending) res({ error: { message: closed } }); pending.clear(); };
  const CALL_TIMEOUT_MS = 30000;
  const call = (method, params = {}) => new Promise((res) => {
    if (closed) { res({ error: { message: closed } }); return; }
    const i = ++id;
    const timer = setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ error: { message: method + ' timed out after ' + CALL_TIMEOUT_MS / 1000 + ' s' } }); } }, CALL_TIMEOUT_MS);
    pending.set(i, (msg) => { clearTimeout(timer); res(msg); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  async function ev(expr) {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.error) return { __error: r.error.message };
    if (r.result && (r.result.exceptionDetails || r.result.wasThrown)) return { __error: JSON.stringify(r.result.exceptionDetails || r.result.result).slice(0, 300) };
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  return { mode: 'tv', ev, key: (c) => ev(KEY_JS(c)), sleep, close: async () => ws.close(), requestsSince: () => null };
}

function loadPuppeteer() {
  const dir = process.env.PUPPETEER_CORE_DIR;
  const req = createRequire(dir ? path.join(dir, 'noop.js') : import.meta.url);
  try { return req('puppeteer-core'); } catch (e) { throw new Error('dry mode needs puppeteer-core: set PUPPETEER_CORE_DIR. ' + e.message); }
}
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ORIGIN = 'http://kinozal.test';
export const FAKE_KEY = 'FAKEKEY0001';

export async function dryDriver() {
  const puppeteer = loadPuppeteer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kinozal-tvdry-'));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', userDataDir: profile, args: ['--window-size=1920,1080'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const log = [];
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    let p;
    if (url.startsWith(ORIGIN + '/')) {
      const rel = decodeURIComponent(url.slice(ORIGIN.length + 1).split('?')[0]) || 'index.html';
      const file = path.join(ROOT, rel);
      p = !file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile() ? req.respond({ status: 404, body: '' })
        : req.respond({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    } else {
      log.push({ t: Date.now(), url });
      p = /\/api\/channel(_now|\/)/.test(url) ? req.continue() : req.abort();   // streams, logos, hls.js: no picture in dry mode
    }
    Promise.resolve(p).catch(() => {});
  });
  await page.evaluateOnNewDocument((k) => { localStorage.setItem('ottKey', JSON.stringify(k)); }, FAKE_KEY);
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'load' });
  const ev = async (expr) => { try { return await page.evaluate(expr); } catch (e) { return { __error: String(e.message).slice(0, 300) }; } };
  return {
    mode: 'dry', ev, key: (c) => ev(KEY_JS(c)), sleep,
    requestsSince: (t) => log.filter((x) => x.t >= t),
    close: async () => { await browser.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  };
}
