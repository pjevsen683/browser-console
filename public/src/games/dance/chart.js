// Koreografien i Dance Beat: pile i 4 baner (◀ ▲ ▼ ▶) lagt på sangens takter (public/data/dance.json), og
// bedømmelsen af et tryk. Ren logik (test/dance.test.js).
export const LANES = 4, PERFECT = 0.05, GREAT = 0.1, GOOD = 0.15;   // sekunder fra pilen
export const LATE = 0.35;                                           // så længe kan et stemplet tryk være undervejs
export const LEAD_IN = 3;                                           // ingen pile før: nedtællingen og første pil

// Første fjerdedel: hver anden takt. Så hver takt. Fra 60 % til 85 %: hver takt og en halv takt efter hver fjerde.
// Til sidst hver takt igen. Banen er tilfældig, men aldrig den samme tre gange i træk.
export function makeChart(beats, rng, { from = LEAD_IN } = {}) {
  const usable = beats.filter((t) => t >= from);
  const notes = [];
  const lane = () => {
    let l;
    do l = Math.floor(rng() * LANES);
    while (notes.length >= 2 && notes.at(-1).lane === l && notes.at(-2).lane === l);
    return l;
  };
  usable.forEach((t, i) => {
    const f = i / usable.length;
    if (f < 0.25 && i % 2) return;
    notes.push({ t, lane: lane() });
    if (f >= 0.6 && f < 0.85 && i % 4 === 2 && usable[i + 1] !== undefined) notes.push({ t: (t + usable[i + 1]) / 2, lane: lane() });
  });
  return notes;
}

// d: trykkets afvigelse fra pilen i sekunder (negativ = for tidligt). null: for langt fra.
export function judge(d) {
  const a = Math.abs(d);
  if (a <= PERFECT + 1e-9) return { kind: 'perfect', points: 300 };
  if (a <= GREAT) return { kind: 'great', points: 200 };
  if (a <= GOOD) return { kind: 'good', points: 100 };
  return null;
}

export const multiplier = (combo) => (combo >= 30 ? 2.5 : combo >= 20 ? 2 : combo >= 10 ? 1.5 : 1);
