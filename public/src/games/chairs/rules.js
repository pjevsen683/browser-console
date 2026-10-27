// Musical Chairs: musikken spiller, og alle løber rundt. Når den stopper, dukker der én pude færre op end spillere;
// den nærmeste inden for SEAT_R sætter sig (og bliver siddende). Når alle puder er taget, eller efter SCRAMBLE, er
// den, der står, ude. Hvem der er ude, afgør common/survival.js. Ren logik (test/chairs.test.js).
export const SEAT_R = 0.8, SCRAMBLE = 6, RESULT = 2.5, ALL_TAKEN = 0.8, GAP = 2.2;
const musicTime = (rng) => 4 + rng() * 5;

export function createChairs(rng, { radius = 7 } = {}) {
  return { rng, radius, phase: 'music', t: musicTime(rng), seats: [], round: 0 };
}

function placeSeats(s, n) {
  const seats = [], lim = s.radius - 1.2;
  for (let tries = 0; seats.length < n && tries < 5000; tries++) {
    const r = Math.sqrt(s.rng()) * lim, a = s.rng() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (seats.every((p) => Math.hypot(p.x - x, p.z - z) >= GAP)) seats.push({ x, z, by: null });
  }
  return seats;
}

// animals: [{ id, x, z, alive }]. Hændelser: stop {seats}, sit {id, seat}, result {out}, music.
export function update(s, dt, animals) {
  const ev = [];
  s.t -= dt;
  const alive = animals.filter((a) => a.alive);
  if (s.phase === 'scramble') {
    const seated = new Set(s.seats.map((p) => p.by).filter(Boolean));
    s.seats.forEach((p, i) => {
      if (p.by) return;
      let best = null, bd = SEAT_R;
      for (const a of alive) {
        const d = Math.hypot(a.x - p.x, a.z - p.z);
        if (!seated.has(a.id) && d <= bd) { bd = d; best = a; }
      }
      if (!best) return;
      p.by = best.id;
      seated.add(best.id);
      ev.push({ type: 'sit', id: best.id, seat: i });
    });
    if (s.seats.every((p) => p.by) && s.t > ALL_TAKEN) s.t = ALL_TAKEN;   // alle sidder: kort pause, så afgørelsen
  }
  if (s.t > 0) return ev;
  if (s.phase === 'music') {
    s.phase = 'scramble';
    s.t = SCRAMBLE;
    s.seats = placeSeats(s, Math.max(1, alive.length - 1));
    ev.push({ type: 'stop', seats: s.seats.map((p) => ({ x: p.x, z: p.z })) });
  } else if (s.phase === 'scramble') {
    const seated = new Set(s.seats.map((p) => p.by));
    s.phase = 'result';
    s.t = RESULT;
    ev.push({ type: 'result', out: alive.filter((a) => !seated.has(a.id)).map((a) => a.id) });
  } else if (s.phase === 'result') {
    s.phase = 'music';
    s.t = musicTime(s.rng);
    s.seats = [];
    s.round++;
    ev.push({ type: 'music' });
  }
  return ev;
}
