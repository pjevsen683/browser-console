import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLadder, trace, createPipes, answer, update, ranking, ROUNDS, STUDY, REVEAL } from '../public/src/games/pipes/rules.js';
import { mulberry32 } from '../public/src/rng.js';

test('stigen: ingen to tværrør rører samme rør i samme række; vejen fra hver start ender hvert sit sted', () => {
  for (let seed = 1; seed < 20; seed++) {
    const l = buildLadder(mulberry32(seed), 5, 12);
    assert.ok(l.rungs.length >= 8);
    for (const a of l.rungs) for (const b of l.rungs) if (a !== b && a.row === b.row) assert.ok(Math.abs(a.col - b.col) >= 2);
    const ends = [0, 1, 2, 3, 4].map((c) => trace(l, c).end);
    assert.deepEqual([...ends].sort(), [0, 1, 2, 3, 4]);
  }
  const l = { cols: 3, rows: 2, rungs: [{ row: 0, col: 0 }, { row: 1, col: 1 }] };
  assert.equal(trace(l, 0).end, 2);
  assert.equal(trace(l, 2).end, 1);
});

test('en runde: rigtigt rør giver 100 + op til 100 for fart; forkert 0; kun første svar', () => {
  const s = createPipes(['a', 'b', 'c'], mulberry32(5));
  const ev = update(s, 0.01);
  const r = ev.find((e) => e.type === 'round');
  assert.ok(r);
  const good = [...Array(s.ladder.cols).keys()].find((c) => trace(s.ladder, c).end === s.treasure);
  assert.equal(answer(s, 'a', good), true);
  assert.equal(answer(s, 'a', (good + 1) % s.ladder.cols), false);
  update(s, STUDY / 2);
  answer(s, 'b', good);
  answer(s, 'c', (good + 1) % s.ladder.cols);
  const ev2 = []; for (let t = 0; t < STUDY; t += 0.1) ev2.push(...update(s, 0.1));
  const rev = ev2.find((e) => e.type === 'reveal');
  assert.equal(rev.good, good);
  assert.ok(s.scores.a > s.scores.b && s.scores.b >= 100 && s.scores.c === 0);
});

test('runden slutter tidligt, når alle har svaret; efter ROUNDS er det slut', () => {
  const s = createPipes(['a', 'b'], mulberry32(6));
  let overs = 0, rounds = 0;
  for (let i = 0; i < 10000 && !s.over; i++) {
    for (const e of update(s, 0.1)) {
      if (e.type === 'round') { rounds++; answer(s, 'a', 0); answer(s, 'b', 1); }
      if (e.type === 'over') overs++;
    }
  }
  assert.equal(rounds, ROUNDS);
  assert.equal(overs, 1);
  s.scores = { a: 5, b: 9 };
  assert.deepEqual(ranking(s), ['b', 'a']);
  assert.ok(REVEAL > 1);
});

test('en spiller, der er væk, ventes der ikke på', () => {
  const s = createPipes(['a', 'b'], mulberry32(7));
  update(s, 0.01);
  s.away = new Set(['b']);
  answer(s, 'a', 0);
  assert.ok(update(s, 0.05).some((e) => e.type === 'reveal'));
});
