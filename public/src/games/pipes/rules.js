// Pipe Maze: en rørlabyrint (en "stige": lodrette rør med tværrør imellem); vandet følger røret ned og drejer ved
// hvert tværrør. Kun ét rør fører til skatten. Man vælger et rør øverst på telefonen inden STUDY sekunder: rigtigt =
// 100 + op til 100 for fart. ROUNDS runder, labyrinten bliver tættere. Ren logik (test/pipes.test.js).
export const ROUNDS = 6, STUDY = 12, REVEAL = 4, COLS = 5;
const rowsFor = (round) => 8 + round * 2;

// Tværrør {row, col} forbinder rør col og col+1 i rækken row; to tværrør i samme række rører ikke samme rør.
export function buildLadder(rng, cols, rows) {
  const rungs = [];
  for (let row = 0; row < rows; row++) {
    let col = Math.floor(rng() * 2);
    while (col < cols - 1) {
      if (rng() < 0.55) { rungs.push({ row, col }); col += 2; } else col += 1;
    }
  }
  return { cols, rows, rungs };
}

// Vejen fra rør start øverst: { end, path: [[col, row], ...] } (row -0.5 = toppen, rows = bunden).
export function trace(l, start) {
  let col = start;
  const path = [[col, -0.5]];
  for (let row = 0; row < l.rows; row++) {
    const right = l.rungs.some((r) => r.row === row && r.col === col), left = l.rungs.some((r) => r.row === row && r.col === col - 1);
    if (right || left) { path.push([col, row]); col += right ? 1 : -1; path.push([col, row]); }
  }
  path.push([col, l.rows]);
  return { end: col, path };
}

export function createPipes(ids, rng) {
  return { ids, rng, round: 0, phase: 'gap', t: 0, ladder: null, treasure: 0, answers: new Map(), away: new Set(), scores: Object.fromEntries(ids.map((id) => [id, 0])), over: false };
}

export function answer(s, id, col) {
  if (s.phase !== 'study' || !(id in s.scores) || s.answers.has(id) || !Number.isInteger(col) || col < 0 || col >= s.ladder.cols) return false;
  s.answers.set(id, { col, left: s.t });
  return true;
}

// Hændelser: round {round}, reveal {good, gained}, over.
export function update(s, dt) {
  const ev = [];
  if (s.over) return ev;
  s.t -= dt;
  if (s.phase === 'study' && s.ids.every((id) => s.answers.has(id) || s.away.has(id))) s.t = Math.min(s.t, 0);   // away: telefonen er væk
  if (s.t > 0) return ev;
  if (s.phase === 'gap') {
    if (s.round >= ROUNDS) { s.over = true; s.phase = 'over'; ev.push({ type: 'over' }); return ev; }
    s.round++;
    s.ladder = buildLadder(s.rng, COLS, rowsFor(s.round));
    s.treasure = Math.floor(s.rng() * COLS);
    s.answers = new Map();
    s.phase = 'study';
    s.t = STUDY;
    ev.push({ type: 'round', round: s.round });
  } else if (s.phase === 'study') {
    const good = [...Array(COLS).keys()].find((c) => trace(s.ladder, c).end === s.treasure);
    const gained = {};
    for (const [id, a] of s.answers) {
      gained[id] = a.col === good ? 100 + Math.round((100 * Math.max(0, a.left)) / STUDY) : 0;
      s.scores[id] += gained[id];
    }
    s.phase = 'gap';
    s.t = REVEAL;
    ev.push({ type: 'reveal', good, gained });
  }
  return ev;
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
