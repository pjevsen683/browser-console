import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, arenaRadius, R0, BODY, SHRINK_AFTER } from '../public/src/games/sumo/physics.js';
import { mulberry32 } from '../public/src/rng.js';

const none = new Map();
const run = (w, inputs, secs, dt = 1 / 60) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...step(w, inputs, dt)); return ev; };
const speed = (a) => Math.hypot(a.vx, a.vz);

test('flagen er hel i 20 s, krymper så glidende og aldrig under minimum', () => {
  assert.equal(arenaRadius(0), R0);
  assert.equal(arenaRadius(SHRINK_AFTER), R0);
  assert.ok(arenaRadius(SHRINK_AFTER + 5) < R0);
  assert.ok(arenaRadius(SHRINK_AFTER + 5) > arenaRadius(SHRINK_AFTER + 10));
  assert.equal(arenaRadius(1000), arenaRadius(2000));
  assert.ok(arenaRadius(1000) >= 2.4);
});

test('12 dyr starter på flagen uden at overlappe, med ansigtet mod midten', () => {
  const w = createWorld([...'abcdefghijkl'], mulberry32(1));
  for (const a of w.animals) {
    assert.ok(Math.hypot(a.x, a.z) < R0 - BODY);
    const fx = Math.sin(a.face), fz = Math.cos(a.face);
    assert.ok(fx * -a.x + fz * -a.z > 0, 'kigger mod midten');
  }
  for (const a of w.animals) for (const b of w.animals) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 2 * BODY);
});

test('pinden accelererer dyret, og uden input glider det til ro', () => {
  const w = createWorld(['a'], () => 0);
  const a = w.animals[0];
  a.x = 0; a.z = 0;
  run(w, new Map([['a', { x: 1, y: 0, aPressed: false }]]), 0.5);
  assert.ok(a.vx > 2 && Math.abs(a.vz) < 1e-9);
  a.x = 0;
  run(w, none, 10);
  assert.ok(speed(a) < 0.05);
  assert.ok(a.alive);
});

test('skub giver et fremstød og har nedkøling', () => {
  const w = createWorld(['a'], () => 0);
  const a = w.animals[0];
  a.x = 0; a.z = 0; a.face = 0;                    // +z
  const ev = step(w, new Map([['a', { x: 0, y: 0, aPressed: true }]]), 1 / 60);
  assert.deepEqual(ev.map((e) => e.type), ['push']);
  assert.ok(a.vz > 6);
  a.vx = a.vz = 0;
  const again = step(w, new Map([['a', { x: 0, y: 0, aPressed: true }]]), 1 / 60);
  assert.equal(again.length, 0);
});

test('to dyr, der støder frontalt sammen, preller af, og bevægelsesmængden bevares', () => {
  const w = createWorld(['a', 'b'], () => 0);
  const [a, b] = w.animals;
  Object.assign(a, { x: -0.6, z: 0, vx: 3, vz: 0 });
  Object.assign(b, { x: 0.6, z: 0, vx: -3, vz: 0 });
  const ev = run(w, none, 0.3);
  assert.ok(ev.some((e) => e.type === 'hit'));
  assert.ok(a.vx < 0 && b.vx > 0, 'på vej væk fra hinanden');
  assert.ok(Math.abs(a.vx + b.vx) < 1e-6);
});

test('et skub, der rammer, slår hårdere end et almindeligt stød', () => {
  const hitWith = (dash) => {
    const w = createWorld(['a', 'b'], () => 0);
    const [a, b] = w.animals;
    Object.assign(a, { x: 0, z: 0, vx: 4, vz: 0, dash: dash ? 0.2 : 0, face: Math.PI / 2 });
    Object.assign(b, { x: 1.05, z: 0, vx: 0, vz: 0 });
    step(w, none, 1 / 60);
    return b.vx;
  };
  assert.ok(hitWith(true) > hitWith(false) + 3);
});

test('et dyr over kanten falder, meldes én gang, og den, der skubbede, får skylden', () => {
  const w = createWorld(['a', 'b'], () => 0);
  const [a, b] = w.animals;
  Object.assign(a, { x: R0 - 1.6, z: 0, vx: 5, vz: 0, dash: 0.2 });
  Object.assign(b, { x: R0 - 0.5, z: 0, vx: 0, vz: 0 });
  const falls = run(w, none, 2).filter((e) => e.type === 'fall');
  assert.ok(falls.some((e) => e.id === 'b' && e.by === 'a'));
  assert.equal(falls.filter((e) => e.id === 'b').length, 1);
  assert.equal(b.alive, false);
  assert.ok(b.y < 0);
});

test('10 dyr oven i hinanden giver ingen NaN', () => {
  const w = createWorld([...'abcdefghij'], mulberry32(2));
  for (const a of w.animals) { a.x = 0; a.z = 0; }
  const rnd = mulberry32(3);
  for (let i = 0; i < 600; i++) {
    const inputs = new Map(w.animals.map((a) => [a.id, { x: rnd() * 2 - 1, y: rnd() * 2 - 1, aPressed: rnd() < 0.05 }]));
    step(w, inputs, 1 / 60);
  }
  for (const a of w.animals) for (const k of ['x', 'z', 'vx', 'vz', 'y']) assert.ok(Number.isFinite(a[k]), `${a.id}.${k}`);
});

test('med kant preller dyret af i stedet for at falde, og radius er fast', () => {
  const w = createWorld(['a'], () => 0, { walls: true, radius: 5 });
  const a = w.animals[0];
  Object.assign(a, { x: 4, z: 0, vx: 6, vz: 0 });
  const ev = run(w, none, 1);
  assert.equal(ev.filter((e) => e.type === 'fall').length, 0);
  assert.ok(a.alive);
  assert.ok(Math.hypot(a.x, a.z) <= 5 - BODY + 1e-9);
  assert.ok(a.vx < 0, 'på vej tilbage');
  run(w, none, 60);
  assert.equal(w.radius, 5);
});

test('speed giver et dyr mere acceleration end de andre', () => {
  const w = createWorld(['a', 'b'], () => 0, { walls: true, radius: 20 });
  const [a, b] = w.animals;
  Object.assign(a, { x: 0, z: -5 }); Object.assign(b, { x: 0, z: 5 });
  const go = new Map([['a', { x: 1, y: 0 }], ['b', { x: 1, y: 0 }]]);
  for (let i = 0; i < 30; i++) step(w, go, 1 / 60, { speed: new Map([['a', 1.15]]) });
  assert.ok(a.vx > b.vx * 1.1);
});

test('stødet melder, hvem der skubbede (dasher), ellers null', () => {
  const hit = (dash) => {
    const w = createWorld(['a', 'b'], () => 0);
    const [a, b] = w.animals;
    Object.assign(a, { x: 0, z: 0, vx: 4, vz: 0, dash: dash ? 0.2 : 0, face: Math.PI / 2 });
    Object.assign(b, { x: 1.05, z: 0, vx: 0, vz: 0 });
    return step(w, none, 1 / 60).find((e) => e.type === 'hit');
  };
  assert.equal(hit(true).dasher, 'a');
  assert.equal(hit(false).dasher, null);
});

test('skubber begge, er der ingen dasher (ingen af dem taber mønter)', () => {
  const w = createWorld(['a', 'b'], () => 0);
  const [a, b] = w.animals;
  Object.assign(a, { x: 0, z: 0, vx: 4, vz: 0, dash: 0.2 });
  Object.assign(b, { x: 1.05, z: 0, vx: -4, vz: 0, dash: 0.2 });
  assert.equal(step(w, none, 1 / 60).find((e) => e.type === 'hit').dasher, null);
});
