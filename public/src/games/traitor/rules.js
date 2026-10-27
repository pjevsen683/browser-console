// Who's the Traitor?: alle får et hemmeligt ord, forræderen et beslægtet. På skift siger man ét ord om sit ord, så
// stemmer alle. Ren logik (test/traitor.test.js). done()/vote()/leave() kan kaldes når som helst; deres hændelser
// kommer med fra det næste update().
export const ROUNDS = 3, DEAL_TIME = 6, CLUE_TIME = 20, VOTE_TIME = 30, REVEAL_TIME = 7, MAX_CLUE_ROUNDS = 3;

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function createTraitor(ids, pairs, rng) {
  return {
    ids, rng, pairs: shuffle(pairs, rng), present: new Set(ids), round: 0, phase: 'next', t: 0, queue: [],
    scores: Object.fromEntries(ids.map((id) => [id, 0])), traitor: null, words: new Map(), alive: [], order: [],
    turn: 0, votes: new Map(), clueRounds: 0,
  };
}

function cluesRound(s) {
  s.order = shuffle(s.alive, s.rng);
  s.turn = 0;
  s.clueRounds++;
  s.phase = 'clues';
  s.t = CLUE_TIME;
  s.queue.push({ type: 'turn', id: s.order[0] });
}

function nextTurn(s) {
  if (s.turn >= s.order.length) {
    s.phase = 'vote';
    s.t = VOTE_TIME;
    s.votes = new Map();
    s.queue.push({ type: 'vote' });
  } else {
    s.t = CLUE_TIME;
    s.queue.push({ type: 'turn', id: s.order[s.turn] });
  }
}

function endRound(s, type) {
  s.phase = 'reveal';
  s.t = REVEAL_TIME;
  s.queue.push({ type, traitor: s.traitor, words: [s.words.get(s.alive.find((id) => id !== s.traitor) ?? '') ?? null, s.words.get(s.traitor)] });
}

function tally(s) {
  const counts = new Map();
  for (const target of s.votes.values()) counts.set(target, (counts.get(target) ?? 0) + 1);
  const max = Math.max(0, ...counts.values()), top = [...counts].filter(([, n]) => n === max);
  const out = max > 0 && top.length === 1 ? top[0][0] : null;
  s.queue.push({ type: 'tally', out, votes: Object.fromEntries(counts) });
  if (out === s.traitor) {
    for (const id of s.alive) if (id !== s.traitor) s.scores[id] += 1 + (s.votes.get(id) === s.traitor ? 1 : 0);
    return endRound(s, 'caught');
  }
  if (out !== null) s.alive = s.alive.filter((id) => id !== out);
  if (s.alive.length <= 2 || s.clueRounds >= MAX_CLUE_ROUNDS) { s.scores[s.traitor] += 4; return endRound(s, 'escaped'); }
  cluesRound(s);
}

// Hændelser: deal, turn {id}, vote, tally {out, votes}, caught/escaped/void {traitor, words}, over.
export function update(s, dt) {
  s.t -= dt;
  if (s.phase === 'next') {
    if (s.round >= ROUNDS) { s.phase = 'over'; s.queue.push({ type: 'over' }); }
    else {
      const players = s.ids.filter((id) => s.present.has(id));
      s.round++;
      const pair = s.pairs[(s.round - 1) % s.pairs.length];
      s.traitor = players[Math.floor(s.rng() * players.length)];
      s.words = new Map(players.map((id) => [id, id === s.traitor ? pair[1] : pair[0]]));
      s.alive = players.slice();
      s.clueRounds = 0;
      s.phase = 'deal';
      s.t = DEAL_TIME;
      s.queue.push({ type: 'deal' });
    }
  } else if (s.phase === 'deal' && s.t <= 0) cluesRound(s);
  else if (s.phase === 'clues' && s.t <= 0) { s.turn++; nextTurn(s); }
  else if (s.phase === 'vote' && (s.t <= 0 || s.votes.size >= s.alive.length)) tally(s);
  else if (s.phase === 'reveal' && s.t <= 0) { s.phase = 'next'; s.t = 0; }
  return s.queue.splice(0);
}

export function done(s, id) {
  if (s.phase !== 'clues' || s.order[s.turn] !== id) return false;
  s.turn++;
  nextTurn(s);
  return true;
}

export function vote(s, voter, target) {
  if (s.phase !== 'vote' || voter === target || !s.alive.includes(voter) || !s.alive.includes(target) || s.votes.has(voter)) return false;
  s.votes.set(voter, target);
  return true;
}

// En spiller forsvandt. Forræderen: runden annulleres (ingen point). Ellers ud af rækkefølge og afstemning.
export function leave(s, id) {
  s.present.delete(id);
  if (!s.alive.includes(id) || s.phase === 'over' || s.phase === 'reveal' || s.phase === 'next') return s.queue.splice(0);
  if (id === s.traitor) { endRound(s, 'void'); return s.queue.splice(0); }
  s.alive = s.alive.filter((x) => x !== id);
  s.votes.delete(id);
  for (const [v, t] of s.votes) if (t === id) s.votes.delete(v);
  const k = s.order.indexOf(id);
  if (k >= 0) {
    s.order.splice(k, 1);
    if (k < s.turn) s.turn--;
    else if (k === s.turn && s.phase === 'clues') nextTurn(s);
  }
  if (s.alive.length <= 2) { s.scores[s.traitor] += 4; endRound(s, 'escaped'); }
  return s.queue.splice(0);
}

// En spiller, der var væk, er tilbage: sidder resten af runden over og får ord fra næste runde.
export function rejoin(s, id) {
  if (s.ids.includes(id)) s.present.add(id);
}

export function ranking(s) {
  return [...s.ids].sort((a, b) => s.scores[b] - s.scores[a]);
}
