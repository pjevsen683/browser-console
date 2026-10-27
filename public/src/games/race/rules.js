// Serien i Penguin Race: RACES løb med nedtælling, point N-1-placering pr. løb, flest point vinder. Et løb slutter,
// når ingen kører mere, eller 10 s efter vinderen. Ren logik (test/race.test.js).
export const RACES = 3, COUNTDOWN = 3, RACE_END = 4, AFTER_WIN = 10;

export function createSeries(ids) {
  return { ids, race: 1, phase: 'countdown', t: COUNTDOWN, totals: Object.fromEntries(ids.map((id) => [id, 0])), lastOrder: [] };
}

// I mål efter tid, så længst fremme, så de udgåede (den sidst udgåede bedst).
export function placements(race) {
  const fin = race.racers.filter((a) => a.finished).sort((a, b) => a.finishT - b.finishT);
  const run = race.racers.filter((a) => !a.finished && !a.out).sort((a, b) => b.s - a.s);
  const out = race.racers.filter((a) => a.out && !a.finished).sort((a, b) => b.outT - a.outT);
  return [...fin, ...run, ...out].map((a) => a.id);
}

function raceOver(race) {
  if (race.racers.every((a) => a.out || a.finished)) return true;
  const first = Math.min(...race.racers.filter((a) => a.finished).map((a) => a.finishT));
  return Number.isFinite(first) && race.t - first >= AFTER_WIN;
}

// Returnerer null eller { type: 'start' | 'raceEnd' (med order, gained) | 'next' | 'over' }.
export function updateSeries(se, race, dt) {
  if (se.phase === 'countdown') {
    se.t -= dt;
    if (se.t > 1e-9) return null;
    se.phase = 'play';
    return { type: 'start' };
  }
  if (se.phase === 'play') {
    if (!raceOver(race)) return null;
    const order = placements(race), n = order.length, gained = {};
    order.forEach((id, i) => { gained[id] = n - 1 - i; se.totals[id] += gained[id]; });
    se.lastOrder = order;
    se.phase = 'raceEnd';
    se.t = RACE_END;
    return { type: 'raceEnd', order, gained };
  }
  if (se.phase === 'raceEnd') {
    se.t -= dt;
    if (se.t > 1e-9) return null;
    if (se.race >= RACES) { se.phase = 'over'; return { type: 'over' }; }
    se.race++;
    se.phase = 'countdown';
    se.t = COUNTDOWN;
    return { type: 'next' };
  }
  return null;
}

export function ranking(se) {
  const last = (id) => { const i = se.lastOrder.indexOf(id); return i < 0 ? Infinity : i; };
  return [...se.ids].sort((a, b) => se.totals[b] - se.totals[a] || last(a) - last(b));
}
