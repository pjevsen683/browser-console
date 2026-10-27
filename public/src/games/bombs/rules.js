// Bombs Away: bomber falder på øen. En skygge viser i WARN sekunder, hvor den lander; den, der står inden for BLAST,
// når den springer, er ude (og man kan falde i vandet som på isflagen). Salverne kommer tættere og bliver større.
// Den første bombe i en salve sigter efter en tilfældig spiller. Hvem der er ude, afgør common/survival.js.
// Ren logik (test/bombs.test.js).
export const WARN = 1.6, BLAST = 1.5;
export const interval = (t) => Math.max(0.5, 1.6 - t * 0.03);
const volley = (t) => Math.min(4, 1 + Math.floor(t / 15));

export function createBombs(rng, { radius = 7 } = {}) {
  return { rng, radius, bombs: [], time: 0, acc: 0.5, nextId: 1 };
}

// animals: [{ id, x, z, alive }]. Hændelser: drop {bomb, at}, boom {bomb, out}.
export function update(s, dt, animals) {
  const ev = [];
  s.time += dt;
  s.acc += dt;
  const alive = animals.filter((a) => a.alive);
  if (s.acc >= interval(s.time)) {
    s.acc = 0;
    for (let k = 0; k < volley(s.time); k++) {
      let x, z;
      const target = k === 0 && alive.length ? alive[Math.floor(s.rng() * alive.length)] : null;
      if (target) { const a = s.rng() * Math.PI * 2, d = s.rng() * 1.1; x = target.x + Math.cos(a) * d; z = target.z + Math.sin(a) * d; }
      else { const r = Math.sqrt(s.rng()) * (s.radius - 0.5), a = s.rng() * Math.PI * 2; x = Math.cos(a) * r; z = Math.sin(a) * r; }
      const r = Math.hypot(x, z), lim = s.radius - 0.5;
      if (r > lim) { x *= lim / r; z *= lim / r; }
      const bomb = { id: s.nextId++, x, z, t: WARN };
      s.bombs.push(bomb);
      ev.push({ type: 'drop', bomb, at: s.time });
    }
  }
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const b = s.bombs[i];
    b.t -= dt;
    if (b.t > 0) continue;
    s.bombs.splice(i, 1);
    ev.push({ type: 'boom', bomb: b, out: alive.filter((a) => Math.hypot(a.x - b.x, a.z - b.z) <= BLAST).map((a) => a.id) });
  }
  return ev;
}
