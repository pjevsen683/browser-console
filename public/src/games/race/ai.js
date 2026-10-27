// En bot i Penguin Race: efter den nærmeste fisk forude, hop over (eller uden om) sneklumper, og hold dig fra kanten.
export function botRace(race, track, id) {
  const me = race.racers.find((a) => a.id === id);
  if (!me || me.out || me.finished || me.fallT > 0) return { x: 0, y: 0, a: 0 };
  const half = track.width / 2;
  let target = 0, a = 0, best = Infinity;
  for (const f of track.fish) {
    const ahead = f.s - me.s;
    if (ahead > 0.5 && ahead < 15 && ahead < best) { best = ahead; target = f.d; }
  }
  for (const o of track.obstacles) {
    const ahead = o.s - me.s;
    if (ahead <= 0 || ahead > 8 || Math.abs(o.d - me.d) > o.r + 0.9) continue;
    if (ahead < 2.5 && me.y === 0) a = 1;
    else target = me.d + (me.d >= o.d ? 2 : -2);
  }
  target = Math.max(-(half - 1.2), Math.min(half - 1.2, target));
  return { x: Math.max(-1, Math.min(1, (target - me.d) * 0.8)), y: 0, a };
}
