import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, updateMatch, ranking, COUNTDOWN, ROUND_END } from '../public/src/games/sumo/rules.js';
import { createWorld } from '../public/src/games/sumo/physics.js';
import { botInput } from '../public/src/games/sumo/ai.js';

const tick = (m, alive, secs, dt = 0.1) => { const out = []; for (let t = 0; t < secs - 1e-9; t += dt) { const c = updateMatch(m, alive, dt); if (c) out.push(c); } return out; };

test('nedtælling i 3 s, så kamp', () => {
  const m = createMatch(['a', 'b']);
  assert.deepEqual(tick(m, ['a', 'b'], COUNTDOWN - 0.1), []);
  assert.deepEqual(tick(m, ['a', 'b'], 0.2), ['start']);
  assert.equal(m.phase, 'play');
});

test('sidste dyr på flagen får et point, og næste runde begynder efter pausen', () => {
  const m = createMatch(['a', 'b', 'c']);
  tick(m, ['a', 'b', 'c'], COUNTDOWN + 0.1);
  assert.equal(updateMatch(m, ['a', 'b'], 0.1), null);
  assert.equal(updateMatch(m, ['b'], 0.1), 'round');
  assert.equal(m.scores.b, 1);
  assert.equal(m.roundWinner, 'b');
  assert.deepEqual(tick(m, ['b'], ROUND_END + 0.1), ['next']);
  assert.equal(m.round, 2);
  assert.equal(m.phase, 'countdown');
});

test('falder alle i samme frame, er runden uafgjort uden point', () => {
  const m = createMatch(['a', 'b']);
  tick(m, ['a', 'b'], COUNTDOWN + 0.1);
  assert.equal(updateMatch(m, [], 0.1), 'round');
  assert.equal(m.roundWinner, null);
  assert.deepEqual(m.scores, { a: 0, b: 0 });
});

test('først til 3 vinder kampen, og ranglisten følger pointene', () => {
  const m = createMatch(['a', 'b', 'c']);
  const round = (winner) => { tick(m, ['a', 'b', 'c'], COUNTDOWN + 0.1); return updateMatch(m, [winner], 0.1); };
  round('a'); tick(m, ['a'], ROUND_END + 0.1);
  round('c'); tick(m, ['c'], ROUND_END + 0.1);
  assert.equal(round('a'), 'round');
  tick(m, ['a'], ROUND_END + 0.1);
  assert.equal(round('a'), 'match');
  assert.equal(m.phase, 'over');
  assert.equal(m.winner, 'a');
  assert.deepEqual(ranking(m), ['a', 'c', 'b']);
  assert.equal(updateMatch(m, ['a'], 1), null);
});

test('botten styrer ind mod midten ved kanten og mod den nærmeste ellers', () => {
  const w = createWorld(['me', 'o1', 'o2'], () => 0);
  const [me, o1, o2] = w.animals;
  Object.assign(me, { x: w.radius * 0.9, z: 0 });
  assert.ok(botInput(w, 'me', () => 0.5).x < -0.9);
  Object.assign(me, { x: 0, z: 0 });
  Object.assign(o1, { x: 0, z: 2 });
  Object.assign(o2, { x: -3, z: 0 });
  const b = botInput(w, 'me', () => 0.5);
  assert.ok(b.y > 0.9 && Math.abs(b.x) < 0.1);
  me.alive = false;
  assert.deepEqual(botInput(w, 'me', () => 0), { x: 0, y: 0, a: 0 });
});

test('sumo tager 2-12 spillere, og der er en art til hver', async () => {
  const { SPECIES } = await import('../public/src/games/common/species.js');
  assert.equal(SPECIES.length, 12);
  assert.equal(new Set(SPECIES).size, 12);
});
