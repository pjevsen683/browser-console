// Dance Beat: alle danser samme koreografi, og hver spiller bedømmes for sig. Et tryk rammer den nærmeste ubedømte pil
// i banen inden for GOOD; et tryk uden pil bryder kæden; en pil, der passerer, er Miss -- først LATE efter Good-vinduet,
// for et tryk stemplet i tide kan stadig være undervejs over wifi. Tryk før den første pil ignoreres. Tiden er
// sangens tid i sekunder. Ren logik (test/dance.test.js).
import { makeChart, judge, multiplier, GOOD, LATE, LEAD_IN } from './chart.js';

export { LEAD_IN };
const END_PAD = 1.5;                                  // sangen er "slut" så længe efter sidste pil

export function createDance(ids, song, rng) {
  const notes = makeChart(song.beats, rng);
  const players = Object.fromEntries(ids.map((id) => {
    const p = { score: 0, combo: 0, best: 0, hits: { perfect: 0, great: 0, good: 0, miss: 0 }, done: new Set(), next: 0, offsets: [] };
    p.offsetMs = () => (p.offsets.length ? (p.offsets.reduce((a, b) => a + b, 0) / p.offsets.length) * 1000 : null);
    return [id, p];
  }));
  return { ids, song, notes, players, end: (notes.at(-1)?.t ?? 0) + END_PAD, over: false };
}

// Resultat: { kind: 'perfect' | 'great' | 'good' | 'stray' | 'ignored', points?, combo? }.
export function tap(s, id, lane, t) {
  const p = s.players[id];
  if (!p || s.over || !s.notes.length || t < s.notes[0].t - GOOD) return { kind: 'ignored' };
  let best = -1, bd = Infinity;
  for (let i = p.next; i < s.notes.length; i++) {
    const n = s.notes[i];
    if (n.t - t > GOOD) break;
    if (n.lane !== lane || p.done.has(i)) continue;
    const d = Math.abs(t - n.t);
    if (d <= GOOD && d < bd) { bd = d; best = i; }
  }
  if (best < 0) { p.combo = 0; return { kind: 'stray' }; }
  const r = judge(t - s.notes[best].t);
  p.done.add(best);
  p.combo++;
  p.best = Math.max(p.best, p.combo);
  p.hits[r.kind]++;
  p.offsets.push(t - s.notes[best].t);
  const points = Math.round(r.points * multiplier(p.combo));
  p.score += points;
  return { kind: r.kind, points, combo: p.combo };
}

// Hændelser: miss {id, lane}, over.
export function update(s, t) {
  const ev = [];
  if (s.over) return ev;
  for (const id of s.ids) {
    const p = s.players[id];
    while (p.next < s.notes.length && s.notes[p.next].t + GOOD + LATE < t) {
      if (!p.done.has(p.next)) { p.combo = 0; p.hits.miss++; ev.push({ type: 'miss', id, lane: s.notes[p.next].lane }); }
      p.next++;
    }
  }
  if (t >= s.end) { s.over = true; ev.push({ type: 'over' }); }
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.players[b].score - s.players[a].score || s.players[b].best - s.players[a].best);
}

// Trykkets tid i konsollens ur (ms): telefonens stempel (konsollens ur minus mindste envejs-forsinkelse) plus halv
// ping-tid. Stemplet er aldrig senere end det rigtige tidspunkt (uret er målt med den mindste forsinkelse), så et
// wifi-ryk gør det kun ældre; det gælder, til det er ping-tiden + 0,5 s gammelt. Uden brugbart stempel (mangler, fra
// fremtiden, ældre end det): ankomsttiden minus halv ping-tid.
export function tapTime(msg, arrival, rtt) {
  const half = Number.isFinite(rtt) ? rtt / 2 : 0, slack = Math.max(Number.isFinite(rtt) ? rtt : 0, 100) + 500;
  if (Number.isFinite(msg.at) && msg.at <= arrival && arrival - msg.at <= slack) return Math.min(arrival, msg.at + half);
  return arrival - half;
}
