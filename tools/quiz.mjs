#!/usr/bin/env node
// Quiz Night-spørgsmål fra serverens LLM. For hver kategori skrives spørgsmål i bidder; derefter svarer modellen på
// hvert spørgsmål uden facit (svarene blandet), og kun dem, hvor svaret stemmer, beholdes. Resultatet skrives til
// asset-generation/quiz-candidates.json; Claude læser dem igennem, før de kommer i public/data/quiz.json.
//   node tools/quiz.mjs [antal pr. kategori, standard 24]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chat, firstJsonArray } from './llm.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PER = Number(process.argv[2]) || 24, BATCH = 8;
const CATS = {
  Denmark: 'Denmark: Danish history, geography, culture, inventions, famous Danes, food and traditions',
  Animals: 'animals and nature from around the world',
  'Film & TV': 'well-known international films, TV series and animated movies',
  Food: 'food, cooking and drinks from around the world',
  Sport: 'sports, the Olympics and famous athletes',
  Science: 'science, space, the human body and technology',
};
const SYSTEM = 'You write trivia for an adult party quiz game shown on a TV. Output only what is asked, no introductions.';

async function batch(cat, about, avoid) {
  const text = await chat(SYSTEM, `Write ${BATCH} multiple-choice trivia questions in English about ${about}.
Rules: medium difficulty; exactly 4 short answers (at most 5 words each), exactly one correct and unambiguous;
no "which is NOT" questions; nothing that changes over time (no "current" champions or records); the question at most 18 words.
For each, also write "img": a short visual description for an illustration of the topic that does NOT show or hint at the answer.
Do not repeat these questions: ${avoid.slice(-40).join(' | ') || '(none)'}.
Return only a JSON array: [{"q": "...", "a": ["...", "...", "...", "..."], "correct": 0, "img": "..."}]`);
  return firstJsonArray(text).filter((x) => typeof x.q === 'string' && Array.isArray(x.a) && x.a.length === 4 && Number.isInteger(x.correct) && x.correct >= 0 && x.correct < 4)
    .map((x) => ({ cat, q: x.q.trim(), a: x.a.map((s) => String(s).trim()), correct: x.correct, img: String(x.img ?? '').trim() }));
}

// Modellen svarer uden facit, med svarene i en anden rækkefølge. Stemmer det ikke, er spørgsmålet tvivlsomt.
async function verify(item) {
  const order = [2, 0, 3, 1], letters = 'ABCD';
  const shown = order.map((i, k) => `${letters[k]}) ${item.a[i]}`).join('\n');
  const text = await chat('You are a careful quiz expert. Answer with only one letter.', `${item.q}\n${shown}`, { maxTokens: 5, temperature: 0 });
  const k = letters.indexOf(text.trim().toUpperCase()[0]);
  return k >= 0 && order[k] === item.correct;
}

const out = [];
for (const [cat, about] of Object.entries(CATS)) {
  const got = [];
  for (let tries = 0; got.length < PER && tries < 8; tries++) {
    let items;
    try { items = await batch(cat, about, got.map((g) => g.q)); } catch (e) { console.log(`${cat}: ${e.message}`); continue; }
    for (const it of items) {
      if (got.some((g) => g.q.toLowerCase() === it.q.toLowerCase())) continue;
      if (await verify(it)) got.push(it); else console.log(`  forkastet: ${it.q} -> ${it.a[it.correct]}`);
      if (got.length >= PER) break;
    }
    console.log(`${cat}: ${got.length}/${PER}`);
  }
  out.push(...got);
}
writeFileSync(join(ROOT, 'asset-generation/quiz-candidates.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} spørgsmål -> asset-generation/quiz-candidates.json`);
