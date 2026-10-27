// Racerne i Penguin Race i banens koordinater (s langs, d på tværs). Ned ad bakke giver fart, pinden styrer, A hopper.
// Ud over kanten: tilbage midt på banen efter FALL_TIME. Mere end OUT_GAP bag føreren: ude. Ren logik.
export const OUT_GAP = 20, FALL_TIME = 1.2;   // 20 m: så den sidste stadig er i billedet
const GRAV = 6, DRAG = 0.35, STEER = 14, VD_MAX = 6, JUMP = 5.5, G = 14, FISH = 4, BODY = 0.55;

export function createRace(ids, track) {
  const lanes = 4, gap = track.width / (lanes + 0.5);
  return {
    t: 0,
    racers: ids.map((id, i) => ({
      id, s: 6 - Math.floor(i / lanes) * 1.6, d: ((i % lanes) - (lanes - 1) / 2) * gap,
      vs: 0, vd: 0, y: 0, vy: 0, out: false, outT: null, finished: false, finishT: null, fallT: 0,
      fish: new Set(), lastObs: -1,
    })),
  };
}

const active = (a) => !a.out && !a.finished;

export function step(race, track, inputs, dt) {
  const ev = [], half = track.width / 2;
  race.t += dt;
  for (const a of race.racers) {
    if (a.finished) { a.s += a.vs * dt; a.vs *= Math.exp(-1.5 * dt); continue; }   // glider videre og bremser
    if (!active(a)) continue;
    if (a.fallT > 0) {
      a.fallT -= dt;
      a.y = -1.2;
      if (a.fallT > 0) continue;
      Object.assign(a, { fallT: 0, d: 0, vd: 0, y: 0, vy: 0, vs: 2 });
    }
    const inp = inputs.get(a.id);
    a.vs += (GRAV - DRAG * a.vs) * dt;
    a.vd += (inp?.x ?? 0) * STEER * dt;
    a.vd *= Math.exp(-3 * dt);
    a.vd = Math.max(-VD_MAX, Math.min(VD_MAX, a.vd));
    if (inp?.aPressed && a.y === 0) { a.vy = JUMP; ev.push({ type: 'jump', id: a.id }); }
    if (a.y > 0 || a.vy > 0) {
      a.vy -= G * dt;
      a.y += a.vy * dt;
      if (a.y <= 0) { a.y = 0; a.vy = 0; }
    }
    a.s += a.vs * dt;
    a.d += a.vd * dt;
    if (a.y === 0 && Math.abs(a.d) > half) {
      a.fallT = FALL_TIME;
      a.vs *= 0.3;
      ev.push({ type: 'fall', id: a.id });
      continue;
    }
    if (a.y === 0) {
      track.obstacles.forEach((o, i) => {
        if (i === a.lastObs || Math.abs(a.s - o.s) > o.r + 0.4 || Math.abs(a.d - o.d) > o.r + 0.4) return;
        a.lastObs = i;
        a.vs *= 0.35;
        a.vd += a.d >= o.d ? 2 : -2;
        ev.push({ type: 'bump', id: a.id });
      });
    }
    if (a.y < 1) {
      track.fish.forEach((f, i) => {
        if (a.fish.has(i) || Math.abs(a.s - f.s) > 1 || Math.abs(a.d - f.d) > 1) return;
        a.fish.add(i);
        a.vs += FISH;
        ev.push({ type: 'fish', id: a.id, i });
      });
    }
    if (a.s >= track.finish) { a.finished = true; a.finishT = race.t; ev.push({ type: 'finish', id: a.id }); }
  }
  collide(race);
  const live = race.racers.filter(active);
  const lead = Math.max(...live.map((a) => a.s));
  for (const a of live) {
    if (lead - a.s > OUT_GAP) { a.out = true; a.outT = race.t; ev.push({ type: 'out', id: a.id }); }
  }
  return ev;
}

function collide(race) {
  const live = race.racers.filter((a) => active(a) && a.fallT === 0 && a.y < 0.6);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const ds = b.s - a.s, dd = b.d - a.d, dist = Math.hypot(ds, dd);
      if (dist >= BODY * 2) continue;
      const ns = dist < 1e-6 ? 0 : ds / dist, nd = dist < 1e-6 ? 1 : dd / dist, half = (BODY * 2 - dist) / 2;
      a.s -= ns * half; a.d -= nd * half; b.s += ns * half; b.d += nd * half;
      const rel = (b.vs - a.vs) * ns + (b.vd - a.vd) * nd;
      if (rel >= 0) continue;
      const imp = -0.75 * rel;
      a.vs -= imp * ns; a.vd -= imp * nd; b.vs += imp * ns; b.vd += imp * nd;
    }
  }
}
