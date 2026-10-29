// Botten i Tower Stack: vælger for hver klods et lille sigtefejl (større jo højere tårnet er) og trykker A, når den
// glidende klods er der. Sigtet holdes inden for klodsens bane (ellers kom den aldrig). Holder A, til klodsen er tabt,
// så spillerlistens latch giver ét tryk.
import { SWING } from './rules.js';

export function stackBot(s, id, mem, rng = Math.random) {
  const t = s.towers[id];
  if (!t || t.done || s.over) return { x: 0, y: 0, a: 0, b: 0 };
  let m = mem.get(id);
  if (!m || m.h !== t.blocks.length) {
    const err = (0.015 + t.score * 0.006) * (rng() * 2 - 1) + (rng() < 0.04 ? (rng() < 0.5 ? -1 : 1) * 0.5 : 0);
    m = { h: t.blocks.length, aim: Math.max(-SWING, Math.min(SWING, t.blocks.at(-1).x + err)) };
    mem.set(id, m);
  }
  const close = Math.abs(t.cur.x - m.aim) < 0.03;
  return { x: 0, y: 0, a: close ? 1 : 0, b: 0 };
}
