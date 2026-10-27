import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOwner, updateOwner, hearNoise, isWatching, catch_ } from '../public/src/games/cats/owner.js';
import { createWorld, createItem, step, STILL } from '../public/src/games/cats/physics.js';
import { createCats, update, ranking, ROUND, PENALTY, STUN, LEVEL, REFILL_BELOW } from '../public/src/games/cats/rules.js';
import { catBot } from '../public/src/games/cats/ai.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (fn, secs, dt = 1 / 60) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...fn(dt)); return ev; };
const none = new Map();

// --- mormor ---

test('mormor: læser -> drejer -> kigger -> læser', () => {
  const o = createOwner(LEVEL, mulberry32(1));
  assert.equal(o.state, 'reading');
  const seen = [];
  for (let t = 0; t < 20; t += 0.05) { const e = updateOwner(o, 0.05); if (e) seen.push(e); }
  assert.deepEqual(seen.slice(0, 3), ['turning', 'looking', 'reading']);
});

test('mormor: et brag forkorter ventetiden, men forlænger den aldrig', () => {
  const o = createOwner(LEVEL, mulberry32(2));
  o.t = 6; hearNoise(o);
  assert.ok(o.t <= 1.1);
  o.t = 0.2; hearNoise(o);
  assert.equal(o.t, 0.2);
  o.state = 'looking'; o.t = 2; hearNoise(o);
  assert.equal(o.t, 2);
  assert.equal(isWatching(o), true);
  catch_(o);
  assert.equal(o.state, 'scolding');
});

// --- fysik ---

test('katten går med pinden og bliver på bordet', () => {
  const w = createWorld(['a'], []);
  run((dt) => step(w, new Map([['a', { x: 1, y: 0 }]]), dt), 6);
  const c = w.cats[0];
  assert.ok(c.x > w.hx - 1 && c.x <= w.hx, `x=${c.x}`);
  run((dt) => step(w, new Map([['a', { x: 0, y: 1 }]]), dt), 6);
  assert.ok(c.z <= w.hz);
});

test('et slag sender tingen foran katten af sted og husker, hvem der slog', () => {
  const w = createWorld(['a'], [createItem({ id: 1, kind: 'mug', x: 0.9, z: 0 })]);
  const c = w.cats[0]; c.x = 0; c.z = 0; c.face = Math.PI / 2;      // kigger mod +x
  const ev = step(w, new Map([['a', { x: 0, y: 0, aPressed: true }]]), 1 / 60);
  assert.ok(ev.some((e) => e.type === 'swat' && e.id === 'a'));
  assert.ok(w.items[0].vx > 3, `vx=${w.items[0].vx}`);
  assert.equal(w.items[0].by, 'a');
});

test('en ting bag katten rammes ikke af slaget', () => {
  const w = createWorld(['a'], [createItem({ id: 1, kind: 'mug', x: -0.9, z: 0 })]);
  const c = w.cats[0]; c.x = 0; c.z = 0; c.face = Math.PI / 2;
  step(w, new Map([['a', { aPressed: true }]]), 1 / 60);
  assert.equal(w.items[0].vx, 0);
  assert.equal(w.items[0].by, null);
});

test('en ting, der forlader bordet, giver fall med den, der rørte den, og lander senere', () => {
  const w = createWorld(['a'], [createItem({ id: 1, kind: 'vase', x: 7.5, z: 0 })]);
  w.items[0].vx = 5; w.items[0].by = 'a';
  const ev = run((dt) => step(w, none, dt), 3);
  const fall = ev.find((e) => e.type === 'fall');
  assert.equal(fall.by, 'a');
  assert.ok(ev.some((e) => e.type === 'crash' && e.item.id === 1));
  assert.equal(w.items[0].state, 'floor');
  assert.equal(ev.filter((e) => e.type === 'fall').length, 1);
});

test('en ting, der støder ind i en anden, giver æren videre', () => {
  const w = createWorld(['a'], [createItem({ id: 1, kind: 'mug', x: 0, z: 0 }), createItem({ id: 2, kind: 'mug', x: 2, z: 0 })]);
  w.cats[0].x = -6;
  w.items[0].vx = 8; w.items[0].by = 'a';
  run((dt) => step(w, none, dt), 1);
  assert.equal(w.items[1].by, 'a');
  assert.ok(w.items[1].x > 2.1);
});

test('en kat, der går ind i en ting, skubber den og får æren', () => {
  const w = createWorld(['b'], [createItem({ id: 1, kind: 'mug', x: 2, z: 0 })]);
  const c = w.cats[0]; c.x = 0; c.z = 0;
  run((dt) => step(w, new Map([['b', { x: 1, y: 0 }]]), dt), 1);
  assert.equal(w.items[0].by, 'b');
  assert.ok(w.items[0].x > 2.2);
});

