// Bomber King (1 mod alle): én er bombemand over øen og flytter et sigte med pinden; A smider en bombe, som springer
// efter WARN. De andre undviger (og kan skubbe hinanden i vandet). Bombemanden får HIT_POINTS pr. undviger, der er
// ude; hver undviger, der overlever runden, får 1 (der er mange flere undvigere end bombemænd). Alle er bombemand én gang. Ren logik (test/bomber.test.js).
export const COUNTDOWN = 2, BREAK = 3, WARN = 1.1, BLAST = 1.7, COOLDOWN = 0.7, AIM_SPEED = 9, HIT_POINTS = 2;
export const roundTime = (n) => (n <= 4 ? 30 : n <= 8 ? 25 : 20);

export function createBomber(ids, rng, { radius = 7 } = {}) {
  const bosses = [...ids];
  for (let i = bosses.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [bosses[i], bosses[j]] = [bosses[j], bosses[i]]; }
  const s = { ids, rng, radius, bosses, round: 0, points: Object.fromEntries(ids.map((id) => [id, 0])), hits: Object.fromEntries(ids.map((id) => [id, 0])), over: false };
  setup(s);
  return s;
}

function setup(s) {
  s.boss = s.bosses[s.round];
  s.dodgers = s.ids.filter((id) => id !== s.boss);
  s.out = [];
  s.bombs = [];
  s.aim = { x: 0, z: 0 };
  s.cd = 0;
  s.nextId = 1;
  s.phase = 'countdown';
  s.t = COUNTDOWN;
}

export function aim(s, inp, dt) {
  const r = s.radius - 0.5;
  s.aim.x += (inp?.x ?? 0) * AIM_SPEED * dt;
  s.aim.z += (inp?.y ?? 0) * AIM_SPEED * dt;
  const d = Math.hypot(s.aim.x, s.aim.z);
  if (d > r) { s.aim.x *= r / d; s.aim.z *= r / d; }
}

export function drop(s) {
  if (s.phase !== 'play' || s.cd > 0) return false;
  s.bombs.push({ id: s.nextId++, x: s.aim.x, z: s.aim.z, t: WARN });
  s.cd = COOLDOWN;
  return true;
}

// En undviger er ude (ramt af en bombe eller faldet i vandet).
export function hit(s, id) {
  if (s.phase !== 'play' || !s.dodgers.includes(id) || s.out.includes(id)) return false;
  s.out.push(id);
  s.points[s.boss] += HIT_POINTS;
  s.hits[s.boss]++;
  return true;
}

// animals: [{ id, x, z, alive }]. Hændelser: start, boom {bomb, out}, roundEnd {survivors}, next, over.
export function update(s, dt, animals) {
  const ev = [];
  if (s.over) return ev;
  s.t -= dt;
  if (s.phase === 'countdown') {
    if (s.t <= 0) { s.phase = 'play'; s.t = roundTime(s.ids.length); ev.push({ type: 'start' }); }
    return ev;
  }
  if (s.phase === 'play') {
    s.cd = Math.max(0, s.cd - dt);
    for (let i = s.bombs.length - 1; i >= 0; i--) {
      const b = s.bombs[i];
      if ((b.t -= dt) > 0) continue;
      s.bombs.splice(i, 1);
      const out = animals.filter((a) => a.alive && Math.hypot(a.x - b.x, a.z - b.z) <= BLAST && hit(s, a.id)).map((a) => a.id);
      ev.push({ type: 'boom', bomb: b, out });
    }
    if (s.out.length >= s.dodgers.length || s.t <= 0) {
      const survivors = s.dodgers.filter((id) => !s.out.includes(id));
      survivors.forEach((id) => { s.points[id]++; });
      s.bombs = [];
      s.phase = 'break';
      s.t = BREAK;
      ev.push({ type: 'roundEnd', survivors });
    }
    return ev;
  }
  if (s.phase === 'break' && s.t <= 0) {
    s.round++;
    if (s.round >= s.bosses.length) { s.over = true; s.phase = 'over'; ev.push({ type: 'over' }); return ev; }
    setup(s);
    ev.push({ type: 'next' });
  }
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.points[b] - s.points[a] || s.hits[b] - s.hits[a]);
}
