// Botten i Bombs Away: væk fra skygger, den står for tæt på, og ind fra kanten; ellers driver den rundt mod et
// tilfældigt sted. mem: Map id -> hukommelse.
import { BLAST } from './rules.js';

export function bombBot(s, w, id, mem, rng = Math.random) {
  const me = w.animals.find((a) => a.id === id);
  if (!me?.alive) return { x: 0, y: 0, a: 0 };
  let m = mem.get(id);
  if (!m) { m = { goal: null, goalT: 0, calm: rng() * 0.4 }; mem.set(id, m); }
  let fx = 0, fz = 0;
  for (const b of s.bombs) {
    const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz);
    if (d > BLAST + 1 || b.t > 1.4 - m.calm) continue;     // nogle opdager skyggen lidt sent
    const k = (BLAST + 1 - d) / (BLAST + 1) + 0.5;
    fx += (d < 1e-3 ? 1 : dx / d) * k; fz += (d < 1e-3 ? 0 : dz / d) * k;
  }
  const r = Math.hypot(me.x, me.z);
  if (r > w.radius - 1.8) { fx -= (me.x / r) * 1.2; fz -= (me.z / r) * 1.2; }
  if (fx || fz) { const n = Math.hypot(fx, fz); return { x: fx / n, y: fz / n, a: 0 }; }
  m.goalT -= 1 / 60;
  if (!m.goal || m.goalT <= 0) { const a = rng() * Math.PI * 2, d = rng() * (w.radius - 2.5); m.goal = { x: Math.cos(a) * d, z: Math.sin(a) * d }; m.goalT = 1.5 + rng() * 2; }
  const dx = m.goal.x - me.x, dz = m.goal.z - me.z, d = Math.hypot(dx, dz);
  return d < 0.4 ? { x: 0, y: 0, a: 0 } : { x: (dx / d) * 0.6, y: (dz / d) * 0.6, a: 0 };
}
