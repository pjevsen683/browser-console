import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimon, answer, update, ranking, COMMANDS, limit, GAP, GRACE } from '../public/src/games/simon/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (s, secs, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt)); return ev; };
const ids = ['a', 'b', 'c', 'd'];

test('kommandoerne: RED, BLUE, NOT RED (= blå), NOT BLUE (= rød), DON\'T TOUCH (= intet)', () => {
  const by = Object.fromEntries(COMMANDS.map((c) => [c.text, c.answer]));
  assert.deepEqual(by, { 'RED!': 0, 'BLUE!': 1, 'NOT RED!': 1, 'NOT BLUE!': 0, "DON'T TOUCH!": null });
  assert.ok(limit(0) >= 1.8 && limit(30) >= 1 && limit(30) < limit(0));
});

test('de første kommandoer er de lette; senere kommer NOT og DON\'T', () => {
  const s = createSimon(ids, mulberry32(1));
  const seen = [];
  for (let i = 0; i < 4000 && seen.length < 40; i++) {
    for (const e of update(s, 0.05)) {
      if (e.type === 'cmd') { seen.push(e.cmd.text); for (const id of s.surv.alive) answer(s, id, e.cmd.answer); }
    }
  }
  assert.ok(seen.slice(0, 4).every((t) => t === 'RED!' || t === 'BLUE!'));
  assert.ok(seen.slice(10).some((t) => t.startsWith('NOT')) && seen.slice(10).some((t) => t.startsWith('DON')));
});

test('forkert svar, intet svar og et tryk ved DON\'T TOUCH er ude; kun første svar tæller', () => {
  const s = createSimon(ids, mulberry32(2));
  let cmd = run(s, GAP + 0.1).find((e) => e.type === 'cmd').cmd;
  answer(s, 'a', cmd.answer);
  assert.equal(answer(s, 'a', 1 - cmd.answer), false);
  answer(s, 'b', 1 - cmd.answer);
  answer(s, 'c', cmd.answer);
  const res = run(s, limit(0) + GRACE + 0.1).find((e) => e.type === 'result');
  assert.deepEqual(res.out.sort(), ['b', 'd']);
  s.cmd = COMMANDS.find((c) => c.answer === null);     // DON'T TOUCH
  s.phase = 'cmd'; s.t = 1; s.answers = new Map();
  answer(s, 'a', 0);
  const res2 = run(s, 1.1).find((e) => e.type === 'result');
  assert.deepEqual(res2.out, ['a']);
});

test('et svar lige efter tidsgrænsen tæller (telefonen er bagud med ping-tiden); alle forkert: wrong tælles, ingen ude', () => {
  const s = createSimon(['a', 'b', 'c'], mulberry32(5));
  const cmd = run(s, GAP + 0.1).find((e) => e.type === 'cmd').cmd;
  run(s, limit(0) + 0.05);
  assert.equal(answer(s, 'a', cmd.answer), true, 'inden for GRACE');
  answer(s, 'b', 1 - cmd.answer);
  answer(s, 'c', 1 - cmd.answer);
  const res = run(s, GRACE + 0.1).find((e) => e.type === 'result');
  assert.deepEqual(res.out.sort(), ['b', 'c']);
  const s2 = createSimon(['a', 'b', 'c'], mulberry32(6));
  const c2 = run(s2, GAP + 0.1).find((e) => e.type === 'cmd').cmd;
  for (const id of ['a', 'b', 'c']) answer(s2, id, c2.answer === null ? 0 : 1 - c2.answer);
  const r2 = run(s2, limit(0) + GRACE + 0.1).find((e) => e.type === 'result');
  assert.deepEqual([r2.out.length, r2.wrong], [0, 3]);
});

test('sidste mand står vinder; ranglisten', () => {
  const s = createSimon(ids, mulberry32(3));
  const rng = mulberry32(4);
  let over = null;
  for (let i = 0; i < 40000 && !over; i++) {
    for (const e of update(s, 0.05)) {
      if (e.type === 'cmd') for (const id of s.surv.alive) if (rng() < 0.85) answer(s, id, e.cmd.answer);
      if (e.type === 'over') over = e;
    }
  }
  assert.ok(over);
  assert.equal(ranking(s)[0], over.winner);
});
