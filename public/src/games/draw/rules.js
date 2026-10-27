// Draw & Guess: én tegner på telefonen, de andre gætter ved at skrive. Ren logik (test/draw.test.js).
// En tur: intro/afsløring -> tegneren vælger mellem 3 ord (CHOOSE_TIME) -> tegner (DRAW_TIME) -> afsløring.
// Rigtigt gæt: 50 + op til 150 for fart; tegneren får DRAWER_POINTS pr. gætter. Alle tegner én gang (2-4 spillere:
// to gange). Gæt sammenlignes uden store/små bogstaver og tegn; én stavefejl er ok i ord på 5+ bogstaver.
import { mulberry32 } from '../../rng.js';

export const INTRO = 3, CHOOSE_TIME = 10, DRAW_TIME = 60, REVEAL_TIME = 5, DRAWER_POINTS = 50, OPTIONS = 3;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return d[b.length];
}

// 'correct' | 'close' | 'wrong'
export function judge(word, text) {
  const w = norm(word), g = norm(text);
  if (!g) return 'wrong';
  const tol = w.length >= 5 ? 1 : 0, d = distance(w, g);
  return d <= tol ? 'correct' : d <= tol + 1 ? 'close' : 'wrong';
}

// "_ _ _   _ _ _ _ _" med n bogstaver afsløret; rækkefølgen er fast for et givet rng (samme frø = samme bogstaver).
export function hint(word, n, rng = Math.random) {
  const idx = [...word].map((c, i) => (/[a-z]/i.test(c) ? i : -1)).filter((i) => i >= 0);   // kun bogstaver
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const shown = new Set(idx.slice(0, n));
  return word.split(' ').map((part, wi, all) => {
    const off = all.slice(0, wi).reduce((k, p) => k + p.length + 1, 0);
    return [...part].map((c, i) => (shown.has(off + i) || !/[a-z]/i.test(c) ? c : '_')).join(' ');
  }).join('   ');
}

// Afslørede bogstaver efter tid: ét ved halv tid og ét til ved 3/4, højst bogstaver/4 (ingen i ord under 4 bogstaver).
const reveals = (word, left) => {
  const max = Math.min(2, Math.floor(word.replace(/[^a-z]/gi, '').length / 4));
  return Math.min(max, left <= DRAW_TIME / 4 ? 2 : left <= DRAW_TIME / 2 ? 1 : 0);
};

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// used: ord, denne konsol har haft før (localStorage); de kommer bagerst i bunken.
export function createDraw(ids, words, rng, used = new Set()) {
  const passes = ids.length <= 4 ? 2 : 1, order = [];
  for (let p = 0; p < passes; p++) {
    const pass = shuffle(ids, rng);
    if (order.length && pass[0] === order.at(-1) && pass.length > 1) [pass[0], pass[1]] = [pass[1], pass[0]];
    order.push(...pass);
  }
  return {
    ids, rng, order, pool: shuffle(words.filter((w) => !used.has(w)), rng).concat(shuffle(words.filter((w) => used.has(w)), rng)), turn: -1, phase: 'intro', t: INTRO, drawer: null, options: [], word: null,
    guessed: [], away: new Set(), queue: [], scores: Object.fromEntries(ids.map((id) => [id, 0])), hintSeed: 0, shown: 0,
  };
}

const guessers = (s) => s.ids.filter((id) => id !== s.drawer && !s.away.has(id));
export const hintText = (s) => hint(s.word, s.shown, mulberry32(s.hintSeed));

function nextTurn(s, ev) {
  s.turn++;
  if (s.turn >= s.order.length) { s.phase = 'over'; ev.push({ type: 'over' }); return; }
  s.drawer = s.order[s.turn];
  s.word = null;
  if (s.away.has(s.drawer)) { nextTurn(s, ev); return; }
  s.options = s.pool.splice(0, OPTIONS);
  if (s.options.length < OPTIONS) { s.pool = shuffle(s.options.concat(s.pool), s.rng); s.options = s.pool.splice(0, OPTIONS); }
  s.phase = 'choose';
  s.t = CHOOSE_TIME;
  s.guessed = [];
  ev.push({ type: 'choose', drawer: s.drawer, options: s.options.slice() });
}

function startDraw(s, i, ev) {
  s.word = s.options[i];
  s.pool.push(...s.options.filter((_, k) => k !== i));   // de fravalgte kan komme igen senere
  s.phase = 'draw';
  s.t = DRAW_TIME;
  s.shown = 0;
  s.hintSeed = Math.floor(s.rng() * 2 ** 31);
  ev.push({ type: 'draw', drawer: s.drawer, word: s.word }, { type: 'hint', hint: hintText(s) });
}

function reveal(s, ev, skipped = false) {
  if (s.word === null) s.pool.push(...s.options);   // sprunget over under ordvalget: ordene tilbage i bunken
  s.phase = 'reveal';
  s.t = REVEAL_TIME;
  ev.push({ type: 'reveal', word: s.word, drawer: s.drawer, guessed: s.guessed.slice(), skipped });
}

export function choose(s, id, i) {
  if (s.phase !== 'choose' || id !== s.drawer || !Number.isInteger(i) || i < 0 || i >= s.options.length) return false;
  startDraw(s, i, s.queue);                       // hændelserne kommer med næste update
  return true;
}

export function guess(s, id, text) {
  if (s.phase !== 'draw' || id === s.drawer || s.guessed.includes(id) || !(id in s.scores)) return { result: 'ignored' };
  const result = judge(s.word, text);
  if (result !== 'correct') return { result };
  const points = 50 + Math.round((150 * Math.max(0, s.t)) / DRAW_TIME);
  s.scores[id] += points;
  s.scores[s.drawer] += DRAWER_POINTS;
  s.guessed.push(id);
  return { result, points };
}

export function leave(s, id) { s.away.add(id); }
export function rejoin(s, id) { s.away.delete(id); }

// Hændelser: choose {drawer, options}, draw {drawer, word}, hint {hint}, reveal {word, drawer, guessed, skipped}, over.
export function update(s, dt) {
  const ev = [];
  if (s.phase === 'over') return ev;
  ev.push(...s.queue.splice(0));
  if ((s.phase === 'choose' || s.phase === 'draw') && s.away.has(s.drawer)) { reveal(s, ev, true); return ev; }
  if (s.phase === 'draw' && guessers(s).every((id) => s.guessed.includes(id))) { reveal(s, ev); return ev; }   // alle (eller ingen tilbage)
  s.t -= dt;
  if (s.phase === 'draw') {
    const n = reveals(s.word, s.t);
    if (n !== s.shown) { s.shown = n; ev.push({ type: 'hint', hint: hintText(s) }); }
  }
  if (s.t > 0) return ev;
  if (s.phase === 'intro' || s.phase === 'reveal') nextTurn(s, ev);
  else if (s.phase === 'choose') startDraw(s, 0, ev);
  else if (s.phase === 'draw') reveal(s, ev);
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
