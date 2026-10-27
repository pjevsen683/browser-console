import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTraitor, update, done, vote, leave, ranking, ROUNDS, CLUE_TIME, MAX_CLUE_ROUNDS } from '../public/src/games/traitor/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const PAIRS = [['beach', 'desert'], ['guitar', 'violin'], ['coffee', 'tea'], ['cat', 'dog']];
const ids = ['a', 'b', 'c', 'd', 'e'];
const tick = (s, secs = 0.1) => update(s, secs);
const until = (s, phase) => { const ev = []; for (let i = 0; i < 2000 && s.phase !== phase; i++) ev.push(...tick(s)); return ev; };
const allClues = (s) => { const ev = until(s, 'clues'); while (s.phase === 'clues') { done(s, s.order[s.turn]); ev.push(...tick(s, 0.01)); } return ev; };

test('hver runde: præcis én forræder med det andet ord; alle andre får det første', () => {
  const s = createTraitor(ids, PAIRS, mulberry32(1));
  const ev = until(s, 'clues');
  assert.ok(ev.some((e) => e.type === 'deal'));
  const pair = PAIRS.find((p) => p.includes(s.words.get(s.traitor)));
  assert.equal(s.words.get(s.traitor), pair[1]);
  for (const id of ids) if (id !== s.traitor) assert.equal(s.words.get(id), pair[0]);
});

test('ledetråde: på skift i rækkefølgen; kun den, der har tur, kan trykke Done; tiden flytter turen', () => {
  const s = createTraitor(ids, PAIRS, mulberry32(2));
  until(s, 'clues');
  const first = s.order[0], second = s.order[1];
  assert.equal(done(s, second), false);
  assert.equal(done(s, first), true);
  assert.equal(s.order[s.turn], second);
  for (let t = 0; t < CLUE_TIME + 0.2; t += 0.1) tick(s);
  assert.notEqual(s.order[s.turn], second);
});

test('afstemning: kun levende, ikke på sig selv, kun én gang; slutter når alle har stemt', () => {
  const s = createTraitor(ids, PAIRS, mulberry32(3));
  allClues(s);
  assert.equal(s.phase, 'vote');
  assert.equal(vote(s, 'a', 'a'), false);
  assert.equal(vote(s, 'a', 'zz'), false);
  assert.equal(vote(s, 'a', 'b'), true);
  assert.equal(vote(s, 'a', 'c'), false);
});

test('fanget forræder: +1 til de andre tilbageværende og +1 ekstra til dem, der stemte på ham', () => {
  const s = createTraitor(ids, PAIRS, mulberry32(4));
  allClues(s);
  const t = s.traitor, others = ids.filter((id) => id !== t);
  vote(s, others[0], t); vote(s, others[1], t); vote(s, others[2], t); vote(s, others[3], others[0]); vote(s, t, others[0]);
  const ev = tick(s, 0.01);
  assert.ok(ev.some((e) => e.type === 'caught'));
  assert.equal(s.scores[t], 0);
  assert.deepEqual(others.map((id) => s.scores[id]), [2, 2, 2, 1]);
});

test('uafgjort: ingen ud, ny omgang ledetråde; forkert ude og to tilbage: forræderen slipper væk med +4', () => {
  const s = createTraitor(['a', 'b', 'c', 'd'], PAIRS, mulberry32(5));
  allClues(s);
  const t = s.traitor, inn = ['a', 'b', 'c', 'd'].filter((id) => id !== t);
  vote(s, inn[0], inn[1]); vote(s, inn[1], inn[0]); vote(s, inn[2], t); vote(s, t, inn[2]);   // 1-1-1-1: uafgjort
  let ev = tick(s, 0.01);
  assert.ok(ev.some((e) => e.type === 'tally' && e.out === null));
  ev = allClues(s);
  vote(s, inn[0], inn[1]); vote(s, inn[2], inn[1]); vote(s, t, inn[1]); vote(s, inn[1], t);   // inn[1] ude
  ev = tick(s, 0.01);
  assert.ok(ev.some((e) => e.type === 'tally' && e.out === inn[1]));
  allClues(s);
  vote(s, inn[0], inn[2]); vote(s, t, inn[2]); vote(s, inn[2], t);                            // inn[2] ude: to tilbage
  ev = tick(s, 0.01);
  assert.ok(ev.some((e) => e.type === 'escaped'));
  assert.equal(s.scores[t], 4);
});

test(`efter ${MAX_CLUE_ROUNDS} omgange uden at fange forræderen slipper han væk`, () => {
  const s = createTraitor(ids, PAIRS, mulberry32(6));
  let escaped = false;
  for (let r = 0; r < MAX_CLUE_ROUNDS && !escaped; r++) {
    allClues(s);
    for (let i = 0; i < 400 && s.phase === 'vote'; i++) escaped = tick(s).some((e) => e.type === 'escaped') || escaped;  // ingen stemmer: uafgjort
  }
  assert.ok(escaped);
});

test(`${ROUNDS} runder med ny forræder, så er spillet slut`, () => {
  const s = createTraitor(ids, PAIRS, mulberry32(7));
  let over = false, deals = 0;
  for (let i = 0; i < 200 && !over; i++) {
    if (i === 0) deals += allClues(s).filter((e) => e.type === 'deal').length; else allClues(s);
    for (const v of s.alive) if (v !== s.traitor) vote(s, v, s.traitor);
    vote(s, s.traitor, s.alive.find((x) => x !== s.traitor));
    for (let k = 0; k < 400 && !over && s.phase !== 'clues'; k++) {
      const ev2 = tick(s);
      deals += ev2.filter((e) => e.type === 'deal').length;
      over = ev2.some((e) => e.type === 'over') || over;
    }
  }
  assert.ok(over);
  assert.equal(deals, ROUNDS);
  assert.equal(ranking(s).length, ids.length);
});

test('forsvinder forræderen, annulleres runden; forsvinder den, der har tur, går turen videre', () => {
  const s = createTraitor(ids, PAIRS, mulberry32(8));
  until(s, 'clues');
  const cur = s.order[s.turn] === s.traitor ? s.order[s.turn + 1] : s.order[s.turn];
  if (s.order[s.turn] === s.traitor) done(s, s.traitor);
  const next = s.order[s.turn + 1];
  leave(s, cur);
  assert.ok(!s.alive.includes(cur));
  assert.equal(s.order[s.turn], next);
  const ev = leave(s, s.traitor);
  assert.ok(ev.some((e) => e.type === 'void'));
  assert.ok(Object.values(s.scores).every((v) => v === 0));
});

test('en spiller, der kommer tilbage, får ord igen fra næste runde', async () => {
  const { rejoin } = await import('../public/src/games/traitor/rules.js');
  const s = createTraitor(ids, PAIRS, mulberry32(9));
  until(s, 'clues');
  const victim = s.alive.find((id) => id !== s.traitor);
  leave(s, victim);
  rejoin(s, victim);
  assert.ok(!s.alive.includes(victim), 'sidder resten af runden over');
  for (let i = 0; i < 5000 && s.round < 2; i++) { if (s.phase === 'clues') done(s, s.order[s.turn]); tick(s); }
  assert.equal(s.round, 2);
  assert.ok(s.words.has(victim) && s.alive.includes(victim));
});
