'use strict';
// build.sh writes OTT_KEY / PLAYLIST_URL / BUILD into a copy of js/config.js (review §2: the `sed`
// substitution corrupts `&`, breaks on `#`, and a `'` breaks the JavaScript string).
//
// Only the substitution command is run — extracted from build.sh (the command that edits config.js,
// with its line continuations) — in a temporary directory with FAKE values. build.sh itself is never
// run: it packages the app and installs it on the TV. The extracted command is refused if it mentions
// the TV tools.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./harness');

function substitutionCommand() {
  const lines = fs.readFileSync(path.join(ROOT, 'build.sh'), 'utf8').split('\n');
  const hit = lines.findIndex((l) => /config\.js/.test(l) && !/^\s*#/.test(l));
  assert.ok(hit >= 0, 'build.sh has no command that edits config.js');
  let first = hit;
  while (first > 0 && /\\\s*$/.test(lines[first - 1])) first--;
  let last = hit;
  while (/\\\s*$/.test(lines[last]) && last + 1 < lines.length) last++;
  const cmd = lines.slice(first, last + 1).join('\n');
  assert.ok(!/\b(sdb|SDB|tizen|TIZEN)\b/.test(cmd), 'refusing to run a command that touches the TV tools:\n' + cmd);
  return cmd;
}

// Runs the substitution on a fresh copy of js/config.js (optionally edited by `transform`) in a
// temporary directory. Returns { status, text } — the exit status and the resulting config.js.
function runSubstitution(env, transform) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinozal-build-'));
  try {
    fs.mkdirSync(path.join(dir, '.buildResult', 'js'), { recursive: true });
    const original = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
    fs.writeFileSync(path.join(dir, '.buildResult', 'js', 'config.js'), transform ? transform(original) : original);
    const script = 'set -eu\ncd "$1"\n' + substitutionCommand() + '\n';
    const res = spawnSync('/bin/zsh', ['-c', script, 'zsh', dir], {
      env: Object.assign({ PATH: path.dirname(process.execPath) + ':' + process.env.PATH, HOME: dir, BUILD: 'abc1234 25.10.2026' }, env),
      encoding: 'utf8'
    });
    return { status: res.status, stderr: res.stderr, text: fs.readFileSync(path.join(dir, '.buildResult', 'js', 'config.js'), 'utf8') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The resulting CONFIG of a successful substitution.
function buildConfig(env) {
  const res = runSubstitution(env);
  assert.equal(res.status, 0, 'the substitution failed: ' + res.stderr);
  const sandbox = {};
  vm.runInNewContext(res.text + '\nthis.CONFIG = CONFIG;', sandbox);
  return sandbox.CONFIG;
}

const FAKE_KEY = 'FAKEKEY0001';
const URLS = {
  ampersand: 'http://playlist.example.test/get.php?username=anastasia&password=fake123&type=m3u_plus',
  hash: 'http://playlist.example.test/list.m3u#channels',
  apostrophe: "http://playlist.example.test/list.m3u?name=o'neil"
};

for (const [kind, url] of Object.entries(URLS)) {
  test('build.sh: a PLAYLIST_URL with ' + kind + ' reaches config.js unchanged', () => {
    const config = buildConfig({ OTT_KEY: FAKE_KEY, PLAYLIST_URL: url });
    assert.equal(config.PLAYLIST_URL, url);
  });
}

test('build.sh (pin): a plain key and URL are written into config.js', () => {
  const config = buildConfig({ OTT_KEY: FAKE_KEY, PLAYLIST_URL: 'http://playlist.example.test/list.m3u' });
  assert.equal(config.OTT_KEY, FAKE_KEY);
  assert.equal(config.PLAYLIST_URL, 'http://playlist.example.test/list.m3u');
});

// verify/mad_react…md N7: a value that was given but whose placeholder was not replaced (here the
// placeholder's quoting changed) must fail the build, not ship a config that silently opens setup.
test('build.sh: a given PLAYLIST_URL is either written or the build fails — never a success with the placeholder left', () => {
  const requote = (text) => text.replace("'__PLAYLIST_URL__'", '"__PLAYLIST_URL__"');
  assert.notEqual(requote(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8')), fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'),
    'config.js has no \'__PLAYLIST_URL__\' placeholder to requote');
  const url = 'http://playlist.example.test/list.m3u';
  const res = runSubstitution({ OTT_KEY: FAKE_KEY, PLAYLIST_URL: url }, requote);
  if (res.status !== 0) return;                        // failing loudly is acceptable
  assert.ok(res.text.indexOf(url) >= 0 && res.text.indexOf('__PLAYLIST_URL__') < 0, 'the build succeeded and left the placeholder in config.js');
});
