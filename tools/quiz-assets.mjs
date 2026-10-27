#!/usr/bin/env node
// Billede og oplæsning til hvert spørgsmål i public/data/quiz.json, ét GPU-job ad gangen. Billedet laves ud fra
// spørgsmålets "img"-beskrivelse (som ikke må afsløre svaret) med tools/images.mjs; oplæsningen med Chatterbox `en`,
// tjekket med Whisper (op til 3 forsøg; bedste beholdes). quiz.json får img- og voice-felter, når filerne findes.
//   node tools/quiz-assets.mjs [images|voices|both]
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API = process.env.ASSET_API || 'http://10.1.0.21:8200';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'public/data/quiz.json');
const what = process.argv[2] || 'both';
const quiz = JSON.parse(readFileSync(DATA, 'utf8'));
const save = () => writeFileSync(DATA, JSON.stringify(quiz, null, 1) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (what === 'images' || what === 'both') {
  const list = join(ROOT, 'asset-generation/quiz-images.json');
  writeFileSync(list, JSON.stringify(quiz.filter((q) => q.imgPrompt).map((q) => ({ name: q.id, prompt: q.imgPrompt })), null, 1));
  execFileSync(process.execPath, [join(ROOT, 'tools/images.mjs'), list, 'quiz'], { stdio: 'inherit' });
  for (const q of quiz) if (existsSync(join(ROOT, `public/quiz/${q.id}.webp`))) q.img = `quiz/${q.id}.webp`;
  save();
}

if (what === 'voices' || what === 'both') {
  const OUT = join(ROOT, 'public/voice/quiz');
  mkdirSync(OUT, { recursive: true });
  const WHISPER = join(homedir(), 'privat/ai-film/.venv/bin/python');
  const check = (file, text) => JSON.parse(execFileSync(WHISPER, [join(ROOT, 'tools/tts-check.py'), 'en'], { input: `${file}\t${text}\n`, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split('\n').pop());
  for (const q of quiz) {
    const file = join(OUT, `${q.id}.mp3`);
    if (existsSync(file)) { q.voice = true; continue; }
    let best = null;
    for (let t = 1; t <= 3; t++) {
      const res = await fetch(`${API}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'speech', name: `ko_quiz_${q.id}`, language: 'en', text: q.q, exaggeration: 0.5, temperature: 0.7, seed: 1000 + t }) });
      const { id } = await res.json().catch(() => ({}));
      if (!res.ok || !id) { console.log(`${q.id}: serveren sagde ${res.status}`); continue; }
      let j = {};
      for (let i = 0; i < 120 && !['done', 'error', 'failed'].includes(j.status); i++) { await sleep(5000); j = await (await fetch(`${API}/jobs/${id}`)).json(); }
      if (j.status !== 'done') { console.log(`${q.id}: ${j.error ?? `stadig ${j.status}`}`); continue; }
      const tmp = join(OUT, `.${q.id}-${t}.wav`);
      writeFileSync(tmp, Buffer.from(await (await fetch(`${API}${j.audio}`)).arrayBuffer()));
      const score = check(tmp, q.q);
      if (!best || score.match > best.score.match) { if (best) unlinkSync(best.tmp); best = { id, tmp, score }; } else unlinkSync(tmp);
      if (score.match >= 0.9) break;
    }
    if (!best) continue;
    if (best.score.match >= 0.75) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', best.tmp, '-ac', '1', '-b:a', '48k', file]);
      q.voice = true;
    }
    unlinkSync(best.tmp);
    appendFileSync(join(ROOT, 'asset-generation/generated/voices.md'), `- speech job ${best.id}: quiz/${q.id}.mp3 "${q.q}" chatterbox en; Whisper ${best.score.match}${best.score.match < 0.75 ? ' (forkastet)' : ''}\n`);
    console.log(`${q.id}: ${best.score.match}`);
    save();
  }
  save();
}
