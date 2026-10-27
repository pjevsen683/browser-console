import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField, step, BODY, CHARGE_T, RANGE_MIN, RANGE_MAX, DUCK_T, DUCK_CD } from '../public/src/games/snowball/physics.js';
import { createSnowball, update, ranking, LIVES, ROUND_TIME, WIN_ROUNDS, MAX_ROUNDS, BREAK } from '../public/src/games/snowball/rules.js';
import { snowBot } from '../public/src/games/snowball/ai.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (fn, secs, dt = 1 / 60) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...fn(dt)); return ev; };
const none = new Map();
const field = (list) => createField(list.map(([id, team]) => ({ id, team })), mulberry32(1));
const P = (f, id) => f.players.find((p) => p.id === id);
const place = (p, x, z, face) => { p.x = x; p.z = z; p.vx = 0; p.vz = 0; if (face !== undefined) p.face = face; };
const EAST = Math.PI / 2;

// --- fysik ---

test('man bliver på sit holds halvdel', () => {
  const f = field([['r', 0], ['b', 1]]);
  run((dt) => step(f, new Map([['r', { x: 1, y: 0 }], ['b', { x: -1, y: 0 }]]), dt), 5);
  assert.ok(P(f, 'r').x < -BODY, `rød x=${P(f, 'r').x}`);
  assert.ok(P(f, 'b').x > BODY, `blå x=${P(f, 'b').x}`);
  run((dt) => step(f, new Map([['r', { x: 0, y: 1 }]]), dt), 5);
  assert.ok(P(f, 'r').z < f.hz);
});

test('A holdt nede lader op; slip kaster, og rækkevidden følger opladningen', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  place(P(f, 'r'), -8, 0, EAST); place(P(f, 'b'), 8, 5);
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T / 2);
  assert.equal(f.balls.length, 0);
  const ev = step(f, new Map([['r', { a: 0 }]]), 1 / 60);
  assert.ok(ev.some((e) => e.type === 'throw' && e.id === 'r'));
  assert.equal(f.balls.length, 1);
  const want = RANGE_MIN + (RANGE_MAX - RANGE_MIN) * 0.5;
  assert.ok(Math.abs(f.balls[0].range - want) < 0.5, `range=${f.balls[0].range}`);
  // fuld opladning stopper ved 1
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T * 3);
  step(f, new Map([['r', { a: 0 }]]), 1 / 60);
  assert.ok(Math.abs(f.balls.at(-1).range - RANGE_MAX) < 0.01);
});

test('sigtehjælp: en modstander inden for 30° af kasteretningen bliver sigtet på, en længere ude ikke', () => {
  const f = field([['r', 0], ['b', 1], ['c', 1]]);
  f.forts.length = 0;
  place(P(f, 'r'), -6, 0, EAST);
  place(P(f, 'b'), 4, Math.tan(20 * Math.PI / 180) * 10);   // 20° fra øst
  place(P(f, 'c'), 2, -Math.tan(55 * Math.PI / 180) * 8);   // 55° fra øst
  step(f, new Map([['r', { a: 1 }]]), 1 / 60);
  step(f, new Map([['r', { a: 0 }]]), 1 / 60);
  const ball = f.balls[0], b = P(f, 'b');
  const want = Math.atan2(b.z - ball.z, b.x - ball.x), got = Math.atan2(ball.vz, ball.vx);
  assert.ok(Math.abs(want - got) < 0.05, `sigter ${got}, ville ${want}`);
  place(P(f, 'b'), 1, 5.5);                                  // nu 38° fra øst: uden for de 30°
  f.balls.length = 0; P(f, 'r').cd = 0;
  step(f, new Map([['r', { a: 1 }]]), 1 / 60);
  step(f, new Map([['r', { a: 0 }]]), 1 / 60);
  assert.ok(Math.abs(Math.atan2(f.balls[0].vz, f.balls[0].vx)) < 0.01, 'lige ud mod øst');
});

test('en snebold rammer en modstander, men ikke en holdkammerat på vejen', () => {
  const f = field([['r', 0], ['r2', 0], ['b', 1]]);
  f.forts.length = 0;
  place(P(f, 'r'), -8, 0, EAST); place(P(f, 'r2'), -4, 0); place(P(f, 'b'), 4, 0);
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T);
  const ev = run((dt) => step(f, new Map([['r', { a: 0 }]]), dt), 1.5);
  const hits = ev.filter((e) => e.type === 'hit');
  assert.deepEqual(hits.map((e) => [e.id, e.by]), [['b', 'r']]);
  assert.equal(P(f, 'b').hits, 1);
  assert.equal(P(f, 'r2').hits, 0);
  assert.equal(f.balls.length, 0);
});

