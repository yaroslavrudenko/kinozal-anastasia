#!/usr/bin/env node
// Samsung TV certificates without the Certificate Manager GUI (it does not render on recent macOS).
// Reproduces what the Samsung Certificate Extension does:
//   1. Samsung account sign-in in the browser; the redirect lands on http://localhost:4794/signin/callback
//   2. author + distributor key pairs and CSRs (openssl), the distributor CSR names the TV's DUID
//   3. certificates from Samsung's CA service (svdca.samsungqbe.com, v1 API: its distributor answer is
//      the signed device profile that the TV needs before it accepts an install)
//   4. author.p12 / distributor.p12 (-legacy, the TV's Tizen cannot read newer PKCS#12)
//   5. a Tizen CLI security profile
//
// usage: node tools/samsung-cert.mjs --duid <TV DUID> [--name kinozal] [--out ~/tizen-studio-data/keystore/kinozal]
// The DUID comes from the TV: `sdb shell 0 getduid`.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DUID = arg('duid');
const NAME = arg('name', 'kinozal');
const OUT = path.resolve(arg('out', path.join(os.homedir(), 'tizen-studio-data', 'keystore', NAME)).replace(/^~/, os.homedir()));
const TIZEN = path.join(os.homedir(), 'tizen-studio', 'tools', 'ide', 'bin', 'tizen');
const SERVICE_ID = 'v285zxnl3h';                                     // Samsung Certificate Extension's client id
const CALLBACK = 'http://localhost:4794/signin/callback';
const LOGIN = `https://account.samsung.com/mobile/account/check.do?serviceID=${SERVICE_ID}&actionID=StartOAuth2&accessToken=Y&redirect_uri=${CALLBACK}`;
const CA_API = 'https://svdca.samsungqbe.com/apis/v1';

if (!DUID) { console.error('usage: node tools/samsung-cert.mjs --duid <TV DUID> [--name kinozal] [--out dir]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
const f = (n) => path.join(OUT, n);
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

// Samsung's CA certificates ship inside the installed Samsung Certificate Extension.
function caCertificates() {
  const plugins = path.join(os.homedir(), 'tizen-studio', 'tools', 'certificate-manager', 'certificate-manager.app', 'Contents', 'Eclipse', 'plugins');
  const dir = fs.existsSync(plugins) ? plugins : path.join(os.homedir(), 'tizen-studio', 'tools', 'certificate-manager', 'plugins');
  const jar = fs.readdirSync(dir).find((n) => /^org\.tizen\.common\.cert_.*\.jar$/.test(n));
  if (!jar) throw new Error('Samsung Certificate Extension not found: package-manager-cli install cert-add-on');
  const author = sh('unzip', ['-p', path.join(dir, jar), 'res/ca/vd_tizen_dev_author_ca.cer']);
  const dist = sh('unzip', ['-p', path.join(dir, jar), 'res/ca/vd_tizen_dev_public2.crt']);
  return { author, dist };
}

function signIn() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        if (!req.url.startsWith('/signin/callback')) { res.writeHead(404); res.end(); return; }
        const fields = new URLSearchParams(body.length ? body : req.url.split('?')[1] || '');
        const code = JSON.parse(fields.get('code'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2 style="font-family:sans-serif">Signed in to Samsung. You can close this tab.</h2>');
        server.close();
        resolve({ token: code.access_token, user: code.userId, email: code.inputEmailID });
      });
    }).listen(4794, '127.0.0.1');
    console.log('\nOpen this Samsung sign-in page and sign in with your Samsung account:\n\n  ' + LOGIN + '\n');
  });
}

async function post(endpoint, fields, csrFile) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('csr', new Blob([fs.readFileSync(csrFile)]), 'request.csr');
  const r = await fetch(`${CA_API}/${endpoint}`, { method: 'POST', body: form });
  const text = await r.text();
  if (!r.ok) throw new Error(`${endpoint}: HTTP ${r.status} ${text.slice(0, 200)}`);
  return text;
}

const pem = (b64) => '-----BEGIN CERTIFICATE-----\n' + b64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';

const ca = caCertificates();
const login = await signIn();
console.log('Signed in as', login.email);

sh('openssl', ['genrsa', '-out', f('author.key.pem'), '2048']);
sh('openssl', ['req', '-new', '-key', f('author.key.pem'), '-out', f('author.csr'), '-subj', `/CN=${NAME}`]);
sh('openssl', ['genrsa', '-out', f('distributor.key.pem'), '2048']);
sh('openssl', ['req', '-new', '-key', f('distributor.key.pem'), '-out', f('distributor.csr'),
  '-subj', `/CN=TizenSDK/emailAddress=${login.email}`,
  '-addext', `subjectAltName = URI:URN:tizen:packageid=,URI:URN:tizen:deviceid=${DUID}`]);

const auth = { access_token: login.token, user_id: login.user, platform: 'VD' };
fs.writeFileSync(f('author.crt'), await post('authors', auth, f('author.csr')));
// The v1 distributor answer is <Profile>…<TestDevice>DUID</TestDevice><Certificate>…</Certificate><Signature>…
// The whole XML is the device profile; the <Certificate> inside is the distributor certificate.
const profile = await post('distributors', { ...auth, privilege_level: 'Public', developer_type: 'Individual' }, f('distributor.csr'));
fs.writeFileSync(f('device-profile.xml'), profile);
const distB64 = /<Certificate>([^<]+)<\/Certificate>/.exec(profile);
if (!distB64) throw new Error('no certificate in the distributor answer: ' + profile.slice(0, 200));
fs.writeFileSync(f('distributor.crt'), pem(distB64[1]));

const password = crypto.randomBytes(12).toString('hex');
fs.writeFileSync(f('.password'), password, { mode: 0o600 });
fs.writeFileSync(f('author-and-ca.crt'), fs.readFileSync(f('author.crt'), 'utf8') + ca.author);
fs.writeFileSync(f('distributor-and-ca.crt'), fs.readFileSync(f('distributor.crt'), 'utf8') + ca.dist);
for (const n of ['author', 'distributor']) {
  sh('openssl', ['pkcs12', '-export', '-legacy', '-out', f(`${n}.p12`), '-inkey', f(`${n}.key.pem`),
    '-in', f(`${n}-and-ca.crt`), '-name', 'usercertificate', '-passout', `pass:${password}`]);
}
for (const n of fs.readdirSync(OUT)) fs.chmodSync(f(n), 0o600);

sh(TIZEN, ['security-profiles', 'add', '-n', NAME, '-a', f('author.p12'), '-p', password, '-d', f('distributor.p12'), '-dp', password]);
sh(TIZEN, ['cli-config', `profiles.path=${path.join(os.homedir(), 'tizen-studio-data', 'profile', 'profiles.xml')}`]);

console.log(`\nDone. Security profile "${NAME}" is registered.\nPut this into build.local.env:\n\n  CERT_PROFILE=${NAME}\n  DEVICE_PROFILE=${f('device-profile.xml')}\n`);
console.log(sh('openssl', ['x509', '-in', f('distributor.crt'), '-noout', '-enddate']).trim());
