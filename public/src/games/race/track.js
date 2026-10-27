// Isbanen i Penguin Race: en bugtet midterlinje i 1 m-trin, forhindringer (sneklumper) og fisk som (s, d), hvor s er
// afstanden langs banen og d sideafstanden (positiv = til højre set i køreretningen). Ren logik (test/race.test.js).
export function buildTrack(rng, { length = 320, width = 9 } = {}) {
  const p1 = rng() * 6.28, p2 = rng() * 6.28, a1 = 0.5 + rng() * 0.3, a2 = 0.25 + rng() * 0.2;
  const heading = (s) => Math.PI + Math.min(1, Math.max(0, (s - 20) / 25)) * (a1 * Math.sin(s / 38 + p1) + a2 * Math.sin(s / 17 + p2));
  const points = [];
  let x = 0, z = 0;
  for (let s = 0; s <= length; s++) {
    const h = heading(s), tx = Math.sin(h), tz = Math.cos(h);
    points.push({ x, z, tx, tz });
    x += tx; z += tz;
  }
  const finish = length - 15;
  const obstacles = [], fish = [];
  const lane = () => (rng() * 2 - 1) * (width / 2 - 1);
  for (let s = 40; s < finish - 10; s += 14 + rng() * 10) obstacles.push({ s, d: lane(), r: 0.7 });
  for (let s = 32; s < finish - 5; s += 9 + rng() * 8) fish.push({ s, d: lane() });

  // Punkt, tangent (t) og normal mod højre (n) i afstanden s langs banen.
  function at(s) {
    const c = Math.min(length - 1e-6, Math.max(0, s)), i = Math.floor(c), k = c - i;
    const a = points[i], b = points[Math.min(i + 1, points.length - 1)];
    let tx = a.tx + (b.tx - a.tx) * k, tz = a.tz + (b.tz - a.tz) * k;
    const n = Math.hypot(tx, tz);
    tx /= n; tz /= n;
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, tx, tz, nx: -tz, nz: tx };
  }
  return { length, width, finish, points, obstacles, fish, at };
}
