#!/usr/bin/env node
// Talks to the local asset server (see ~/privat/ASSETS-BILLEDER-OG-3D.md).
// One job at a time, polled every 12 s, and every job is written to
// asset-generation/generated/<name>.md -- the server forgets its jobs, the note
// is the only record of how a model was made.
//
//   node tools/gen.mjs images cat,mug --seeds 1,2     reference images
//   node tools/gen.mjs model mug <image-job-id>       3D from a chosen image
//   node tools/gen.mjs parts cat <image-job-id|-> '<parts json>' [--source <3d-job-id>]
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const API = process.env.ASSET_API || 'http://10.1.0.21:8200';
const ROOT = fileURLToPath(new URL('../asset-generation/', import.meta.url));
const OUT = join(ROOT, 'generated');
const cfg = JSON.parse(readFileSync(join(ROOT, 'assets.json'), 'utf8'));

const GAME = { res: 1024, faces: 8000, tex: 1024, remesh: 384 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

function note(name, line) {
  const file = join(OUT, `${name}.md`);
  if (!existsSync(file)) {
    writeFileSync(file, `# ${name}\n\nLavet på den lokale asset-server (${API}; TRELLIS.2 MIT, Z-Image Turbo Apache 2.0 -- fri brug).\n\n`);
  }
  appendFileSync(file, `- ${stamp()} ${line}\n`);
}

async function post(body, query) {
  const url = query ? `${API}/jobs?${new URLSearchParams(query)}` : `${API}/jobs`;
  const res = await fetch(url, query
    ? { method: 'POST', body, headers: { 'content-type': 'image/png' } }
    : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${res.status}: ${JSON.stringify(json)}`);
  return json.id ?? json.job?.id ?? json.job_id;
}

async function wait(id) {
  const t0 = Date.now();
  for (;;) {
    const job = await (await fetch(`${API}/jobs/${id}`)).json();
    if (job.status === 'done') return { job, secs: Math.round((Date.now() - t0) / 1000) };
    if (job.status === 'error' || job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(`job ${id} ${job.status}: ${job.error ?? ''}`);
    }
    process.stdout.write(`  ${id} ${job.status} ${job.stage ?? ''} ${job.step ?? ''}\r`);
    await sleep(12000);
  }
}

async function download(id, file, dest) {
  const res = await fetch(`${API}/jobs/${id}/${file}`);
  if (!res.ok) throw new Error(`GET ${file} ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const promptOf = (name) => {
  const a = cfg.assets[name];
  if (!a) throw new Error(`ukendt asset ${name}`);
  return { ...a, prompt: `${a.prompt}, ${cfg.style}` };
};

const [cmd, arg, ...rest] = process.argv.slice(2);
const flag = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };

if (cmd === 'images') {
  const seeds = (flag('--seeds') || '1').split(',').map(Number);
  for (const name of arg.split(',')) {
    const a = promptOf(name);
    for (const seed of seeds) {
      const id = await post({ type: 'image', kind: a.kind, prompt: a.prompt, seed, name: `ko_${name}` });
      const { secs } = await wait(id);
      await download(id, 'image.png', join(OUT, `${name}-s${seed}.png`));
      note(name, `image job ${id}, kind=${a.kind}, seed ${seed}, ${secs} s: "${a.prompt}"`);
      console.log(`${name} seed ${seed}: ${id} (${secs} s)`);
    }
  }
} else if (cmd === 'model' || cmd === 'parts') {
  const a = promptOf(arg);
  if (flag('--kind')) a.kind = flag('--kind');
  const imageJob = rest[0];
  const settings = { ...GAME, ...(a.kind === 'person' ? { faces: 9000 } : {}) };
  // --res / --remesh / --faces override, e.g. after running out of VRAM
  for (const k of ['res', 'remesh', 'faces', 'tex', 'seed']) if (flag(`--${k}`)) settings[k] = Number(flag(`--${k}`));
  let id;
  if (cmd === 'model') {
    const img = await (await fetch(`${API}/jobs/${imageJob}/image.png`)).arrayBuffer();
    id = await post(Buffer.from(img), { type: '3d', kind: a.kind, name: `ko_${arg}`, ...settings });
  } else {
    const parts = JSON.parse(rest[1]);
    const source = flag('--source');
    const body = { type: 'parts', kind: a.kind, name: `ko_${arg}`, animate: true, parts, ...settings };
    if (source) body.source = source;
    else {
      // parts takes JSON; give it the chosen image's prompt + seed by reusing the image job
      body.source = imageJob;
    }
    id = await post(body);
  }
  console.log(`${cmd} ${arg}: job ${id}`);
  const { secs } = await wait(id);
  await download(id, 'model.glb', join(OUT, `${arg}.glb`));
  await download(id, 'image.png', join(OUT, `${arg}-ref.png`)).catch(() => {});
  if (cmd === 'parts') await download(id, 'parts.png', join(OUT, `${arg}-parts.png`)).catch(() => {});
  note(arg, `${cmd} job ${id} fra ${imageJob}, ${JSON.stringify(settings)}${cmd === 'parts' ? ' parts=' + rest[1] : ''}, ${secs} s -> ${arg}.glb`);
  console.log(`\n${arg}.glb færdig (${secs} s)`);
} else {
  console.log('brug: images <a,b> [--seeds 1,2] | model <name> <image-job> | parts <name> <image-job> <json> [--source id]');
}
