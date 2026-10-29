#!/usr/bin/env node
// The referee's lines in Ice Floe Sumo, spoken by the local asset server: Chatterbox with language "en" and its
// built-in English voice (no "roest" model and no voice sample -- those are for Danish). The game went English
// 2026-10-25; the Danish lines (roest + coral_dk) could not say "vinder", and Whisper could not check one-syllable
// words in Danish.
// One job at a time; each line becomes public/voice/<key>-<n>.mp3 and
// public/voice/index.json lists them per key. Existing files are kept, so a
// re-run only records what is new.  node tools/voices.mjs [--force]
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API = process.env.ASSET_API || 'http://10.1.0.21:8200';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/voice');
const NOTE = join(ROOT, 'asset-generation/generated/voices.md');
mkdirSync(OUT, { recursive: true });
const force = process.argv.includes('--force');

// [text, exaggeration]. The server does not reproduce a seed, so every take is checked with Whisper
// (tools/tts-check.py en) and retaken until all words are heard.
const LINES = {
  'count-3': [['Three!', 0.6]],
  'count-2': [['Two!', 0.6]],
  'count-1': [['One!', 0.6]],
  go: [['Push!', 0.8], ['Go, go, go!', 0.8]],
  round: [['Round over!', 0.6], ['Splash! Only one left!', 0.7]],
  winner: [['We have a winner!', 0.8], ['What a sumo champion!', 0.8]],
  'quiz-intro': [['Welcome to Quiz Night!', 0.8]],
  'quiz-last': [['Last question!', 0.7]],
  'tr-clues': [['Give your clues!', 0.7]],
  'tr-vote': [['Time to vote!', 0.7]],
  'tr-caught': [['The traitor has been caught!', 0.8]],
  'tr-escaped': [['The traitor got away!', 0.8]],
  // Cat Chaos: mormor med coral_nic (den kvindelige danske stemme), så hun taler engelsk med dansk accent.
  'gran-hm': [['Hmm? What was that?', 0.6, 'coral_nic'], ['Kitty? Is that you?', 0.6, 'coral_nic']],
  'gran-look': [["I'm watching you, kitties.", 0.7, 'coral_nic'], ['Are you being good?', 0.6, 'coral_nic']],
  'gran-caught': [['Hey! I saw that!', 1.0, 'coral_nic'], ['Off the table, you rascal!', 1.0, 'coral_nic'], ['Naughty kitty!', 0.9, 'coral_nic']],
  'gran-done': [['Oh no, my lovely things!', 1.1, 'coral_nic']],
  'cats-intro': [["Don't let grandma see you!", 0.8]],
  'sb-intro': [['Snowball fight!', 0.9]],
  'sb-out': [["You're out!", 0.8]],
  'sb-red': [['Red team wins!', 0.8]],
  'sb-blue': [['Blue team wins!', 0.8]],
  'dg-intro': [['Draw and guess!', 0.8]],
  'dg-up': [["Time's up!", 0.7]],
  'dg-all': [['Everybody got it!', 0.8]],
  'rc-intro': [['Start your engines!', 0.9]],
  'rc-last': [['Last car standing!', 0.8]],
  'dn-intro': [["Let's dance!", 0.9]],
  'dn-end': [['What a dance party!', 0.9]],
  'pn-intro': [['Color panic!', 0.9]],
  'pn-red': [['Red!', 0.8]],
  'pn-blue': [['Blue!', 0.8]],
  'pn-yellow': [['Yellow!', 0.8]],
  'pn-green': [['Green!', 0.8]],
  'ch-sit': [['Sit down!', 0.9]],
  'cn-intro': [['Grab the coins!', 0.9]],
  'bm-intro': [['Bombs away!', 0.9]],
  'pl-intro': [["Don't pick the bomb!", 0.9]],
  'sm-intro': [['Simon says!', 0.9]],
  'sm-notred': [['Not red!', 0.8]],
  'sm-notblue': [['Not blue!', 0.8]],
  'sm-dont': [["Don't touch!", 0.9]],
  'pp-intro': [['Follow the pipes!', 0.8]],
  'tg-intro': [['Pull!', 1.0]],
  'rp-intro': [['Keep your balance!', 0.8]],
  'bk-intro': [['Here comes the bomber!', 0.9]],
  'st-intro': [['Stack it high!', 0.8]],
  'st-perfect': [['Perfect!', 0.9]],
  'sv-intro': [['Survive the waves!', 0.9]],
  'sv-wave': [['Here they come!', 0.9], ['Next wave!', 0.8]],
  'sv-clear': [['Wave cleared!', 0.8]],
  'record': [['New record!', 1.0]],
};
const TAKES = 5;
const LANG = 'en';
const WHISPER = join(homedir(), 'privat/ai-film/.venv/bin/python');

