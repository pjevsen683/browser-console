// Color Panic: gulvet er felter i fire farver. En farve meldes; efter kaldetiden synker alle andre felter, og den, der
// står forkert (eller på et hul), er ude. Felterne stiger igen og får nye farver; kaldetiden bliver kortere. Hvem der
// er ude, afgør common/survival.js. Ren logik (test/panic.test.js).
export const COLORS = [
  { name: 'RED', hex: '#ff4d5e' }, { name: 'BLUE', hex: '#3fa7ff' }, { name: 'YELLOW', hex: '#ffd23f' }, { name: 'GREEN', hex: '#44d07b' },
];
export const FIRST = 1, SINK = 1.6, RISE = 1;
export const callTime = (n) => Math.max(1.8, 4 - 0.25 * n);

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Lige mange felter af hver farve, i tilfældig orden.
function recolor(s) {
  const cols = shuffle(s.tiles.map((_, i) => i % COLORS.length), s.rng);
  s.tiles.forEach((t, i) => { t.color = cols[i]; });
}

export function createPanic(rng, { radius = 7, size = 1.75 } = {}) {
  const tiles = [], n = Math.ceil(radius / size);
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const x = (i + 0.5) * size, z = (j + 0.5) * size;
      if (Math.hypot(x, z) < radius - size * 0.35) tiles.push({ i, j, x, z, color: 0 });
    }
  }
  const s = { rng, radius, size, tiles, phase: 'wait', t: FIRST, callLen: 1, color: null, calls: 0, gone: new Set() };
  recolor(s);
  return s;
}

export function tileAt(s, x, z) {
  const i = Math.floor(x / s.size), j = Math.floor(z / s.size);
  return s.tiles.find((t) => t.i === i && t.j === j) ?? null;
}

const wrong = (s, a) => { const t = tileAt(s, a.x, a.z); return !t || t.color !== s.color; };

// animals: [{ id, x, z, alive }]. Hændelser: call {color, time}, sink {color, out}, fall {out}, rise.
export function update(s, dt, animals) {
  const ev = [];
  s.t -= dt;
  if (s.phase === 'sink') {
    const out = animals.filter((a) => a.alive && !s.gone.has(a.id) && wrong(s, a)).map((a) => a.id);
    out.forEach((id) => s.gone.add(id));
    if (out.length) ev.push({ type: 'fall', out });
  }
  if (s.t > 0) return ev;
  if (s.phase === 'wait' || s.phase === 'rise') {
    if (s.phase === 'rise') recolor(s);
    s.color = Math.floor(s.rng() * COLORS.length);
    s.phase = 'call';
    s.t = s.callLen = callTime(s.calls);
    s.gone = new Set();
    ev.push({ type: 'call', color: s.color, time: s.t });
    s.calls++;
  } else if (s.phase === 'call') {
    s.phase = 'sink';
    s.t = SINK;
    const out = animals.filter((a) => a.alive && wrong(s, a)).map((a) => a.id);
    out.forEach((id) => s.gone.add(id));
    ev.push({ type: 'sink', color: s.color, out });
  } else if (s.phase === 'sink') {
    s.phase = 'rise';
    s.t = RISE;
    ev.push({ type: 'rise' });
  }
  return ev;
}
