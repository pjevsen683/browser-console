import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLobby, lobbyStep, canStart, START_DELAY } from '../public/src/console/lobby-state.js';

const G = [{ id: 'g1', minPlayers: 2, maxPlayers: 10 }, { id: 'g2', minPlayers: 2, maxPlayers: 4 }];
const P = (id, o = {}) => ({ id, connected: true, ready: false, input: { x: 0, y: 0, a: 0, b: 0, aPressed: false, bPressed: false, ...o } });
const press = (p) => { p.input.aPressed = true; };
const quiet = (ps) => ps.forEach((p) => { p.input.aPressed = false; });

test('A skifter mellem klar og ikke klar', () => {
  const l = createLobby(G), p = P('a');
  press(p); lobbyStep(l, [p], 0.016);
  assert.equal(p.ready, true);
  quiet([p]); lobbyStep(l, [p], 0.016);
  assert.equal(p.ready, true);
  press(p); lobbyStep(l, [p], 0.016);
  assert.equal(p.ready, false);
});

test('alle klar: spillet starter efter nedtællingen, ikke før', () => {
  const l = createLobby(G), ps = [P('a'), P('b')];
  ps.forEach(press);
  assert.equal(lobbyStep(l, ps, 0), null);
  quiet(ps);
  let t = 0, started = null;
  while (!started && t < 10) { started = lobbyStep(l, ps, 0.1); t += 0.1; }
  assert.equal(started, G[0]);
  assert.ok(t >= START_DELAY - 0.01 && t <= START_DELAY + 0.25, `startede efter ${t}`);
});

test('en, der fortryder under nedtællingen, stopper den', () => {
  const l = createLobby(G), ps = [P('a'), P('b')];
  ps.forEach(press); lobbyStep(l, ps, 0); quiet(ps);
  lobbyStep(l, ps, 1);
  press(ps[0]); lobbyStep(l, ps, 0.1);
  assert.equal(l.countdown, null);
});

test('én spiller alene starter aldrig, og 5 spillere starter ikke et spil til 4', () => {
  const l = createLobby(G), one = [P('a')];
  press(one[0]); lobbyStep(l, one, 0); quiet(one);
  for (let i = 0; i < 50; i++) assert.equal(lobbyStep(l, one, 0.1), null);
  const l2 = createLobby(G); l2.sel = 1;
  const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...P(id), ready: true }));
  for (let i = 0; i < 50; i++) assert.equal(lobbyStep(l2, five, 0.1), null);
});

test('pinden til højre vælger næste spil én gang pr. skub, går rundt, og nulstiller "klar"', () => {
  const l = createLobby(G), p = P('a'), q = { ...P('b'), ready: true };
  p.input.x = 0.9; lobbyStep(l, [p, q], 0.016);
  assert.equal(l.sel, 1);
  assert.equal(q.ready, false);
  lobbyStep(l, [p, q], 0.016);
  assert.equal(l.sel, 1);                          // holdt: ingen gentagelse
  p.input.x = 0; lobbyStep(l, [p, q], 0.016);
  p.input.x = 0.9; lobbyStep(l, [p, q], 0.016);
  assert.equal(l.sel, 0);
});

test('en frakoblet spiller blokerer ikke starten', () => {
  const l = createLobby(G), ps = [P('a'), P('b'), { ...P('c'), connected: false }];
  press(ps[0]); press(ps[1]); lobbyStep(l, ps, 0); quiet(ps);
  let started = null;
  for (let i = 0; i < 40 && !started; i++) started = lobbyStep(l, ps, 0.1);
  assert.equal(started, G[0]);
  assert.equal(canStart(G[0], ps), true);
  assert.equal(canStart(G[0], [P('a')]), false);
});
