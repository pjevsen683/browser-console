// Tightrope: alle går på hver sin line over en kløft. Man vipper som et omvendt pendul (vinkel theta); vindstød og
// gangen skubber, og man styrer imod med telefonens hældning (eller pinden): x. Man går af sig selv, hurtigst når
// man står lige. Over FALL: ned i kløften og tilbage på sidste checkpoint efter FALL_TIME. Først i mål vinder; ellers
// længst efter TIME. Ren logik (test/rope.test.js).
export const LENGTH = 40, FALL = 0.9, FALL_TIME = 2, CHECK = 10, TIME = 75;
const G = 2.5, CTRL = 6, DAMP = 1.2, GUST = 2, SPEED = 1.6, WOBBLE = 0.25;

export function createRope(ids, rng) {
  return {
    ids, rng, t: 0, over: false, gusts: true,
    walkers: ids.map((id) => ({ id, dist: 0, theta: 0, omega: 0, fallT: 0, finished: false, finishT: null, gustT: 2 + rng() * 3, gust: 0, gustLeft: 0, phase: rng() * 6.28, falls: 0 })),
  };
}

// Hændelser: gust {id, dir}, fall {id}, back {id}, finish {id}, over.
export function step(s, inputs, dt) {
  const ev = [];
  if (s.over) return ev;
  s.t += dt;
  for (const w of s.walkers) {
    if (w.finished) continue;
    if (w.fallT > 0) {
      w.fallT -= dt;
      if (w.fallT > 0) continue;
      Object.assign(w, { fallT: 0, theta: 0, omega: 0, dist: Math.floor(w.dist / CHECK) * CHECK });
      ev.push({ type: 'back', id: w.id });
      continue;
    }
    if (s.gusts && (w.gustT -= dt) <= 0) {
      w.gust = (s.rng() < 0.5 ? -1 : 1) * (0.6 + s.rng());
      w.gustLeft = 0.7;
      w.gustT = 2 + s.rng() * 2.5;
      ev.push({ type: 'gust', id: w.id, dir: Math.sign(w.gust) });
    }
    const g = w.gustLeft > 0 ? w.gust : 0;
    w.gustLeft -= dt;
    const x = Math.max(-1, Math.min(1, inputs.get(w.id)?.x ?? 0));
    const wobble = s.gusts ? Math.sin(s.t * 7 + w.phase) * WOBBLE : 0;
    w.omega += (G * Math.sin(w.theta) + g * GUST + wobble - x * CTRL - DAMP * w.omega) * dt;
    w.theta += w.omega * dt;
    w.dist += SPEED * Math.max(0, 1 - Math.abs(w.theta) / 0.5) * dt;
    if (Math.abs(w.theta) > FALL) { w.fallT = FALL_TIME; w.falls++; ev.push({ type: 'fall', id: w.id }); continue; }
    if (w.dist >= LENGTH) { w.dist = LENGTH; w.finished = true; w.finishT = s.t; ev.push({ type: 'finish', id: w.id }); }
  }
  if (s.walkers.every((w) => w.finished) || s.t >= TIME) { s.over = true; ev.push({ type: 'over' }); }
  return ev;
}

// I mål efter tid; så længst fremme.
export function ranking(s) {
  const w = (id) => s.walkers.find((x) => x.id === id);
  return [...s.ids].sort((a, b) => {
    const A = w(a), B = w(b);
    if (A.finished !== B.finished) return A.finished ? -1 : 1;
    return A.finished ? A.finishT - B.finishT : B.dist - A.dist;
  });
}
