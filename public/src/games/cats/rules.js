// Cat Chaos: point, mormor og hvem der bliver taget. Ren logik (test/cats.test.js).
// En ting giver sin værdi, når den forlader bordet (som i Kattekaos: kanten tæller, ikke landingen). Mens mormor
// kigger, bliver hver kat, der bevæger sig eller slår, taget én gang pr. kig: minuspoint og et øjeblik på pladsen.
import { createOwner, updateOwner, hearNoise, isWatching } from './owner.js';
import { createWorld, createItem, step, CATALOG, STILL, HX, HZ } from './physics.js';

export const ROUND = 90, PENALTY = 250, STUN = 1.5, ITEMS = 28;
export const REFILL_BELOW = 10, REFILL_UNTIL = 10;   // færre ting end det: nye falder ned (ikke de sidste 10 s)
const EDGE = 1.2;
export const LEVEL = { readMin: 4, readMax: 7, warn: 1.1, lookMin: 1.8, lookMax: 2.8 };

// Ting spredt over bordet uden at overlappe, mindst EDGE fra kanten (ellers skubber kattene dem ud med det samme,
// bare ved at gå fremad) og med en fri stribe foran kattene. avoid: katte og ting, der allerede
// står der (nye ting må ikke lande på dem).
function layout(rng, n, firstId = 0, avoid = []) {
  const kinds = Object.keys(CATALOG), items = [];
  for (let tries = 0; items.length < n && tries < 5000; tries++) {
    const kind = kinds[Math.floor(rng() * kinds.length)], r = CATALOG[kind].r;
    const x = (rng() * 2 - 1) * (HX - EDGE - r);
    const z = -HZ + EDGE + r + rng() * (HZ * 2 - EDGE - 2.4 - 2 * r);
    if (items.concat(avoid).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.25)) continue;
    items.push(createItem({ id: firstId + items.length, kind, x, z }));
  }
  return items;
}

// Nye ting falder ned på bordet ovenfra.
function refill(s, ev) {
  const w = s.world, onTable = w.items.filter((i) => i.state === 'table');
  const fresh = layout(s.rng, ITEMS - onTable.length, s.nextId, onTable.concat(w.cats));
  s.nextId += fresh.length;
  fresh.forEach((it, i) => { it.y = 4 + i * 0.15; });
  w.items.push(...fresh);                          // dem på gulvet bliver: visningen viser skårene
  ev.push({ type: 'refill', items: fresh });
}

export function createCats(ids, rng) {
  return {
    ids, rng, world: createWorld(ids, layout(rng, ITEMS)), owner: createOwner(LEVEL, rng), nextId: ITEMS,
    scores: Object.fromEntries(ids.map((id) => [id, 0])), seen: new Set(), t: ROUND, phase: 'play',
  };
}

function caught(s, id, ev) {
  const c = s.world.cats.find((x) => x.id === id);
  if (!c || s.seen.has(id)) return;
  s.seen.add(id);
  s.scores[id] = Math.max(0, s.scores[id] - PENALTY);
  c.stun = STUN;
  c.vx = 0; c.vz = 0;
  ev.push({ type: 'caught', id });
}

// inputs: Map id -> {x, y, aPressed}. Hændelser: fysikkens + score {id, gained, item}, caught {id},
// owner {state}, refill {items}, over.
export function update(s, inputs, dt) {
  if (s.phase !== 'play') return [];
  s.t -= dt;
  const ev = step(s.world, inputs, dt);
  const turn = updateOwner(s.owner, dt);
  if (turn) {
    if (turn === 'turning') s.seen.clear();
    ev.push({ type: 'owner', state: turn });
  }
  const watching = isWatching(s.owner);
  for (const e of ev.slice()) {
    if (e.type === 'crash' || e.type === 'thud') hearNoise(s.owner);
    if (e.type === 'fall' && e.by !== null && e.by in s.scores) {
      s.scores[e.by] += e.item.value;
      ev.push({ type: 'score', id: e.by, gained: e.item.value, item: e.item });
      if (watching) caught(s, e.by, ev);
    }
  }
  if (watching) {
    for (const c of s.world.cats) {
      if (Math.hypot(c.vx, c.vz) > STILL || ev.some((e) => e.type === 'swat' && e.id === c.id)) caught(s, c.id, ev);
    }
  }
  const onTable = s.world.items.filter((i) => i.state === 'table').length;
  if (onTable < REFILL_BELOW && s.t > REFILL_UNTIL) refill(s, ev);
  const left = s.world.items.some((i) => i.state === 'table' || i.state === 'falling');
  if (s.t <= 0 || !left) { s.phase = 'over'; ev.push({ type: 'over' }); }
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
