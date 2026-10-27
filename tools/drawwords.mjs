#!/usr/bin/env node
// Ord til Draw & Guess fra serverens LLM: ting, der kan tegnes på en telefon på et minut og gættes af andre.
// Skrives til asset-generation/draw-candidates.json; Claude læser dem igennem, før de kommer i public/data/draw.json.
//   node tools/drawwords.mjs [antal, standard 260]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chat, firstJsonArray } from './llm.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WANT = Number(process.argv[2]) || 260;
const THEMES = ['animals', 'food', 'household objects', 'vehicles and travel', 'nature and weather', 'sports and hobbies',
  'jobs and people', 'buildings and places', 'clothing', 'actions (verbs a person does)', 'fantasy and fairy tales', 'music and instruments'];
const words = [];
for (let tries = 0; words.length < WANT && tries < 30; tries++) {
  const theme = THEMES[tries % THEMES.length];
  const text = await chat('You pick words for a drawing party game. Output only JSON.', `Write 25 English words or two-word phrases on the theme "${theme}" for a Pictionary-style game.
Each must be easy to draw with a finger on a phone in under a minute and easy to recognise and guess from a simple sketch.
Common words everyone knows, no proper names, no brands, nothing abstract. Mix easy and medium.
Do not repeat: ${words.slice(-80).join(', ') || '(none)'}.
Return only a JSON array of strings: ["cat", "rainbow", ...]`, { temperature: 0.9 });
  let got;
  try { got = firstJsonArray(text); } catch (e) { console.log(`  sprunget over: ${e.message.slice(0, 80)}`); continue; }
  for (const w0 of got) {
    const w = String(w0).trim().toLowerCase();
    if (!/^[a-z][a-z -]{1,18}[a-z]$/.test(w) || w.split(' ').length > 2 || words.includes(w)) continue;
    words.push(w);
  }
  console.log(`${theme}: ${words.length}/${WANT}`);
}
writeFileSync(join(ROOT, 'asset-generation/draw-candidates.json'), JSON.stringify(words.slice(0, WANT)) + '\n');
console.log(`${Math.min(WANT, words.length)} ord -> asset-generation/draw-candidates.json`);
