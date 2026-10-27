// Cat Chaos: mormors lange spisebord med katte og ting. Ren logik uden three.js (test/cats.test.js).
// Samme idé som Kattekaos' physics.js (cirkler på et rektangel, én tyngdekonstant), men i konsollens mål: et dyr
// er 0,55 m i radius, så bordet er 16 x 8 m. Koordinater som i Sumo: x mod højre, z mod kameraet (pindens y).
// Mormor sidder ved den fjerne kant (-z); kattene starter ved den nære (+z).
export const HX = 8, HZ = 4, TOP = 2.6;     // bordets halve bredde og dybde, højden til gulvet
export const CAT_R = 0.55;
export const STILL = 0.6;                   // m/s: hurtigere end det, og man er i bevægelse
const SPEED = 4.2, ACCEL = 9, GRAVITY = 14, FRICTION = 2.5;
const PAW = 0.55, PAW_REACH = 0.75, CONE = Math.cos(1.2), SWAT_CD = 0.45, SWAT_POWER = 7, CAT_SHOVE = 5;

// h: højde i meter (modellen skaleres til den); værdierne er Kattekaos'.
export const CATALOG = {
  mug:    { h: 0.8, r: 0.42, mass: 0.6, breaks: true,  value: 100 },
  cactus: { h: 1.0, r: 0.45, mass: 0.9, breaks: true,  value: 150 },
  books:  { h: 0.8, r: 0.7,  mass: 2.0, breaks: false, value: 80 },
  clock:  { h: 1.0, r: 0.45, mass: 0.8, breaks: true,  value: 200 },
  teapot: { h: 1.0, r: 0.55, mass: 1.2, breaks: true,  value: 250 },
  vase:   { h: 1.9, r: 0.45, mass: 1.0, breaks: true,  value: 300 },
  globe:  { h: 1.6, r: 0.55, mass: 1.3, breaks: false, value: 200 },
  lamp:   { h: 1.8, r: 0.55, mass: 1.4, breaks: true,  value: 250 },
  cake:   { h: 0.8, r: 0.7,  mass: 1.1, breaks: true,  value: 400 },
  robot:  { h: 1.1, r: 0.4,  mass: 0.7, breaks: false, value: 150 },
  piggy:  { h: 0.8, r: 0.5,  mass: 1.0, breaks: true,  value: 350 },
  trophy: { h: 1.5, r: 0.45, mass: 2.4, breaks: false, value: 500 },
  yarn:   { h: 0.7, r: 0.45, mass: 0.4, breaks: false, value: 60 },
};

export function createItem({ id, kind, x, z }) {
  const c = CATALOG[kind];
  return { id, kind, ...c, x, z, y: 0, vx: 0, vz: 0, vy: 0, spin: 0, yaw: 0, tilt: 0, state: 'table', by: null };
}

// Kattene på række ved den nære kant.
export function createWorld(ids, items) {
  const n = ids.length, span = (HX - 1) * 2;
  const cats = ids.map((id, i) => ({
    id, x: n === 1 ? 0 : -span / 2 + (span * i) / (n - 1), z: HZ - 0.9, vx: 0, vz: 0, face: Math.PI,
    r: CAT_R, cd: 0, stun: 0, swatT: 0,
  }));
  return { hx: HX, hz: HZ, top: TOP, cats, items };
}

// Hændelser: swat {id}, bump {a, b, strength}, fall {item, by}, crash|thud {item}.
export function step(w, inputs, dt) {
  const ev = [];
  for (const c of w.cats) {
    const inp = inputs.get(c.id);
    c.cd = Math.max(0, c.cd - dt);
    c.swatT = Math.max(0, c.swatT - dt);
    let tx = 0, tz = 0;
    if (c.stun > 0) c.stun = Math.max(0, c.stun - dt);
    else if (inp) {
      const ix = inp.x ?? 0, iz = inp.y ?? 0, m = Math.min(1, Math.hypot(ix, iz));
      if (m > 0.05) { tx = (ix / Math.hypot(ix, iz)) * m * SPEED; tz = (iz / Math.hypot(ix, iz)) * m * SPEED; }
      if (m > 0.2) c.face = Math.atan2(ix, iz);
      if (inp.aPressed && c.cd === 0) { swat(w, c); ev.push({ type: 'swat', id: c.id }); }
    }
    const k = 1 - Math.exp(-(c.stun > 0 ? 14 : ACCEL) * dt);
    c.vx += (tx - c.vx) * k;
    c.vz += (tz - c.vz) * k;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
  }
  bumpCats(w, ev);
  for (const c of w.cats) {                 // katten er sikker på benene: den går til kanten, aldrig ud over
    const mx = w.hx - c.r * 0.6, mz = w.hz - c.r * 0.6;
    if (Math.abs(c.x) > mx) { c.x = Math.sign(c.x) * mx; c.vx = 0; }
    if (Math.abs(c.z) > mz) { c.z = Math.sign(c.z) * mz; c.vz = 0; }
  }
  const onTable = w.items.filter((i) => i.state === 'table' && i.y === 0);
  for (const c of w.cats) shove(c, onTable);
  knock(onTable);
  move(w, dt, ev);
  return ev;
}