test('bolden lander ved rækkevidden og rammer ingen længere ude', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  place(P(f, 'r'), -10, 0, EAST); place(P(f, 'b'), 10, 0);    // 20 m: for langt
  step(f, new Map([['r', { a: 1 }]]), 1 / 60);
  const ev = run((dt) => step(f, new Map([['r', { a: 0 }]]), dt), 2);
  assert.ok(ev.some((e) => e.type === 'land'));
  assert.equal(ev.filter((e) => e.type === 'hit').length, 0);
});

test('et fort tager imod snebolden', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  f.forts.push({ x: 0, z: 0, r: 0.9 });
  place(P(f, 'r'), -8, 0, EAST); place(P(f, 'b'), 4, 0);
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T);
  const ev = run((dt) => step(f, new Map([['r', { a: 0 }]]), dt), 1.5);
  assert.ok(ev.some((e) => e.type === 'block'));
  assert.equal(P(f, 'b').hits, 0);
});

test('man kan ikke gå gennem et fort', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  f.forts.push({ x: -5, z: 0, r: 0.9 });
  place(P(f, 'r'), -8, 0);
  run((dt) => step(f, new Map([['r', { x: 1, y: 0 }]]), dt), 2);
  const p = P(f, 'r');
  assert.ok(Math.hypot(p.x + 5, p.z) >= 0.9 + BODY - 1e-6);
});

test('B dukker: bolde flyver over, man står stille, og man kan ikke dukke igen med det samme', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  place(P(f, 'r'), -8, 0, EAST); place(P(f, 'b'), 4, 0);
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T);
  step(f, new Map([['r', { a: 0 }], ['b', { bPressed: true }]]), 1 / 60);
  const b = P(f, 'b');
  assert.ok(b.duck > 0);
  const ev = run((dt) => step(f, new Map([['b', { x: 1, y: 0 }]]), dt), DUCK_T - 0.05);
  assert.equal(ev.filter((e) => e.type === 'hit').length, 0);
  assert.ok(Math.abs(b.x - 4) < 0.01, 'stod stille');
  run((dt) => step(f, none, dt), 0.2);
  step(f, new Map([['b', { bPressed: true }]]), 1 / 60);
  assert.equal(b.duck, 0, 'nedkøling');
  run((dt) => step(f, none, dt), DUCK_CD);
  step(f, new Map([['b', { bPressed: true }]]), 1 / 60);
  assert.ok(b.duck > 0);
});

test('tre træffere, og man er ude: kan ikke rammes, gå eller kaste', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  const b = P(f, 'b');
  b.hits = LIVES - 1;
  place(P(f, 'r'), -8, 0, EAST); place(b, 4, 0);
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T);
  const ev = run((dt) => step(f, new Map([['r', { a: 0 }]]), dt), 1.5);
  const hit = ev.find((e) => e.type === 'hit');
  assert.deepEqual([hit.id, hit.by, hit.out], ['b', 'r', true]);
  assert.equal(b.out, true);
  const bx = b.x;
  run((dt) => step(f, new Map([['b', { x: -1, y: 0, a: 1 }]]), dt), 0.5);
  step(f, new Map([['b', { a: 0 }]]), 1 / 60);
  assert.equal(f.balls.filter((x) => x.by === 'b').length, 0);
  assert.ok(Math.abs(b.x - bx) < 0.3);
});

// --- regler ---

test('holdene skiftevis; 2 spillere er én mod én', () => {
  const s = createSnowball(['a', 'b'], mulberry32(1));
  assert.deepEqual([s.teams.get('a'), s.teams.get('b')], [0, 1]);
  const s6 = createSnowball(['a', 'b', 'c', 'd', 'e'], mulberry32(1));
  assert.deepEqual([...s6.teams.values()], [0, 1, 0, 1, 0]);
  for (const p of s6.field.players) assert.ok(p.team === 0 ? p.x < 0 : p.x > 0);
});

function knockOut(s, team) {
  for (const p of s.field.players) if (p.team === team) { p.hits = LIVES; p.out = true; }
}

test('et hold uden spillere taber runden; efter en pause starter en ny runde med alle tilbage', () => {
  const s = createSnowball(['a', 'b', 'c', 'd'], mulberry32(2));
  s.hitsBy.a = 2;
  knockOut(s, 1);
  const ev = update(s, none, 1 / 60);
  assert.deepEqual(ev.find((e) => e.type === 'round'), { type: 'round', winner: 0 });
  assert.deepEqual(s.wins, [1, 0]);
  assert.equal(s.phase, 'break');
  const ev2 = run((dt) => update(s, none, dt), BREAK + 0.1);
  assert.ok(ev2.some((e) => e.type === 'start'));
  assert.equal(s.round, 2);
  assert.equal(s.phase, 'play');
  assert.ok(s.field.players.every((p) => !p.out && p.hits === 0));
  assert.equal(s.hitsBy.a, 2, 'træffere tælles over hele spillet');
});

