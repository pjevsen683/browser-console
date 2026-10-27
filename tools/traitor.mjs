#!/usr/bin/env node
// Ordpar til Who's the Traitor? fra serverens LLM: to beslægtede, men forskellige ting, som man kan give ledetråde om
// med ét ord. Skrives til asset-generation/traitor-candidates.json; Claude læser dem igennem.
//   node tools/traitor.mjs [antal, standard 70]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chat, firstJsonArray } from './llm.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WANT = Number(process.argv[2]) || 70;
const pairs = [];
for (let tries = 0; pairs.length < WANT && tries < 10; tries++) {
  const text = await chat('You design word pairs for a party game. Output only JSON.', `Write 20 pairs of English nouns for the game "Who's the Traitor?".
Each pair: two related but clearly different everyday things that share many clues but not all (like "beach" and "desert", "guitar" and "violin", "coffee" and "tea").
Single common words, known to everyone, no proper names. Do not repeat: ${pairs.map((p) => p.join('/')).slice(-60).join(', ') || '(none)'}.
Return only a JSON array of pairs: [["beach", "desert"], ...]`, { temperature: 0.9 });
  let got;
  try { got = firstJsonArray(text); } catch (e) { console.log(`  sprunget over: ${e.message.slice(0, 80)}`); continue; }
  for (const p of got) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const [a, b] = p.map((s) => String(s).trim().toLowerCase());
    if (!/^[a-z][a-z -]{1,18}$/.test(a) || !/^[a-z][a-z -]{1,18}$/.test(b) || a === b) continue;
    if (pairs.some(([x, y]) => [x, y].includes(a) || [x, y].includes(b))) continue;
    pairs.push([a, b]);
  }
  console.log(`${pairs.length}/${WANT}`);
}
writeFileSync(join(ROOT, 'asset-generation/traitor-candidates.json'), JSON.stringify(pairs.slice(0, WANT)) + '\n');
console.log(`${Math.min(WANT, pairs.length)} par -> asset-generation/traitor-candidates.json`);
