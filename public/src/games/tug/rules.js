// Tug of War: rød mod blå; hvert A-tryk trækker i rebet, delt med holdets størrelse (så tempoet pr. spiller tæller,
// og et hold på 3 ikke slår et på 2 bare ved at være flere). Når rebet når ±1, vinder holdet runden; efter ROUND_MAX
// vinder det hold, rebet hælder mod. Først til 2 runder (højst 5). Ren logik (test/tug.test.js).
import { assignTeams } from '../../console/teams.js';

export const COUNTDOWN = 3, ROUND_MAX = 30, BREAK = 3, WIN = 2, MAX_ROUNDS = 5, PULL = 0.1;

export function createTug(ids) {
  const teams = assignTeams(ids, 2);
  const size = [0, 1].map((t) => [...teams.values()].filter((v) => v === t).length);
  return { ids, teams, size, phase: 'countdown', t: COUNTDOWN, pos: 0, round: 1, wins: [0, 0], presses: Object.fromEntries(ids.map((id) => [id, 0])), winner: null };
}

// pos < 0: mod rød (hold 0), pos > 0: mod blå (hold 1).
export function press(s, id) {
  if (s.phase !== 'play' || !s.teams.has(id)) return false;
  const team = s.teams.get(id);
  s.pos += (team === 0 ? -PULL : PULL) / s.size[team];
  s.presses[id]++;
  return true;
}

function endRound(s, w, ev) {
  if (w !== null) s.wins[w]++;
  ev.push({ type: 'round', winner: w });
  if (s.wins.some((n) => n >= WIN) || s.round >= MAX_ROUNDS) {
    s.phase = 'over';
    s.winner = s.wins[0] === s.wins[1] ? null : s.wins[0] > s.wins[1] ? 0 : 1;
    ev.push({ type: 'over', winner: s.winner });
    return;
  }
  s.phase = 'break';
  s.t = BREAK;
}

// Hændelser: start, round {winner}, next, over {winner}.
export function update(s, dt) {
  const ev = [];
  if (s.phase === 'over') return ev;
  s.t -= dt;
  if (s.phase === 'countdown' && s.t <= 0) { s.phase = 'play'; s.t = ROUND_MAX; ev.push({ type: 'start' }); }
  else if (s.phase === 'play') {
    if (Math.abs(s.pos) >= 1) endRound(s, s.pos < 0 ? 0 : 1, ev);
    else if (s.t <= 0) endRound(s, Math.abs(s.pos) < 1e-6 ? null : s.pos < 0 ? 0 : 1, ev);   // ulige hold giver afrundingsstøj
  } else if (s.phase === 'break' && s.t <= 0) {
    s.round++;
    s.pos = 0;
    s.phase = 'countdown';
    s.t = COUNTDOWN;
    ev.push({ type: 'next' });
  }
  return ev;
}

export function ranking(s) {
  const team = (id) => (s.winner === null ? 0 : s.teams.get(id) === s.winner ? 0 : 1);
  return [...s.ids].sort((a, b) => team(a) - team(b) || s.presses[b] - s.presses[a]);
}
