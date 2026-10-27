#!/usr/bin/env node
// 16:9-billeder fra asset-serveren (Z-Image, `type: image` uden kind), ét job ad gangen, gemt som WebP i 960x540.
// Liste: JSON-fil med [{ "name": "...", "prompt": "..." }]. Hvert job noteres i asset-generation/generated/images.md.
//   node tools/images.mjs <liste.json> <ud-mappe under public/> [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const API = process.env.ASSET_API || 'http://10.1.0.21:8200';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [listFile, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
const STYLE = 'colourful cartoon illustration, clean shapes, soft lighting, no text, no letters, no words';
const items = JSON.parse(readFileSync(listFile, 'utf8'));
const OUT = join(ROOT, 'public', outDir);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const it of items) {
  const file = join(OUT, `${it.name}.webp`);
  if (existsSync(file) && !force) continue;
  const prompt = `${it.prompt}, ${STYLE}`;
  const res = await fetch(`${API}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'image', name: `ko_img_${it.name}`.slice(0, 60), prompt, width: 1024, height: 576, seed: 1 }) });
  const { id } = await res.json().catch(() => ({}));
  if (!res.ok || !id) { console.log(`${it.name}: serveren sagde ${res.status}`); continue; }
  // Højst 20 min pr. billede; ellers videre til det næste (et job, der aldrig bliver færdigt, må ikke låse værktøjet).
  let j = {};
  for (let i = 0; i < 200 && !['done', 'error', 'failed'].includes(j.status); i++) { await sleep(6000); j = await (await fetch(`${API}/jobs/${id}`)).json(); }
  if (j.status !== 'done') { console.log(`${it.name}: ${j.error ?? `stadig ${j.status}`}`); continue; }
  const tmp = join(OUT, `.${it.name}.png`);
  writeFileSync(tmp, Buffer.from(await (await fetch(`${API}/jobs/${id}/image.png`)).arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', 'scale=960:540', '-c:v', 'libwebp', '-quality', '72', file]);
  unlinkSync(tmp);
  appendFileSync(join(ROOT, 'asset-generation/generated/images.md'), `- ${new Date().toISOString().slice(0, 16).replace('T', ' ')} image job ${id}: ${outDir}/${it.name}.webp "${prompt}"\n`);
  console.log(`${it.name}: ${id}`);
}
