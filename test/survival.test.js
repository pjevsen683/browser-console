import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvival, knockOut, nextRound, ranking } from '../public/src/games/common/survival.js';

test('sidste mand står: ude én ad gangen, den sidste vinder; med 4+ spillere er det én runde', () => {
  const s = createSurvival(['a', 'b', 'c', 'd']);
  assert.equal(s.target, 1);
  assert.deepEqual(knockOut(s, ['b']), { out: ['b'], event: null, winner: null });
  assert.deepEqual(knockOut(s, ['d', 'a']), { out: ['d', 'a'], event: 'over', winner: 'c' });
  assert.equal(s.phase, 'over');
  assert.deepEqual(ranking(s), ['c', 'a', 'd', 'b']);
});

test('ville alle tilbageværende være ude på én gang, er ingen ude', () => {
  const s = createSurvival(['a', 'b', 'c', 'd']);
  knockOut(s, ['a', 'b']);
  assert.deepEqual(knockOut(s, ['c', 'd']), { out: [], event: null, winner: null });
  assert.deepEqual(s.alive, ['c', 'd']);
});

test('med 2-3 spillere er det bedst af 3 runder; nextRound tager alle med igen', () => {
  const s = createSurvival(['a', 'b']);
  assert.equal(s.target, 2);
  assert.deepEqual(knockOut(s, ['a']), { out: ['a'], event: 'round', winner: 'b' });
  assert.equal(s.phase, 'round');
  nextRound(s);
  assert.deepEqual(s.alive, ['a', 'b']);
  assert.equal(s.round, 2);
  knockOut(s, ['b']);
  nextRound(s);
  const r = knockOut(s, ['a']);
  assert.equal(r.event, 'over');
  assert.equal(r.winner, 'b');
  assert.deepEqual(ranking(s), ['b', 'a']);
});

test('ukendte og allerede udgåede id\'er ignoreres', () => {
  const s = createSurvival(['a', 'b', 'c', 'd']);
  knockOut(s, ['a']);
  assert.deepEqual(knockOut(s, ['a', 'zz']).out, []);
});
