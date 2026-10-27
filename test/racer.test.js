import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLoop } from '../public/src/games/racer/track.js';
import { createCars, placeGrid, step, CAR_R, FALL_TIME, MAX, LOST_D } from '../public/src/games/racer/physics.js';
import { createCup, updateCup, ranking, gapAt, ROUNDS, OUT_GAP, MIN_GAP, GRACE, COUNTDOWN, BREAK, ROUND_MAX } from '../public/src/games/racer/rules.js';
import { carBot } from '../public/src/games/racer/ai.js';
import { mulberry32 } from '../public/src/rng.js';

const track = buildLoop(mulberry32(3));
const clean = { ...track, props: [] };
const run = (cars, inputs, secs, t = clean) => {
  const ev = [];
  for (let i = 0; i < secs * 60; i++) ev.push(...step(cars, t, typeof inputs === 'function' ? inputs() : inputs, 1 / 60));
  return ev;
};
const heading = (s, t = track) => { const p = t.at(s); return Math.atan2(p.tx, p.tz); };
const solo = (s = 10) => { const cars = createCars(['a'], clean); placeGrid(cars, clean, s); return cars; };
const toward = (car, p) => { const dx = p.x - car.x, dz = p.z - car.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, y: dz / d, a: 1, b: 0 }; };

test('banen: en lukket sløjfe i 1 m-trin, der ikke krydser sig selv og ikke har for skarpe sving', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const t = buildLoop(mulberry32(seed));
    const n = t.points.length;
    assert.ok(t.length > 180 && t.length < 400, `længde ${t.length}`);
    for (let i = 0; i < n; i++) {
      const a = t.points[i], b = t.points[(i + 1) % n];
      assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - 1) < 0.05, `trin ${i}`);
    }
    for (let i = 0; i < n; i += 3) {
      for (let j = i + 25; j < n; j += 3) {
        if (n - (j - i) < 25) continue;
        const a = t.points[i], b = t.points[j];
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > t.width + 2, `seed ${seed}: ${i} og ${j} for tæt`);
      }
    }
    for (let s = 0; s < t.length; s += 2) {
      const h1 = heading(s, t), h2 = heading(s + 2, t);
      const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1))) / 2;
      assert.ok(turn < 1 / 6, `seed ${seed}: sving ved ${s} (${turn.toFixed(3)} rad/m)`);
    }
  }
});

test('banen: at() går rundt, nearest finder s og sideafstand; bordet rummer banen; ting står ikke på vejen', () => {
  const p = track.at(track.length + 5), q = track.at(5);
  assert.ok(Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6);
  const r = track.at(40), n = track.nearest(r.x + r.nx * 2, r.z + r.nz * 2);
  assert.ok(Math.abs(n.s - 40) < 0.6, `s=${n.s}`);
  assert.ok(Math.abs(n.d - 2) < 0.1, `d=${n.d}`);
  for (const pt of track.points) assert.ok(Math.abs(pt.x - track.table.cx) < track.table.hx - track.width && Math.abs(pt.z - track.table.cz) < track.table.hz - track.width);
  assert.ok(track.props.length >= 10);
  for (const o of track.props) {
    const m = track.nearest(o.x, o.z);
    assert.ok(Math.abs(m.d) - o.r > track.width / 2 - 1.3, `ting på vejen: d=${m.d}`);
  }
  assert.deepEqual(buildLoop(mulberry32(3)).points[50], track.points[50]);
});

test('bilen: A speeder op, uden A bremser luften; pinden drejer bilen mod retningen', () => {
  const cars = solo();
  const car = cars[0], h0 = heading(10);
  const fwd = { x: Math.sin(h0), y: Math.cos(h0), a: 1, b: 0 };
  run(cars, new Map([['a', fwd]]), 1.5);
  const v = Math.hypot(car.vx, car.vz);
  assert.ok(v > 8, `fart ${v}`);
  run(cars, new Map(), 2);
  assert.ok(Math.hypot(car.vx, car.vz) < v * 0.6, 'bremser uden gas');
  placeGrid(cars, clean, 10);                         // midt på vejen igen (banen bugter sig væk fra den lige linje)
  const right = h0 + Math.PI / 2;
  run(cars, new Map([['a', { x: Math.sin(right), y: Math.cos(right), a: 1, b: 0 }]]), 0.8);
  const dh = Math.atan2(Math.sin(car.h - right), Math.cos(car.h - right));
  assert.ok(Math.abs(dh) < 0.15, `drejet til ${car.h}, ville ${right}`);
});

test('bilen: B bremser og bakker; uden for vejen er topfarten lavere', () => {
  const cars = solo();
  const car = cars[0], h0 = heading(10);
  run(cars, new Map([['a', { x: 0, y: 0, a: 0, b: 1 }]]), 1);
  const back = car.vx * Math.sin(h0) + car.vz * Math.cos(h0);
  assert.ok(back < -1, `bakker: ${back}`);
  const top = (d) => {
    const c = solo(20);
    const p = clean.at(20);
    Object.assign(c[0], { x: p.x + p.nx * d, z: p.z + p.nz * d, h: Math.atan2(p.tx, p.tz) });
    let best = 0;
    for (let i = 0; i < 90; i++) {
      const q = clean.at(c[0].s + 4);
      const target = { x: q.x + q.nx * d, z: q.z + q.nz * d };
      step(c, clean, new Map([['a', toward(c[0], target)]]), 1 / 60);
      best = Math.max(best, Math.hypot(c[0].vx, c[0].vz));
    }
    return best;
  };
  assert.ok(top(track.width / 2 + 2.5) < top(0) * 0.8, 'dugen er langsom');
});

