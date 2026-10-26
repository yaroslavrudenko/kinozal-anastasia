// Minimal CDP client for the TV inspector. Usage: node tests/tv/accept/cdp-client.mjs <port> <scenario.mjs> [args...]
// The scenario exports default async function (c, args). URLs are redacted before printing (no key).
const [port, scen, ...args] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const handlers = [];
export const redact = (u) => String(u || '').replace(/\/stream\/[^\/]+\//, '/stream/<key>/').replace(/([?&](key|token|pass\w*)=)[^&]*/gi, '$1<x>').replace(/\/\/[^@\/]+@/, '//');
const c = {
  t0: Date.now(),
  call: (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); }),
  on: (fn) => handlers.push(fn),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async ev(expr) {
    const r = await c.call('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r && r.exceptionDetails) return { __exception: JSON.stringify(r.exceptionDetails).slice(0, 300) };
    if (r && r.wasThrown) return { __thrown: JSON.stringify(r.result).slice(0, 300) };
    return r && r.result ? r.result.value : r;
  },
  key(code) { return c.ev(`(function(){var e=document.createEvent('Event');e.initEvent('keydown',true,true);e.keyCode=${code};document.dispatchEvent(e);return Date.now()})()`); },
  log: (...a) => console.log(((Date.now() - c.t0) / 1000).toFixed(1) + 's', ...a),
  redact,
};
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.error ? { __error: msg.error } : msg.result); pending.delete(msg.id); }
  if (msg.method) for (const h of handlers) h(msg);
};
ws.onerror = (e) => { console.log('ws error', e.message); process.exit(1); };
ws.onopen = async () => {
  try {
    const mod = await import(new URL(scen, `file://${process.cwd()}/`).href);
    await mod.default(c, args);
  } catch (e) { console.log('scenario error', e && e.stack); }
  ws.close(); process.exit(0);
};
