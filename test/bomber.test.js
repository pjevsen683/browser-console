import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBomber, update, aim, drop, hit, ranking, roundTime, COUNTDOWN, WARN, BLAST, COOLDOWN, BREAK, HIT_POINTS } from '../public/src/games/bomber/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const ids = ['a', 'b', 'c', 'd'];
const run = (s, secs, animals = [], dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt, animals)); return ev; };

test('alle er bombemand én gang, i tilfældig rækkefølge; rundens længde efter antal spillere', () => {
  const s = createBomber(ids, mulberry32(1));
  assert.deepEqual([...s.bosses].sort(), ids);
  assert.ok(roundTime(2) > roundTime(12));
  assert.equal(s.boss, s.bosses[0]);
  assert.deepEqual(s.dodgers.sort(), ids.filter((id) => id !== s.boss).sort());
});

test('sigtet følger pinden og bliver på øen; A smider en bombe med nedkøling', () => {
  const s = createBomber(ids, mulberry32(2), { radius: 7 });
  run(s, COUNTDOWN + 0.05);
  aim(s, { x: 1, y: 0 }, 0.5);
  assert.ok(s.aim.x > 2 && Math.abs(s.aim.z) < 1e-9);
  aim(s, { x: 1, y: 0 }, 10);
  assert.ok(Math.hypot(s.aim.x, s.aim.z) <= 7 - 0.5 + 1e-9);
  assert.equal(drop(s), true);
  assert.equal(drop(s), false, 'nedkøling');
  run(s, COOLDOWN + 0.05);
  assert.equal(drop(s), true);
});

test('bomben springer efter WARN: de undvigere inden for BLAST er ude, og bombemanden får HIT_POINTS pr. ram', () => {
  const s = createBomber(ids, mulberry32(3));
  run(s, COUNTDOWN + 0.05);
  s.aim = { x: 0, z: 0 };
  drop(s);
  const [d1, d2] = s.dodgers;
  const animals = [{ id: d1, x: 0.5, z: 0, alive: true }, { id: d2, x: BLAST + 1, z: 0, alive: true }];
  const ev = run(s, WARN + 0.1, animals);
  assert.deepEqual(ev.find((e) => e.type === 'boom').out, [d1]);
  assert.equal(s.points[s.boss], HIT_POINTS);
  assert.ok(s.out.includes(d1));
  hit(s, d2);                                         // fx faldet i vandet
  assert.equal(s.points[s.boss], 2 * HIT_POINTS);
});

test('runden slutter, når alle undvigere er ude, eller tiden er gået; de overlevende får et point; så næste bombemand', () => {
  const s = createBomber(['a', 'b', 'c'], mulberry32(4));
  run(s, COUNTDOWN + 0.05);
  const [d1, d2] = s.dodgers, boss1 = s.boss;
  hit(s, d1);
  const ev = run(s, roundTime(3) + 0.1);
  const end = ev.find((e) => e.type === 'roundEnd');
  assert.deepEqual(end.survivors, [d2]);
  assert.equal(s.points[d2], 1);
  const ev2 = run(s, BREAK + 0.1);
  assert.ok(ev2.some((e) => e.type === 'next'));
  assert.notEqual(s.boss, boss1);
  hit(s, 'zz');
  run(s, COUNTDOWN + 0.05);
  for (const d of [...s.dodgers]) hit(s, d);
  assert.ok(run(s, 0.1).some((e) => e.type === 'roundEnd'));
});

test('efter sidste bombemand er det slut; rangliste efter point', () => {
  const s = createBomber(['a', 'b'], mulberry32(5));
  let over = 0;
  for (let i = 0; i < 4000 && !s.over; i++) over += update(s, 0.1, []).filter((e) => e.type === 'over').length;
  assert.equal(over, 1);
  s.points = { a: 1, b: 4 };
  assert.deepEqual(ranking(s), ['b', 'a']);
});
