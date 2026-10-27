// Sidste mand står (Color Panic, Musical Chairs, Bombs Away): spillere går ud, den sidste vinder runden. Med 2-3
// spillere er det bedst af 3 runder (ellers er et spil overstået på sekunder). Ville alle tilbageværende gå ud på én
// gang, går ingen ud. Ren logik (test/survival.test.js).
export function createSurvival(ids) {
  return {
    ids, alive: [...ids], out: [], round: 1, target: ids.length <= 3 ? 2 : 1, phase: 'play',
    wins: Object.fromEntries(ids.map((id) => [id, 0])), roundOut: [], roundWinner: null, winner: null,
  };
}

// Resultat: { out: de id'er, der faktisk gik ud, event: null | 'round' | 'over', winner }.
export function knockOut(s, ids) {
  const res = { out: [], event: null, winner: null };
  if (s.phase !== 'play') return res;
  const hit = [...new Set(ids)].filter((id) => s.alive.includes(id));
  if (!hit.length || hit.length >= s.alive.length) return res;
  s.alive = s.alive.filter((id) => !hit.includes(id));
  s.out.push(...hit);
  res.out = hit;
  if (s.alive.length > 1) return res;
  const w = s.alive[0];
  s.wins[w]++;
  s.roundOut = s.out.slice();
  s.roundWinner = w;
  res.winner = w;
  if (s.wins[w] >= s.target) { s.phase = 'over'; s.winner = w; res.event = 'over'; } else { s.phase = 'round'; res.event = 'round'; }
  return res;
}

export function nextRound(s) {
  if (s.phase !== 'round') return;
  s.alive = [...s.ids];
  s.out = [];
  s.round++;
  s.phase = 'play';
}

// Flest vundne runder; så den, der holdt længst i sidste runde (sidst ude bedst).
export function ranking(s) {
  const rank = (id) => (id === s.roundWinner ? Infinity : s.roundOut.indexOf(id));
  return [...s.ids].sort((a, b) => s.wins[b] - s.wins[a] || rank(b) - rank(a));
}
