import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateRun, fall, ranking, enemyCount, enemyIds, enemySpeed, enemyEager, isEnemy, MAX_ANIMALS, MAX_WAVE, COUNTDOWN, BREAK } from '../public/src/games/waves/rules.js';
import { waveBot } from '../public/src/games/waves/ai.js';
import { createWorld, step } from '../public/src/games/sumo/physics.js';
import { mulberry32 } from '../public/src/rng.js';

test('bølgerne vokser, men aldrig over 12 dyr i alt, og altid mindst én bølle', () => {
  assert.equal(enemyCount(1, 1), 1);
  assert.equal(enemyCount(3, 1), 2);
  assert.equal(enemyCount(1, 6), 3);
  assert.ok(enemyCount(9, 1) > enemyCount(1, 1));
  for (let n = 1; n <= 6; n++) for (let w = 1; w <= MAX_WAVE; w++) {
    assert.ok(n + enemyCount(w, n) <= MAX_ANIMALS);
    assert.ok(enemyCount(w, n) >= 1);
  }
  assert.ok(enemySpeed(10) > enemySpeed(1));
  assert.ok(enemyIds(2, 1).every(isEnemy));
  assert.equal(isEnemy('bot:0'), false);
});

test('nedtælling → spil → klaret → pause → næste bølge', () => {
  const run = createRun(['a']);
  assert.equal(updateRun(run, 1, 1, COUNTDOWN - 0.1), null);
  assert.equal(updateRun(run, 1, 1, 0.2), 'start');
  assert.equal(updateRun(run, 1, 1, 1), null);
  assert.equal(updateRun(run, 1, 0, 0.1), 'cleared');
  assert.equal(run.cleared, 1);
  assert.equal(updateRun(run, 1, 0, BREAK + 0.1), 'next');
  assert.equal(run.wave, 2);
  assert.equal(run.phase, 'countdown');
});

test('alle spillere i vandet er slut, også hvis den sidste bølle faldt samtidig', () => {
  const run = createRun(['a', 'b']);
  updateRun(run, 2, 1, COUNTDOWN + 0.1);
  assert.equal(updateRun(run, 0, 0, 0.1), 'over');
  assert.equal(run.cleared, 0);
  assert.equal(updateRun(run, 0, 0, 10), null);
});

test('sidste bølge klaret = vundet', () => {
  const run = createRun(['a']);
  run.wave = MAX_WAVE;
  updateRun(run, 1, 1, COUNTDOWN + 0.1);
  assert.equal(updateRun(run, 1, 0, 0.1), 'won');
  assert.equal(run.won, true);
});

test('skub tælles på den, der skubbede bøllen; ranking efter skub, så færrest fald', () => {
  const run = createRun(['a', 'b', 'c']);
  fall(run, { id: 'bully:0', by: 'b' });
  fall(run, { id: 'bully:1', by: 'bully:2' });
  fall(run, { id: 'bully:1', by: null });
  fall(run, { id: 'a', by: 'bully:0' });
  assert.deepEqual(run.pushes, { a: 0, b: 1, c: 0 });
  assert.deepEqual(ranking(run), ['b', 'c', 'a']);
});

test('botterne går kun efter deres fjender', () => {
  const w = createWorld(['a', 'b', 'bully:0'], mulberry32(1));
  const [a, b, e] = w.animals;
  a.x = 0; a.z = 0; b.x = 1; b.z = 0; e.x = 0; e.z = 2;
  const inp = waveBot(w, 'a', isEnemy, () => 0.5);
  assert.ok(inp.y > 0.9, 'a går mod bøllen, ikke mod b');
  const inpE = waveBot(w, 'bully:0', (id) => !isEnemy(id), () => 0.5);
  assert.ok(inpE.y < 0, 'bøllen går mod en spiller');
});

test('en bot alene klarer de første bølger, men ikke uendeligt mange', () => {
  const rng = mulberry32(5), run = createRun(['a']);
  let world = null;
  const held = new Map();
  const make = () => { world = createWorld(['a', ...enemyIds(run.wave, 1)], rng); };
  make();
  for (let i = 0; i < 60 * 60 * 20 && run.phase !== 'over'; i++) {
    const inputs = new Map();
    const speed = new Map(enemyIds(run.wave, 1).map((id) => [id, enemySpeed(run.wave)]));
    if (run.phase === 'play') for (const an of world.animals) {
      inputs.set(an.id, isEnemy(an.id) ? waveBot(world, an.id, (id) => !isEnemy(id), rng, enemyEager(run.wave)) : waveBot(world, an.id, isEnemy, rng));
    }
    const pressed = new Map([...inputs].map(([k, v]) => [k, { ...v, aPressed: !!v.a && !held.get(k) }]));
    for (const [k, v] of inputs) held.set(k, v.a);
    if (run.phase === 'play') for (const e of step(world, pressed, 1 / 60, { speed })) if (e.type === 'fall') fall(run, e);
    const alive = world.animals.filter((x) => x.alive);
    const ev = updateRun(run, alive.filter((x) => !isEnemy(x.id)).length, alive.filter((x) => isEnemy(x.id)).length, 1 / 60);
    if (ev === 'next') make();
  }
  assert.equal(run.phase, 'over');
  assert.ok(run.cleared >= 1, `klarede ${run.cleared}`);
});
