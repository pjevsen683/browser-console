import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStack, step, drop, speedAt, ranking, endIfIdle, START_W, PERFECT, SWING, TIME } from '../public/src/games/stack/rules.js';
import { stackBot } from '../public/src/games/stack/ai.js';
import { mulberry32 } from '../public/src/rng.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('tårnet starter med en fuld grundklods, og den glidende klods bevæger sig og vender ved kanten', () => {
  const s = createStack(['a']);
  const t = s.towers.a;
  assert.equal(t.blocks.length, 1);
  near(t.blocks[0].w, START_W);
  const x0 = t.cur.x;
  step(s, 0.1);
  assert.notEqual(t.cur.x, x0);
  for (let i = 0; i < 200; i++) { step(s, 0.05); assert.ok(Math.abs(t.cur.x) <= SWING + 1e-9); }
});

test('et skævt tab skærer det overhængende af; den nye top er overlappet', () => {
  const s = createStack(['a']);
  const t = s.towers.a;
  t.cur.x = 0.3;
  const e = drop(s, 'a');
  assert.equal(e.type, 'place');
  near(t.blocks.length, 2);
  near(t.blocks[1].w, START_W - 0.3);
  near(t.blocks[1].x, 0.15);
  near(e.cut.w, 0.3);
  near(e.cut.x, 0.3 + START_W / 2 - 0.15);
  assert.equal(t.score, 1);
  near(t.cur.w, START_W - 0.3);
});

test('perfect lægger klodsen præcist; 3 i træk gør den bredere, men aldrig over fuld bredde', () => {
  const s = createStack(['a']);
  const t = s.towers.a;
  t.cur.x = 0.4; drop(s, 'a');                     // bredde 0,6 ved x 0,2
  for (let i = 0; i < 2; i++) { t.cur.x = t.blocks.at(-1).x + PERFECT / 2; assert.equal(drop(s, 'a').type, 'perfect'); }
  near(t.blocks.at(-1).w, START_W - 0.4);
  t.cur.x = t.blocks.at(-1).x; drop(s, 'a');
  assert.ok(t.blocks.at(-1).w > START_W - 0.4);
  for (let i = 0; i < 60; i++) { t.cur.x = t.blocks.at(-1).x; drop(s, 'a'); }
  assert.ok(t.blocks.at(-1).w <= START_W + 1e-9);
});

test('helt ved siden af: tårnet er færdigt, og et færdigt tårn tager ikke flere klodser', () => {
  const s = createStack(['a', 'b']);
  s.towers.a.cur.x = START_W + 0.01;
  assert.equal(drop(s, 'a').type, 'miss');
  assert.equal(s.towers.a.done, true);
  assert.equal(drop(s, 'a'), null);
  assert.equal(s.over, false);
  s.towers.b.cur.x = -START_W - 0.01; drop(s, 'b');
  assert.equal(s.over, true);
});

test('farten stiger med højden og har et loft; tiden løber ud', () => {
  assert.ok(speedAt(10) > speedAt(0));
  assert.equal(speedAt(1000), speedAt(2000));
  const s = createStack(['a']);
  for (let i = 0; i < TIME * 10 + 5; i++) step(s, 0.1);
  assert.equal(s.over, true);
});

test('ranking efter højde', () => {
  const s = createStack(['a', 'b']);
  s.towers.b.cur.x = 0; drop(s, 'b');
  assert.deepEqual(ranking(s), ['b', 'a']);
  step(s, 1);
  s.towers.a.cur.x = 0; drop(s, 'a');
  assert.deepEqual(ranking(s), ['b', 'a'], 'lige højde: b nåede den først');
});

test('botten bygger et tårn, men ikke uendeligt', () => {
  const rng = mulberry32(3), s = createStack(['a']), mem = new Map();
  let prevA = 0;
  for (let i = 0; i < 20000 && !s.over; i++) {
    const inp = stackBot(s, 'a', mem, rng);
    if (inp.a && !prevA) drop(s, 'a');
    prevA = inp.a;
    step(s, 1 / 60);
  }
  assert.ok(s.towers.a.score >= 5, `højde ${s.towers.a.score}`);
  assert.ok(s.over);
});

test('botten trykker også, når dens sigte ville ligge uden for klodsens bane', () => {
  const s = createStack(['a']), t = s.towers.a, mem = new Map();
  t.blocks.push({ x: 0.7, w: 0.6 });
  const rng = () => 0.999;                          // største fejl, mod højre
  let pressed = false;
  for (let i = 0; i < 600 && !pressed; i++) { pressed = !!stackBot(s, 'a', mem, rng).a; step(s, 1 / 60); }
  assert.ok(pressed);
});

test('er de tilstedeværendes tårne færdige, slutter spillet, selv om en forsvundet spiller aldrig trykkede', () => {
  const s = createStack(['a', 'b']);
  assert.equal(endIfIdle(s, ['a']), false);
  s.towers.a.cur.x = START_W + 0.1; drop(s, 'a');
  assert.equal(s.over, false);
  assert.equal(endIfIdle(s, ['a']), true);
  assert.equal(s.over, true);
  assert.equal(s.towers.b.done, true);
  assert.equal(endIfIdle(createStack(['a']), []), false, 'ingen til stede: vent');
});
