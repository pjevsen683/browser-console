// Botten i Tug of War: hamrer på A med sit eget tempo (5-8 tryk i sekundet). Et tryk er én frame med a=1; spillerlisten
// tæller kanten. mem: Map id -> hukommelse.
export function tugBot(id, mem, rng = Math.random, dt = 1 / 60) {
  let m = mem.get(id);
  if (!m) { m = { hz: 5 + rng() * 3, acc: rng(), down: false }; mem.set(id, m); }
  if (m.down) { m.down = false; return { x: 0, y: 0, a: 0, b: 0 }; }
  m.acc += m.hz * dt * (0.8 + rng() * 0.4);
  if (m.acc < 1) return { x: 0, y: 0, a: 0, b: 0 };
  m.acc -= 1;
  m.down = true;
  return { x: 0, y: 0, a: 1, b: 0 };
}
