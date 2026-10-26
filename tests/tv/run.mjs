// The TV runner: executes the automatic use cases of docs/TESTING.md against the installed app (or, with
// --dry, against this repository's app in headless Chrome) and writes a markdown results table per run.
//   node tests/tv/run.mjs --dry [--root <tree>] [--cases U0,M2,...] [--quick] [--m11-min N]
//   node tests/tv/run.mjs [--port N] [--cases ...] [--soak-min 10] [--m11-min 30] [--c2 "A,B,C,D"]
// TV setup: tests/tv/launch.sh (writes tests/tv/.port). OTHER_APP=<app id> lets M9 really switch apps
// through sdb (TV=<ip:port> and SDB=<path> are read from the environment); without it M9 simulates a hide.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// --root <tree>: the app tree the dry driver serves (sets KINOZAL_ROOT before the driver loads).
{ const i = process.argv.indexOf('--root'); if (i >= 0) process.env.KINOZAL_ROOT = path.resolve(process.argv[i + 1]); }
const { tvDriver, dryDriver, ROOT } = await import('./driver.mjs');
const C = await import('./cases.mjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const dry = flag('--dry');
const quick = flag('--quick');
const ALL = ['U0', 'M2', 'M4', 'M5', 'M7', 'M8', 'M9', 'M6', 'C2', 'M10', 'M11', 'COLD348'];
const cases = (val('--cases', '') || ALL.join(',')).split(',');
const opt = {
  soakMin: +val('--soak-min', 10), m11Min: +val('--m11-min', dry ? 0 : 30),
  c2: (val('--c2', 'Viju+ Megahit,Кинокомедия,sci-fi,Kinoliving')).split(',').map((s) => s.trim()).filter(Boolean),
  landings: true
};
if (!dry && process.env.OTHER_APP && process.env.TV) {
  const SDB = process.env.SDB || path.join(process.env.HOME, 'tizen-studio/tools/sdb');
  opt.away = async (ms) => {
    execFileSync(SDB, ['-s', process.env.TV, 'shell', '0', 'was_execute', process.env.OTHER_APP], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, ms));
    execFileSync(SDB, ['-s', process.env.TV, 'shell', '0', 'was_execute', 'Yr0ttPlay1.OttClubPlayer'], { stdio: 'ignore' });
  };
}

const d = dry ? await dryDriver() : await tvDriver(val('--port'));
const started = new Date();
const rows = [];
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
try {
  await d.ev(fs.readFileSync(path.join(HERE, 'page-helper.js'), 'utf8'));
  const ready = await C.helpers(d).waitFor('(function(){return Channels.count()>0&&!!Playback.current()&&!!window.__TT})()', 30000, 300);
  if (!ready) throw new Error('the app never had a channel list and a playing channel');
  const info = await d.ev('(function(){return {version:CONFIG.VERSION,build:CONFIG.BUILD,channels:Channels.count()}})()');
  log('app', JSON.stringify(info), 'mode', d.mode);
  const run = {
    U0: () => C.U0(d, opt, quick), M2: () => C.M2(d, opt), M4: () => C.M4(d, opt), M5: () => C.M5(d, opt), M7: () => C.M7(d, opt),
    M8: () => C.M8(d, opt), COLD348: () => C.cold348(d), M9: () => C.M9(d, opt), M6: () => C.M6(d, opt), C2: () => C.C2archive(d, opt), M10: () => C.M10(d, opt),
    M11: async () => { if (!opt.m11Min) return [{ id: 'M11', channel: '—', measured: 'skipped (--m11-min 0)', result: 'NOT-RUN' }];
      const open = await C.menuOpenFreshness(d, opt.m11Min);         // the menu left open the whole time
      return open.concat((await C.U0(d, Object.assign({}, opt, { landings: false }), true)).map((r) => Object.assign(r, { id: 'M11·' + r.id }))); }
  };
  for (const id of cases) {
    if (!run[id]) { rows.push({ id, channel: '—', measured: 'unknown case', result: 'FAIL' }); continue; }
    log('case', id);
    try { const r = await run[id](); rows.push(...r); r.forEach((x) => log('  ', x.result, x.id, '·', x.channel, '·', x.measured.slice(0, 160))); }
    catch (e) { rows.push({ id, channel: '—', measured: 'runner error: ' + String(e && e.message).slice(0, 200), result: 'FAIL' }); log('  runner error', e && e.message); }
  }
  rows.push({ id: 'app-errors', channel: '—', measured: 'failure log lines: ' + (await d.ev('Diag.snapshot().recent.length')), result: 'INFO' });
} finally {
  await d.close();
}

const count = (r) => rows.filter((x) => x.result === r).length;
const esc = (s) => String(s).replace(/\|/g, '\\|');
// Local time (the TV's and the owner's clock), not UTC.
const stamp = started.toLocaleString('sv-SE', { hour12: false }).slice(0, 16);
const md = [`### ${stamp} (local) — ${dry ? 'DRY (desktop, headless Chrome, no picture) · tree ' + ROOT : 'TV'} · cases ${cases.join(',')}`,
  '', `PASS ${count('PASS')} · FAIL ${count('FAIL')} · DRY-SKIP ${count('DRY-SKIP')} · NOT-RUN ${count('NOT-RUN')}`, '',
  '| Case | Channel / group | Measured | Result |', '|---|---|---|---|',
  ...rows.map((r) => `| ${esc(r.id)} | ${esc(r.channel)} | ${esc(r.measured)} | ${r.result} |`), ''].join('\n');
const dir = path.join(HERE, 'results');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, stamp.replace(/[: ]/g, '-') + (dry ? '-dry' : '-tv') + '.md');
fs.writeFileSync(file, md);
console.log('\n' + md + '\nwritten: ' + path.relative(ROOT, file));
process.exit(count('FAIL') ? 1 : 0);
