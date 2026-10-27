import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTeams, TEAM_COLORS } from '../public/src/console/teams.js';

test('holdene fordeles skiftevis, så de højst er 1 fra hinanden', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const t = assignTeams(ids, 2);
  assert.deepEqual(ids.map((id) => t.get(id)), [0, 1, 0, 1, 0]);
  const three = assignTeams([...'abcdefghijkl'], 3);
  const sizes = [0, 0, 0];
  for (const v of three.values()) sizes[v]++;
  assert.deepEqual(sizes, [4, 4, 4]);
});

test('der er en farve til hvert muligt hold (2-4)', () => {
  assert.ok(TEAM_COLORS.length >= 4);
  assert.throws(() => assignTeams(['a'], 5));
});
