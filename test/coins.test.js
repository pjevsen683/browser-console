import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoins, update, bump, ranking, ROUND, MAX_COINS, GUARD, PICK_R } from '../public/src/games/coins/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (s, secs, animals, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt, animals)); return ev; };
const far = [{ id: 'a', x: 100, z: 100, alive: true }, { id: 'b', x: 100, z: 100, alive: true }];

test('mønterne regner ned inde i arenaen, nogle store; aldrig flere end MAX_COINS', () => {
  const s = createCoins(['a', 'b'], mulberry32(1), { radius: 7 });
  run(s, 30, far);
  assert.equal(s.coins.length, MAX_COINS);
  for (const c of s.coins) assert.ok(Math.hypot(c.x, c.z) < 7 - 0.5);
  const s2 = createCoins(['a'], mulberry32(2), { radius: 7 });
  const ev = run(s2, 30, far);
  assert.ok(ev.some((e) => e.type === 'spawn' && e.coin.value === 5), 'en stor mønt');
});

test('man samler en landet mønt op ved at gå hen til den; en mønt i luften kan ikke tages', () => {
  const s = createCoins(['a', 'b'], mulberry32(3), { radius: 7 });
  s.coins.push({ id: 1, x: 1, z: 1, y: 0, vy: 0, value: 1 }, { id: 2, x: -1, z: -1, y: 5, vy: 0, value: 5 });
  const animals = [{ id: 'a', x: 1 + PICK_R * 0.8, z: 1, alive: true }, { id: 'b', x: -1, z: -1, alive: true }];
  const ev = update(s, 0.01, animals);
  assert.deepEqual(ev.filter((e) => e.type === 'pick').map((e) => [e.id, e.value]), [['a', 1]]);
  assert.equal(s.scores.a, 1);
  assert.equal(s.scores.b, 0);
  assert.ok(s.coins.some((c) => c.id === 2));
});

test('bliver man skubbet, taber man 30 % (mindst 2, højst 10) som mønter omkring sig; man kan ikke selv tage dem straks', () => {
  const s = createCoins(['a', 'b'], mulberry32(4), { radius: 7 });
  s.scores.a = 20;
  const r = bump(s, 'a', 0, 0);
  assert.equal(r.dropped, 6);
  assert.equal(s.scores.a, 14);
  assert.equal(s.coins.length, 6);
  for (const c of s.coins) { const d = Math.hypot(c.x, c.z); assert.ok(d > 1 && d < 3); }
  s.scores.b = 1;
  assert.equal(bump(s, 'b', 0, 0).dropped, 1);
  s.scores.a = 100;
  assert.equal(bump(s, 'a', 0, 0).dropped, 10);
  for (const c of s.coins) { c.y = 0; c.vy = 0; c.x = 0.2; c.z = 0; }
  const ev = update(s, 0.01, [{ id: 'a', x: 0, z: 0, alive: true }]);
  assert.equal(ev.filter((e) => e.type === 'pick').length, 0, 'den skubbede kan ikke tage dem lige med det samme');
  const ev2 = run(s, GUARD + 0.1, [{ id: 'a', x: 0, z: 0, alive: true }]);
  assert.ok(ev2.filter((e) => e.type === 'pick').length > 0);
});

test('efter ROUND er det slut; ranglisten efter mønter', () => {
  const s = createCoins(['a', 'b', 'c'], mulberry32(5), { radius: 7 });
  const ev = run(s, ROUND + 1, far, 0.1);
  assert.equal(ev.filter((e) => e.type === 'over').length, 1);
  s.scores = { a: 3, b: 9, c: 5 };
  assert.deepEqual(ranking(s), ['b', 'c', 'a']);
});

test('botten samler mønter', async () => {
  const { coinBot } = await import('../public/src/games/coins/ai.js');
  const { createWorld, step } = await import('../public/src/games/sumo/physics.js');
  const rng = mulberry32(6), s = createCoins(['b'], rng, { radius: 7 }), w = createWorld(['b'], rng, { walls: true, radius: 7 });
  for (let i = 0; i < 60 * 20; i++) { step(w, new Map([['b', coinBot(s, w, 'b', rng)]]), 1 / 60); update(s, 1 / 60, w.animals); }
  assert.ok(s.scores.b >= 10, `${s.scores.b} mønter`);
});
