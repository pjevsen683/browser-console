// Bøller og spiller-bots i Sumo Survival: som Sumo-botten (ind mod midten ved kanten, ellers efter den nærmeste og skub
// tæt på), men kun efter dyr i `foes` (bøller går efter spillerne, spiller-bots efter bøllerne). eager: chancen pr.
// billede for at skubbe, når målet er tæt på.
export function waveBot(w, id, foes, rng = Math.random, eager = 0.08) {
  const me = w.animals.find((a) => a.id === id);
  if (!me || !me.alive) return { x: 0, y: 0, a: 0 };
  const r = Math.hypot(me.x, me.z);
  if (r > w.radius * 0.72) return { x: -me.x / r, y: -me.z / r, a: 0 };
  let best = null, bd = Infinity;
  for (const o of w.animals) {
    if (o === me || !o.alive || !foes(o.id)) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best || bd < 1e-6) return { x: 0, y: 0, a: 0 };
  return { x: (best.x - me.x) / bd, y: (best.z - me.z) / bd, a: bd < 1.8 && rng() < eager ? 1 : 0 };
}