test('katte skubber hinanden; et slag mod en kat giver et skub', () => {
  const w = createWorld(['a', 'b'], []);
  const [a, b] = w.cats;
  a.x = 0; a.z = 0; a.face = Math.PI / 2; b.x = 1.2; b.z = 0;
  const ev = step(w, new Map([['a', { aPressed: true }]]), 1 / 60);
  assert.ok(b.vx > 2, `b.vx=${b.vx}`);
  assert.ok(ev.some((e) => e.type === 'swat'));
  a.x = 0; b.x = 0.5; b.vx = 0; a.vx = 0;
  step(w, none, 1 / 60);
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) >= 2 * 0.55 - 1e-6);
});

test('en kat på sin plads (stun) kan ikke gå eller slå', () => {
  const w = createWorld(['a'], [createItem({ id: 1, kind: 'mug', x: 0.9, z: 0 })]);
  const c = w.cats[0]; c.x = 0; c.z = 0; c.face = Math.PI / 2; c.stun = 1;
  run((dt) => step(w, new Map([['a', { x: 1, y: 0, aPressed: true }]]), dt), 0.5);
  assert.ok(Math.abs(c.x) < 0.01);
  assert.equal(w.items[0].by, null);
});

// --- regler ---

function game(n = 3, seed = 1) {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].slice(0, n);
  return createCats(ids, mulberry32(seed));
}

test('bordet dækkes med ting, der ikke overlapper, og kattene står ved den nære kant', () => {
  for (const n of [2, 12]) {
    const s = game(n);
    const { items, cats, hx, hz } = s.world;
    assert.ok(items.length >= 24);
    for (const it of items) assert.ok(Math.abs(it.x) < hx - it.r && Math.abs(it.z) < hz - it.r);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      assert.ok(Math.hypot(A.x - B.x, A.z - B.z) >= A.r + B.r, `${A.id}/${B.id} overlapper`);
    }
    for (const c of cats) assert.ok(c.z > hz - 1.5);
    for (const c of cats) for (const it of items) assert.ok(Math.hypot(c.x - it.x, c.z - it.z) > c.r + it.r);
  }
});

test('en ting over kanten giver dens værdi til den, der rørte den', () => {
  const s = game();
  const it = s.world.items[0];
  it.x = s.world.hx - 0.1; it.z = 0; it.vx = 6; it.by = 'b';
  s.owner.t = 99;
  const ev = run((dt) => update(s, none, dt), 0.5);
  assert.deepEqual(ev.find((e) => e.type === 'score'), { type: 'score', id: 'b', gained: it.value, item: it });
  assert.equal(s.scores.b, it.value);
});

test('mens mormor kigger, bliver en kat, der går, taget én gang: minus point og på plads', () => {
  const s = game();
  s.scores.a = 400;
  s.owner.state = 'looking'; s.owner.t = 5;
  const ev = run((dt) => update(s, new Map([['a', { x: 1, y: 0 }]]), dt), 1);
  const caught = ev.filter((e) => e.type === 'caught');
  assert.deepEqual(caught.map((e) => e.id), ['a']);
  assert.equal(s.scores.a, 400 - PENALTY);
  const a = s.world.cats.find((c) => c.id === 'a');
  assert.ok(a.stun > STUN - 1.1 && a.stun <= STUN);
});

test('taget giver aldrig minuspoint', () => {
  const s = game();
  s.owner.state = 'looking'; s.owner.t = 5;
  run((dt) => update(s, new Map([['c', { x: -1, y: 0 }]]), dt), 0.5);
  assert.equal(s.scores.c, 0);
});

test('en kat, der står stille, bliver ikke taget, og efter næste kig kan man blive taget igen', () => {
  const s = game();
  s.owner.state = 'looking'; s.owner.t = 0.5;
  const ev = run((dt) => update(s, none, dt), 0.4);
  assert.equal(ev.filter((e) => e.type === 'caught').length, 0);
  const a = s.world.cats.find((c) => c.id === 'a');
  a.vx = 2;                                       // skubbet, mens hun kigger
  const ev2 = run((dt) => update(s, none, dt), 0.05);
  assert.equal(ev2.filter((e) => e.type === 'caught').length, 1);
  s.owner.state = 'reading'; s.owner.t = 0.01;
  run((dt) => update(s, none, dt), 0.2);
  s.owner.state = 'looking'; s.owner.t = 5;
  a.stun = 0; a.vx = 2;
  const ev3 = run((dt) => update(s, none, dt), 0.05);
  assert.equal(ev3.filter((e) => e.type === 'caught').length, 1);
});

