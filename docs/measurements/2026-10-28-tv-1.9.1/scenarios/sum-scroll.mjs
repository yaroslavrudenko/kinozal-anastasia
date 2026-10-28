// node sum-scroll.mjs <log>... → per phase and variant (file name prefix up to the last -N): median of the per-run
// key medians, worst key, frames > 34 ms, longest frame gap, logo downloads started / done-handler ms, idle callbacks.
import fs from 'node:fs';
const by = {};
for (const f of process.argv.slice(2)) {
  const variant = f.split('/').pop().replace(/-\d+\.log$/, '');
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\S+ (\S.*?)\s{2,}(\{.*\})$/); if (!m) continue;
    let j; try { j = JSON.parse(m[2]); } catch { continue; }
    if (j.medianMs === undefined) continue;
    const k = m[1] + ' | ' + variant; (by[k] || (by[k] = [])).push(j);
  }
}
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const n = (t, l) => (t[l] ? t[l].split('/')[0] : 0), ms = (t, l) => (t[l] ? parseFloat(t[l].split('/')[1]) : 0);
console.log('phase | variant'.padEnd(58), 'runs med(keyMed) max  >34ms longest imgStart doneMs idleMs keyJsMed | emptyFrames maxEmpty arriving allPaintedMs');
for (const [k, rs] of Object.entries(by).sort()) console.log(k.padEnd(58), String(rs.length).padStart(4), String(med(rs.map((r) => r.medianMs))).padStart(9), String(Math.max(...rs.map((r) => r.maxMs))).padStart(5),
  String(med(rs.map((r) => r.framesOver34))).padStart(6), String(Math.max(...rs.map((r) => r.longestGap))).padStart(7), String(med(rs.map((r) => +n(r.totals, 'img.start')))).padStart(8),
  String(med(rs.map((r) => ms(r.totals, 'logo.done')))).padStart(6), String(med(rs.map((r) => ms(r.totals, 'idle')))).padStart(6), String(med(rs.map((r) => r.keyJsMedian))).padStart(8), '|',
  String(med(rs.map((r) => r.visible && r.visible.framesWithEmptyBox))).padStart(11), String(Math.max(...rs.map((r) => (r.visible ? r.visible.maxEmptyBoxes : 0)))).padStart(8),
  String(med(rs.map((r) => r.visible && r.visible.logosSeenArriving))).padStart(8), String(med(rs.map((r) => r.visible && r.visible.allPaintedMsAfterLastKey))).padStart(12));
