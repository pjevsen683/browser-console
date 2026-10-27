import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTug, press, update, ranking, COUNTDOWN, ROUND_MAX, BREAK } from '../public/src/games/tug/rules.js';

const run = (s, secs, presses = {}, dt = 1 / 60) => {
  const ev = [];
  const acc = Object.fromEntries(Object.keys(presses).map((id) => [id, 0]));
  for (let t = 0; t < secs; t += dt) {
    for (const [id, hz] of Object.entries(presses)) { acc[id] += hz * dt; while (acc[id] >= 1) { acc[id]--; press(s, id); } }
    ev.push(...update(s, dt));
  }
  return ev;
};

test('holdene trækker med tryk pr. spiller: 3 mod 2 med samme tempo står stille; det hurtigste hold vinder', () => {
  const s = createTug(['a', 'b', 'c', 'd', 'e']);
  run(s, COUNTDOWN + 0.05);
  assert.equal(s.phase, 'play');
  const [red, blue] = [0, 1].map((t) => [...s.teams].filter(([, v]) => v === t).map(([id]) => id));
  assert.equal(red.length, 3);
  run(s, 5, Object.fromEntries([...red, ...blue].map((id) => [id, 6])));
  assert.ok(Math.abs(s.pos) < 0.08, `pos ${s.pos}`);
  const ev = run(s, 20, Object.fromEntries([...red.map((id) => [id, 7]), ...blue.map((id) => [id, 5])]));
  assert.deepEqual(ev.find((e) => e.type === 'round'), { type: 'round', winner: 0 });
});

test('tryk tæller kun under spillet; efter ROUND_MAX vinder det hold, rebet hælder mod', () => {
  const s = createTug(['a', 'b']);
  press(s, 'a');
  assert.equal(s.pos, 0);
  run(s, COUNTDOWN + 0.05);
  const ev = run(s, ROUND_MAX + 0.1, { b: 3, a: 2.6 });
  assert.deepEqual(ev.find((e) => e.type === 'round'), { type: 'round', winner: s.teams.get('b') });
});

test('står rebet (næsten) helt lige efter tiden, er runden uafgjort', () => {
  const s = createTug(['a', 'b', 'c']);
  run(s, COUNTDOWN + 0.05);
  s.pos = 1e-12;
  const ev = run(s, ROUND_MAX + 0.1);
  assert.deepEqual(ev.find((e) => e.type === 'round'), { type: 'round', winner: null });
});

test('først til 2 runder; ranglisten: vinderholdet først, så efter tryk', () => {
  const s = createTug(['a', 'b', 'c', 'd']);
  const red = [...s.teams].filter(([, v]) => v === 0).map(([id]) => id);
  let over = null;
  for (let i = 0; i < 6 && !over; i++) {
    const ev = run(s, COUNTDOWN + ROUND_MAX + BREAK + 1, Object.fromEntries(red.map((id) => [id, 8])));
    over = ev.find((e) => e.type === 'over');
  }
  assert.deepEqual(over, { type: 'over', winner: 0 });
  assert.equal(s.wins[0], 2);
  const r = ranking(s);
  assert.ok(red.includes(r[0]) && red.includes(r[1]));
});

test('botten trykker A 5-8 gange i sekundet (ét tryk = én frame med a=1)', async () => {
  const { tugBot } = await import('../public/src/games/tug/ai.js');
  const { mulberry32 } = await import('../public/src/rng.js');
  const mem = new Map(), rng = mulberry32(3);
  let presses = 0, prev = 0;
  for (let i = 0; i < 600; i++) { const a = tugBot('x', mem, rng, 1 / 60).a; if (a && !prev) presses++; prev = a; }
  assert.ok(presses >= 45 && presses <= 85, `${presses} tryk på 10 s`);
});