test('lidt drift tilgives: under STILL er man ikke i bevægelse', () => {
  const s = game();
  s.owner.state = 'looking'; s.owner.t = 5;
  s.world.cats[0].vx = STILL * 0.5;
  const ev = run((dt) => update(s, none, dt), 0.05);
  assert.equal(ev.filter((e) => e.type === 'caught').length, 0);
});

test('falder en ting, mens mormor kigger, får katten pointene, men bliver taget', () => {
  const s = game();
  const it = s.world.items[0];
  it.x = s.world.hx - 0.1; it.z = 0; it.vx = 6; it.by = 'b';
  s.owner.state = 'looking'; s.owner.t = 5;
  const ev = run((dt) => update(s, none, dt), 0.3);
  assert.ok(ev.some((e) => e.type === 'caught' && e.id === 'b'));
  assert.equal(s.scores.b, Math.max(0, it.value - PENALTY));
});

test('et brag gør mormor nysgerrig', () => {
  const s = game();
  const it = s.world.items[0];
  it.x = s.world.hx - 0.1; it.z = 0; it.vx = 6; it.by = 'a';
  s.owner.t = 30;
  run((dt) => update(s, none, dt), 2);
  assert.ok(s.owner.t < 2 || s.owner.state !== 'reading');
});

test('spillet slutter efter ROUND sekunder; ranglisten efter point', () => {
  const s = game();
  s.scores = { a: 100, b: 300, c: 200 };
  const ev = run((dt) => update(s, none, dt), ROUND + 0.5, 0.1);
  assert.equal(ev.filter((e) => e.type === 'over').length, 1);
  assert.equal(s.phase, 'over');
  assert.deepEqual(ranking(s), ['b', 'c', 'a']);
});

test('når der er få ting tilbage, fyldes bordet op med nye, der falder ned uden at ramme katte eller ting', () => {
  const s = game(12);
  const keep = s.world.items.slice(0, REFILL_BELOW - 1);
  for (const it of s.world.items.slice(REFILL_BELOW - 1)) it.state = 'floor';
  const c = s.world.cats[0]; c.x = 0; c.z = 0;
  const ev = update(s, none, 0.01);
  const refill = ev.find((e) => e.type === 'refill');
  assert.ok(refill && refill.items.length >= 10);
  const table = s.world.items.filter((i) => i.state === 'table');
  for (const it of refill.items) {
    assert.ok(it.y > 0, 'nye ting falder ned ovenfra');
    for (const o of table) if (o !== it) assert.ok(Math.hypot(o.x - it.x, o.z - it.z) >= o.r + it.r, 'overlap');
    for (const k of s.world.cats) assert.ok(Math.hypot(k.x - it.x, k.z - it.z) > k.r + it.r, 'på en kat');
  }
  assert.ok(keep.every((i) => s.world.items.includes(i)));
  assert.equal(new Set(s.world.items.map((i) => i.id)).size, s.world.items.length, 'id-erne er unikke');
  run((dt) => update(s, none, dt), 2);
  assert.ok(refill.items.every((i) => i.y === 0 && i.state === 'table'));
});

test('et tomt bord til sidst fyldes ikke op: så er spillet slut', () => {
  const s = game();
  s.t = 5;
  for (const it of s.world.items) it.state = 'floor';
  assert.ok(update(s, none, 0.1).some((e) => e.type === 'over'));
});

test('botten slår ting ned, og fryser når mormor drejer', () => {
  const s = game(4, 3);
  s.owner.t = 999; s.owner.state = 'reading';
  const bot = new Map(), rng = mulberry32(9);
  run((dt) => {
    const inputs = new Map(s.world.cats.map((c) => [c.id, catBot(s, c.id, bot, dt, rng)]));
    return update(s, inputs, dt);
  }, 30);
  const total = Object.values(s.scores).reduce((a, b) => a + b, 0);
  assert.ok(total > 0, 'botterne fik ingen point');
  s.owner.state = 'turning'; s.owner.t = 999;
  let moving = 0;
  run((dt) => {
    const inputs = new Map(s.world.cats.map((c) => [c.id, catBot(s, c.id, bot, dt, rng)]));
    const ev = update(s, inputs, dt);
    return ev;
  }, 2);
  for (const c of s.world.cats) if (Math.hypot(c.vx, c.vz) > STILL) moving++;
  assert.equal(moving, 0);
});
