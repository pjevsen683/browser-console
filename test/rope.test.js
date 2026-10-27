import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRope, step, ranking, LENGTH, FALL, FALL_TIME, CHECK, TIME } from '../public/src/games/rope/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const calm = (s) => { for (const w of s.walkers) w.gustT = 1e9; s.gusts = false; };
const run = (s, secs, input, dt = 1 / 60) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...step(s, typeof input === 'function' ? input() : input, dt)); return ev; };
const balance = (s, id) => { const w = s.walkers.find((x) => x.id === id); return { x: Math.max(-1, Math.min(1, w.theta * 4 + w.omega * 1.2)) }; };

test('uden at styre vælter man; den, der styrer imod, holder balancen og går fremad', () => {
  const s = createRope(['a', 'b'], mulberry32(1));
  calm(s);
  s.walkers[0].theta = 0.05; s.walkers[1].theta = 0.05;
  const ev = run(s, 4, () => new Map([['b', balance(s, 'b')]]));
  assert.ok(ev.some((e) => e.type === 'fall' && e.id === 'a'));
  assert.ok(!ev.some((e) => e.type === 'fall' && e.id === 'b'));
  assert.ok(s.walkers[1].dist > 3, `gik ${s.walkers[1].dist}`);
});

test('man går hurtigst, når man står lige; skævt går langsommere', () => {
  const s = createRope(['a', 'b'], mulberry32(2));
  calm(s);
  s.walkers[1].theta = 0.4;
  step(s, new Map(), 0.1);
  assert.ok(s.walkers[0].dist > s.walkers[1].dist);
});

test('et fald: væk i FALL_TIME, så tilbage ved sidste checkpoint, lige', () => {
  const s = createRope(['a'], mulberry32(3));
  calm(s);
  Object.assign(s.walkers[0], { dist: CHECK * 1.6, theta: FALL + 0.01 });
  const ev = run(s, 0.05, new Map());
  assert.ok(ev.some((e) => e.type === 'fall'));
  const ev2 = [];
  for (let t = 0; t < FALL_TIME + 0.1 && !ev2.some((e) => e.type === 'back'); t += 1 / 60) ev2.push(...step(s, new Map(), 1 / 60));
  const w = s.walkers[0];
  assert.equal(w.dist, CHECK);
  assert.equal(w.theta, 0);
  assert.equal(w.fallT, 0);
});

test('vindstød skubber; i mål ved LENGTH; slut når alle er i mål eller tiden er gået; rangliste', () => {
  const s = createRope(['a', 'b', 'c'], mulberry32(4));
  const ev = run(s, 10, new Map());
  assert.ok(ev.some((e) => e.type === 'gust'));
  const s2 = createRope(['a', 'b', 'c'], mulberry32(5));
  calm(s2);
  s2.walkers[0].dist = LENGTH - 0.01;
  const ev2 = step(s2, new Map(), 0.1);
  assert.ok(ev2.some((e) => e.type === 'finish' && e.id === 'a'));
  s2.walkers[1].dist = 20; s2.walkers[2].dist = 10;
  const ev3 = run(s2, TIME + 1, () => new Map(['b', 'c'].map((id) => [id, balance(s2, id)])), 0.1);
  assert.equal(ev3.filter((e) => e.type === 'over').length, 1);
  assert.equal(ranking(s2)[0], 'a');
});

test('botten når over i blæst, men falder en gang imellem', async () => {
  const { ropeBot } = await import('../public/src/games/rope/ai.js');
  let finished = 0, falls = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const rng = mulberry32(seed), s = createRope(['b'], rng), mem = new Map();
    for (let i = 0; i < 60 * TIME && !s.over; i++) for (const e of step(s, new Map([['b', ropeBot(s, 'b', mem, rng)]]), 1 / 60)) if (e.type === 'fall') falls++;
    if (s.walkers[0].finished) finished++;
  }
  assert.ok(finished >= 4, `${finished} af 6 i mål`);
  assert.ok(falls >= 1, `${falls} fald`);
});
