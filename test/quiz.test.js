import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickQuestions, createQuiz, update, answer, ranking, COUNT, ASK_TIME } from '../public/src/games/quiz/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const CATS = ['Denmark', 'Animals', 'Film & TV', 'Food', 'Sport', 'Science'];
const ALL = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, cat: CATS[i % 6], q: `Q${i}?`, a: ['a', 'b', 'c', 'd'], correct: i % 4 }));
const toAsk = (s) => { for (let i = 0; i < 1000 && s.phase !== 'ask'; i++) update(s, 0.05); };

test('udvælgelse: ingen gentagelser, ubrugte først, kategorierne blandet', () => {
  const used = new Set(ALL.slice(0, 50).map((q) => q.id));
  const qs = pickQuestions(ALL, COUNT, used, mulberry32(1));
  assert.equal(qs.length, COUNT);
  assert.equal(new Set(qs.map((q) => q.id)).size, COUNT);
  assert.ok(qs.every((q) => !used.has(q.id)), 'kun ubrugte, når der er nok');
  const fresh = pickQuestions(ALL, COUNT, new Set(), mulberry32(2));
  assert.equal(new Set(fresh.slice(0, 6).map((q) => q.cat)).size, 6, 'de første seks er seks forskellige kategorier');
});

test('udvælgelse: er (næsten) alt brugt, startes forfra, så der altid er nok', () => {
  const used = new Set(ALL.slice(0, 55).map((q) => q.id));
  const qs = pickQuestions(ALL, COUNT, used, mulberry32(3));
  assert.equal(qs.length, COUNT);
  assert.equal(new Set(qs.map((q) => q.id)).size, COUNT);
});

test('kun det første svar tæller, og kun mens der spørges', () => {
  const s = createQuiz(['a', 'b'], ALL.slice(0, COUNT));
  assert.equal(answer(s, 'a', 0), false);
  toAsk(s);
  assert.equal(answer(s, 'a', 1), true);
  assert.equal(answer(s, 'a', 2), false);
  assert.equal(answer(s, 'z', 2), false);
});

test('rigtigt svar giver 500 + op til 500 for fart; forkert 0; alle har svaret = runden slutter', () => {
  const s = createQuiz(['fast', 'slow', 'wrong'], ALL.slice(0, COUNT));
  toAsk(s);
  const right = s.qs[s.i].correct;
  answer(s, 'fast', right);
  for (let t = 0; t < ASK_TIME / 2; t += 0.1) update(s, 0.1);
  answer(s, 'slow', right);
  answer(s, 'wrong', (right + 1) % 4);
  const ev = update(s, 0.01);
  const rev = ev.find((e) => e.type === 'reveal');
  assert.ok(rev);
  assert.ok(s.scores.fast > 990 && s.scores.fast <= 1000);
  assert.ok(s.scores.slow > 700 && s.scores.slow < 800);
  assert.equal(s.scores.wrong, 0);
  assert.deepEqual(rev.counts, [0, 1, 2, 3].map((k) => (k === right ? 2 : k === (right + 1) % 4 ? 1 : 0)));
});

test('runden slutter, når tiden er gået, og efter COUNT spørgsmål er quizzen slut', () => {
  const s = createQuiz(['a', 'b'], ALL.slice(0, COUNT));
  let asks = 0, over = false;
  for (let i = 0; i < 100000 && !over; i++) {
    for (const e of update(s, 0.1)) {
      if (e.type === 'ask') { asks++; answer(s, 'b', s.qs[s.i].correct); }
      if (e.type === 'over') over = true;
    }
  }
  assert.equal(asks, COUNT);
  assert.deepEqual(ranking(s), ['b', 'a']);
  assert.equal(s.scores.a, 0);
});

test('udvælgelse: de sidste ubrugte kommer med, før brugte spørgsmål gentages', () => {
  const used = new Set(ALL.slice(0, 55).map((q) => q.id));
  const qs = pickQuestions(ALL, COUNT, used, mulberry32(4));
  const fresh = ALL.slice(55).map((q) => q.id);
  for (const id of fresh) assert.ok(qs.some((q) => q.id === id), `${id} mangler`);
  assert.equal(new Set(qs.map((q) => q.id)).size, COUNT);
});
