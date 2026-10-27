import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, hint, createDraw, update, choose, guess, leave, rejoin, ranking, CHOOSE_TIME, DRAW_TIME, REVEAL_TIME, INTRO, DRAWER_POINTS }
  from '../public/src/games/draw/rules.js';
import { mulberry32 } from '../public/src/rng.js';

const WORDS = ['cat', 'rainbow', 'ice cream', 'bicycle', 'house', 'snowman', 'banana', 'guitar', 'rocket', 'tree', 'pizza', 'castle',
  'spider', 'umbrella', 'robot', 'whale', 'train', 'cactus', 'dragon', 'ladder', 'kite', 'clock', 'shark', 'tent'];
const run = (s, secs, dt = 0.1) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...update(s, dt)); return ev; };
const toDraw = (s) => { run(s, INTRO + 0.05); choose(s, s.drawer, 0); return s.word; };

test('gæt: store/små bogstaver og mellemrum er lige meget; én stavefejl er ok i ord på 5+ bogstaver', () => {
  assert.equal(judge('ice cream', 'Ice-Cream'), 'correct');
  assert.equal(judge('rainbow', 'rainbw'), 'correct');
  assert.equal(judge('rainbow', 'rainbo w'), 'correct');
  assert.equal(judge('cat', 'cut'), 'close');
  assert.equal(judge('cat', 'cat'), 'correct');
  assert.equal(judge('rainbow', 'rinbw'), 'close');
  assert.equal(judge('rainbow', 'house'), 'wrong');
  assert.equal(judge('cat', ''), 'wrong');
});

test('ledetråden viser bogstavernes antal og afslører et par bogstaver undervejs', () => {
  assert.equal(hint('ice cream', 0), '_ _ _   _ _ _ _ _');
  const h = hint('rainbow', 2, mulberry32(1));
  assert.equal(h.replace(/ /g, '').length, 7);
  assert.equal([...h.replace(/ /g, '')].filter((c) => c !== '_').length, 2);
  assert.ok([...h.replace(/ /g, '')].every((c, i) => c === '_' || c === 'rainbow'[i]));
});

test('alle tegner på skift: to gange hver med 2-4 spillere, én gang med 5+', () => {
  assert.equal(createDraw(['a', 'b', 'c'], WORDS, mulberry32(1)).order.length, 6);
  const s = createDraw(['a', 'b', 'c', 'd', 'e'], WORDS, mulberry32(1));
  assert.equal(s.order.length, 5);
  assert.deepEqual([...s.order].sort(), ['a', 'b', 'c', 'd', 'e']);
  const s2 = createDraw(['a', 'b'], WORDS, mulberry32(2));
  assert.ok(s2.order[0] !== s2.order[1], 'ikke den samme to gange i træk');
});

test('tegneren vælger mellem 3 ord; uden valg tages det første efter CHOOSE_TIME; ingen ord to gange', () => {
  const s = createDraw(['a', 'b', 'c'], WORDS, mulberry32(3));
  const ev = run(s, INTRO + 0.05);
  const c = ev.find((e) => e.type === 'choose');
  assert.equal(c.drawer, s.drawer);
  assert.equal(c.options.length, 3);
  assert.equal(choose(s, s.order.find((id) => id !== s.drawer), 1), false, 'kun tegneren vælger');
  const ev2 = run(s, CHOOSE_TIME + 0.1);
  assert.deepEqual(ev2.find((e) => e.type === 'draw'), { type: 'draw', drawer: c.drawer, word: c.options[0] });
  const seen = new Set();
  for (let turn = 0; turn < s.order.length; turn++) {
    seen.add(s.word);
    run(s, DRAW_TIME + REVEAL_TIME + CHOOSE_TIME + 0.5);
  }
  assert.equal(seen.size, s.order.length);
});

test('rigtigt gæt giver point efter tid, tegneren får point pr. gætter; to gange tæller ikke', () => {
  const s = createDraw(['a', 'b', 'c'], WORDS, mulberry32(4));
  const word = toDraw(s);
  const [g1, g2] = s.ids.filter((id) => id !== s.drawer);
  assert.deepEqual(guess(s, s.drawer, word), { result: 'ignored' });
  assert.equal(guess(s, g1, 'zzzz').result, 'wrong');
  const r = guess(s, g1, word);
  assert.equal(r.result, 'correct');
  assert.ok(r.points > 190 && r.points <= 200, `points=${r.points}`);
  assert.equal(guess(s, g1, word).result, 'ignored');
  run(s, DRAW_TIME / 2);
  const r2 = guess(s, g2, word);
  assert.ok(r2.points < r.points && r2.points >= 50);
  assert.equal(s.scores[s.drawer], 2 * DRAWER_POINTS);
});

