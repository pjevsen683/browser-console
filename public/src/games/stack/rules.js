// Tower Stack: en klods glider frem og tilbage over tårnets top; A taber den. Det, der stikker ud, skæres af; helt ved
// siden af = tårnet er færdigt. Alle bygger hver sit tårn samtidig. x er klodsens midte, w dens bredde, i enheder af en
// fuld klods. Ren logik (test/stack.test.js).
export const START_W = 1;
export const SWING = 0.75;          // den glidende klods' midte går mellem −SWING og SWING
export const PERFECT = 0.04;        // så tæt på er et tab perfekt
export const GROW = 0.06;           // 3 perfekte i træk gør klodsen så meget bredere
export const TIME = 180;            // højst så længe varer et spil
const MISS_W = 0.02;                // mindre overlap end dette er ved siden af

export const speedAt = (h) => Math.min(2.4, 0.7 + h * 0.05);

function nextCur(t) {
  const top = t.blocks.at(-1), side = t.blocks.length % 2 ? -1 : 1;
  t.cur = { x: side * SWING, w: top.w, dir: -side };
}

export function createStack(ids) {
  const towers = {};
  for (const id of ids) {
    const t = { blocks: [{ x: 0, w: START_W }], cur: null, done: false, score: 0, streak: 0, at: 0 };
    nextCur(t);
    towers[id] = t;
  }
  return { ids, towers, t: 0, over: false };
}

export function step(s, dt) {
  if (s.over) return;
  s.t += dt;
  for (const id of s.ids) {
    const t = s.towers[id];
    if (t.done) continue;
    const c = t.cur;
    c.x += c.dir * speedAt(t.score) * dt;
    if (c.x > SWING) { c.x = 2 * SWING - c.x; c.dir = -1; }
    if (c.x < -SWING) { c.x = -2 * SWING - c.x; c.dir = 1; }
  }
  if (s.t >= TIME) { for (const id of s.ids) s.towers[id].done = true; s.over = true; }
}

// Taber spillerens klods: { type: 'perfect' | 'place' | 'miss', block, cut? } eller null (færdigt tårn).
export function drop(s, id) {
  const t = s.towers[id];
  if (!t || t.done || s.over) return null;
  const top = t.blocks.at(-1), c = t.cur, d = c.x - top.x;
  if (top.w - Math.abs(d) < MISS_W) {
    t.done = true;
    s.over = s.ids.every((i) => s.towers[i].done);
    return { type: 'miss', block: { x: c.x, w: c.w } };
  }
  let block, cut = null, type;
  if (Math.abs(d) <= PERFECT) {
    t.streak++;
    const w = t.streak % 3 === 0 ? Math.min(START_W, top.w + GROW) : top.w;
    block = { x: top.x, w };
    type = 'perfect';
  } else {
    t.streak = 0;
    const lo = Math.max(c.x - c.w / 2, top.x - top.w / 2), hi = Math.min(c.x + c.w / 2, top.x + top.w / 2);
    block = { x: (lo + hi) / 2, w: hi - lo };
    const cw = c.w - block.w;
    cut = { x: d > 0 ? hi + cw / 2 : lo - cw / 2, w: cw };
    type = 'place';
  }
  t.blocks.push(block);
  t.score++;
  t.at = s.t;                        // lige højde: den, der nåede den først, vinder
  nextCur(t);
  return { type, block, cut };
}

// Er alle tårne hos spillere, der stadig er her (active), færdige, slutter spillet; en telefon, der er væk, eller en, der
// aldrig trykker, holder ikke de andre hen. Svarer, om spillet sluttede nu.
export function endIfIdle(s, active) {
  if (s.over) return false;
  const here = s.ids.filter((id) => active.includes(id));
  if (!here.length || !here.every((id) => s.towers[id].done)) return false;
  for (const id of s.ids) s.towers[id].done = true;
  s.over = true;
  return true;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.towers[b].score - s.towers[a].score || s.towers[a].at - s.towers[b].at);
}
