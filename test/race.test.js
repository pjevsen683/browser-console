import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../public/src/games/race/track.js';
import { createRace, step, OUT_GAP, FALL_TIME } from '../public/src/games/race/physics.js';
import { createSeries, updateSeries, placements, ranking, RACES } from '../public/src/games/race/rules.js';
import { botRace } from '../public/src/games/race/ai.js';
import { mulberry32 } from '../public/src/rng.js';

const track = buildTrack(mulberry32(7));
const none = new Map();
const run = (race, inputs, secs, t = track) => { const ev = []; for (let i = 0; i < secs * 60; i++) ev.push(...step(race, t, typeof inputs === 'function' ? inputs() : inputs, 1 / 60)); return ev; };
const solo = (o = {}) => { const r = createRace(['a'], track); Object.assign(r.racers[0], { s: 30, d: 0, vs: 0, vd: 0, ...o }); return r; };
// En bane uden forhindringer og fisk, til test af ren bevægelse.
const clean = { ...track, obstacles: [], fish: [] };

test('banen: punkter i 1 m-trin, tangent og normal er enhedsvektorer og vinkelrette', () => {
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1], b = track.points[i];
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - 1) < 0.02);
  }
  for (const s of [0, 12.5, 100, track.length - 1]) {
    const p = track.at(s);
    assert.ok(Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-6);
    assert.ok(Math.abs(p.tx * p.nx + p.tz * p.nz) < 1e-6);
  }
});

test('banen: lige start, samme bane for samme seed, forhindringer og fisk ligger på banen', () => {
  const a = track.at(0), b = track.at(20);
  assert.ok(a.tx * b.tx + a.tz * b.tz > 0.97);
  const again = buildTrack(mulberry32(7));
  assert.deepEqual(again.at(150), track.at(150));
  assert.ok(track.obstacles.length > 5 && track.fish.length > 5);
  for (const o of [...track.obstacles, ...track.fish]) {
    assert.ok(Math.abs(o.d) <= track.width / 2 - 0.5);
    assert.ok(o.s >= 30 && o.s <= track.finish);
  }
});

test('ned ad bakke: farten vokser mod en topfart, og man kommer frem', () => {
  const r = solo();
  run(r, none, 3, clean);
  const v3 = r.racers[0].vs;
  run(r, none, 10, clean);
  assert.ok(v3 > 5 && r.racers[0].vs >= v3 && r.racers[0].vs < 25);
  assert.ok(r.racers[0].s > 60);
});

test('pinden til højre styrer mod højre (positiv d)', () => {
  const r = solo();
  run(r, new Map([['a', { x: 1, y: 0, aPressed: false }]]), 0.4, clean);
  assert.ok(r.racers[0].d > 0.3);
});

test('ud over kanten: man falder og er tilbage midt på banen efter faldtiden, ikke ude', () => {
  const r = solo({ d: track.width / 2 - 0.1, vd: 5 });
  const ev = run(r, none, 0.2, clean);
  assert.ok(ev.some((e) => e.type === 'fall'));
  run(r, none, FALL_TIME + 0.1, clean);
  const a = r.racers[0];
  assert.equal(a.out, false);
  assert.equal(a.fallT, 0);
  assert.equal(a.d, 0);
});

test('en forhindring bremser på jorden, men man kan hoppe over den', () => {
  const ob = { s: 40, d: 0, r: 0.7 };
  const t1 = { ...clean, obstacles: [ob] };
  const ground = solo({ s: 36, vs: 10 });
  const ev = run(ground, none, 0.6, t1);
  assert.ok(ev.some((e) => e.type === 'bump'));
  assert.ok(ground.racers[0].vs < 8);
  const air = solo({ s: 36, vs: 10 });
  let first = true;
  const ev2 = run(air, () => { const m = new Map([['a', { x: 0, y: 0, aPressed: first }]]); first = false; return m; }, 0.6, t1);
  assert.ok(ev2.some((e) => e.type === 'jump'));
  assert.ok(!ev2.some((e) => e.type === 'bump'));
});

test('en fisk giver fart, men kun én gang', () => {
  const t1 = { ...clean, fish: [{ s: 40, d: 0 }] };
  const r = solo({ s: 38, vs: 8 });
  const ev = run(r, none, 1, t1);
  assert.equal(ev.filter((e) => e.type === 'fish').length, 1);
});

