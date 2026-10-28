// node sum-parity.mjs <log>...  — s-parity / s-pickprobe logs; build label = file name up to the last -N.
// Prints, per build: cold launch list end, reload list end / channels ready / first picture, zap ▶◀ and digits
// (key → playing, → spinner off), menu open #1 (first) and #2–5, group keys, and menu picks (s-pickprobe).
import fs from 'node:fs';
const B = {};
const add = (b, k, v) => { if (v == null) return; ((B[b] || (B[b] = {}))[k] || (B[b][k] = [])).push(v); };
for (const f of process.argv.slice(2)) {
  const b = f.split('/').pop().replace(/-\d+\.log$/, '');
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const j = (() => { const m = line.match(/(\{.*\})\s*(wallMs.*)?$/); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } })();
    if (!j) continue;
    if (/ 1 cold launch/.test(line)) { add(b, 'cold: list end (ms from start)', j.listRequests && j.listRequests.length ? j.listRequests[j.listRequests.length - 1].end : null); add(b, 'cold: load event', j.loadEvent); }
    if (/ 2 reload/.test(line)) { add(b, 'reload: list end', j.listRequests && j.listRequests.length ? j.listRequests[j.listRequests.length - 1].end : null); add(b, 'reload: channels ready', j.channelsReady); add(b, 'reload: first picture', j.firstPicture); }
    if (/ 3 zap [▶◀]/.test(line)) { add(b, 'zap ▶◀: key → playing', j.playing); add(b, 'zap ▶◀: key → spinner off', j.spinnerOff); }
    if (/ 4 digits \d/.test(line)) { add(b, 'digits: last digit → playing', j.playing); }
    if (/ 6 menu open\/close #1/.test(line)) { const a = String(j.all).split(' ').map(Number); add(b, 'menu: first open', a[0]); add(b, 'menu: close after first open', a[1]); }
    if (/ 6 menu open\/close #[2-5]/.test(line)) { const a = String(j.all).split(' ').map(Number); add(b, 'menu: reopen', a[0]); add(b, 'menu: close', a[1]); }
    if (/ 5 groups #/.test(line)) { const a = String(j.all).split(' ').map(Number); a.slice(1, 9).forEach((x) => add(b, 'groups: ◀ ▼ ▲ ▶ keys', x)); add(b, 'groups: frames > 34 ms per run', j.framesOver34); }
    if (/ pick [▼▲]/.test(line)) { add(b, 'menu pick: key → playing', j.playing); add(b, 'menu pick: key JS', j.keyJs); add(b, 'menu pick: Player.open at', j.playerOpen); add(b, 'menu pick: prepared at', j.prepared); }
  }
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const keys = [...new Set(Object.values(B).flatMap((o) => Object.keys(o)))];
console.log('metric'.padEnd(36), Object.keys(B).map((b) => b.padStart(24)).join(''));
for (const k of keys) console.log(k.padEnd(36), Object.keys(B).map((b) => { const a = B[b][k]; return (a ? `med ${med(a)} (n${a.length}, max ${Math.max(...a)})` : '-').padStart(24); }).join(''));
