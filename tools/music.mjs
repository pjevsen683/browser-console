#!/usr/bin/env node
// Musik til lobbyen og spillene fra asset-serveren (ACE-Step, `type: music`), ét job ad gangen.
// Prompts i asset-generation/music.json; filerne bliver public/music/<navn>.mp3, og hvert job noteres i
// asset-generation/generated/music.md (96 kbit/s). Eksisterende filer springes over (--force laver dem igen).
//   node tools/music.mjs [navn …] [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const API = process.env.ASSET_API || 'http://10.1.0.21:8200';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/music');
const NOTE = join(ROOT, 'asset-generation/generated/music.md');
const cfg = JSON.parse(readFileSync(join(ROOT, 'asset-generation/music.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2), force = args.includes('--force');
const names = args.filter((a) => !a.startsWith('--'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const name of names.length ? names : Object.keys(cfg)) {
  const file = join(OUT, `${name}.mp3`);
  if (existsSync(file) && !force) { console.log(`${name}: findes`); continue; }
  const body = { type: 'music', model: 'ace', name: `ko_music_${name}`, ...cfg[name] };
  const res = await fetch(`${API}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const { id } = await res.json().catch(() => ({}));
  if (!res.ok || !id) { console.log(`${name}: serveren sagde ${res.status}`); continue; }
  const t0 = Date.now();
  let j = {};
  for (let i = 0; i < 100 && !['done', 'error', 'failed'].includes(j.status); i++) { await sleep(12000); j = await (await fetch(`${API}/jobs/${id}`)).json(); }
  if (j.status !== 'done') { console.log(`${name}: ${j.error}`); continue; }
  // Serverens mp3 er V0 (~2 MB pr. minut); 96 kbit/s rækker til fjernsynets højttalere (~720 KB).
  const raw = join(OUT, `.${name}-raw.mp3`);
  writeFileSync(raw, Buffer.from(await (await fetch(`${API}${j.audio}`)).arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-ac', '2', '-b:a', '96k', file]);
  unlinkSync(raw);
  const secs = Math.round((Date.now() - t0) / 1000);
  appendFileSync(NOTE, `- ${new Date().toISOString().slice(0, 16).replace('T', ' ')} music job ${id}: ${name}.mp3, ace, ${JSON.stringify(cfg[name])}, ${secs} s\n`);
  console.log(`${name}: ${id} (${secs} s)`);
}
