// Botten i Coin Grab: efter den mønt, der er mest værd i forhold til afstanden; skubber nogle gange en rig nabo.
export function coinBot(s, w, id, rng = Math.random) {
  const me = w.animals.find((a) => a.id === id);
  if (!me?.alive) return { x: 0, y: 0, a: 0 };
  let best = null, bv = 0;
  for (const c of s.coins) {
    if (c.y > 3) continue;
    const v = c.value / (Math.hypot(c.x - me.x, c.z - me.z) + 1);
    if (v > bv) { bv = v; best = c; }
  }
  for (const o of w.animals) {
    if (o === me || !o.alive || (s.scores[o.id] ?? 0) < 4) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d < 1.6 && rng() < 0.05) return { x: (o.x - me.x) / d, y: (o.z - me.z) / d, a: 1 };
  }
  if (!best) return { x: -me.x * 0.1, y: -me.z * 0.1, a: 0 };
  const d = Math.hypot(best.x - me.x, best.z - me.z) || 1;
  return { x: (best.x - me.x) / d, y: (best.z - me.z) / d, a: 0 };
}
