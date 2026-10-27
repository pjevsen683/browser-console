// Lobbyens regler, ren logik (test/lobby.test.js): A = klar, pinden vælger spil, og spillet starter START_DELAY
// sekunder efter, at alle tilsluttede er klar -- når antallet passer til spillet.
export const START_DELAY = 3;

export function createLobby(games) {
  return { games, sel: 0, countdown: null };
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
    const dir = p.input.x > 0.6 ? 1 : p.input.x < -0.6 ? -1 : 0;
    if (dir && dir !== p.navDir) {
      lobby.sel = (lobby.sel + dir + lobby.games.length) % lobby.games.length;
      changed = true;
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
