import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeChart, judge, multiplier, LANES, PERFECT, GREAT, GOOD, LATE } from '../public/src/games/dance/chart.js';
import { createDance, tap, update, ranking, tapTime, LEAD_IN } from '../public/src/games/dance/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const beats = Array.from({ length: 140 }, (_, i) => 1 + i * 0.5);    // 120 bpm, 1-70.5 s
const song = { id: 'x', bpm: 120, duration: 75, beats };

test('koreografien: pile på takterne efter LEAD_IN, tættere mod slutningen, aldrig samme bane tre gange i træk', () => {
  const notes = makeChart(beats, mulberry32(1));
  assert.ok(notes.length > 80, `${notes.length} pile`);
  assert.ok(notes[0].t >= LEAD_IN);
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t > notes[i - 1].t, 'stigende tid');
  for (let i = 2; i < notes.length; i++) assert.ok(!(notes[i].lane === notes[i - 1].lane && notes[i].lane === notes[i - 2].lane), `tre ens ved ${i}`);
  assert.ok(notes.every((n) => Number.isInteger(n.lane) && n.lane >= 0 && n.lane < LANES));
  const per = (a, b) => notes.filter((n) => n.t >= a && n.t < b).length;
  assert.ok(per(5, 15) < per(45, 55), 'tættere senere');
  assert.ok(notes.some((n, i) => i && Math.abs(n.t - notes[i - 1].t - 0.25) < 1e-6), 'halve takter i et stykke');
  assert.deepEqual(makeChart(beats, mulberry32(1)), notes, 'samme frø = samme koreografi');
});

test('bedømmelse: Perfect/Great/Good efter afvigelse, ellers intet; kæden giver gange', () => {
  assert.equal(judge(0.02).kind, 'perfect');
  assert.equal(judge(-PERFECT).kind, 'perfect');
  assert.equal(judge(GREAT - 0.001).kind, 'great');
  assert.equal(judge(-(GOOD - 0.001)).kind, 'good');
  assert.equal(judge(GOOD + 0.01), null);
  assert.ok(judge(0).points > judge(0.09).points && judge(0.09).points > judge(0.14).points);
  assert.deepEqual([0, 9, 10, 19, 20, 30, 99].map(multiplier), [1, 1, 1.5, 1.5, 2, 2.5, 2.5]);
});

test('et tryk rammer den nærmeste pil i banen; samme pil tæller én gang; tryk ved siden af bryder kæden', () => {
  const s = createDance(['a', 'b'], song, mulberry32(2));
  const n0 = s.notes[0], n1 = s.notes[1];
  const r = tap(s, 'a', n0.lane, n0.t + 0.01);
  assert.equal(r.kind, 'perfect');
  assert.equal(s.players.a.combo, 1);
  assert.equal(tap(s, 'a', n0.lane, n0.t + 0.02).kind, n1.lane === n0.lane && Math.abs(n1.t - n0.t) < GOOD ? 'good' : 'stray');
  const s2 = createDance(['a'], song, mulberry32(2));
  tap(s2, 'a', n0.lane, n0.t);
  assert.equal(tap(s2, 'a', (n1.lane + 1) % LANES, n1.t).kind, 'stray', 'forkert bane');
  assert.equal(s2.players.a.combo, 0);
  assert.equal(s2.players.a.score, judge(0).points, 'et vildt tryk koster ikke point');
});

test('en pil, der passerer uden tryk, er Miss for den spiller og nulstiller kæden', () => {
  const s = createDance(['a', 'b'], song, mulberry32(3));
  const [n0, n1] = s.notes;
  tap(s, 'a', n0.lane, n0.t);
  tap(s, 'b', n0.lane, n0.t);
  tap(s, 'a', n1.lane, n1.t);
  const ev = update(s, n1.t + GOOD + LATE + 0.01);
  assert.deepEqual(ev.filter((e) => e.type === 'miss').map((e) => e.id), ['b']);
  assert.equal(s.players.b.combo, 0);
  assert.equal(s.players.b.hits.miss, 1);
  assert.equal(s.players.a.combo, 2);
});

test('sangen slutter efter sidste pil; ranglisten efter point; gennemsnitlig afvigelse pr. spiller', () => {
  const s = createDance(['a', 'b', 'c'], song, mulberry32(4));
  for (const n of s.notes) { tap(s, 'a', n.lane, n.t + 0.03); tap(s, 'b', n.lane, n.t - 0.12); }
  const ev = [];
  for (let t = 0; t < song.duration + 5; t += 0.1) ev.push(...update(s, t));
  assert.equal(ev.filter((e) => e.type === 'over').length, 1);
  assert.deepEqual(ranking(s), ['a', 'b', 'c']);
  assert.ok(Math.abs(s.players.a.offsetMs() - 30) < 1);
  assert.ok(Math.abs(s.players.b.offsetMs() + 120) < 1);
  assert.equal(s.players.c.offsetMs(), null);
  assert.equal(s.players.a.hits.perfect, s.notes.length);
  assert.equal(s.players.c.hits.miss, s.notes.length);
});

test('trykkets tid: telefonens stempel plus halv ping-tid; uden stempel ankomsttiden minus halv ping-tid', () => {
  assert.equal(tapTime({ at: 1000 }, 1100, 40), 1020);
  assert.equal(tapTime({}, 1100, 40), 1080);
  assert.equal(tapTime({ at: 1000 }, 1100, null), 1000);
  assert.equal(tapTime({ at: 300 }, 1100, 40), 1080, 'et stempel meget ældre end ping-tiden + 0,5 s: ankomsttid i stedet');
  assert.equal(tapTime({ at: 1200 }, 1100, 40), 1080, 'et stempel fra fremtiden: ankomsttid i stedet');
  assert.equal(tapTime({ at: 850 }, 1100, 40), 870, 'et wifi-ryk på 250 ms: stemplet gælder stadig');
});

test('botten rammer de fleste pile, med en afvigelse efter dygtighed, og misser nogle', async () => {
  const { botTap, botSkill } = await import('../public/src/games/dance/ai.js');
  const rng = mulberry32(5);
  const skill = botSkill(rng);
  assert.ok(skill.hit > 0.7 && skill.hit < 1 && skill.sd > 0.01 && skill.sd < 0.09);
  const s = createDance(['bot'], song, mulberry32(6));
  for (const n of s.notes) { const t = botTap(n, skill, rng); if (t !== null) tap(s, 'bot', n.lane, t); }
  update(s, song.duration + 5);
  const h = s.players.bot.hits;
  assert.ok(h.miss > 0 && h.miss < s.notes.length * 0.35, `miss ${h.miss}`);
  assert.ok(h.perfect > 0 && h.good + h.great > 0);
});

test('et tryk, der kommer for sent frem, men er stemplet inden for Good, tæller, selv om pilen er passeret', () => {
  const s = createDance(['a'], song, mulberry32(7));
  const n = s.notes[0];
  update(s, n.t + 0.16);                              // konsollens ur er videre, før trykket når frem
  assert.equal(tap(s, 'a', n.lane, n.t + 0.12).kind, 'good');
  assert.equal(s.players.a.hits.miss, 0);
});

test('tryk før den første pil (under nedtællingen) ignoreres og bryder ingen kæde', () => {
  const s = createDance(['a'], song, mulberry32(8));
  assert.equal(tap(s, 'a', 0, s.notes[0].t - 1).kind, 'ignored');
  assert.equal(s.players.a.combo, 0);
});
