// Snowball Fight: snemarken, fortene, spillerne og sneboldene. Ren logik uden three.js (test/snowball.test.js).
// Koordinater som i Sumo: x mod højre, z mod kameraet (pindens y). Hold 0 (rød) har venstre halvdel, hold 1 (blå)
// højre; midterlinjen x = 0 kan ikke krydses.
export const HX = 11, HZ = 6, BODY = 0.55, BALL_R = 0.2;
export const CHARGE_T = 1, RANGE_MIN = 7, RANGE_MAX = 16, BALL_SPEED = 16, THROW_CD = 0.5;
export const DUCK_T = 0.8, DUCK_CD = 1.5;          // dukke i 0,8 s; ikke igen før 1,5 s efter
export const LIVES = 3;
const SPEED = 5, ACCEL = 10, AIM_CONE = (30 * Math.PI) / 180, MID = 0.3;

// Tre fort pr. hold, spejlet om midterlinjen.
const FORTS = [[-4, -2.6, 1], [-6.8, 1.6, 0.9], [-3.2, 3.6, 0.8]];

export function createField(players, rng = Math.random) {
  const forts = [];
  for (const [x, z, r] of FORTS) forts.push({ x, z, r }, { x: -x, z: -z, r });
  const byTeam = [[], []];
  for (const p of players) byTeam[p.team].push(p);
  const out = [];
  byTeam.forEach((list, team) => list.forEach((p, i) => {
    const n = list.length, z = n === 1 ? 0 : -HZ + 1.2 + ((HZ * 2 - 2.4) * i) / (n - 1);
    const x = (team === 0 ? -1 : 1) * (8.5 + (i % 2) * 1.2 + rng() * 0.3);
    out.push({ id: p.id, team, x, z, vx: 0, vz: 0, face: team === 0 ? Math.PI / 2 : -Math.PI / 2,
      hits: 0, out: false, duck: 0, duckCd: 0, charge: 0, charging: false, cd: 0 });
  }));
  return { hx: HX, hz: HZ, forts, players: out, balls: [], nextBall: 0 };
}

// Den modstander, der er nærmest kasteretningen (inden for AIM_CONE); ellers null.
function aimAt(f, p) {
  let best = null, ba = AIM_CONE;
  for (const o of f.players) {
    if (o.team === p.team || o.out) continue;
    const a = Math.abs(angleDiff(Math.atan2(o.x - p.x, o.z - p.z), p.face));
    if (a <= ba) { ba = a; best = o; }
  }
  return best;
}

const angleDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function throwBall(f, p, ev) {
  const t = aimAt(f, p);
  let dx = Math.sin(p.face), dz = Math.cos(p.face);
  if (t) { const d = Math.hypot(t.x - p.x, t.z - p.z) || 1; dx = (t.x - p.x) / d; dz = (t.z - p.z) / d; }
  const range = RANGE_MIN + (RANGE_MAX - RANGE_MIN) * p.charge;
  const off = BODY + BALL_R + 0.05;
  f.balls.push({ id: f.nextBall++, by: p.id, team: p.team, x: p.x + dx * off, z: p.z + dz * off,
    vx: dx * BALL_SPEED, vz: dz * BALL_SPEED, range, flown: 0 });
  p.charge = 0; p.charging = false; p.cd = THROW_CD;
  ev.push({ type: 'throw', id: p.id });
}

// inputs: Map id -> {x, y, a (holdt), bPressed}. Hændelser: throw {id}, duck {id}, hit {id, by, out, x, z},
// block {ball, fort}, land {ball}.
export function step(f, inputs, dt) {
  const ev = [];
  for (const p of f.players) {
    const inp = inputs.get(p.id) ?? {};
    p.cd = Math.max(0, p.cd - dt);
    p.duck = Math.max(0, p.duck - dt);
    p.duckCd = Math.max(0, p.duckCd - dt);
    let tx = 0, tz = 0;
    if (!p.out) {
      if (inp.bPressed && p.duckCd === 0) {
        p.duck = DUCK_T; p.duckCd = DUCK_T + DUCK_CD; p.charge = 0; p.charging = false;
        ev.push({ type: 'duck', id: p.id });
      }
      if (p.duck === 0) {
        const ix = inp.x ?? 0, iz = inp.y ?? 0, m = Math.min(1, Math.hypot(ix, iz));
        if (m > 0.05) { tx = (ix / Math.hypot(ix, iz)) * m * SPEED; tz = (iz / Math.hypot(ix, iz)) * m * SPEED; }
        if (m > 0.2) p.face = Math.atan2(ix, iz);
        if (inp.a && p.cd === 0) { p.charging = true; p.charge = Math.min(1, p.charge + dt / CHARGE_T); }
        else if (!inp.a && p.charging) throwBall(f, p, ev);
      }
    }
    const k = 1 - Math.exp(-(p.duck > 0 || p.out ? 20 : ACCEL) * dt);
    p.vx += (tx - p.vx) * k;
    p.vz += (tz - p.vz) * k;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
  }
  separate(f);
  for (const p of f.players) clamp(f, p);
  flyBalls(f, dt, ev);
  return ev;
}

function separate(f) {
  const ps = f.players.filter((p) => !p.out);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= BODY * 2) continue;
    const nx = d < 1e-6 ? 0 : dx / d, nz = d < 1e-6 ? 1 : dz / d, half = (BODY * 2 - d) / 2;
    a.x -= nx * half; a.z -= nz * half;
    b.x += nx * half; b.z += nz * half;
  }
}

function clamp(f, p) {
  for (const o of f.forts) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + BODY;
    if (d >= min) continue;
    const nx = d < 1e-6 ? 1 : dx / d, nz = d < 1e-6 ? 0 : dz / d;
    p.x = o.x + nx * min; p.z = o.z + nz * min;
  }
  const lo = p.team === 0 ? -f.hx + BODY : MID + BODY, hi = p.team === 0 ? -MID - BODY : f.hx - BODY;
  if (p.x < lo) { p.x = lo; p.vx = Math.max(0, p.vx); }
  if (p.x > hi) { p.x = hi; p.vx = Math.min(0, p.vx); }
  const mz = f.hz - BODY;
  if (Math.abs(p.z) > mz) { p.z = Math.sign(p.z) * mz; p.vz = 0; }
}

function flyBalls(f, dt, ev) {
  for (let i = f.balls.length - 1; i >= 0; i--) {
    const b = f.balls[i];
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.flown += BALL_SPEED * dt;
    let gone = false;
    for (const p of f.players) {
      if (p.team === b.team || p.out || p.duck > 0) continue;
      if (Math.hypot(p.x - b.x, p.z - b.z) > BODY + BALL_R) continue;
      p.hits++;
      if (p.hits >= LIVES) { p.out = true; p.charging = false; p.charge = 0; }
      ev.push({ type: 'hit', id: p.id, by: b.by, out: p.out, x: b.x, z: b.z });
      gone = true;
      break;
    }
    if (!gone) {
      const fort = f.forts.find((o) => Math.hypot(o.x - b.x, o.z - b.z) < o.r + BALL_R);
      if (fort) { ev.push({ type: 'block', ball: b, fort }); gone = true; }
    }
    if (!gone && (b.flown >= b.range || Math.abs(b.x) > f.hx + 2 || Math.abs(b.z) > f.hz + 2)) {
      ev.push({ type: 'land', ball: b });
      gone = true;
    }
    if (gone) f.balls.splice(i, 1);
  }
}
