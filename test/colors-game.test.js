// Color Rush-modulet med en falsk ctx: en telefon, der kommer midt i spillet, får pind og spillets "vent"-tekst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import colors from '../public/src/games/colors/index.js';
import { mulberry32 } from '../public/src/rng.js';

const el = () => ({ style: {}, textContent: '', innerHTML: '' });
const ctx = {
  players: [{ id: 'a', name: 'A', color: '#f00' }, { id: 'b', name: 'B', color: '#00f' }],
  rng: mulberry32(1), notify() {},
  audio: { blip() {}, fanfare() {}, thud() {}, say() {} },
  hud: { layer: { innerHTML: '', querySelector: el }, scores() {}, banner() {}, clear() {} },
};

test('en nyankommen midt i Color Rush får ingen svarknapper og en tydelig vent-besked', () => {
  const g = colors.start(ctx);
  assert.ok(!g.layoutFor('stranger'));
  assert.match(g.hello('stranger').text, /game is on/i);
  assert.equal(g.layoutFor('a').kind, 'choices');
});
