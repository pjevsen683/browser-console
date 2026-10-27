// Plunger Roulette: lige så mange udløsere som spillere tilbage; én af dem er bomben. På skift vælger man en på
// telefonen (PICK_TIME, ellers vælges der for en); efter en trommehvirvel (DRUM) er den sikker -- eller BOOM, og man
// er ude. Ny runde med én udløser færre, og en ny begynder. Sidste mand står (common/survival.js; 2-3 spillere: bedst
// af 3). Ren logik (test/plunger.test.js).
import { createSurvival, knockOut, nextRound, ranking as rank } from '../common/survival.js';

export const PICK_TIME = 7, DRUM = 1.8, AFTER = 2.5, FIRST = 0.05;

export function createPlunger(ids, rng) {
  return { rng, surv: createSurvival(ids), phase: 'start', t: FIRST, round: 0, plungers: 0, bomb: -1, picked: [], order: [], turn: 0, choice: null, auto: false };
}

const current = (s) => s.order[s.turn];
const free = (s) => [...Array(s.plungers).keys()].filter((i) => !s.picked.includes(i));

function startRound(s, ev) {
  const alive = s.surv.alive;
  s.plungers = alive.length;
  s.bomb = Math.floor(s.rng() * s.plungers);
  s.picked = [];
  const k = s.round % alive.length;
  s.order = [...alive.slice(k), ...alive.slice(0, k)];   // en ny begynder hver runde
  s.round++;
  s.turn = 0;
  ev.push({ type: 'round', plungers: s.plungers });
  nextTurn(s, ev);
}

function nextTurn(s, ev) {
  s.phase = 'pick';
  s.t = free(s).length === 1 ? 2 : PICK_TIME;              // kun bomben tilbage: ingen grund til at vente længe
  s.choice = null;
  ev.push({ type: 'turn', id: current(s), options: free(s) });
}

export function pick(s, id, i) {
  if (s.phase !== 'pick' || id !== current(s) || !free(s).includes(i)) return false;
  s.choice = i;
  s.auto = false;
  s.phase = 'drum';
  s.t = DRUM;
  s.queued = { type: 'drum', id, plunger: i, auto: false };
  return true;
}

// Hændelser: round {plungers}, turn {id, options}, drum {id, plunger, auto}, safe {id, plunger}, boom {id, plunger},
// over {winner}.
export function update(s, dt) {
  const ev = [];
  if (s.queued) { ev.push(s.queued); s.queued = null; }
  if (s.phase === 'over') return ev;
  s.t -= dt;
  if (s.t > 0) return ev;
  if (s.phase === 'start') startRound(s, ev);
  else if (s.phase === 'pick') {
    const opts = free(s), i = opts[Math.floor(s.rng() * opts.length)];
    s.choice = i;
    s.phase = 'drum';
    s.t = DRUM;
    ev.push({ type: 'drum', id: current(s), plunger: i, auto: true });
  } else if (s.phase === 'drum') {
    const id = current(s);
    s.picked.push(s.choice);
    if (s.choice !== s.bomb) { ev.push({ type: 'safe', id, plunger: s.choice }); s.turn++; nextTurn(s, ev); return ev; }
    const res = knockOut(s.surv, [id]);
    ev.push({ type: 'boom', id, plunger: s.choice, event: res.event, winner: res.winner });
    s.phase = 'after';
    s.t = AFTER;
  } else if (s.phase === 'after') {
    if (s.surv.phase === 'over') { s.phase = 'over'; ev.push({ type: 'over', winner: s.surv.winner }); return ev; }
    if (s.surv.phase === 'round') nextRound(s.surv);
    startRound(s, ev);
  }
  return ev;
}

export const ranking = (s) => rank(s.surv);
