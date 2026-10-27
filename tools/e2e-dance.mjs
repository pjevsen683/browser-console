#!/usr/bin/env node
// Ende-til-ende for Dance Beat i headless Chrome: to telefoner (Anna direkte, Bo via serveren) starter spillet, får
// pileknapperne, kender konsollens ur efter et ping, og et tryk når konsollen med et tidsstempel tæt på ankomsten og
// giver en bedømmelse på telefonen. Kør: node tools/e2e-dance.mjs
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PORT = 8193, BASE = `http://localhost:${PORT}`;
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
  const konsol = await page(`${BASE}/?nosw=1&game=dance`);
  await konsol.waitForFunction(() => window.__konsol?.code(), { timeout: 5000 });
  const code = await konsol.evaluate(() => window.__konsol.code());
  const phone = { width: 844, height: 390 };
  const anna = await page(`${BASE}/c.html?nosw=1&g=${code}&name=Anna`, phone);
  const bo = await page(`${BASE}/c.html?nosw=1&g=${code}&name=Bo&nortc=1`, phone);
  await konsol.waitForFunction(() => window.__konsol.players().length === 2, { timeout: 15000 });
  for (const p of [anna, bo]) { await p.waitForFunction(() => window.__pad.state().color, { timeout: 5000 }); await p.evaluate(() => window.__pad.tap('a')); }
  await konsol.waitForFunction(() => window.__konsol.screen() === 'play', { timeout: 10000 });
  ok('Dance Beat startede fra lobbyen');
  for (const p of [anna, bo]) await p.waitForFunction(() => document.body.dataset.layout === 'beat', { timeout: 5000 });
  ok('begge telefoner viser pileknapperne');
  for (const p of [anna, bo]) await p.waitForFunction(() => window.__pad.clock() !== undefined, { timeout: 5000 });
  ok('begge telefoner kender konsollens ur (fra ping)');
  await sleep(4500);                                  // to ping mere: de første kom, mens siden stadig indlæste

  for (const [p, n] of [[anna, 'Anna'], [bo, 'Bo']]) {
    await p.click('#beat button:nth-child(3)');
    await konsol.waitForFunction((n) => window.__konsol.ctlLog().some((e) => e.name === n && e.msg.t === 'tap'), { timeout: 5000 }, n);
    const m = await konsol.evaluate((n) => window.__konsol.ctlLog().filter((e) => e.name === n && e.msg.t === 'tap').at(-1).msg, n);
    const lag = m.recv - m.at;
    if (m.lane !== 2 || !Number.isFinite(m.at) || lag < -20 || lag > 300) throw new Error(`${n}: tryk ${JSON.stringify(m)} (forsinkelse ${lag} ms)`);
    ok(`${n}: trykket nåede konsollen i bane 2, stemplet ${lag.toFixed(0)} ms før ankomsten`);
    await p.waitForFunction(() => /PERFECT|Great|Good|Off beat|Miss/.test(document.getElementById('prompt').textContent), { timeout: 5000 });
  }
  ok('telefonerne viser bedømmelsen');
} catch (e) {
  failed = true;
  console.error('FEJL:', e.message);
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
