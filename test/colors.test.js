import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createColorRush, makeQuestion, update, answer, ranking, COLORS, ROUNDS, ROUND_TIME, GAP } from '../public/src/games/colors/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const toAsk = (s) => { const ev = []; for (let i = 0; i < 200 && s.phase !== 'ask'; i++) ev.push(...update(s, 0.05)); return ev; };

test('et spørgsmål: ordet og blækket er forskellige, og blækket er blandt de fire valg', () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 200; i++) {
    const q = makeQuestion(rng);
    assert.notEqual(q.word, q.ink);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options[q.correct], q.ink);
    assert.ok(q.options.every((c) => c >= 0 && c < COLORS.length));
  }
});

test('kun det første svar tæller, og kun mens der spørges', () => {
  const s = createColorRush(['a', 'b'], mulberry32(2));
  assert.equal(answer(s, 'a', 0), false);            // før første spørgsmål
  toAsk(s);
  assert.equal(answer(s, 'a', 1), true);
  assert.equal(answer(s, 'a', 2), false);
  assert.equal(answer(s, 'x', 2), false);             // ikke med i spillet
});

test('point: første rigtige 3, anden 2, resten 1, forkert 0; runden slutter, når alle har svaret', () => {
  const s = createColorRush(['a', 'b', 'c', 'd'], mulberry32(3));
  toAsk(s);
  const right = s.q.correct, wrong = (right + 1) % 4;
  answer(s, 'c', right); answer(s, 'a', right); answer(s, 'd', wrong); answer(s, 'b', right);
  const ev = update(s, 0.01);
  assert.ok(ev.some((e) => e.type === 'reveal'));
  assert.deepEqual(s.scores, { c: 3, a: 2, b: 1, d: 0 });
});

test('runden slutter efter tiden, også uden svar', () => {
  const s = createColorRush(['a', 'b'], mulberry32(4));
  toAsk(s);
  let ev = [];
  for (let t = 0; t < ROUND_TIME + 0.2; t += 0.1) ev.push(...update(s, 0.1));
  assert.ok(ev.some((e) => e.type === 'reveal'));
  assert.deepEqual(s.scores, { a: 0, b: 0 });
});

test(`efter ${ROUNDS} runder er spillet slut, og ranglisten følger pointene`, () => {
  const s = createColorRush(['a', 'b', 'c'], mulberry32(5));
  let rounds = 0, over = false;
  for (let i = 0; i < 100000 && !over; i++) {
    for (const e of update(s, 0.05)) {
      if (e.type === 'ask') { rounds++; answer(s, 'b', s.q.correct); answer(s, 'a', s.q.correct); answer(s, 'c', (s.q.correct + 1) % 4); }
      if (e.type === 'over') over = true;
    }
  }
  assert.equal(rounds, ROUNDS);
  assert.equal(s.phase, 'over');
  assert.deepEqual(ranking(s), ['b', 'a', 'c']);
  assert.equal(s.scores.b, 3 * ROUNDS);
  assert.ok(GAP > 0);
});