test('først til 2 runder; ranglisten har vinderholdet først, inden for holdet flest træffere', () => {
  const s = createSnowball(['a', 'b', 'c', 'd'], mulberry32(3));
  s.hitsBy = { a: 1, b: 5, c: 4, d: 0 };
  for (let r = 0; r < WIN_ROUNDS; r++) {
    knockOut(s, 1);
    const ev = update(s, none, 1 / 60);
    if (r < WIN_ROUNDS - 1) run((dt) => update(s, none, dt), BREAK + 0.1);
    else assert.deepEqual(ev.find((e) => e.type === 'over'), { type: 'over', winner: 0 });
  }
  assert.equal(s.phase, 'over');
  assert.deepEqual(ranking(s), ['c', 'a', 'b', 'd']);
});

test('når tiden er gået, vinder holdet med flest liv tilbage; lige = ingen vinder', () => {
  const s = createSnowball(['a', 'b'], mulberry32(4));
  s.field.players.find((p) => p.id === 'b').hits = 1;
  const ev = run((dt) => update(s, none, dt), ROUND_TIME + 0.1, 0.1);
  assert.deepEqual(ev.find((e) => e.type === 'round'), { type: 'round', winner: 0 });
  run((dt) => update(s, none, dt), BREAK + 0.1, 0.1);
  const ev2 = run((dt) => update(s, none, dt), ROUND_TIME + 0.1, 0.1);
  assert.deepEqual(ev2.find((e) => e.type === 'round'), { type: 'round', winner: null });
  assert.deepEqual(s.wins, [1, 0]);
});

test(`højst ${MAX_ROUNDS} runder; derefter vinder holdet med flest runder`, () => {
  const s = createSnowball(['a', 'b'], mulberry32(5));
  let over = null;
  for (let r = 0; r < MAX_ROUNDS && !over; r++) {
    if (r === 0) knockOut(s, 1);
    over = run((dt) => update(s, none, dt), ROUND_TIME + BREAK + 0.5, 0.1).find((e) => e.type === 'over');
  }
  assert.deepEqual(over, { type: 'over', winner: 0 });
  assert.equal(s.round, MAX_ROUNDS);
});

test('bots kaster, rammer og afgør en runde', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const s = createSnowball(ids, mulberry32(6)), mem = new Map(), rng = mulberry32(7);
  let hits = 0, round = null;
  for (let t = 0; t < ROUND_TIME && !round; t += 1 / 60) {
    const inputs = new Map(ids.map((id) => [id, snowBot(s, id, mem, rng)]));
    for (const e of update(s, inputs, 1 / 60)) { if (e.type === 'hit') hits++; if (e.type === 'round') round = e; }
  }
  assert.ok(hits >= 6, `kun ${hits} træffere`);
  assert.ok(round, 'ingen runde afgjort');
});

test('den, der bliver slået ud midt i en opladning, holder op med at lade op', () => {
  const f = field([['r', 0], ['b', 1]]);
  f.forts.length = 0;
  const b = P(f, 'b');
  b.hits = LIVES - 1;
  place(P(f, 'r'), -8, 0, EAST); place(b, 4, 0, -EAST);
  run((dt) => step(f, new Map([['r', { a: 1 }]]), dt), CHARGE_T);
  run((dt) => step(f, new Map([['r', { a: 0 }], ['b', { a: 1 }]]), dt), 1.5);
  assert.equal(b.out, true);
  assert.equal(b.charging, false);
  assert.equal(b.charge, 0);
});

test('ingen kast i pausen fra en, der holdt A, da runden sluttede; bolde i luften lander med hændelser', () => {
  const s = createSnowball(['a', 'b', 'c'], mulberry32(8));
  const a = s.field.players.find((p) => p.id === 'a');
  run((dt) => update(s, new Map([['a', { a: 1 }]]), dt), 0.5);
  assert.equal(a.charging, true);
  s.field.balls.push({ id: 99, by: 'a', team: 0, x: 0, z: 0, vx: 16, vz: 0, range: 3, flown: 0 });
  knockOut(s, 1);
  update(s, new Map([['a', { a: 1 }]]), 1 / 60);
  assert.equal(s.phase, 'break');
  const ev = run((dt) => update(s, none, dt), 1);
  assert.equal(ev.filter((e) => e.type === 'throw').length, 0);
  assert.ok(ev.some((e) => e.type === 'land' || e.type === 'block'));
});

test('lige mange runder: flest træffere vinder; lige træffere er uafgjort', () => {
  for (const [hits, want] of [[{ a: 2, b: 5 }, 1], [{ a: 3, b: 3 }, null]]) {
    const s = createSnowball(['a', 'b'], mulberry32(9));
    s.hitsBy = { ...hits };
    s.round = MAX_ROUNDS;
    s.t = 0.01;
    const ev = update(s, none, 0.1);
    assert.deepEqual(ev.find((e) => e.type === 'over'), { type: 'over', winner: want });
    if (want === 1) assert.equal(ranking(s)[0], 'b');
  }
});
