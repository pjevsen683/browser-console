// Bilerne i Mini Racers set oppefra. Pinden peger, hvor bilen skal hen (den drejer mod retningen), A speeder, B
// bremser og bakker. Bilen glider lidt i sving (sidefarten dør ud med vejgrebet). Uden for vejen er dugen: lavere
// topfart, mindre greb. Over bordkanten: falder, og står på vejen igen efter FALL_TIME. Mere end LOST_D fra vejen
// (inde midt på bordet): "væk" og tilbage på vejen på samme måde -- ellers kunne man skære genvej over dugen. p er
// fremdriften langs banen (vokser over omgangene). Ren logik (test/racer.test.js).
export const CAR_R = 0.6, FALL_TIME = 1.5, MAX = 15, LOST_D = 10;
const ACC = 16, BRAKE = 24, REV_MAX = 5, MAX_OFF = 7, SLOW = 25, DRAG = 0.35, ROLL = 3, TURN = 3.4, GRIP = 7, GRIP_OFF = 2.5;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createCars(ids, track) {
  return ids.map((id) => ({ id, x: 0, z: 0, h: 0, vx: 0, vz: 0, s: 0, p: 0, d: 0, fallT: 0, lost: false, out: false, off: false }));
}

// Startgitter: rækker af 4 på tværs af vejen bag p0, i rækkefølgen order (de første forrest).
export function placeGrid(cars, track, p0, order = cars.map((c) => c.id)) {
  const sorted = [...cars].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  sorted.forEach((c, i) => {
    const row = Math.floor(i / 4), lane = i % 4, p = p0 - 1.5 - row * 2.4;
    const q = track.at(p), d = (lane - 1.5) * 1.8;
    Object.assign(c, { x: q.x + q.nx * d, z: q.z + q.nz * d, h: Math.atan2(q.tx, q.tz), vx: 0, vz: 0, s: track.wrap(p), p, d, fallT: 0, lost: false, out: false, off: false });
  });
}

// Hændelser: fall {id}, lost {id}, respawn {id}, bump {a, b, speed}, hit {id, speed}.
export function step(cars, track, inputs, dt) {
  const ev = [], L = track.length, T = track.table;
  for (const c of cars) {
    if (c.out) continue;
    if (c.fallT > 0) {
      c.fallT -= dt;
      if (c.fallT > 0) continue;
      const q = track.at(c.s);
      Object.assign(c, { fallT: 0, lost: false, x: q.x, z: q.z, h: Math.atan2(q.tx, q.tz), vx: 0, vz: 0, d: 0, off: false });
      ev.push({ type: 'respawn', id: c.id });
      continue;
    }
    const inp = inputs.get(c.id) ?? {};
    let fx = Math.sin(c.h), fz = Math.cos(c.h);
    const f0 = c.vx * fx + c.vz * fz;
    const sx = inp.x ?? 0, sy = inp.y ?? 0;
    if (Math.hypot(sx, sy) > 0.3) {
      const dh = wrapAngle(Math.atan2(sx, sy) - c.h), rate = TURN * (0.35 + 0.65 * Math.min(1, Math.abs(f0) / 6)) * dt;
      c.h = wrapAngle(c.h + Math.max(-rate, Math.min(rate, dh)));
      fx = Math.sin(c.h); fz = Math.cos(c.h);
    }
    const rx = -fz, rz = fx;
    let f = c.vx * fx + c.vz * fz, side = c.vx * rx + c.vz * rz;
    if (inp.a) f += (f < 0 ? ACC + BRAKE : ACC) * dt;
    if (inp.b) f = f > 0.5 ? f - BRAKE * dt : Math.max(-REV_MAX, f - ACC * 0.5 * dt);
    f -= f * DRAG * dt;
    if (!inp.a && !inp.b) f -= Math.sign(f) * Math.min(Math.abs(f), ROLL * dt);
    const max = c.off ? MAX_OFF : MAX;
    if (f > max) f = Math.max(max, f - SLOW * dt);
    side *= Math.exp(-(c.off ? GRIP_OFF : GRIP) * dt);
    c.vx = fx * f + rx * side;
    c.vz = fz * f + rz * side;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    if (Math.abs(c.x - T.cx) > T.hx || Math.abs(c.z - T.cz) > T.hz) {
      c.fallT = FALL_TIME;
      ev.push({ type: 'fall', id: c.id });
      continue;
    }
    const m = track.nearest(c.x, c.z, c.s);
    if (Math.abs(m.d) > LOST_D) {
      c.fallT = FALL_TIME;
      c.lost = true;
      ev.push({ type: 'lost', id: c.id });
      continue;
    }
    let ds = m.s - c.s;
    if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
    const most = Math.hypot(c.vx, c.vz) * dt + 0.2;     // nearest kan glide langs banen, når bilen er ude på dugen
    ds = Math.max(-most, Math.min(most, ds));
    c.p += ds;
    c.s = m.s;
    c.d = m.d;
    c.off = Math.abs(m.d) > track.width / 2;
  }
  collide(cars, track, ev);
  return ev;
}

function collide(cars, track, ev) {
  const live = cars.filter((c) => !c.out && c.fallT <= 0);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
      if (dist >= CAR_R * 2) continue;
      const nx = dist < 1e-6 ? 1 : dx / dist, nz = dist < 1e-6 ? 0 : dz / dist, half = (CAR_R * 2 - dist) / 2;
      a.x -= nx * half; a.z -= nz * half; b.x += nx * half; b.z += nz * half;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel >= 0) continue;
      const imp = -0.75 * rel;
      a.vx -= imp * nx; a.vz -= imp * nz; b.vx += imp * nx; b.vz += imp * nz;
      if (-rel > 2) ev.push({ type: 'bump', a: a.id, b: b.id, speed: -rel });
    }
  }
  for (const c of live) {
    for (const o of track.props) {
      const dx = c.x - o.x, dz = c.z - o.z, dist = Math.hypot(dx, dz), min = o.r + CAR_R;
      if (dist >= min) continue;
      const nx = dist < 1e-6 ? 1 : dx / dist, nz = dist < 1e-6 ? 0 : dz / dist;
      c.x = o.x + nx * min; c.z = o.z + nz * min;
      const vn = c.vx * nx + c.vz * nz;
      if (vn >= 0) continue;
      c.vx -= 1.4 * vn * nx; c.vz -= 1.4 * vn * nz;
      if (-vn > 1.5) ev.push({ type: 'hit', id: c.id, speed: -vn });
    }
  }
}
