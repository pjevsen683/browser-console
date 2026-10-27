// Botten i Tightrope: styrer imod, hvad den så for et øjeblik siden (reaktionstid), med lidt rysten; nu og da
// overstyrer den i panik. mem: Map id -> hukommelse.
export function ropeBot(s, id, mem, rng = Math.random) {
  const w = s.walkers.find((x) => x.id === id);
  if (!w || w.finished || w.fallT > 0) return { x: 0, y: 0, a: 0 };
  let m = mem.get(id);
  if (!m) { m = { seen: [], delay: 8 + Math.floor(rng() * 10), k: 3 + rng() * 2, panic: 0 }; mem.set(id, m); }
  m.seen.push([w.theta, w.omega]);
  const [theta, omega] = m.seen.length > m.delay ? m.seen.shift() : [0, 0];
  if (m.panic > 0) { m.panic -= 1 / 60; return { x: -Math.sign(theta || 1), y: 0, a: 0 }; }
  if (rng() < 0.0015) m.panic = 0.35;
  const x = theta * m.k + omega * 1.1 + (rng() - 0.5) * 0.3;
  return { x: Math.max(-1, Math.min(1, x)), y: 0, a: 0 };
}