function check(file, text) {
  const out = execFileSync(WHISPER, [join(ROOT, 'tools/tts-check.py'), LANG], { input: `${file}\t${text}\n`, stdio: ['pipe', 'pipe', 'ignore'] });
  return JSON.parse(out.toString().trim().split('\n').pop());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The server restarts now and then; a refused connection is waited out.
async function api(path, init) {
  for (let attempt = 1; ; attempt++) {
    try { return await fetch(`${API}${path}`, init); } catch (e) {
      if (attempt === 20) throw e;
      await sleep(15000);
    }
  }
}
// One take on the server. Something outside the job queue sometimes holds most
// of the GPU, and the server restarts now and then; both are waited out.
async function take(body) {
  for (let attempt = 1; ; attempt++) {
    const res = await api('/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const { id } = await res.json();
    let j;
    do { await sleep(5000); j = await (await api(`/jobs/${id}`)).json(); } while (j.status !== 'done' && j.status !== 'error' && j.status !== 'failed');
    if (j.status === 'done') return { id, wav: Buffer.from(await (await api(`/jobs/${id}/audio.wav`)).arrayBuffer()) };
    if (!/memory|genstartet/i.test(j.error ?? '') || attempt === 6) throw new Error(`${id}: ${j.error}`);
    console.log(`  GPU'en er fuld eller serveren genstartede, prøver igen om 30 s (${attempt}/5)`);
    await sleep(30000);
  }
}

const index = {};
for (const [key, lines] of Object.entries(LINES)) {
  index[key] = [];
  for (const [n, [text, ex, voice]] of lines.entries()) {
    const file = `${key}-${n}.mp3`;
    index[key].push(file);
    if (existsSync(join(OUT, file)) && !force) continue;
    let best = null;
    for (let t = 1; t <= TAKES; t++) {
      const seed = 1000 + Math.floor(Math.random() * 9000);
      const { id, wav } = await take({ type: 'speech', name: `ko_${key}_${n}`, language: LANG, text, exaggeration: ex,
        temperature: 0.7, seed, ...(voice ? { voice } : {}) });
      const tmp = join(OUT, `.${key}-${n}-${t}.wav`);
      writeFileSync(tmp, wav);
      const score = check(tmp, text);
      console.log(`  ${file} take ${t}: ${score.match} ord, ${score.lang} ${LANG}  "${score.heard}"`);
      if (!best || score.match > best.score.match || (score.match === best.score.match && score.lang > best.score.lang)) {
        if (best) unlinkSync(best.tmp);
        best = { id, seed, tmp, score };
      } else unlinkSync(tmp);
      if (best.score.match >= 0.95 && best.score.lang >= 0.5) break;
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', best.tmp, '-ac', '1', '-b:a', '64k', join(OUT, file)]);
    unlinkSync(best.tmp);
    appendFileSync(NOTE, `- speech job ${best.id}: ${file} "${text}" chatterbox ${LANG} (${voice ?? 'indbygget stemme'}) exaggeration ${ex} temperature 0.7 seed ${best.seed}; Whisper ${best.score.match} ord, ${best.score.lang} ${LANG}\n`);
    console.log(`${file}: "${text}" (${best.score.match})`);
  }
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
