// Pind og knapper fra alle kilder gøres ens: dødzone, klip til enhedscirklen, knapper som 0/1.
export const DEAD = 0.12;

export function normStick(x, y, dead = DEAD) {
  x = Number.isFinite(x) ? x : 0;
  y = Number.isFinite(y) ? y : 0;
  const len = Math.hypot(x, y);
  if (len <= dead) return { x: 0, y: 0 };
  const k = Math.min(1, (len - dead) / (1 - dead)) / len;
  return { x: x * k, y: y * k };
}

// En controllers besked {s, x, y, a, b} -> renset input, eller null for noget, der ikke er input.
export function parseInput(m) {
  if (!m || typeof m !== 'object' || !Number.isFinite(m.s)) return null;
  const { x, y } = normStick(Number(m.x), Number(m.y));
  const out = { s: m.s, x, y, a: m.a ? 1 : 0, b: m.b ? 1 : 0 };
  if (Number.isFinite(m.an)) out.an = m.an;      // trykketællere (se players.js)
  if (Number.isFinite(m.bn)) out.bn = m.bn;
  return out;
}
