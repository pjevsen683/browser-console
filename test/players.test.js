import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoster, STALE_MS } from '../public/src/input/players.js';
import { normStick, parseInput } from '../public/src/input/normalize.js';
import { readPad } from '../public/src/input/gamepads.js';

const inp = (s, o = {}) => ({ s, x: 0, y: 0, a: 0, b: 0, ...o });
const phone = (r, id, now = 0) => r.add({ id, name: id, source: 'phone' }, now);

test('hver af de 12 spillere får sin egen farve, og den 13. afvises', () => {
  const r = createRoster();
  for (let i = 0; i < 12; i++) assert.ok(phone(r, `p${i}`));
  assert.equal(new Set(r.list().map((p) => p.color)).size, 12);
  assert.equal(phone(r, 'p12'), null);
});

test('samme id igen er den samme spiller med samme farve', () => {
  const r = createRoster();
  phone(r, 'a');
  const b = phone(r, 'b');
  r.setConnected('b', false, 5);
  const again = r.add({ id: 'b', name: 'B2', source: 'phone' }, 6);
  assert.equal(again, b);
  assert.equal(again.connected, true);
  assert.equal(again.name, 'B2');
  assert.equal(r.size, 2);
});

test('en fjernet spiller frigiver sin farve', () => {
  const r = createRoster();
  const a = phone(r, 'a');
  phone(r, 'b');
  r.remove('a');
  assert.equal(phone(r, 'c').color, a.color);
});

test('et hurtigt tryk mellem to frames tæller: A trykket i præcis én frame', () => {
  const r = createRoster();
  phone(r, 'p');
  r.setInput('p', inp(1, { a: 1 }), 0);
  r.setInput('p', inp(2, { a: 0 }), 0);
  r.frame(10);
  assert.equal(r.get('p').input.aPressed, true);
  assert.equal(r.get('p').input.a, 0);
  r.frame(20);
  assert.equal(r.get('p').input.aPressed, false);
});

test('holdt A giver kun aPressed én gang', () => {
  const r = createRoster();
  phone(r, 'p');
  r.setInput('p', inp(1, { a: 1 }), 0);
  r.frame(10);
  r.setInput('p', inp(2, { a: 1 }), 15);
  r.frame(20);
  assert.equal(r.get('p').input.aPressed, false);
  assert.equal(r.get('p').input.a, 1);
});

test('et gammelt løbenummer ignoreres (datakanal og server kan bytte rækkefølge)', () => {
  const r = createRoster();
  phone(r, 'p');
  assert.equal(r.setInput('p', inp(5, { x: 0.5 }), 0), true);
  assert.equal(r.setInput('p', inp(4, { x: -1 }), 0), false);
  r.frame(1);
  assert.equal(r.get('p').input.x, 0.5);
});

test('ingen input i 1 s: pinden nulstilles, og spilleren er tabt; nyt input bringer den tilbage', () => {
  const r = createRoster();
  phone(r, 'p');
  r.setInput('p', inp(1, { x: 1 }), 0);
  r.frame(STALE_MS - 1);
  assert.equal(r.get('p').input.x, 1);
  r.frame(STALE_MS + 1);
  assert.equal(r.get('p').input.x, 0);
  assert.equal(r.get('p').lost, true);
  r.setInput('p', inp(2, { x: 1 }), STALE_MS + 5);
  r.frame(STALE_MS + 10);
  assert.equal(r.get('p').lost, false);
  assert.equal(r.get('p').input.x, 1);
});

test('en tavs telefon bliver i lobbyen; kun frakoblede fjernes, når de har været væk i 10 s', () => {
  const r = createRoster();
  r.add({ id: 'pad:0', name: 'C1', source: 'pad' }, 0);
  phone(r, 'p', 0);
  phone(r, 'q', 0);
  r.frame(5_000);
  assert.equal(r.get('pad:0').lost, false);
  assert.equal(r.get('p').lost, true);
  r.prune(60_000);                                 // tavse, men tilsluttede: bliver
  assert.deepEqual(r.list().map((p) => p.id), ['pad:0', 'p', 'q']);
  r.setConnected('q', false, 61_000);
  r.setConnected('pad:0', false, 61_000);
  r.prune(70_000);
  assert.deepEqual(r.list().map((p) => p.id), ['pad:0', 'p', 'q']);
  r.prune(71_500);
  assert.deepEqual(r.list().map((p) => p.id), ['p']);
});

test('et tryk, hvis eneste a:1-pakke blev tabt, tæller via trykketælleren i de næste pakker', () => {
  const r = createRoster();
  phone(r, 'p');
  r.setInput('p', inp(1, { an: 500, bn: 900 }), 0);
  r.frame(1);
  assert.equal(r.get('p').input.aPressed, false);  // første pakke sætter kun tælleren
  r.setInput('p', inp(3, { an: 501, bn: 900 }), 2); // pakke 2 (a:1, an:501) gik tabt; pakke 3 har a:0
  r.frame(3);
  assert.equal(r.get('p').input.aPressed, true);
  assert.equal(r.get('p').input.bPressed, false);
  r.setInput('p', inp(4, { an: 501, bn: 900 }), 4);
  r.frame(5);
  assert.equal(r.get('p').input.aPressed, false);
});

test('parseInput tager trykketællerne med, når de er tal', () => {
  assert.deepEqual(parseInput({ s: 1, x: 0, y: 0, a: 0, b: 0, an: 7, bn: 'x' }), { s: 1, x: 0, y: 0, a: 0, b: 0, an: 7 });
});

test('normStick: dødzone, skalering og klip til enhedscirklen', () => {
  assert.deepEqual(normStick(0.1, 0.05), { x: 0, y: 0 });
  const d = normStick(1, 1);
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9);
  const h = normStick(0.56, 0);
  assert.ok(Math.abs(h.x - 0.5) < 1e-9);
  assert.deepEqual(normStick(NaN, undefined), { x: 0, y: 0 });
});

test('parseInput afviser affald og gør knapper til 0/1', () => {
  assert.equal(parseInput(null), null);
  assert.equal(parseInput({ x: 1 }), null);
  assert.equal(parseInput('x'), null);
  assert.deepEqual(parseInput({ s: 3, x: 2, y: 0, a: 'ja', b: 0 }), { s: 3, x: 1, y: 0, a: 1, b: 0 });
});

test('readPad: venstre pind, d-pad vinder over pinden, knap 0 = A, knap 1 = B', () => {
  const btn = (on) => ({ pressed: on });
  const buttons = Array.from({ length: 16 }, () => btn(false));
  assert.deepEqual(readPad({ axes: [0.05, 0], buttons }), { x: 0, y: 0, a: 0, b: 0 });
  buttons[0] = btn(true);
  buttons[15] = btn(true);
  const r = readPad({ axes: [-1, 0], buttons });
  assert.ok(r.x > 0.99);
  assert.equal(r.a, 1);
  assert.deepEqual(readPad({ axes: [], buttons: [] }), { x: 0, y: 0, a: 0, b: 0 });
});

test('ping-tiden glattes (EMA 0,3), og første måling tages direkte', () => {
  const r = createRoster();
  phone(r, 'p');
  r.setRtt('p', 100);
  assert.equal(r.get('p').rtt, 100);
  r.setRtt('p', 0);
  assert.equal(r.get('p').rtt, 70);
  r.setRtt('nobody', 5);
});
