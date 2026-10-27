// Botten i Mini Racers: peger pinden mod et punkt et stykke fremme på banen (i sin egen bane på tværs) og speeder;
// slipper gassen i skarpe sving. Hver bot har sit eget temperament (hvor langt den ser frem, hvor meget gas), så
// feltet trækker sig ud. mem: Map id -> hukommelse.
export function carBot(cars, track, id, mem, rng = Math.random) {
  const c = cars.find((o) => o.id === id);
  if (!c || c.out || c.fallT > 0) return { x: 0, y: 0, a: 0, b: 0 };
  let m = mem.get(id);
  if (!m) { m = { look: 5 + rng() * 3, lane: (rng() * 2 - 1) * 2, gas: 0.86 + rng() * 0.14, sloppy: 0 }; mem.set(id, m); }
  if (m.sloppy > 0) m.sloppy -= 1 / 60;
  else if (rng() < 0.002) m.sloppy = 0.4 + rng() * 0.6;   // et øjebliks uopmærksomhed
  const q = track.at(c.s + m.look), dx = q.x + q.nx * m.lane - c.x, dz = q.z + q.nz * m.lane - c.z, d = Math.hypot(dx, dz) || 1;
  const ahead = track.at(c.s + m.look + 6), bend = Math.abs(Math.atan2(q.tx * ahead.tz - q.tz * ahead.tx, q.tx * ahead.tx + q.tz * ahead.tz));
  const v = Math.hypot(c.vx, c.vz);
  const a = m.sloppy > 0 ? 0 : bend > 0.45 && v > 9 ? 0 : rng() < m.gas ? 1 : 0;
  return { x: dx / d, y: dz / d, a, b: 0 };
}
