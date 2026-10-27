// Botten i Color Panic: efter en reaktionstid går den mod midten af det nærmeste felt med den meldte farve (nogle
// gange tager den fejl af farven) og skubber en gang imellem den, der står tæt på. mem: Map id -> hukommelse.
import { COLORS } from './rules.js';

export function panicBot(s, w, id, mem, rng = Math.random) {
  const me = w.animals.find((a) => a.id === id);
  if (!me?.alive || s.color === null) return { x: 0, y: 0, a: 0 };
  let m = mem.get(id);
  if (!m || m.call !== s.calls) {
    const color = rng() < 0.07 ? Math.floor(rng() * COLORS.length) : s.color;
    m = { call: s.calls, wait: 0.25 + rng() * 0.8, color, tile: null };
    mem.set(id, m);
  }
  if (m.wait > 0) { m.wait -= 1 / 60; return { x: 0, y: 0, a: 0 }; }
  if (!m.tile || m.tile.color !== m.color) {
    let best = null, bd = Infinity;
    for (const t of s.tiles) {
      if (t.color !== m.color) continue;
      const d = Math.hypot(t.x - me.x, t.z - me.z);
      if (d < bd) { bd = d; best = t; }
    }
    m.tile = best;
  }
  if (!m.tile) return { x: 0, y: 0, a: 0 };
  const dx = m.tile.x - me.x, dz = m.tile.z - me.z, d = Math.hypot(dx, dz);
  const near = w.animals.some((o) => o !== me && o.alive && Math.hypot(o.x - me.x, o.z - me.z) < 1.2);
  if (d < 0.25) return { x: -me.vx * 0.3, y: -me.vz * 0.3, a: near && rng() < 0.02 ? 1 : 0 };   // stå stille på feltet
  const k = Math.min(1, d / 1.2);
  return { x: (dx / d) * k - me.vx * 0.15, y: (dz / d) * k - me.vz * 0.15, a: 0 };
}
