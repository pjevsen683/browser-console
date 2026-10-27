// ?bots=N: falske spillere, så konsollen kan prøves uden telefoner. I lobbyen trykker de A én gang (klar); i et
// spil styrer spillets egen bot (game.bot), hvis det har en; ellers står de stille.
export function createBots(n, roster, now) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const p = roster.add({ id: `bot:${i}`, name: `Bot ${i + 1}`, source: 'bot' }, now);
    if (p) ids.push(p.id);
  }
  return {
    update(now, game, inLobby) {
      for (const id of ids) {
        const p = roster.get(id);
        if (!p) continue;
        let inp = { x: 0, y: 0, a: 0, b: 0 };
        if (game?.bot) { const b = game.bot(id); inp = { x: b.x, y: b.y, a: b.a, b: b.b ?? 0 }; }
        else if (inLobby && !p.ready && !p.raw.a) inp.a = 1;
        roster.setInput(id, inp, now);
      }
    },
  };
}
