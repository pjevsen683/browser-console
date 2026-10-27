// Botten i Musical Chairs: går rundt om midten, mens musikken spiller; når den stopper, løber den efter en kort
// reaktionstid hen til den nærmeste ledige pude og skubber nogle gange den, der kommer i vejen. mem: Map id -> hukommelse.
export function chairsBot(s, w, id, mem, rng = Math.random) {
  const me = w.animals.find((a) => a.id === id);
  if (!me?.alive) return { x: 0, y: 0, a: 0 };
  let m = mem.get(id);
  if (!m) { m = { dir: rng() < 0.5 ? 1 : -1, ring: 3 + rng() * 2.5, round: -1, wait: 0 }; mem.set(id, m); }
  if (s.phase === 'scramble') {
    if (m.round !== s.round) { m.round = s.round; m.wait = 0.15 + rng() * 0.7; }
    if (s.seats.some((p) => p.by === id)) return { x: 0, y: 0, a: 0 };
    if (m.wait > 0) { m.wait -= 1 / 60; return { x: 0, y: 0, a: 0 }; }
    let best = null, bd = Infinity;
    for (const p of s.seats) {
      if (p.by) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return { x: 0, y: 0, a: 0 };
    const rival = w.animals.some((o) => o !== me && o.alive && Math.hypot(o.x - me.x, o.z - me.z) < 1.3);
    return { x: (best.x - me.x) / bd, y: (best.z - me.z) / bd, a: rival && bd < 2 && rng() < 0.06 ? 1 : 0 };
  }
  if (s.phase !== 'music') return { x: 0, y: 0, a: 0 };
  const r = Math.hypot(me.x, me.z) || 1, tx = (-me.z / r) * m.dir, tz = (me.x / r) * m.dir, pull = (m.ring - r) * 0.5;
  return { x: (tx + (me.x / r) * pull) * 0.7, y: (tz + (me.z / r) * pull) * 0.7, a: 0 };
}
