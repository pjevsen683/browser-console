// Color Rush: fjernsynet viser et farveord skrevet med en anden farve blæk; tryk på blækkets farve. Første rigtige
// får 3 point, anden 2, resten rigtige 1. ROUNDS runder. Ren logik (test/colors.test.js).
export const COLORS = [
  { name: 'Red', hex: '#ff4d5e' }, { name: 'Blue', hex: '#3fa7ff' }, { name: 'Green', hex: '#3ddc84' },
  { name: 'Yellow', hex: '#ffd23f' }, { name: 'Purple', hex: '#b469ff' }, { name: 'Orange', hex: '#ff8c3a' },
];
export const ROUNDS = 10, ROUND_TIME = 5, GAP = 2.5;
const POINTS = [3, 2];          // derefter 1 for hvert rigtigt svar

const pick = (rng, n) => Math.floor(rng() * n);

export function makeQuestion(rng) {
  const word = pick(rng, COLORS.length);
  let ink = pick(rng, COLORS.length - 1);
  if (ink >= word) ink++;
  const rest = COLORS.map((_, i) => i).filter((i) => i !== ink && i !== word);
  while (rest.length > 2) rest.splice(pick(rng, rest.length), 1);
  const options = [ink, word, ...rest];
  for (let i = options.length - 1; i > 0; i--) { const j = pick(rng, i + 1); [options[i], options[j]] = [options[j], options[i]]; }
  return { word, ink, options, correct: options.indexOf(ink) };
}

export function createColorRush(ids, rng) {
  return { ids, rng, scores: Object.fromEntries(ids.map((id) => [id, 0])), round: 0, phase: 'gap', t: GAP, q: null, answers: [] };
}

// Svaret tæller, hvis spilleren er med, der spørges, og det er spillerens første svar i runden.
export function answer(s, id, value) {
  if (s.phase !== 'ask' || !(id in s.scores) || s.answers.some((a) => a.id === id)) return false;
  s.answers.push({ id, value });
  return true;
}

// Hændelser: { type: 'ask' } (nyt spørgsmål i s.q), { type: 'reveal', gained } , { type: 'over' }.
export function update(s, dt) {
  const ev = [];
  if (s.phase === 'gap') {
    s.t -= dt;
    if (s.t > 0) return ev;
    if (s.round >= ROUNDS) { s.phase = 'over'; ev.push({ type: 'over' }); return ev; }
    s.round++;
    s.q = makeQuestion(s.rng);
    s.answers = [];
    s.phase = 'ask';
    s.t = ROUND_TIME;
    ev.push({ type: 'ask' });
  } else if (s.phase === 'ask') {
    s.t -= dt;
    if (s.t > 0 && s.answers.length < s.ids.length) return ev;
    const gained = {};
    let place = 0;
    for (const a of s.answers) {
      if (a.value !== s.q.correct) { gained[a.id] = 0; continue; }
      gained[a.id] = POINTS[place++] ?? 1;
      s.scores[a.id] += gained[a.id];
    }
    s.phase = 'gap';
    s.t = GAP;
    ev.push({ type: 'reveal', gained });
  }
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
