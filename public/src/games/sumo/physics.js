// Isflagen: dyr, der glider, skubber og falder i vandet. Ren logik uden three.js (test/sumo-physics.test.js).
// Koordinater: x mod højre, z mod kameraet (pindens y), meter og sekunder. face: retningen (sin face, cos face).
export const R0 = 6;              // flagens radius ved start
export const BODY = 0.55;         // dyrenes radius
export const SHRINK_AFTER = 20;   // sekunder, før isen begynder at smelte
const SHRINK_RATE = 0.1, R_MIN = 2.4;
const ACC = 9, DRAG = 0.9, VMAX = 6.5;
const DASH = 7, DASH_T = 0.25, PUSH_CD = 1.2, PUSH_BONUS = 5;
const RESTITUTION = 0.8, GRAVITY = 14, BLAME_S = 3;

export function arenaRadius(t) {
  return t <= SHRINK_AFTER ? R0 : Math.max(R_MIN, R0 - (t - SHRINK_AFTER) * SHRINK_RATE);
}

// walls: dyrene preller af kanten i stedet for at falde (Hot Potato); radius: fast radius (ingen smeltning).
export function createWorld(ids, rng = Math.random, { walls = false, radius = null } = {}) {
  const n = ids.length, r = n === 1 ? 0 : (radius ?? R0) * 0.6, off = rng() * Math.PI * 2;
  return {
    t: 0,
    radius: radius ?? R0,
    fixed: radius,
    walls,
    animals: ids.map((id, i) => {
      const ang = off + (i / n) * Math.PI * 2, x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      return { id, x, z, y: 0, vx: 0, vz: 0, vy: 0, face: Math.atan2(-x, -z), alive: true, cd: 0, dash: 0, mass: 1, lastHit: null };
    }),
  };
}

// speed: Map id -> faktor på acceleration og topfart (Hot Potato: bæreren er hurtigere).
export function step(w, inputs, dt, { speed } = {}) {
  const ev = [];
  w.t += dt;
  w.radius = w.fixed ?? arenaRadius(w.t);
  for (const a of w.animals) {
    if (!a.alive) {
      if (a.y > -4) { a.vy -= GRAVITY * dt; a.y += a.vy * dt; a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.97; a.vz *= 0.97; }
      continue;
    }
    const inp = inputs.get(a.id);
    const f = speed?.get(a.id) ?? 1;
    const ix = (inp?.x ?? 0) * f, iy = (inp?.y ?? 0) * f;
    a.cd = Math.max(0, a.cd - dt);
    a.dash = Math.max(0, a.dash - dt);
    a.vx += ix * ACC * dt;
    a.vz += iy * ACC * dt;
    const k = Math.exp(-DRAG * dt);
    a.vx *= k; a.vz *= k;
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > VMAX * f && a.dash === 0) { a.vx *= (VMAX * f) / sp; a.vz *= (VMAX * f) / sp; }
    if (Math.hypot(ix, iy) > 0.2) a.face = Math.atan2(ix, iy);
    if (inp?.aPressed && a.cd === 0) {
      a.vx += Math.sin(a.face) * DASH;
      a.vz += Math.cos(a.face) * DASH;
      a.cd = PUSH_CD;
      a.dash = DASH_T;
      ev.push({ type: 'push', id: a.id });
    }
    a.x += a.vx * dt;
    a.z += a.vz * dt;
  }
  collide(w, ev);
  if (w.walls) {
    const edge = w.radius - BODY;
    for (const a of w.animals) {
      const r = Math.hypot(a.x, a.z);
      if (!a.alive || r <= edge) continue;
      const nx = a.x / r, nz = a.z / r, out = a.vx * nx + a.vz * nz;
      a.x = nx * edge; a.z = nz * edge;
      if (out > 0) { a.vx -= 1.8 * out * nx; a.vz -= 1.8 * out * nz; }   // prel af med 80 % af farten
    }
    return ev;
  }
  for (const a of w.animals) {
    if (a.alive && Math.hypot(a.x, a.z) > w.radius) {
      a.alive = false;
      a.vy = 2;
      const by = a.lastHit && w.t - a.lastHit.t < BLAME_S ? a.lastHit.by : null;
      ev.push({ type: 'fall', id: a.id, by });
    }
  }
  return ev;
}

function collide(w, ev) {
  const live = w.animals.filter((a) => a.alive);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d >= BODY * 2) continue;
      const nx = d < 1e-6 ? 1 : dx / d, nz = d < 1e-6 ? 0 : dz / d;   // samme sted: skilles langs x
      const half = (BODY * 2 - d) / 2;
      a.x -= nx * half; a.z -= nz * half;
      b.x += nx * half; b.z += nz * half;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;           // < 0: på vej mod hinanden
      if (rel >= 0) continue;
      const imp = -(1 + RESTITUTION) * rel / (1 / a.mass + 1 / b.mass);
      a.vx -= imp * nx / a.mass; a.vz -= imp * nz / a.mass;
      b.vx += imp * nx / b.mass; b.vz += imp * nz / b.mass;
      const dasher = a.dash > 0 && b.dash > 0 ? null : a.dash > 0 ? a.id : b.dash > 0 ? b.id : null;   // Coin Grab: den, der skubbede
      if (a.dash > 0) { b.vx += nx * PUSH_BONUS; b.vz += nz * PUSH_BONUS; a.dash = 0; }
      if (b.dash > 0) { a.vx -= nx * PUSH_BONUS; a.vz -= nz * PUSH_BONUS; b.dash = 0; }
      a.lastHit = { by: b.id, t: w.t };
      b.lastHit = { by: a.id, t: w.t };
      ev.push({ type: 'hit', a: a.id, b: b.id, strength: -rel, dasher });
    }
  }
}
