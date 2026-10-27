// Runderne i Mini Racers (Micro Machines): kameraet følger feltet, og den, der er mere end OUT_GAP bag føreren (langs
// banen), er ude af runden -- alle, der stadig kører, får 1 point. Afstanden skrumper til MIN_GAP i løbet af runden
// (kameraet zoomer ind), så runden slutter, når én er tilbage, eller senest efter ROUND_MAX. ROUNDS runder; flest point vinder (lige: bedst i sidste runde). Ren logik (test/racer.test.js).
export const ROUNDS = 5, OUT_GAP = 20, MIN_GAP = 8, COUNTDOWN = 3, BREAK = 3, ROUND_MAX = 60, GRACE = 4;   // GRACE: ingen er ude, mens køen fra startgitteret løser sig

export const gapAt = (t) => OUT_GAP - (OUT_GAP - MIN_GAP) * Math.min(1, Math.max(0, t / ROUND_MAX));

export function createCup(ids) {
  return { ids, round: 1, phase: 'countdown', t: COUNTDOWN, roundT: 0, points: Object.fromEntries(ids.map((id) => [id, 0])), outOrder: [], lastOrder: [] };
}

// Hændelser: start, out {id}, roundEnd {winner, order}, next, over.
export function updateCup(cup, cars, dt) {
  const ev = [];
  if (cup.phase === 'countdown') {
    cup.t -= dt;
    if (cup.t > 1e-9) return ev;
    cup.phase = 'play';
    cup.roundT = 0;
    cup.outOrder = [];
    ev.push({ type: 'start' });
  } else if (cup.phase === 'play') {
    cup.roundT += dt;
    const alive = cars.filter((c) => !c.out).sort((a, b) => a.p - b.p);
    const lead = Math.max(...alive.map((c) => c.p)), gap = gapAt(cup.roundT);
    for (const c of alive.slice()) {
      if (cup.roundT < GRACE || alive.length <= 1 || lead - c.p <= gap) break;   // sorteret bagfra: resten er tættere på
      c.out = true;
      alive.splice(alive.indexOf(c), 1);
      cup.outOrder.push(c.id);
      for (const o of alive) cup.points[o.id]++;
      ev.push({ type: 'out', id: c.id });
    }
    if (alive.length <= 1 || cup.roundT >= ROUND_MAX) {
      const order = [...alive.sort((a, b) => b.p - a.p).map((c) => c.id), ...cup.outOrder.slice().reverse()];
      cup.lastOrder = order;
      cup.phase = 'break';
      cup.t = BREAK;
      ev.push({ type: 'roundEnd', winner: order[0], order });
    }
  } else if (cup.phase === 'break') {
    cup.t -= dt;
    if (cup.t > 1e-9) return ev;
    if (cup.round >= ROUNDS) { cup.phase = 'over'; ev.push({ type: 'over' }); return ev; }
    cup.round++;
    cup.phase = 'countdown';
    cup.t = COUNTDOWN;
    ev.push({ type: 'next' });
  }
  return ev;
}

export function ranking(cup) {
  const last = (id) => { const i = cup.lastOrder.indexOf(id); return i < 0 ? Infinity : i; };
  return [...cup.ids].sort((a, b) => cup.points[b] - cup.points[a] || last(a) - last(b));
}
