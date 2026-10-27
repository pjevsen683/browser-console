import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPanic, update, tileAt, COLORS, SINK, RISE, callTime } from '../public/src/games/panic/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (s, secs, animals, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt, animals)); return ev; };

test('gulvet: felter i et gitter inden for arenaen, alle farver er med, tileAt finder feltet under et punkt', () => {
  const s = createPanic(mulberry32(1), { radius: 7 });
  assert.ok(s.tiles.length > 30);
  for (const t of s.tiles) assert.ok(Math.hypot(t.x, t.z) < 7);
  for (let c = 0; c < COLORS.length; c++) assert.ok(s.tiles.filter((t) => t.color === c).length >= 6, `farve ${c}`);
  const t = s.tiles[5];
  assert.equal(tileAt(s, t.x + 0.3, t.z - 0.3), t);
  assert.equal(tileAt(s, 50, 50), null);
});

test('et kald: farven meldes, efter kaldetiden synker de andre felter; den, der står forkert, er ude', () => {
  const s = createPanic(mulberry32(2), { radius: 7 });
  const animals = [{ id: 'a', x: 0, z: 0, alive: true }, { id: 'b', x: 0, z: 0, alive: true }];
  const ev = run(s, s.t + 0.01, animals);
  const call = ev.find((e) => e.type === 'call');
  assert.ok(call && call.color >= 0 && call.color < COLORS.length);
  const good = s.tiles.find((t) => t.color === call.color), bad = s.tiles.find((t) => t.color !== call.color);
  Object.assign(animals[0], { x: good.x, z: good.z });
  Object.assign(animals[1], { x: bad.x, z: bad.z });
  const ev2 = run(s, callTime(0) + 0.05, animals);
  const sink = ev2.find((e) => e.type === 'sink');
  assert.deepEqual(sink.out, ['b']);
  assert.equal(s.phase, 'sink');
});

test('mens felterne er sunket, ryger også den, der går ud på et hul; så stiger de og får nye farver', () => {
  const s = createPanic(mulberry32(3), { radius: 7 });
  const a = { id: 'a', x: 0, z: 0, alive: true };
  run(s, s.t + 0.01, [a]);
  const good = s.tiles.find((t) => t.color === s.color);
  Object.assign(a, { x: good.x, z: good.z });
  run(s, callTime(0) + 0.05, [a]);
  const hole = s.tiles.find((t) => t.color !== s.color);
  Object.assign(a, { x: hole.x, z: hole.z });
  const ev = update(s, 0.05, [a]);
  assert.deepEqual(ev.find((e) => e.type === 'fall')?.out, ['a']);
  const before = s.tiles.map((t) => t.color).join();
  const ev2 = run(s, SINK + RISE + 0.1, [{ ...a, alive: false }]);
  assert.ok(ev2.some((e) => e.type === 'rise'));
  assert.ok(ev2.some((e) => e.type === 'call'));
  assert.notEqual(s.tiles.map((t) => t.color).join(), before);
});

test('kaldetiden bliver kortere, men aldrig under 1,8 s', () => {
  assert.ok(callTime(0) >= 3.5);
  assert.ok(callTime(5) < callTime(0));
  assert.equal(callTime(100), 1.8);
});

test('botten går hen på et felt med den meldte farve (efter en kort reaktionstid)', async () => {
  const { panicBot } = await import('../public/src/games/panic/ai.js');
  const { createWorld, step } = await import('../public/src/games/sumo/physics.js');
  let onTarget = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const rng = mulberry32(seed), s = createPanic(rng, { radius: 7 }), w = createWorld(['b'], rng, { walls: true, radius: 7 }), mem = new Map();
    run(s, s.t + 0.01, w.animals);
    for (let i = 0; i < 60 * (callTime(0) - 0.1); i++) step(w, new Map([['b', panicBot(s, w, 'b', mem, rng)]]), 1 / 60);
    const t = tileAt(s, w.animals[0].x, w.animals[0].z);
    if (t && t.color === s.color) onTarget++;
  }
  assert.ok(onTarget >= 8, `${onTarget} af 10`);
});
