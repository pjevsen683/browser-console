import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBombs, update, WARN, BLAST } from '../public/src/games/bombs/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (s, secs, animals, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt, animals)); return ev; };
const one = () => [{ id: 'a', x: 2, z: -1, alive: true }];

test('bomberne kommer tættere, jo længere runden varer, og lander inde på øen', () => {
  const s = createBombs(mulberry32(1), { radius: 7 });
  const drops = run(s, 60, one()).filter((e) => e.type === 'drop');
  const early = drops.filter((e) => e.at < 10).length, late = drops.filter((e) => e.at >= 40 && e.at < 50).length;
  assert.ok(early >= 3 && late > early * 1.8, `tidligt ${early}, sent ${late}`);
  for (const e of drops) assert.ok(Math.hypot(e.bomb.x, e.bomb.z) < 7);
});

test('den første bombe i en salve sigter efter en spiller', () => {
  const s = createBombs(mulberry32(2), { radius: 7 });
  const animals = one();
  const first = run(s, 5, animals).find((e) => e.type === 'drop');
  assert.ok(Math.hypot(first.bomb.x - 2, first.bomb.z + 1) <= 1.2);
});

test('efter WARN springer bomben: alle inden for BLAST er ude, de andre ikke', () => {
  const s = createBombs(mulberry32(3), { radius: 7 });
  s.bombs.push({ id: 99, x: 0, z: 0, t: WARN });
  s.acc = -100;                                       // ingen nye bomber i testen
  const animals = [{ id: 'near', x: BLAST * 0.8, z: 0, alive: true }, { id: 'far', x: BLAST + 0.6, z: 0, alive: true }, { id: 'dead', x: 0, z: 0, alive: false }];
  assert.equal(run(s, WARN - 0.1, animals).filter((e) => e.type === 'boom').length, 0);
  const boom = run(s, 0.2, animals).find((e) => e.type === 'boom');
  assert.deepEqual(boom.out, ['near']);
  assert.equal(s.bombs.length, 0);
});

test('botten flytter sig væk fra en skygge', async () => {
  const { bombBot } = await import('../public/src/games/bombs/ai.js');
  const { createWorld, step } = await import('../public/src/games/sumo/physics.js');
  const rng = mulberry32(4), s = createBombs(rng, { radius: 7 }), w = createWorld(['b'], rng, { radius: 7 });
  Object.assign(w.animals[0], { x: 1, z: 0 });
  s.bombs.push({ id: 1, x: 0.6, z: 0.2, t: WARN });
  s.acc = -100;
  const mem = new Map();
  for (let i = 0; i < 60 * (WARN - 0.1); i++) { step(w, new Map([['b', bombBot(s, w, 'b', mem, rng)]]), 1 / 60); update(s, 1 / 60, w.animals); }
  const a = w.animals[0];
  assert.ok(a.alive && Math.hypot(a.x - 0.6, a.z - 0.2) > BLAST, `står ${Math.hypot(a.x - 0.6, a.z - 0.2).toFixed(2)} m fra bomben`);
});
