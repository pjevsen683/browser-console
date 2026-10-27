// Banen i Mini Racers: en lukket sløjfe på et kæmpe køkkenbord. Midterlinjen er en radius, der er en sum af sinusser
// (så den aldrig krydser sig selv), strakt i x og lagt ud i 1 m-trin. s er afstanden langs banen (går rundt ved
// length), d sideafstanden (positiv = til højre i køreretningen). Ting på bordet (props) er cirkler. Ren logik
// (test/racer.test.js).
export const PROPS = [
  { kind: 'books', r: 1.6, h: 1.4 }, { kind: 'mug', r: 0.9, h: 1.3 }, { kind: 'teapot', r: 1.4, h: 1.8 },
  { kind: 'clock', r: 1.2, h: 2.2 }, { kind: 'globe', r: 1.5, h: 2.8 }, { kind: 'lamp', r: 1.4, h: 4 },
  { kind: 'vase', r: 1, h: 2.4 }, { kind: 'cake', r: 1.6, h: 1.4 }, { kind: 'yarn', r: 0.9, h: 1.1 },
  { kind: 'cactus', r: 1, h: 2.2 }, { kind: 'robot', r: 1, h: 2 }, { kind: 'trophy', r: 1, h: 2.4 },
  { kind: 'piggy', r: 1.1, h: 1.3 },
];

export function buildLoop(rng, { width = 8, radius = 27, stretch = 1.5 } = {}) {
  const p1 = rng() * 6.28, p2 = rng() * 6.28, a1 = 0.1 + rng() * 0.08, a2 = 0.05 + rng() * 0.05;
  const r = (th) => radius * (1 + a1 * Math.sin(2 * th + p1) + a2 * Math.sin(3 * th + p2));
  // fin kurve, så lagt ud i 1 m-trin
  const fine = [];
  for (let i = 0; i <= 4000; i++) {
    const th = (i / 4000) * Math.PI * 2;
    fine.push({ x: r(th) * Math.cos(th) * stretch, z: r(th) * Math.sin(th) });
  }
  let total = 0;
  for (let i = 1; i < fine.length; i++) total += Math.hypot(fine[i].x - fine[i - 1].x, fine[i].z - fine[i - 1].z);
  const n = Math.round(total), step = total / n, raw = [];
  let acc = 0, k = 1;
  for (let i = 0; i < n; i++) {
    const want = i * step;
    while (k < fine.length - 1 && acc + Math.hypot(fine[k].x - fine[k - 1].x, fine[k].z - fine[k - 1].z) < want) {
      acc += Math.hypot(fine[k].x - fine[k - 1].x, fine[k].z - fine[k - 1].z);
      k++;
    }
    const seg = Math.hypot(fine[k].x - fine[k - 1].x, fine[k].z - fine[k - 1].z), f = seg ? (want - acc) / seg : 0;
    raw.push({ x: fine[k - 1].x + (fine[k].x - fine[k - 1].x) * f, z: fine[k - 1].z + (fine[k].z - fine[k - 1].z) * f });
  }
  const length = n;
  const points = raw.map((p, i) => {
    const a = raw[(i - 1 + n) % n], b = raw[(i + 1) % n], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz);
    return { x: p.x, z: p.z, tx: tx / l, tz: tz / l };
  });
  const wrap = (s) => ((s % length) + length) % length;

  // Punkt, tangent (t) og normal mod højre (n) i afstanden s.
  function at(s) {
    const c = wrap(s), i = Math.floor(c), f = c - i, a = points[i], b = points[(i + 1) % n];
    let tx = a.tx + (b.tx - a.tx) * f, tz = a.tz + (b.tz - a.tz) * f;
    const l = Math.hypot(tx, tz);
    tx /= l; tz /= l;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx, tz, nx: -tz, nz: tx };
  }

  // Nærmeste sted på midterlinjen: { s, d }. hint (et tidligere s) gør søgningen lokal.
  function nearest(x, z, hint = null) {
    let best = Infinity, bi = 0;
    const from = hint === null ? 0 : Math.floor(hint) - 12, to = hint === null ? n - 1 : Math.floor(hint) + 12;
    for (let j = from; j <= to; j++) {
      const i = ((j % n) + n) % n, p = points[i], d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    // finjustering på stykket før og efter
    let s = bi, bd = Infinity;
    for (let f = -1; f <= 1; f += 0.05) {
      const p = at(bi + f), d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; s = bi + f; }
    }
    const p = at(s);
    return { s: wrap(s), d: (x - p.x) * p.nx + (z - p.z) * p.nz };
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const margin = width + 6;
  const table = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, hx: (maxX - minX) / 2 + margin, hz: (maxZ - minZ) / 2 + margin };

  // Ting på bordet: uden for vejen (ikke nærmere end 2 m fra kanten), enkelte helt ude ved vejkanten, ikke oven i hinanden.
  const props = [];
  const free = (x, z, r) => props.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 1.5);
  for (let tries = 0; props.length < 22 && tries < 600; tries++) {
    const kind = PROPS[Math.floor(rng() * PROPS.length)];
    const x = table.cx + (rng() * 2 - 1) * (table.hx - 2.5), z = table.cz + (rng() * 2 - 1) * (table.hz - 2.5);
    const m = nearest(x, z);
    if (Math.abs(m.d) - kind.r < width / 2 + 2 || !free(x, z, kind.r)) continue;
    props.push({ x, z, r: kind.r, h: kind.h, kind: kind.kind, rot: rng() * 6.28 });
  }
  for (let i = 0; i < 6; i++) {                       // ved vejkanten, lige uden for: man kan ramme dem i et sving
    const kind = PROPS[[1, 8, 4, 9, 6, 10][i]], s = ((i + 0.5) / 6) * length + rng() * 10, side = rng() < 0.5 ? -1 : 1;
    const p = at(s), d = side * (width / 2 + kind.r - 1.1);
    const x = p.x + p.nx * d, z = p.z + p.nz * d;
    if (Math.abs(nearest(x, z).d) - kind.r > width / 2 - 1.3 && free(x, z, kind.r)) props.push({ x, z, r: kind.r, h: kind.h, kind: kind.kind, rot: rng() * 6.28 });
  }
  return { length, width, points, at, nearest, table, props, wrap };
}
