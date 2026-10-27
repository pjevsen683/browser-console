// Botten i Snowball Fight: flytter sig rundt på sin halvdel, lader op mod den nærmeste modstander (nok til at nå
// den) og slipper; dukker sig nogle gange for en bold på vej. mem: Map id -> bottens hukommelse.
import { RANGE_MIN, RANGE_MAX, BODY } from './physics.js';

export function snowBot(s, id, mem, rng = Math.random) {
  const f = s.field, me = f.players.find((p) => p.id === id);
  const idle = { x: 0, y: 0, a: 0, b: 0 };
  if (!me || me.out || s.phase !== 'play') return idle;
  let m = mem.get(id);
  if (!m) { m = { goal: null, goalT: 0, want: 0, holding: false, seen: new Set() }; mem.set(id, m); }
  // en bold på vej mod mig: dukke (35 %, besluttet én gang pr. bold)
  for (const b of f.balls) {
    if (b.team === me.team || m.seen.has(b.id)) continue;
    const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz);
    if (d > 3.5) continue;
    m.seen.add(b.id);
    if ((dx * b.vx + dz * b.vz) / (d * Math.hypot(b.vx, b.vz)) > 0.95 && rng() < 0.35) return { ...idle, b: 1, bPressed: true };
  }
  let foe = null, fd = Infinity;
  for (const o of f.players) {
    if (o.team === me.team || o.out) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d < fd) { fd = d; foe = o; }
  }
  if (!foe) return idle;
  const tx = (foe.x - me.x) / fd, tz = (foe.z - me.z) / fd;
  if (m.holding) {
    if (me.charge >= m.want) { m.holding = false; return { x: tx * 0.25, y: tz * 0.25, a: 0 }; }
    return { x: tx * 0.25, y: tz * 0.25, a: 1 };
  }
  if (me.cd === 0 && rng() < 0.025) {
    m.holding = true;
    m.want = Math.min(1, Math.max(0.05, (fd - RANGE_MIN) / (RANGE_MAX - RANGE_MIN) + 0.08));
    return { x: tx * 0.25, y: tz * 0.25, a: 1 };
  }
  // gå mod et tilfældigt sted på egen halvdel; nyt sted hvert 2.-3. sekund, eller når det er nået
  m.goalT -= 1 / 60;
  const side = me.team === 0 ? -1 : 1;
  if (!m.goal || m.goalT <= 0 || Math.hypot(m.goal.x - me.x, m.goal.z - me.z) < 0.4) {
    m.goal = { x: side * (2 + rng() * 7.5), z: (rng() * 2 - 1) * (f.hz - BODY - 0.5) };
    m.goalT = 2 + rng();
  }
  const gx = m.goal.x - me.x, gz = m.goal.z - me.z, gd = Math.hypot(gx, gz) || 1;
  return { x: gx / gd, y: gz / gd, a: 0 };
}
