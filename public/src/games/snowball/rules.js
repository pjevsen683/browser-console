// Snowball Fight: to hold, tre liv, runder. Ren logik (test/snowball.test.js).
// Et hold uden spillere taber runden; efter ROUND_TIME vinder holdet med flest liv tilbage (lige: ingen). Først til
// WIN_ROUNDS; højst MAX_ROUNDS, så vinder holdet med flest runder, ellers flest træffere.
import { assignTeams } from '../../console/teams.js';
import { createField, step, LIVES } from './physics.js';

export { LIVES };
export const ROUND_TIME = 90, WIN_ROUNDS = 2, MAX_ROUNDS = 5, BREAK = 3;

export function createSnowball(ids, rng) {
  const teams = assignTeams(ids, 2);
  return {
    ids, rng, teams, field: createField(ids.map((id) => ({ id, team: teams.get(id) })), rng),
    round: 1, wins: [0, 0], hitsBy: Object.fromEntries(ids.map((id) => [id, 0])),
    t: ROUND_TIME, phase: 'play', breakT: 0, winner: null,
  };
}

const livesLeft = (s, team) => s.field.players.filter((p) => p.team === team && !p.out).reduce((n, p) => n + LIVES - p.hits, 0);
const teamHits = (s, team) => s.ids.filter((id) => s.teams.get(id) === team).reduce((n, id) => n + s.hitsBy[id], 0);

function endRound(s, winner, ev) {
  if (winner !== null) s.wins[winner]++;
  ev.push({ type: 'round', winner });
  if ((winner !== null && s.wins[winner] >= WIN_ROUNDS) || s.round >= MAX_ROUNDS) {
    const [a, b] = s.wins, [ha, hb] = [teamHits(s, 0), teamHits(s, 1)];
    s.winner = a !== b ? (a > b ? 0 : 1) : ha !== hb ? (ha > hb ? 0 : 1) : null;
    s.phase = 'over';
    ev.push({ type: 'over', winner: s.winner });
    return;
  }
  s.phase = 'break';
  s.breakT = BREAK;
  for (const p of s.field.players) { p.charging = false; p.charge = 0; }   // ingen kast i pausen
}

// inputs: Map id -> input. Hændelser: fysikkens + round {winner}, start, over {winner}.
export function update(s, inputs, dt) {
  const ev = [];
  if (s.phase === 'over') return ev;
  if (s.phase === 'break') {
    for (const e of step(s.field, new Map(), dt)) if (e.type === 'land' || e.type === 'block') ev.push(e);   // bolde i luften lander færdig
    if ((s.breakT -= dt) <= 0) {
      s.field = createField(s.ids.map((id) => ({ id, team: s.teams.get(id) })), s.rng);
      s.round++;
      s.t = ROUND_TIME;
      s.phase = 'play';
      ev.push({ type: 'start' });
    }
    return ev;
  }
  s.t -= dt;
  for (const e of step(s.field, inputs, dt)) {
    if (e.type === 'hit' && e.by in s.hitsBy) s.hitsBy[e.by]++;
    ev.push(e);
  }
  const alive = [0, 1].map((t) => s.field.players.some((p) => p.team === t && !p.out));
  if (!alive[0] || !alive[1]) endRound(s, alive[0] ? 0 : alive[1] ? 1 : null, ev);
  else if (s.t <= 0) {
    const [a, b] = [livesLeft(s, 0), livesLeft(s, 1)];
    endRound(s, a === b ? null : a > b ? 0 : 1, ev);
  }
  return ev;
}

// Vinderholdet først; inden for et hold flest træffere.
export function ranking(s) {
  const first = s.winner ?? -1;
  return [...s.ids].sort((a, b) => (s.teams.get(a) === first ? 0 : 1) - (s.teams.get(b) === first ? 0 : 1)
    || s.hitsBy[b] - s.hitsBy[a]);
}