test('fremdrift tælles langs banen og fortsætter over omgangen', () => {
  const cars = solo(track.length - 6);
  const car = cars[0], p0 = car.p;
  run(cars, () => new Map([['a', toward(car, clean.at(car.s + 6))]]), 4);
  assert.ok(car.p - p0 > 20, `kørt ${car.p - p0}`);
  assert.ok(car.s < 60, 's er rundet over');
});

test('over bordkanten: bilen falder og står på vejen igen efter FALL_TIME', () => {
  const cars = solo();
  const car = cars[0];
  car.x = track.table.cx + track.table.hx + 1;
  const ev = run(cars, new Map(), 0.1);
  assert.ok(ev.some((e) => e.type === 'fall' && e.id === 'a'));
  assert.ok(car.fallT > 0);
  const ev2 = run(cars, new Map(), FALL_TIME);
  assert.ok(ev2.some((e) => e.type === 'respawn'));
  assert.ok(Math.abs(clean.nearest(car.x, car.z).d) < 0.5, 'tilbage midt på vejen');
});

test('biler støder fra hinanden og fra ting', () => {
  const cars = createCars(['a', 'b'], clean);
  placeGrid(cars, clean, 30);
  const [a, b] = cars;
  Object.assign(b, { x: a.x + CAR_R * 2 + 0.3, z: a.z, vx: -8, vz: 0, h: -Math.PI / 2 });
  const ev = run(cars, new Map(), 0.2);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= CAR_R * 2 - 0.01);
  assert.ok(ev.some((e) => e.type === 'bump'));
  const p = clean.at(30), one = solo(30), prop = { x: p.x + p.tx * 3, z: p.z + p.tz * 3, r: 0.8 };
  const ev2 = run(one, () => new Map([['a', toward(one[0], prop)]]), 1.5, { ...clean, props: [prop] });
  assert.ok(Math.hypot(one[0].x - prop.x, one[0].z - prop.z) >= prop.r + CAR_R - 0.01);
  assert.ok(ev2.some((e) => e.type === 'hit'));
});

test('startgitteret: rækker på tværs af vejen bag startpunktet, ingen overlapper', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
  const cars = createCars(ids, clean);
  placeGrid(cars, clean, 50);
  for (const c of cars) {
    const m = clean.nearest(c.x, c.z);
    assert.ok(Math.abs(m.d) < clean.width / 2 - 0.5);
    assert.ok(c.p <= 50.01 && c.p > 50 - 10);
  }
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) assert.ok(Math.hypot(cars[i].x - cars[j].x, cars[i].z - cars[j].z) > CAR_R * 2);
});

test('runden: nedtælling, så kørsel; bagud med mere end OUT_GAP = ude, og de andre får et point', () => {
  const ids = ['a', 'b', 'c'];
  const cars = createCars(ids, clean);
  placeGrid(cars, clean, 20);
  const cup = createCup(ids);
  assert.equal(cup.phase, 'countdown');
  let ev = [];
  for (let t = 0; t < COUNTDOWN + 0.1; t += 0.05) ev.push(...updateCup(cup, cars, 0.05));
  assert.ok(ev.some((e) => e.type === 'start'));
  cars[0].p = 60; cars[1].p = 45; cars[2].p = 60 - OUT_GAP - 1;
  ev = updateCup(cup, cars, 0.05);
  assert.equal(ev.filter((e) => e.type === 'out').length, 0, 'ingen er ude i de første sekunder (kø ved starten)');
  cars[2].p = 50;
  for (let t = 0; t < GRACE; t += 0.05) updateCup(cup, cars, 0.05);
  cars[2].p = 60 - gapAt(cup.roundT) - 1;
  ev = updateCup(cup, cars, 0.05);
  assert.deepEqual(ev.filter((e) => e.type === 'out').map((e) => e.id), ['c']);
  assert.deepEqual(cup.points, { a: 1, b: 1, c: 0 });
  assert.ok(cars[2].out);
  cars[1].p = 60 - gapAt(cup.roundT) - 0.5;
  ev = updateCup(cup, cars, 0.05);
  assert.ok(ev.some((e) => e.type === 'out' && e.id === 'b'));
  assert.deepEqual(ev.find((e) => e.type === 'roundEnd'), { type: 'roundEnd', winner: 'a', order: ['a', 'b', 'c'] });
  assert.deepEqual(cup.points, { a: 2, b: 1, c: 0 });
});

