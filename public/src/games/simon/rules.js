// Simon Says: fjernsynet råber en kommando, og man trykker RØD eller BLÅ på telefonen inden tidsgrænsen -- "NOT RED!"
// betyder blå, og "DON'T TOUCH!" betyder: tryk ikke. Forkert, for sent eller et tryk ved DON'T TOUCH = ude. Tiden
// bliver kortere, og de svære kommandoer kommer efterhånden. Svar tæller GRACE efter grænsen (telefonen får
// kommandoen og svaret tilbage med ping-tiden), men fjernsynets tidsbjælke viser grænsen. Sidste mand står (common/survival.js).
// Ren logik (test/simon.test.js).
import { createSurvival, knockOut, nextRound, ranking as rank } from '../common/survival.js';

export const COMMANDS = [
  { text: 'RED!', answer: 0, level: 0 }, { text: 'BLUE!', answer: 1, level: 0 },
  { text: 'NOT RED!', answer: 1, level: 1 }, { text: 'NOT BLUE!', answer: 0, level: 1 },
  { text: "DON'T TOUCH!", answer: null, level: 2 },
];
export const GAP = 1.4, RESULT = 1.6, GRACE = 0.3;
export const limit = (n) => Math.max(1, 2 - n * 0.04);
const level = (n) => (n < 4 ? 0 : n < 9 ? 1 : 2);

export function createSimon(ids, rng) {
  return { rng, surv: createSurvival(ids), phase: 'gap', t: GAP, n: 0, cmd: null, answers: new Map() };
}

export function answer(s, id, v) {
  if (s.phase !== 'cmd' || !s.surv.alive.includes(id) || s.answers.has(id) || (v !== 0 && v !== 1)) return false;
  s.answers.set(id, v);
  return true;
}

// Hændelser: cmd {cmd, n, limit}, result {cmd, out, wrong, event, winner}, over {winner}.
export function update(s, dt) {
  const ev = [];
  if (s.phase === 'over') return ev;
  s.t -= dt;
  if (s.phase === 'cmd' && s.answers.size >= s.surv.alive.length && s.cmd.answer !== null) s.t = Math.min(s.t, 0);   // alle har svaret
  if (s.t > 0) return ev;
  if (s.phase === 'gap') {
    const pool = COMMANDS.filter((c) => c.level <= level(s.n));
    s.cmd = pool[Math.floor(s.rng() * pool.length)];
    s.phase = 'cmd';
    s.t = limit(s.n) + GRACE;
    s.answers = new Map();
    ev.push({ type: 'cmd', cmd: s.cmd, n: s.n, limit: limit(s.n) });
    s.n++;
  } else if (s.phase === 'cmd') {
    const wrong = s.surv.alive.filter((id) => (s.answers.has(id) ? s.answers.get(id) : null) !== s.cmd.answer);
    const res = knockOut(s.surv, wrong);
    ev.push({ type: 'result', cmd: s.cmd, out: res.out, wrong: wrong.length, event: res.event, winner: res.winner });
    s.phase = 'result';
    s.t = RESULT;
  } else if (s.phase === 'result') {
    if (s.surv.phase === 'over') { s.phase = 'over'; ev.push({ type: 'over', winner: s.surv.winner }); return ev; }
    if (s.surv.phase === 'round') { nextRound(s.surv); s.n = 0; }
    s.phase = 'gap';
    s.t = GAP;
  }
  return ev;
}

export const ranking = (s) => rank(s.surv);
