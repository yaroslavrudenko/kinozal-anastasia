// TV probe (run with tv5/cdp.mjs): the TV engine's image semantics the logo design relies on.
//   node <S>/tv5/cdp.mjs <port> <S>/logo-design/t-imgsem.mjs
// Injects imgsem-page.js (a 200x100 box top-left for ~1 s, removed after) and runs it with two OTT Club logos (public,
// no key) and an unroutable address for "a picture that does not arrive". About 53 small image requests to myott.top.
// Answers: Q1 does an <img> keep its old picture while a new src loads; Q2 does removeAttribute('src') clear it at once;
// Q3 is a URL held by a live Image() complete synchronously in a new <img> (same-frame paint); Q4 after the holder was
// let go; Q5 img.decode / createImageBitmap present (Chromium 47: expected absent / present).
import fs from 'fs';
export default async function (c) {
  const src = fs.readFileSync(new URL('./imgsem-page.js', import.meta.url), 'utf8');
  await c.ev(src + '\n1');
  await c.ev(`(function(){window.__IS=null;__imgsem('http://myott.top/images/136.png','http://10.255.255.1/never.png','http://myott.top/images/181.png',function(r){window.__IS=r});return 1})()`);
  let r = null; for (let i = 0; i < 60 && !r; i++) { await c.sleep(500); r = await c.ev('window.__IS'); }
  c.log('imgsem', JSON.stringify(r));
  c.log('state', JSON.stringify(await c.ev(`({ov:Overlay.mode(),st:webapis.avplay.getState()})`)));
}
