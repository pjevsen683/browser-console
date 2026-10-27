#!/usr/bin/env node
// Ende-til-ende for Draw & Guess i headless Chrome: to telefoner (Anna direkte, Bo via serveren) starter spillet, tegneren
// vælger et ord og tegner med fingeren, og strøgene (med lærredets format) når konsollen; gætteren skriver ordet og får
// "You got it". Kør: node tools/e2e-draw.mjs
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PORT = 8192, BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), NOPID: '1' }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (t) => console.log(`ok: ${t}`);

for (let i = 0; i < 50; i++) { if (await fetch(BASE).then((r) => r.ok, () => false)) break; await sleep(100); }
let browser = null, failed = false;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns'],
  });
  const page = async (url, vp) => {
    const p = await (await browser.createBrowserContext()).newPage();
    if (vp) await p.setViewport(vp);
    p.on('pageerror', (e) => console.error('sidefejl:', e.message));
    await p.goto(url);
    return p;
  };
  const konsol = await page(`${BASE}/?nosw=1&game=draw`);
  await konsol.waitForFunction(() => window.__konsol?.code(), { timeout: 5000 });
  const code = await konsol.evaluate(() => window.__konsol.code());
  const phone = { width: 844, height: 390 };
  const anna = await page(`${BASE}/c.html?nosw=1&g=${code}&name=Anna`, phone);
  const bo = await page(`${BASE}/c.html?nosw=1&g=${code}&name=Bo&nortc=1`, phone);
  await konsol.waitForFunction(() => window.__konsol.players().length === 2, { timeout: 15000 });
  for (const p of [anna, bo]) { await p.waitForFunction(() => window.__pad.state().color, { timeout: 5000 }); await p.evaluate(() => window.__pad.tap('a')); }
  await konsol.waitForFunction(() => window.__konsol.screen() === 'play', { timeout: 10000 });
  ok('Draw & Guess startede fra lobbyen');

  // hvem tegner? den, der får ordvalget
  const layout = (p) => p.evaluate(() => document.body.dataset.layout);
  let drawer = null;
  for (let i = 0; i < 100 && !drawer; i++) { for (const p of [anna, bo]) if (await layout(p) === 'choices') drawer = p; await sleep(100); }
  if (!drawer) throw new Error('ingen fik ordvalget');
  const guesser = drawer === anna ? bo : anna;
  await drawer.click('#choices button:nth-child(2)');
  await drawer.waitForFunction(() => document.body.dataset.layout === 'draw', { timeout: 5000 });
  const word = (await drawer.evaluate(() => document.getElementById('prompt').textContent)).replace(/^Draw: /, '').toLowerCase();
  ok(`tegneren valgte et ord ("${word}") og fik lærredet`);

  const box = await (await drawer.$('#draw')).boundingBox();
  await drawer.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await drawer.mouse.down();
  for (let i = 1; i <= 20; i++) { await drawer.mouse.move(box.x + box.width * (0.2 + i * 0.03), box.y + box.height * (0.3 + Math.sin(i / 3) * 0.2)); await sleep(15); }
  await drawer.mouse.up();
  await konsol.waitForFunction(() => window.__konsol.ctlLog().some((e) => e.msg.t === 'stroke' && e.msg.ar > 1), { timeout: 5000 });
  const ink = await konsol.evaluate(() => {
    const c = document.querySelector('.dg canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80) dark++; return dark;
  });
  if (ink < 50) throw new Error(`tegningen nåede ikke fjernsynet (${ink} mørke pixels)`);
  ok(`strøgene nåede fjernsynet med lærredets format (${ink} mørke pixels)`);

  await guesser.waitForFunction(() => document.body.dataset.layout === 'text', { timeout: 5000 });
  await guesser.type('#text-in', 'definitely wrong');
  await guesser.keyboard.press('Enter');
  await guesser.waitForFunction(() => document.getElementById('text').textContent.startsWith('Not'), { timeout: 5000 });
  await guesser.type('#text-in', word.toUpperCase());
  await guesser.keyboard.press('Enter');
  await guesser.waitForFunction(() => /got it/.test(document.getElementById('text').textContent), { timeout: 5000 });
  ok('gætteren gættede forkert og så rigtigt; telefonen siger "You got it"');
  await konsol.waitForFunction(() => /The word was/.test(document.querySelector('.dg-over')?.textContent ?? ''), { timeout: 5000 });
  ok('turen sluttede, og fjernsynet viser ordet');
} catch (e) {
  failed = true;
  console.error('FEJL:', e.message);
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
