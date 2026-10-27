// Runderne: nedtælling, kamp, rundevinder, først til 3. Ren logik (test/sumo-rules.test.js).
export const COUNTDOWN = 3, ROUND_END = 3, TARGET = 3;

export function createMatch(ids, { target = TARGET } = {}) {
  return {
    ids, target, round: 1, phase: 'countdown', t: COUNTDOWN, winner: null, roundWinner: null,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
  };
}

// alive: id'erne på flagen. Returnerer faseskiftet ('start' | 'round' | 'next' | 'match') eller null.
export function updateMatch(m, alive, dt) {
  if (m.phase === 'countdown') {
    m.t -= dt;
    if (m.t > 1e-9) return null;
    m.phase = 'play';
    return 'start';
  }
  if (m.phase === 'play') {
    if (alive.length > 1) return null;
    m.roundWinner = alive[0] ?? null;
    if (m.roundWinner !== null) m.scores[m.roundWinner]++;
    const champ = m.ids.find((id) => m.scores[id] >= m.target);
    if (champ) { m.phase = 'over'; m.winner = champ; return 'match'; }
    m.phase = 'roundEnd';
    m.t = ROUND_END;
    return 'round';
  }
  if (m.phase === 'roundEnd') {
    m.t -= dt;
    if (m.t > 1e-9) return null;
    m.round++;
    m.phase = 'countdown';
    m.t = COUNTDOWN;
    return 'next';
  }
  return null;
}

export function ranking(m) {
  return [...m.ids].sort((a, b) => m.scores[b] - m.scores[a] || (b === m.winner) - (a === m.winner));
}