test(`den, der er mere end ${OUT_GAP} m bag føreren, er ude`, () => {
  const r = createRace(['a', 'b'], clean);
  Object.assign(r.racers[0], { s: 100 });
  Object.assign(r.racers[1], { s: 100 - OUT_GAP - 1 });
  const ev = step(r, clean, none, 1 / 60);
  assert.ok(ev.some((e) => e.type === 'out' && e.id === 'b'));
  assert.equal(r.racers[1].out, true);
});

test('målstregen giver finish én gang', () => {
  const r = solo({ s: track.finish - 0.5, vs: 10 });
  const ev = run(r, none, 1, clean);
  assert.equal(ev.filter((e) => e.type === 'finish').length, 1);
  assert.equal(r.racers[0].finished, true);
});

test('12 racere med tilfældig styring giver ingen NaN, og alle starter på banen', () => {
  const ids = [...'abcdefghijkl'];
  const r = createRace(ids, track);
  for (const a of r.racers) assert.ok(Math.abs(a.d) < track.width / 2);
  const rnd = mulberry32(9);
  run(r, () => new Map(ids.map((id) => [id, { x: rnd() * 2 - 1, y: 0, aPressed: rnd() < 0.02 }])), 20);
  for (const a of r.racers) for (const k of ['s', 'd', 'vs', 'vd', 'y']) assert.ok(Number.isFinite(a[k]), `${a.id}.${k}`);
});

test('placeringer: i mål efter tid, så længst fremme, så de udgåede (sidst ude bedst)', () => {
  const r = createRace(['a', 'b', 'c', 'd', 'e'], clean);
  const [a, b, c, d, e] = r.racers;
  Object.assign(a, { finished: true, finishT: 30 }); Object.assign(b, { finished: true, finishT: 28 });
  Object.assign(c, { s: 200 }); Object.assign(d, { out: true, outT: 10 }); Object.assign(e, { out: true, outT: 12 });
  assert.deepEqual(placements(r), ['b', 'a', 'c', 'e', 'd']);
});

test(`en serie på ${RACES} løb: point N-1-placering, og flest point vinder`, () => {
  const ids = ['a', 'b', 'c'];
  const series = createSeries(ids);
  const changes = [];
  for (let n = 0; n < RACES; n++) {
    const r = createRace(ids, clean);
    for (let i = 0; i < 1000 && series.phase !== 'play'; i++) { const c = updateSeries(series, r, 0.05); if (c) changes.push(c.type); }
    Object.assign(r.racers[1], { finished: true, finishT: 20 });   // b vinder hvert løb
    Object.assign(r.racers[0], { out: true, outT: 5 });
    Object.assign(r.racers[2], { out: true, outT: 9 });
    const c = updateSeries(series, r, 0.05);
    changes.push(c.type);
    assert.deepEqual(c.order, ['b', 'c', 'a']);
    for (let i = 0; i < 1000 && series.phase === 'raceEnd'; i++) { const x = updateSeries(series, r, 0.05); if (x) changes.push(x.type); }
  }
  assert.equal(series.phase, 'over');
  assert.deepEqual(series.totals, { a: 0, b: 2 * RACES, c: RACES });
  assert.deepEqual(ranking(series), ['b', 'c', 'a']);
  assert.equal(changes.filter((t) => t === 'start').length, RACES);
});

test('et løb slutter 10 s efter vinderen, selv om andre stadig kører', () => {
  const series = createSeries(['a', 'b']);
  const r = createRace(['a', 'b'], clean);
  series.phase = 'play';
  Object.assign(r.racers[0], { finished: true, finishT: 0 });
  r.t = 9.9;
  assert.equal(updateSeries(series, r, 0.01), null);
  r.t = 10.1;
  assert.equal(updateSeries(series, r, 0.01).type, 'raceEnd');
});

test('botten styrer mod en fisk, hopper før en forhindring og holder sig fra kanten', () => {
  const r = createRace(['me'], clean);
  const me = r.racers[0];
  Object.assign(me, { s: 50, d: 0, vs: 10 });
  assert.ok(botRace(r, { ...clean, fish: [{ s: 58, d: 3 }] }, 'me').x > 0.2);
  assert.equal(botRace(r, { ...clean, obstacles: [{ s: 51.8, d: 0, r: 0.7 }] }, 'me').a, 1);
  Object.assign(me, { d: track.width / 2 - 0.3 });
  assert.ok(botRace(r, clean, 'me').x < -0.2);
});

test('i mål glider man videre og bremser, så målstregen ikke bliver en bunke', () => {
  const r = solo({ s: track.finish + 1, vs: 12, finished: true, finishT: 1 });
  run(r, none, 1, clean);
  const a = r.racers[0];
  assert.ok(a.s > track.finish + 4);
  assert.ok(a.vs < 6);
});
