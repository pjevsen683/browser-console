// Quiz Night: COUNT spørgsmål med fire svar; rigtigt svar giver 500 + op til 500 for fart. Ren logik
// (test/quiz.test.js).
export const COUNT = 10, ASK_TIME = 15, REVEAL_TIME = 5, INTRO = 3;

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// n spørgsmål, helst nogle der ikke er brugt (used: Set af id'er); er der ikke nok ubrugte, kommer de sidste
// ubrugte med, og resten fyldes op med brugte. Kategorierne flettes, så der ikke kommer tre om sport i træk.
export function pickQuestions(all, n, used, rng) {
  let pool = all.filter((q) => !used.has(q.id));
  if (pool.length < n) pool = [...pool, ...shuffle(all.filter((q) => used.has(q.id)), rng).slice(0, n - pool.length)];
  const byCat = new Map();
  for (const q of shuffle(pool, rng)) { if (!byCat.has(q.cat)) byCat.set(q.cat, []); byCat.get(q.cat).push(q); }
  const cats = shuffle([...byCat.keys()], rng), out = [];
  while (out.length < n && cats.some((c) => byCat.get(c).length)) {
    for (const c of cats) { const q = byCat.get(c).pop(); if (q && out.length < n) out.push(q); }
  }
  return out;
}

export function createQuiz(ids, qs) {
  return { ids, qs, i: -1, phase: 'intro', t: INTRO, scores: Object.fromEntries(ids.map((id) => [id, 0])), answers: [] };
}

export function answer(s, id, value) {
  if (s.phase !== 'ask' || !(id in s.scores) || s.answers.some((a) => a.id === id)) return false;
  s.answers.push({ id, value, left: s.t });
  return true;
}

// Hændelser: { type: 'ask' } (spørgsmål s.qs[s.i]), { type: 'reveal', gained, counts }, { type: 'over' }.
export function update(s, dt) {
  const ev = [];
  if (s.phase === 'intro' || s.phase === 'reveal') {
    s.t -= dt;
    if (s.t > 0) return ev;
    if (s.i + 1 >= s.qs.length) { s.phase = 'over'; ev.push({ type: 'over' }); return ev; }
    s.i++;
    s.answers = [];
    s.phase = 'ask';
    s.t = ASK_TIME;
    ev.push({ type: 'ask' });
  } else if (s.phase === 'ask') {
    s.t -= dt;
    if (s.t > 0 && s.answers.length < s.ids.length) return ev;
    const q = s.qs[s.i], gained = {}, counts = [0, 0, 0, 0];
    for (const a of s.answers) {
      if (a.value >= 0 && a.value < 4) counts[a.value]++;
      gained[a.id] = a.value === q.correct ? 500 + Math.round((500 * Math.max(0, a.left)) / ASK_TIME) : 0;
      s.scores[a.id] += gained[a.id];
    }
    s.phase = 'reveal';
    s.t = REVEAL_TIME;
    ev.push({ type: 'reveal', gained, counts });
  }
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
