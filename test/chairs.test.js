import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChairs, update, SEAT_R, SCRAMBLE, RESULT } from '../public/src/games/chairs/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const herd = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: -5 + i, z: 5, alive: true }));
const run = (s, secs, animals, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt, animals)); return ev; };
const toStop = (s, animals) => run(s, s.t + 0.01, animals).find((e) => e.type === 'stop');

test('musikken stopper efter 4-9 s, og der kommer én plads færre end spillere, spredt ud i arenaen', () => {
  const s = createChairs(mulberry32(1), { radius: 7 });
  assert.equal(s.phase, 'music');
  assert.ok(s.t >= 4 && s.t <= 9);
  const animals = herd(6);
  const stop = toStop(s, animals);
  assert.equal(stop.seats.length, 5);
  for (const p of stop.seats) assert.ok(Math.hypot(p.x, p.z) <= 7 - 1.2 + 1e-9);
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) assert.ok(Math.hypot(stop.seats[i].x - stop.seats[j].x, stop.seats[i].z - stop.seats[j].z) >= 2.2);
});

test('den nærmeste inden for SEAT_R får pladsen; man kan kun sidde på én', () => {
  const s = createChairs(mulberry32(2), { radius: 7 });
  const animals = herd(3);
  const stop = toStop(s, animals);
  const [s0, s1] = stop.seats;
  Object.assign(animals[0], { x: s0.x + 0.5, z: s0.z });
  Object.assign(animals[1], { x: s0.x + 0.2, z: s0.z });
  const ev = update(s, 0.05, animals);
  assert.deepEqual(ev.filter((e) => e.type === 'sit').map((e) => e.id), ['p1']);
  assert.equal(s.seats[0].by, 'p1');
  Object.assign(animals[1], { x: s1.x, z: s1.z });          // den siddende flytter sig ikke til en anden plads
  update(s, 0.05, animals);
  assert.equal(s.seats[1].by, null);
  assert.ok(SEAT_R >= 0.6);
});

test('når alle pladser er taget, er den uden plads ude; derefter musik igen og ingen pladser', () => {
  const s = createChairs(mulberry32(3), { radius: 7 });
  const animals = herd(3);
  const stop = toStop(s, animals);
  stop.seats.forEach((p, i) => Object.assign(animals[i], { x: p.x, z: p.z }));
  const ev = run(s, 1.5, animals);
  assert.deepEqual(ev.find((e) => e.type === 'result').out, ['p2']);
  const ev2 = run(s, RESULT + 0.1, animals);
  assert.ok(ev2.some((e) => e.type === 'music'));
  assert.equal(s.seats.length, 0);
  assert.equal(s.phase, 'music');
});

test('efter SCRAMBLE er alle uden plads ude, også selv om der er pladser tilbage', () => {
  const s = createChairs(mulberry32(4), { radius: 7 });
  const animals = herd(4);
  const stop = toStop(s, animals);
  Object.assign(animals[0], { x: stop.seats[0].x, z: stop.seats[0].z });
  animals[3].alive = false;
  const ev = run(s, SCRAMBLE + 0.1, animals);
  assert.deepEqual(ev.find((e) => e.type === 'result').out, ['p1', 'p2']);
});

test('botten går rundt, mens musikken spiller, og løber hen til en ledig pude, når den stopper', async () => {
  const { chairsBot } = await import('../public/src/games/chairs/ai.js');
  const { createWorld, step } = await import('../public/src/games/sumo/physics.js');
  const rng = mulberry32(9), s = createChairs(rng, { radius: 7 }), w = createWorld(['b', 'c'], rng, { walls: true, radius: 7 }), mem = new Map();
  const start = { x: w.animals[0].x, z: w.animals[0].z };
  for (let i = 0; i < 60 * 3; i++) step(w, new Map([['b', chairsBot(s, w, 'b', mem, rng)]]), 1 / 60);
  assert.ok(Math.hypot(w.animals[0].x - start.x, w.animals[0].z - start.z) > 2, 'går rundt');
  s.t = 0.01;
  w.animals[1].x = 100;                               // c er langt væk
  let sat = false;
  for (let i = 0; i < 60 * 5 && !sat; i++) {
    for (const e of update(s, 1 / 60, w.animals)) if (e.type === 'sit' && e.id === 'b') sat = true;
    step(w, new Map([['b', chairsBot(s, w, 'b', mem, rng)]]), 1 / 60);
  }
  assert.ok(sat, 'botten satte sig');
});
