#!/usr/bin/env node
// Ende-til-ende i headless Chrome: en konsol og to controllere i hver sin browser-kontekst (hver sin localStorage,
// altså hver sin pid). Anna forbinder direkte over WebRTC, Bo tvinges over serveren (&nortc=1). Begge trykker A,
// spillet starter, og Annas pind når frem. Kør: npm run e2e
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PORT = 8191, BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), NOPID: '1' }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (t) => console.log(`ok: ${t}`);

for (let i = 0; i < 50; i++) { if (await fetch(BASE).then((r) => r.ok, () => false)) break; await sleep(100); }
let browser = null, failed = false;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = async (url) => {
    const p = await (await browser.createBrowserContext()).newPage();
    p.on('pageerror', (e) => console.error('sidefejl:', e.message));
    await p.goto(url);
    return p;
  };
  const konsol = await page(`${BASE}/?nosw=1`);
  await konsol.waitForFunction(() => window.__konsol?.code(), { timeout: 5000 });
  const code = await konsol.evaluate(() => window.__konsol.code());
  ok(`konsollen fik koden ${code}`);

  const anna = await page(`${BASE}/c.html?nosw=1&g=${code}&name=Anna`);
  const bo = await page(`${BASE}/c.html?nosw=1&g=${code}&name=Bo&nortc=1`);
  await konsol.waitForFunction(() => {
    const l = window.__konsol.players();
    return l.length === 2 && l.find((p) => p.name === 'Anna')?.link === 'direct' && l.find((p) => p.name === 'Bo')?.link === 'relay';
  }, { timeout: 15000 });
  ok('Anna er forbundet direkte (WebRTC), Bo via serveren');

  await anna.waitForFunction(() => window.__pad.state().color, { timeout: 5000 });
  await bo.waitForFunction(() => window.__pad.state().color, { timeout: 5000 });
  ok('begge controllere fik deres farve');

  await konsol.evaluate(() => window.__konsol.notifyAll({ t: 'layout', kind: 'choices', prompt: 'Pick one',
    options: [{ label: 'Red', color: '#ff4d5e' }, { label: 'Blue', color: '#3fa7ff' }] }));
  await anna.waitForSelector('#choices button:nth-child(2)', { visible: true, timeout: 5000 });
  await anna.click('#choices button:nth-child(2)');
  await konsol.waitForFunction(() => window.__konsol.ctlLog().some((e) => e.name === 'Anna' && e.msg.t === 'answer' && e.msg.value === 1), { timeout: 5000 });
  await bo.waitForSelector('#choices button:nth-child(1)', { visible: true, timeout: 5000 });
  await bo.click('#choices button:nth-child(1)');
  await konsol.waitForFunction(() => window.__konsol.ctlLog().some((e) => e.name === 'Bo' && e.msg.value === 0), { timeout: 5000 });
  ok('svarknapper: Anna (datakanal) og Bo (via server) svarer, og svarene når frem');
  await konsol.waitForFunction(() => window.__konsol.players().every((p) => p.rtt > 0), { timeout: 8000 });
  ok('ping-tid målt til begge telefoner');
  await konsol.evaluate(() => window.__konsol.notifyAll({ t: 'layout', kind: 'pad' }));
  await anna.waitForSelector('#a', { visible: true, timeout: 5000 });

  for (const p of [anna, bo]) await p.evaluate(() => window.__pad.tap('a'));
  await konsol.waitForFunction(() => window.__konsol.players().every((p) => p.ready), { timeout: 5000 });
  ok('A over datakanal og over server gør begge klar');
  await konsol.waitForFunction(() => window.__konsol.screen() === 'play', { timeout: 8000 });
  ok('spillet startede efter nedtællingen');
  const tune = await konsol.evaluate(() => window.__konsol.music());
  if (tune !== 'sumo') throw new Error(`musikken er "${tune}", ikke sumo`);
  ok('musikken skiftede fra lobby til spillets');

  await anna.evaluate(() => window.__pad.stick(1, 0));
  await konsol.waitForFunction(() => window.__konsol.players().find((p) => p.name === 'Anna').input.x > 0.5, { timeout: 3000 });
  ok('Annas pind når frem');

  await anna.reload();
  await konsol.waitForFunction(() => {
    const l = window.__konsol.players();
    return l.length === 2 && l.find((p) => p.name === 'Anna')?.link === 'direct';
  }, { timeout: 15000 });
  ok('Anna genindlæser og er tilbage på samme plads');
  await anna.waitForFunction(() => document.getElementById('text').textContent.length > 0, { timeout: 5000 });
  const text = await anna.evaluate(() => document.getElementById('text').textContent);
  if (/Press A|Ready ✓/.test(text)) throw new Error(`Anna fik lobbyens tekst midt i spillet: "${text}"`);
  ok(`Anna får spillets tekst efter genindlæsningen ("${text}")`);
} catch (e) {
  failed = true;
  console.error('FEJL:', e.message);
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