// Poten: ting og katte foran katten inden for rækkevidde.
function swat(w, c) {
  c.cd = SWAT_CD;
  c.swatT = 0.25;
  const fx = Math.sin(c.face), fz = Math.cos(c.face), px = c.x + fx * PAW, pz = c.z + fz * PAW;
  const inFront = (o) => {
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
    return Math.hypot(o.x - px, o.z - pz) <= PAW_REACH + o.r && (d < 1e-6 || (dx * fx + dz * fz) / d >= CONE);
  };
  for (const it of w.items) {
    if (it.state !== 'table' || !inFront(it)) continue;
    const dx = it.x - px, dz = it.z - pz, d = Math.hypot(dx, dz);
    const nx = d > 1e-6 ? dx / d : fx, nz = d > 1e-6 ? dz / d : fz;
    const dirx = fx * 0.7 + nx * 0.3, dirz = fz * 0.7 + nz * 0.3, n = Math.hypot(dirx, dirz);
    const v = SWAT_POWER / Math.sqrt(it.mass);
    it.vx += (dirx / n) * v;
    it.vz += (dirz / n) * v;
    it.spin += (it.x - c.x > 0 ? 1 : -1) * 6;
    it.by = c.id;
  }
  for (const o of w.cats) {
    if (o === c || !inFront(o)) continue;
    o.vx += fx * CAT_SHOVE;
    o.vz += fz * CAT_SHOVE;
  }
}

function bumpCats(w, ev) {
  const cs = w.cats;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
    if (d >= min) continue;
    const nx = d < 1e-6 ? 1 : dx / d, nz = d < 1e-6 ? 0 : dz / d, half = (min - d) / 2;
    a.x -= nx * half; a.z -= nz * half;
    b.x += nx * half; b.z += nz * half;
    const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rel >= 0) continue;
    const j2 = -(1 + 0.6) * rel / 2;
    a.vx -= j2 * nx; a.vz -= j2 * nz;
    b.vx += j2 * nx; b.vz += j2 * nz;
    if (-rel > 1.5) ev.push({ type: 'bump', a: a.id, b: b.id, strength: -rel });
  }
}

// En kat, der går ind i en ting, skubber den foran sig og får æren.
function shove(c, items) {
  for (const it of items) {
    const dx = it.x - c.x, dz = it.z - c.z, d = Math.hypot(dx, dz), min = it.r + c.r;
    if (d >= min || d < 1e-6) continue;
    const nx = dx / d, nz = dz / d;
    it.x = c.x + nx * min;
    it.z = c.z + nz * min;
    const push = c.vx * nx + c.vz * nz;
    if (push <= 0) continue;
    const want = push * 1.1, cur = it.vx * nx + it.vz * nz;
    if (cur < want) { it.vx += nx * (want - cur); it.vz += nz * (want - cur); }
    it.by = c.id;
  }
}

// Ting mod ting; den hurtigste giver æren videre til den, den rammer.
function knock(items) {
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const A = items[a], B = items[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = A.r + B.r;
    if (d >= min || d < 1e-6) continue;
    const nx = dx / d, nz = dz / d, overlap = min - d;
    const wa = B.mass / (A.mass + B.mass), wb = A.mass / (A.mass + B.mass);
    A.x -= nx * overlap * wa; A.z -= nz * overlap * wa;
    B.x += nx * overlap * wb; B.z += nz * overlap * wb;
    const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
    if (rel >= 0) continue;
    const fast = Math.hypot(A.vx, A.vz) >= Math.hypot(B.vx, B.vz) ? A : B;
    if (fast.by !== null) (fast === A ? B : A).by = fast.by;
    const j = (-(1 + 0.4) * rel) / (1 / A.mass + 1 / B.mass);
    A.vx -= (j / A.mass) * nx; A.vz -= (j / A.mass) * nz;
    B.vx += (j / B.mass) * nx; B.vz += (j / B.mass) * nz;
  }
}

function move(w, dt, ev) {
  const damp = Math.exp(-FRICTION * dt);
  for (const it of w.items) {
    if (it.state === 'table' && it.y > 0) {          // en ny ting, der falder ned på bordet
      it.vy -= GRAVITY * dt;
      it.y = Math.max(0, it.y + it.vy * dt);
      if (it.y === 0) it.vy = 0;
    } else if (it.state === 'table') {
      it.x += it.vx * dt; it.z += it.vz * dt;
      it.vx *= damp; it.vz *= damp;
      it.yaw += it.spin * dt; it.spin *= damp;
      if (Math.abs(it.x) > w.hx || Math.abs(it.z) > w.hz) {
        it.state = 'falling';
        const ox = Math.abs(it.x) > w.hx ? Math.sign(it.x) : 0, oz = Math.abs(it.z) > w.hz ? Math.sign(it.z) : 0;
        if (ox && Math.abs(it.vx) < 2) it.vx = ox * 2;           // ud over kanten: fortsæt udad og vip
        if (oz && Math.abs(it.vz) < 2) it.vz = oz * 2;
        ev.push({ type: 'fall', item: it, by: it.by });
      }
    } else if (it.state === 'falling') {
      it.vy -= GRAVITY * dt;
      it.x += it.vx * dt; it.z += it.vz * dt; it.y += it.vy * dt;
      it.tilt = Math.min(Math.PI / 2, it.tilt + 6 * dt);
      it.yaw += it.spin * dt;
      if (w.top + it.y <= 0) {
        it.y = -w.top;
        it.state = 'floor';
        it.tilt = Math.PI / 2;               // lander på siden
        ev.push({ type: it.breaks ? 'crash' : 'thud', item: it });
      }
    }
  }
}
