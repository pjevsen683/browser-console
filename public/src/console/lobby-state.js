// Lobbyens regler, ren logik (test/lobby.test.js): A = klar, pinden vælger spil i et gitter med `cols` kolonner, og
// spillet starter START_DELAY sekunder efter, at alle tilsluttede er klar -- når antallet passer til spillet.
export const START_DELAY = 3;
export const COLS = 6;

export function createLobby(games, cols = COLS) {
  return { games, cols, sel: 0, countdown: null };
}

// Venstre/højre går ét kort (og rundt); op/ned en række. Er der intet kort lige under, men en række til, lander man på
// det sidste kort.
function move(lobby, dir) {
  const n = lobby.games.length, c = lobby.cols;
  if (dir === 'l' || dir === 'r') return (lobby.sel + (dir === 'r' ? 1 : -1) + n) % n;
  if (dir === 'u') return lobby.sel - c >= 0 ? lobby.sel - c : lobby.sel;
  const row = Math.floor(lobby.sel / c), last = Math.floor((n - 1) / c);
  return row >= last ? lobby.sel : Math.min(lobby.sel + c, n - 1);
}

const active = (players) => players.filter((p) => p.connected);

export function canStart(game, players) {
  const n = active(players).length;
  return n >= game.minPlayers && n <= game.maxPlayers;
}

export function lobbyStep(lobby, players, dt) {
  let changed = false;
  for (const p of players) {
    if (p.input.aPressed) p.ready = !p.ready;
    const { x, y } = p.input;
    const dir = x > 0.6 ? 'r' : x < -0.6 ? 'l' : y > 0.6 ? 'd' : y < -0.6 ? 'u' : null;
    if (dir && dir !== p.navDir) {
      const to = move(lobby, dir);
      if (to !== lobby.sel) { lobby.sel = to; changed = true; }
    }
    p.navDir = dir;
  }
  if (changed) for (const p of players) p.ready = false;
  const game = lobby.games[lobby.sel];
  const ready = canStart(game, players) && active(players).every((p) => p.ready);
  if (!ready) { lobby.countdown = null; return null; }
  lobby.countdown = lobby.countdown === null ? START_DELAY : lobby.countdown - dt;
  if (lobby.countdown > 1e-9) return null;
  lobby.countdown = null;
  return game;
}