test('turen slutter, når alle har gættet, eller tiden er gået; afsløringen fortæller, hvem der fik det', () => {
  const s = createDraw(['a', 'b', 'c'], WORDS, mulberry32(5));
  const word = toDraw(s);
  for (const id of s.ids) if (id !== s.drawer) guess(s, id, word);
  const ev = update(s, 0.1);
  const rev = ev.find((e) => e.type === 'reveal');
  assert.equal(rev.word, word);
  assert.equal(rev.guessed.length, 2);
  const s2 = createDraw(['a', 'b', 'c'], WORDS, mulberry32(6));
  toDraw(s2);
  const ev2 = run(s2, DRAW_TIME + 0.2);
  assert.deepEqual(ev2.find((e) => e.type === 'reveal').guessed, []);
  assert.ok(ev2.filter((e) => e.type === 'hint').length >= 1);
});

test('forsvinder tegneren, springes turen over; en gætter, der forsvinder, skal ikke ventes på', () => {
  const s = createDraw(['a', 'b', 'c'], WORDS, mulberry32(7));
  const word = toDraw(s);
  const drawer = s.drawer, [g1, g2] = s.ids.filter((id) => id !== drawer);
  leave(s, g2);
  guess(s, g1, word);
  assert.ok(update(s, 0.1).some((e) => e.type === 'reveal'), 'kun den tilbageværende gætter skulle gætte');
  rejoin(s, g2);
  run(s, REVEAL_TIME + 0.2);
  leave(s, s.drawer);
  const ev = update(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'reveal' && e.skipped));
});

test('efter sidste tur er spillet slut; ranglisten efter point', () => {
  const s = createDraw(['a', 'b', 'c', 'd', 'e'], WORDS, mulberry32(8));
  let over = 0;
  for (let i = 0; i < 60 && s.phase !== 'over'; i++) over += run(s, 10).filter((e) => e.type === 'over').length;
  assert.equal(over, 1);
  s.scores = { a: 1, b: 5, c: 3, d: 0, e: 2 };
  assert.deepEqual(ranking(s), ['b', 'c', 'e', 'a', 'd']);
});

test('ord, der er brugt før på denne konsol, kommer sidst', () => {
  const used = new Set(WORDS.slice(0, 20));
  const s = createDraw(['a', 'b', 'c'], WORDS, mulberry32(9), used);
  assert.deepEqual(new Set(s.pool.slice(0, 4)), new Set(WORDS.slice(20)));
});

test('springes en tur over under ordvalget, nævnes intet gammelt ord, og ordene kommer tilbage i bunken', () => {
  const s = createDraw(['a', 'b', 'c'], WORDS, mulberry32(10));
  toDraw(s);
  const first = s.word;
  run(s, DRAW_TIME + REVEAL_TIME + 0.3);
  assert.equal(s.phase, 'choose');
  const opts = s.options.slice(), poolSize = s.pool.length;
  leave(s, s.drawer);
  const rev = update(s, 0.1).find((e) => e.type === 'reveal');
  assert.ok(rev.skipped);
  assert.notEqual(rev.word, first);
  assert.equal(s.word, null);
  assert.equal(s.pool.length, poolSize + opts.length);
});

test('er der ingen gættere tilbage, slutter turen med det samme', () => {
  const s = createDraw(['a', 'b'], WORDS, mulberry32(11));
  toDraw(s);
  leave(s, s.ids.find((id) => id !== s.drawer));
  assert.ok(update(s, 0.1).some((e) => e.type === 'reveal'));
});

test('ledetråden viser bindestreger som de er og afslører kun bogstaver', () => {
  assert.equal(hint('t-shirt', 0), '_ - _ _ _ _ _');
  for (let seed = 1; seed < 20; seed++) assert.ok(!hint('t-shirt', 2, mulberry32(seed)).includes('- -'));
  assert.equal([...hint('t-shirt', 6, mulberry32(1)).replace(/ /g, '')].join(''), 't-shirt');
});
