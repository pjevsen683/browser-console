// Hot Potato: en bombe med lunte sidder på én spiller og går videre ved et stød. Når lunten er brændt ud, er
// bæreren ude; sidste overlevende vinder. Med 2 spillere er det bedst af 3 runder. Ren logik (test/potato.test.js).
export const FUSE_MIN = 8, FUSE_MAX = 14;
export const NO_PASS_BACK = 0.6;      // sekunder, før bomben kan gå tilbage til den, der lige gav den

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const fuse = (rng) => FUSE_MIN + rng() * (FUSE_MAX - FUSE_MIN);

export function createPotato(ids, rng) {
  return {
    ids, rng, holder: pick(rng, ids), from: null, passT: 0, fuse: fuse(rng), rate: 1, tickAcc: 0,
    out: [], roundOut: [], roundWinner: null, wins: Object.fromEntries(ids.map((id) => [id, 0])),
    target: ids.length === 2 ? 2 : 1, phase: 'play', winner: null,
  };
}

// a og b stødte sammen. Er den ene bæreren, går bomben til den anden (med de undtagelser, testene beskriver).
export function onHit(p, a, b) {
  if (p.phase !== 'play' || (a !== p.holder && b !== p.holder)) return false;
  const other = a === p.holder ? b : a;
  if (p.out.includes(other) || (other === p.from && p.passT < NO_PASS_BACK)) return false;
  p.from = p.holder;
  p.holder = other;
  p.passT = 0;
  return true;
}

// alive: de id'er, der stadig er med. Hændelser: tick (lyd), boom {id}, round {winner}, over {winner}.
export function update(p, dt, alive) {
  const ev = [];
  if (p.phase !== 'play') return ev;
  p.passT += dt;
  p.fuse -= dt;
  p.rate = p.fuse > 6 ? 1 : p.fuse > 3 ? 2 : p.fuse > 1.5 ? 3.5 : 6;   // tik pr. sekund
  p.tickAcc += dt * p.rate;
  if (p.tickAcc >= 1) { p.tickAcc -= 1; ev.push({ type: 'tick', rate: p.rate }); }
  if (p.fuse > 0) return ev;
  const gone = p.holder;
  p.out.push(gone);
  ev.push({ type: 'boom', id: gone });
  const left = alive.filter((id) => id !== gone && !p.out.includes(id));
  p.from = null;
  p.passT = 0;
  if (left.length > 1) {
    p.holder = pick(p.rng, left);
    p.fuse = fuse(p.rng);
    return ev;
  }
  const w = left[0] ?? null;
  p.roundOut = p.out.slice();
  p.roundWinner = w;
  if (w !== null) p.wins[w]++;
  if (w === null || p.wins[w] >= p.target) {
    p.phase = 'over';
    p.winner = w;
    ev.push({ type: 'over', winner: w });
    return ev;
  }
  ev.push({ type: 'round', winner: w });
  p.out = [];
  p.holder = pick(p.rng, p.ids);
  p.fuse = fuse(p.rng);
  return ev;
}

// Flest vundne runder først; ellers den, der overlevede længst i sidste runde.
export function ranking(p) {
  const rank = (id) => (id === p.roundWinner ? Infinity : p.roundOut.indexOf(id));
  return [...p.ids].sort((a, b) => p.wins[b] - p.wins[a] || rank(b) - rank(a));
}
