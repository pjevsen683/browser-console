import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPotato, onHit, update, ranking, FUSE_MIN, FUSE_MAX, NO_PASS_BACK } from '../public/src/games/potato/rules.js';
import { fleeInput } from '../public/src/games/potato/ai.js';
import { createWorld } from '../public/src/games/sumo/physics.js';
import { mulberry32 } from '../public/src/rng.js';

const ids = ['a', 'b', 'c'];

test('bomben starter hos én af spillerne med en lunte på 8-14 s', () => {
  for (let seed = 1; seed < 30; seed++) {
    const p = createPotato(ids, mulberry32(seed));
    assert.ok(ids.includes(p.holder));
    assert.ok(p.fuse >= FUSE_MIN && p.fuse <= FUSE_MAX);
  }
});

test('bomben går videre ved et stød, men ikke straks tilbage til den, der gav den', () => {
  const p = createPotato(ids, mulberry32(1));
  p.holder = 'a';
  assert.equal(onHit(p, 'b', 'c'), false);            // bæreren er ikke med i stødet
  assert.equal(onHit(p, 'b', 'a'), true);
  assert.equal(p.holder, 'b');
  assert.equal(onHit(p, 'b', 'a'), false);            // tilbage til a med det samme: nej
  update(p, NO_PASS_BACK + 0.01, ids);
  assert.equal(onHit(p, 'a', 'b'), true);
  assert.equal(p.holder, 'a');
});

test('når lunten er brændt ud, er bæreren ude, og bomben går til en af de tilbageværende', () => {
  const p = createPotato(ids, mulberry32(2));
  p.holder = 'b'; p.fuse = 0.05;
  const ev = update(p, 0.1, ids);
  assert.deepEqual(ev.find((e) => e.type === 'boom'), { type: 'boom', id: 'b' });
  assert.deepEqual(p.out, ['b']);
  assert.ok(['a', 'c'].includes(p.holder));
  assert.ok(p.fuse >= FUSE_MIN);
  assert.equal(onHit(p, p.holder, 'b'), false);       // en, der er ude, kan ikke få bomben
});

test('sidste overlevende vinder; ranglisten er omvendt rækkefølge af, hvem der røg ud', () => {
  const p = createPotato(['a', 'b', 'c', 'd'], mulberry32(3));
  const alive = () => ['a', 'b', 'c', 'd'].filter((id) => !p.out.includes(id));
  const order = [];
  for (let i = 0; i < 3; i++) { p.fuse = 0.01; const ev = update(p, 0.1, alive()); order.push(ev.find((e) => e.type === 'boom').id); }
  assert.equal(p.phase, 'over');
  const winner = alive()[0];
  assert.deepEqual(ranking(p), [winner, order[2], order[1], order[0]]);
});

test('med 2 spillere er det bedst af 3', () => {
  const p = createPotato(['a', 'b'], mulberry32(4));
  const boom = (who) => { p.holder = who; p.fuse = 0.01; return update(p, 0.1, ['a', 'b'].filter((id) => !p.out.includes(id))); };
  assert.ok(boom('a').some((e) => e.type === 'round'));
  assert.equal(p.phase, 'play');
  assert.deepEqual(p.out, []);                         // ny runde: begge er med igen
  boom('b');
  assert.ok(boom('a').some((e) => e.type === 'over'));
  assert.deepEqual(ranking(p), ['b', 'a']);
});

test('lunten tikker hurtigere til sidst', () => {
  const p = createPotato(ids, mulberry32(5));
  p.fuse = 10;
  const slow = update(p, 0.01, ids).find((e) => e.type === 'tick')?.rate ?? p.rate;
  p.fuse = 1;
  update(p, 0.01, ids);
  assert.ok(p.rate > slow);
});

test('en bot flygter fra bæreren og holder sig fra kanten', () => {
  const w = createWorld(['me', 'h'], () => 0, { walls: true, radius: 6 });
  const [me, h] = w.animals;
  Object.assign(me, { x: 1, z: 0 }); Object.assign(h, { x: -1, z: 0 });
  assert.ok(fleeInput(w, 'me', 'h').x > 0.5);
  Object.assign(me, { x: 5, z: 0 }); Object.assign(h, { x: 3, z: 0 });
  const e = fleeInput(w, 'me', 'h');
  assert.ok(Math.abs(e.y) > 0.5, 'svinger langs kanten');
});
