// Summarise s-openprobe logs: node sum.mjs <log>... -> one row per log and phase (P1 first open, P2 reopen ...).
import fs from 'node:fs';
const rows = [];
for (const f of process.argv.slice(2)) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\S+ (P\d [^{]*?)\s+(\{.*\})$/); if (!m) continue;
    let j; try { j = JSON.parse(m[2]); } catch { continue; }
    const js = j.js || {};
    const g = (k) => (js[k] ? js[k].ms : 0);
    rows.push({ file: f.split('/').pop(), phase: m[1].slice(0, 2), keyToRaf2: j.keyToRaf2Ms, keyTask: j.keyTaskMs, raf1: j.raf1, gap12: j.gapRaf1ToRaf2,
      open: g('Overlay.open'), columns: g('ListView.columns'), fill: g('ListRows.fill'), put: g('Logos.put'), want: g('Logos.want'),
      between: (j.jsBetweenRaf1AndRaf2 || []).join(';'), idleBeforeRaf2: (j.idleCallbacks || []).filter((x) => x.start != null && x.start < j.keyToRaf2Ms).map((x) => `${x.start}+${x.dur}`).join(';'),
      img: `${j.newImage ? j.newImage.beforeRaf2 + '/' + j.newImage.total : '-'}`, tasks: (j.tasksRunInWindow || []).filter((t) => t[1] < j.keyToRaf2Ms).map((t) => `${t[0]}@${t[1]}+${t[2]}`).join(';'),
      ready: j.logos && j.logos.before ? `${j.logos.before.page} next ${j.logos.before.next}` : '' });
  }
}
console.table(rows);
const by = {}; for (const r of rows) { const k = r.file.replace(/-\d+\.log$/, '') + ' ' + r.phase; (by[k] || (by[k] = [])).push(r.keyToRaf2); }
for (const [k, v] of Object.entries(by)) { const s = v.slice().sort((a, b) => a - b); console.log(k.padEnd(18), 'n', s.length, 'median', s[Math.floor(s.length / 2)], 'all', s.join(' ')); }
