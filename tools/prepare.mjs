#!/usr/bin/env node
// generated/<name>.glb -> public/models/<name>.glb, made phone-sized:
// textures to 512 px WebP, geometry meshopt-compressed. Records the file (and an
// optional yaw correction, degrees) in public/models/models.json.
//
//   node tools/prepare.mjs cat mug vase        all named
//   node tools/prepare.mjs cat --yaw 90        set the cat's yaw
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GEN = join(ROOT, 'asset-generation/generated');
const PUB = join(ROOT, 'public/models');
const metaFile = join(PUB, 'models.json');
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};

const args = process.argv.slice(2);
const yawAt = args.indexOf('--yaw');
const yaw = yawAt >= 0 ? Number(args.splice(yawAt, 2)[1]) : undefined;
const bin = join(ROOT, 'node_modules/.bin/gltf-transform');

for (const name of args) {
  const src = join(GEN, `${name}.glb`), dst = join(PUB, `${name}.glb`);
  if (!existsSync(src)) { console.log(`${name}: ingen ${src}`); continue; }
  execFileSync(bin, ['optimize', src, dst, '--compress', 'meshopt', '--texture-compress', 'webp',
    '--texture-size', '512', '--simplify', 'false', '--join', 'false', '--flatten', 'false'], { stdio: 'pipe' });
  meta[name] = { ...(meta[name] ?? {}), file: `${name}.glb` };
  if (yaw !== undefined) meta[name].yaw = yaw;
  console.log(`${name}: ${(statSync(src).size / 1024) | 0} KB -> ${(statSync(dst).size / 1024) | 0} KB`);
}
writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
