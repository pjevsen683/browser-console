// Coin Grab: mønter regner ned i arenaen; man samler dem op ved at gå hen til dem. Bliver man skubbet (et A-skub, der
// rammer), taber man 30 % af sine mønter (mindst 2, højst 10) rundt om sig og kan ikke samle op i GUARD sekunder.
// Flest mønter efter ROUND vinder. Ren logik (test/coins.test.js).
export const ROUND = 60, MAX_COINS = 24, SPAWN = 0.45, PICK_R = 0.8, GUARD = 1, BIG = 5;
const DROP_FROM = 7, G = 14;

export function createCoins(ids, rng, { radius = 7 } = {}) {
  return { ids, rng, radius, coins: [], nextId: 1, scores: Object.fromEntries(ids.map((id) => [id, 0])), guard: {}, t: ROUND, acc: 0, over: false };
}

function inside(s, x, z) {
  const r = Math.hypot(x, z), lim = s.radius - 0.6;
  return r <= lim ? [x, z] : [(x / r) * lim, (z / r) * lim];
}

// Hændelser: spawn {coin}, pick {id, value, coin}, over.
export function update(s, dt, animals) {
  const ev = [];
  if (s.over) return ev;
  s.t -= dt;
  for (const id in s.guard) s.guard[id] = Math.max(0, s.guard[id] - dt);
  s.acc += dt;
  while (s.acc >= SPAWN) {
    s.acc -= SPAWN;
    if (s.coins.length >= MAX_COINS) continue;
    const r = Math.sqrt(s.rng()) * (s.radius - 0.8), a = s.rng() * Math.PI * 2;
    const coin = { id: s.nextId++, x: Math.cos(a) * r, z: Math.sin(a) * r, y: DROP_FROM, vy: 0, value: s.rng() < 0.1 ? BIG : 1 };
    s.coins.push(coin);
    ev.push({ type: 'spawn', coin });
  }
  for (const c of s.coins) {
    if (c.y <= 0 && c.vy === 0) continue;
    c.vy -= G * dt;
    c.y += c.vy * dt;
    if (c.y <= 0) { c.y = 0; c.vy = Math.abs(c.vy) > 3 ? Math.abs(c.vy) * 0.3 : 0; }   // et lille hop, så ligger den
  }
  for (const an of animals) {
    if (!an.alive || s.guard[an.id] > 0 || !(an.id in s.scores)) continue;
    for (let i = s.coins.length - 1; i >= 0; i--) {
      const c = s.coins[i];
      if (c.y > 0.8 || Math.hypot(c.x - an.x, c.z - an.z) > PICK_R) continue;
      s.coins.splice(i, 1);
      s.scores[an.id] += c.value;
      ev.push({ type: 'pick', id: an.id, value: c.value, coin: c });
    }
  }
  if (s.t <= 0) { s.over = true; ev.push({ type: 'over' }); }
  return ev;
}

// id blev skubbet ved (x, z): mønterne flyver ud omkring den.
export function bump(s, id, x, z) {
  const have = s.scores[id] ?? 0;
  const n = Math.min(have, Math.max(2, Math.ceil(have * 0.3)), 10);
  s.scores[id] = have - n;
  s.guard[id] = GUARD;
  const coins = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + s.rng() * 0.5, d = 1.3 + s.rng() * 1.2;
    const [cx, cz] = inside(s, x + Math.cos(a) * d, z + Math.sin(a) * d);
    const coin = { id: s.nextId++, x: cx, z: cz, y: 0.5, vy: 5, value: 1 };
    s.coins.push(coin);
    coins.push(coin);
  }
  return { dropped: n, coins };
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
