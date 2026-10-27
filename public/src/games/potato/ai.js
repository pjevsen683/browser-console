// Bots i Hot Potato: bæreren jager (sumo/ai.js botInput); de andre flygter fra bæreren og svinger langs kanten,
// når de kommer ud til den, i stedet for at blive trængt op i den.
export function fleeInput(w, id, holderId) {
  const me = w.animals.find((a) => a.id === id), h = w.animals.find((a) => a.id === holderId);
  if (!me?.alive || !h) return { x: 0, y: 0, a: 0 };
  let ax = me.x - h.x, az = me.z - h.z;
  const d = Math.hypot(ax, az) || 1;
  ax /= d; az /= d;
  const r = Math.hypot(me.x, me.z);
  if (r < w.radius * 0.65 || r < 1e-6) return { x: ax, y: az, a: 0 };
  const tx = -me.z / r, tz = me.x / r, sign = ax * tx + az * tz < 0 ? -1 : 1;
  const x = tx * sign * 0.9 - (me.x / r) * 0.4, z = tz * sign * 0.9 - (me.z / r) * 0.4, n = Math.hypot(x, z);
  return { x: x / n, y: z / n, a: 0 };
}
