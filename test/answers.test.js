import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCtl, MAX_TEXT, MAX_POINTS } from '../public/src/input/answers.js';

test('et svar er et indeks 0-11 (12 knapper) eller en kort tekst uden kontroltegn', () => {
  assert.deepEqual(parseCtl({ t: 'answer', value: 3 }), { t: 'answer', value: 3 });
  assert.deepEqual(parseCtl({ t: 'answer', value: 11 }), { t: 'answer', value: 11 });
  assert.equal(parseCtl({ t: 'answer', value: 12 }), null);
  assert.equal(parseCtl({ t: 'answer', value: 1.5 }), null);
  assert.equal(parseCtl({ t: 'answer', value: -1 }), null);
  assert.deepEqual(parseCtl({ t: 'answer', value: '  Polar\u0007 bear  ' }), { t: 'answer', value: 'Polar bear' });
  assert.equal(parseCtl({ t: 'answer', value: 'x'.repeat(100) }).value.length, MAX_TEXT);
  assert.equal(parseCtl({ t: 'answer', value: '   ' }), null);
  assert.equal(parseCtl({ t: 'answer', value: { evil: 1 } }), null);
});

test('et strøg er højst 64 punkter med tal i [0,1]; clear er et strøg uden punkter', () => {
  assert.deepEqual(parseCtl({ t: 'stroke', pts: [[0, 0], [0.5, 1]] }), { t: 'stroke', pts: [[0, 0], [0.5, 1]] });
  assert.deepEqual(parseCtl({ t: 'stroke', clear: true }), { t: 'stroke', clear: true });
  assert.equal(parseCtl({ t: 'stroke', pts: [[0, 2]] }), null);
  assert.equal(parseCtl({ t: 'stroke', pts: [['a', 0]] }), null);
  assert.equal(parseCtl({ t: 'stroke', pts: Array.from({ length: MAX_POINTS + 1 }, () => [0, 0]) }), null);
  assert.equal(parseCtl({ t: 'stroke', pts: [] }), null);
});

test('pong med et tal går igennem; alt andet er null', () => {
  assert.deepEqual(parseCtl({ t: 'pong', at: 12.5 }), { t: 'pong', at: 12.5 });
  assert.equal(parseCtl({ t: 'pong', at: 'x' }), null);
  assert.equal(parseCtl({ t: 'hack' }), null);
  assert.equal(parseCtl(null), null);
  assert.equal(parseCtl('answer'), null);
});

test('et strøg kan have lærredets format (ar = bredde/højde, 0,3-4), så fjernsynet tegner uden at forvrænge', () => {
  assert.deepEqual(parseCtl({ t: 'stroke', pts: [[0, 0]], ar: 2.1 }), { t: 'stroke', pts: [[0, 0]], ar: 2.1 });
  assert.deepEqual(parseCtl({ t: 'stroke', pts: [[0, 0]], ar: 9 }), { t: 'stroke', pts: [[0, 0]] });
  assert.deepEqual(parseCtl({ t: 'stroke', pts: [[0, 0]], ar: 'x' }), { t: 'stroke', pts: [[0, 0]] });
});

test('et tryk i Dance Beat: bane 0-3 og tidspunktet i konsollens ur (at mangler, hvis telefonen ikke kender uret)', () => {
  assert.deepEqual(parseCtl({ t: 'tap', lane: 2, at: 1234.5 }), { t: 'tap', lane: 2, at: 1234.5 });
  assert.deepEqual(parseCtl({ t: 'tap', lane: 0 }), { t: 'tap', lane: 0 });
  assert.deepEqual(parseCtl({ t: 'tap', lane: 3, at: 'x' }), { t: 'tap', lane: 3 });
  assert.equal(parseCtl({ t: 'tap', lane: 4, at: 1 }), null);
  assert.equal(parseCtl({ t: 'tap', lane: 1.5 }), null);
  assert.equal(parseCtl({ t: 'tap' }), null);
});
