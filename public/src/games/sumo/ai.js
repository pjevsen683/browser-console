// En bot på isflagen (?bots=N): ind mod midten ved kanten, ellers efter den nærmeste og skub, når den er tæt på.
export function botInput(w, id, rng = Math.random) {
  const me = w.animals.find((a) => a.id === id);
  if (!me || !me.alive) return { x: 0, y: 0, a: 0 };
  const r = Math.hypot(me.x, me.z);
  if (r > w.radius * 0.72) return { x: -me.x / r, y: -me.z / r, a: 0 };
  let best = null, bd = Infinity;
  for (const o of w.animals) {
    if (o === me || !o.alive) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best || bd < 1e-6) return { x: 0, y: 0, a: 0 };
  return { x: (best.x - me.x) / bd, y: (best.z - me.z) / bd, a: bd < 1.8 && rng() < 0.08 ? 1 : 0 };
}
