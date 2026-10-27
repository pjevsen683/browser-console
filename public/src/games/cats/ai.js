// Botten i Cat Chaos: går om bag den nærmeste ting (set fra den nærmeste kant) og slår den udad. Når mormor drejer,
// fryser den efter en tilfældig reaktionstid (0-1,4 s; mormor advarer i 1,1 s), så bots også bliver taget en gang imellem.
// mem: Map id -> botten hukommelse (mål, reaktion, skiftevis A, så konsollen ser et nyt tryk).
export function catBot(s, id, mem, dt, rng = Math.random) {
  const w = s.world, me = w.cats.find((c) => c.id === id);
  if (!me) return { x: 0, y: 0, a: 0 };
  let m = mem.get(id);
  if (!m) { m = { target: null, since: 0, react: null, last: { x: 0, y: 0, a: 0 }, tap: false }; mem.set(id, m); }
  const alarm = s.owner.state === 'turning' || s.owner.state === 'looking' || me.stun > 0;
  if (alarm) {
    if (m.react === null) m.react = rng() * 1.4;
    m.react -= dt;
    if (m.react > 0) return m.last;
    return (m.last = { x: 0, y: 0, a: 0 });
  }
  m.react = null;
  m.since += dt;
  let it = w.items.find((i) => i.id === m.target && i.state === 'table');
  if (!it || m.since > 6) {
    let best = null, bd = Infinity;
    for (const i of w.items) {
      if (i.state !== 'table' || (i.id === m.target && m.since > 6)) continue;
      const d = Math.hypot(i.x - me.x, i.z - me.z);
      if (d < bd) { bd = d; best = i; }
    }
    if (best?.id !== m.target) m.since = 0;
    it = best;
    m.target = it?.id ?? null;
  }
  if (!it) return (m.last = { x: 0, y: 0, a: 0 });
  // den nærmeste kant bestemmer, hvilken vej tingen skal
  const ex = w.hx - Math.abs(it.x), ez = w.hz - Math.abs(it.z);
  const dx = ex < ez ? Math.sign(it.x) || 1 : 0, dz = ex < ez ? 0 : Math.sign(it.z) || 1;
  const bx = it.x - dx * (it.r + me.r + 0.15), bz = it.z - dz * (it.r + me.r + 0.15);
  const gx = bx - me.x, gz = bz - me.z, gd = Math.hypot(gx, gz);
  m.tap = !m.tap;
  if (gd < 0.4) return (m.last = { x: dx * 0.3, y: dz * 0.3, a: m.tap ? 1 : 0, aPressed: m.tap });
  // gå uden om tingen, hvis den står i vejen
  let mx = gx / gd, mz = gz / gd;
  const tx = it.x - me.x, tz = it.z - me.z, td = Math.hypot(tx, tz);
  if (td < gd && (tx * mx + tz * mz) / td > 0.7) { const sx = -mz, sz = mx; mx = mx * 0.4 + sx * 0.9; mz = mz * 0.4 + sz * 0.9; }
  const n = Math.hypot(mx, mz);
  return (m.last = { x: mx / n, y: mz / n, a: 0 });
}