test('føreren er aldrig ude; flere bagud på én gang går ud bagfra, og én bliver tilbage', () => {
  const ids = ['a', 'b', 'c'];
  const cars = createCars(ids, clean);
  const cup = createCup(ids);
  cup.phase = 'play';
  cup.roundT = GRACE;
  cars[0].p = 100; cars[1].p = 10; cars[2].p = 5;
  const ev = updateCup(cup, cars, 0.05);
  assert.deepEqual(ev.filter((e) => e.type === 'out').map((e) => e.id), ['c', 'b']);
  assert.ok(!cars[0].out);
  assert.deepEqual(cup.points, { a: 2, b: 1, c: 0 });
});

test('efter ROUND_MAX slutter runden alligevel; pause, så næste runde; efter ROUNDS er det slut', () => {
  const ids = ['a', 'b'];
  const cars = createCars(ids, clean);
  const cup = createCup(ids);
  const types = [];
  let guard = 0;
  while (cup.phase !== 'over' && guard++ < 100000) {
    for (const e of updateCup(cup, cars, 0.1)) {
      types.push(e.type);
      if (e.type === 'next') { for (const c of cars) { c.out = false; c.p = 0; } }
    }
  }
  assert.equal(types.filter((t) => t === 'start').length, ROUNDS);
  assert.equal(types.filter((t) => t === 'roundEnd').length, ROUNDS);
  assert.equal(types.filter((t) => t === 'next').length, ROUNDS - 1);
  assert.equal(types.at(-1), 'over');
  assert.ok(guard * 0.1 >= ROUNDS * (COUNTDOWN + ROUND_MAX) - 1 && guard * 0.1 <= ROUNDS * (COUNTDOWN + ROUND_MAX + BREAK) + 1);
});

test('afstanden, man må være bagud, skrumper i løbet af runden (kameraet zoomer ind)', () => {
  assert.equal(gapAt(0), OUT_GAP);
  assert.ok(gapAt(ROUND_MAX / 2) < OUT_GAP && gapAt(ROUND_MAX / 2) > MIN_GAP);
  assert.equal(gapAt(ROUND_MAX), MIN_GAP);
  const ids = ['a', 'b', 'c'];
  const cars = createCars(ids, clean);
  const cup = createCup(ids);
  cup.phase = 'play';
  cup.roundT = ROUND_MAX * 0.9;
  cars[0].p = 100; cars[1].p = 100 - MIN_GAP - 2; cars[2].p = 99;
  assert.ok(updateCup(cup, cars, 0.05).some((e) => e.type === 'out' && e.id === 'b'));
});

test('ranglisten: flest point, lige = bedst i sidste runde', () => {
  const cup = createCup(['a', 'b', 'c']);
  cup.points = { a: 3, b: 5, c: 3 };
  cup.lastOrder = ['c', 'b', 'a'];
  assert.deepEqual(ranking(cup), ['b', 'c', 'a']);
});

test('botten kører banen rundt uden at falde ned', () => {
  const cars = createCars(['a'], track);
  placeGrid(cars, track, 0);
  const mem = new Map(), rng = mulberry32(1);
  let falls = 0;
  for (let i = 0; i < 60 * 40; i++) {
    for (const e of step(cars, track, new Map([['a', carBot(cars, track, 'a', mem, rng)]]), 1 / 60)) if (e.type === 'fall') falls++;
  }
  assert.ok(cars[0].p > track.length * 0.9, `kørt ${cars[0].p.toFixed(0)} m af ${track.length}`);
  assert.ok(falls <= 1, `faldt ${falls} gange`);
});

test('kører man ind over dugen midt på bordet, springer fremdriften ikke; for langt væk fra vejen = væk og tilbage', () => {
  for (const seed of [3, 5, 8]) {
    const t = { ...buildLoop(mulberry32(seed)), props: [] };
    const cars = createCars(['a'], t);
    placeGrid(cars, t, 10);
    const car = cars[0], target = { x: t.table.cx, z: t.table.cz };
    let maxJump = 0, lost = 0, last = car.p;
    for (let i = 0; i < 60 * 8; i++) {
      for (const e of step(cars, t, new Map([['a', toward(car, target)]]), 1 / 60)) if (e.type === 'lost') lost++;
      maxJump = Math.max(maxJump, Math.abs(car.p - last));
      last = car.p;
    }
    assert.ok(maxJump < 1, `seed ${seed}: fremdriften sprang ${maxJump.toFixed(1)} m`);
    assert.ok(Math.abs(car.p - 10) < 25, `seed ${seed}: p=${car.p.toFixed(1)}`);
    assert.ok(lost >= 1, `seed ${seed}: bilen skulle være "væk" (mere end ${LOST_D} m fra vejen)`);
  }
});

test('topfarten er et loft: højst MAX på vejen', () => {
  const cars = solo(20);
  let best = 0;
  for (let i = 0; i < 60 * 6; i++) {
    step(cars, clean, new Map([['a', toward(cars[0], clean.at(cars[0].s + 6))]]), 1 / 60);
    best = Math.max(best, Math.hypot(cars[0].vx, cars[0].vz));
  }
  assert.ok(best <= MAX + 0.2, `fart ${best.toFixed(1)}`);
});
