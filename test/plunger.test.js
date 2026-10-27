import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlunger, pick, update, ranking, PICK_TIME, DRUM, AFTER } from '../public/src/games/plunger/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const run = (s, secs, dt = 0.05) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt)); return ev; };
const ids = ['a', 'b', 'c', 'd'];

test('en runde: lige så mange udløsere som spillere; kun den, der har tur, kan vælge, og kun en ledig', () => {
  const s = createPlunger(ids, mulberry32(1));
  const ev = run(s, 0.1);
  assert.equal(ev.find((e) => e.type === 'round').plungers, 4);
  const turn = ev.find((e) => e.type === 'turn');
  assert.deepEqual(turn.options, [0, 1, 2, 3]);
  const other = ids.find((id) => id !== turn.id);
  assert.equal(pick(s, other, 0), false);
  assert.equal(pick(s, turn.id, 9), false);
  assert.equal(pick(s, turn.id, 2), true);
  assert.equal(pick(s, turn.id, 1), false, 'kun ét valg');
});

test('sikker: næste spiller får tur uden den valgte; bomben: ude, og ny runde med én udløser færre', () => {
  const s = createPlunger(ids, mulberry32(2));
  let turn = run(s, 0.1).find((e) => e.type === 'turn');
  const safe = [0, 1, 2, 3].find((i) => i !== s.bomb);
  pick(s, turn.id, safe);
  const ev = run(s, DRUM + 0.1);
  assert.deepEqual(ev.find((e) => e.type === 'safe'), { type: 'safe', id: turn.id, plunger: safe });
  turn = ev.find((e) => e.type === 'turn');
  assert.ok(!turn.options.includes(safe));
  const victim = turn.id;
  pick(s, victim, s.bomb);
  const ev2 = run(s, DRUM + 0.1);
  assert.equal(ev2.find((e) => e.type === 'boom').id, victim);
  assert.ok(!s.surv.alive.includes(victim));
  const ev3 = run(s, AFTER + 0.2);
  assert.equal(ev3.find((e) => e.type === 'round').plungers, 3);
});

test('vælger man ikke i tide, vælges der for en', () => {
  const s = createPlunger(ids, mulberry32(3));
  const turn = run(s, 0.1).find((e) => e.type === 'turn');
  const ev = run(s, PICK_TIME + 0.1);
  const drum = ev.find((e) => e.type === 'drum');
  assert.equal(drum.id, turn.id);
  assert.ok(drum.auto);
});

test('et helt spil ender med én vinder; med 2 spillere er det bedst af 3', () => {
  for (const group of [ids, ['a', 'b']]) {
    const s = createPlunger(group, mulberry32(4));
    const rng = mulberry32(5);
    let over = null;
    for (let i = 0; i < 20000 && !over; i++) {
      for (const e of update(s, 0.05)) {
        if (e.type === 'turn') pick(s, e.id, e.options[Math.floor(rng() * e.options.length)]);
        if (e.type === 'over') over = e;
      }
    }
    assert.ok(over, 'slut');
    assert.equal(ranking(s)[0], over.winner);
    if (group.length === 2) assert.equal(s.surv.wins[over.winner], 2);
  }
});
