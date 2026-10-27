// Lobbyens DOM: spilkort, ti pladser og nedtællingen. Tegnes kun om, når noget er ændret.
import { esc } from './hud.js';

const LINK = { direct: '⚡', relay: '📶', pad: '🎮', bot: '🤖' };
let last = '';

export function renderLobby(els, { games, sel, players, countdown, max }) {
  const sig = JSON.stringify([sel, countdown === null ? null : Math.ceil(countdown),
    players.map((p) => [p.id, p.name, p.color, p.link, p.ready, p.connected && !p.lost, p.rtt === undefined ? null : Math.round(p.rtt / 10)])]);
  if (sig === last) return;
  last = sig;
  const n = players.filter((p) => p.connected).length;
  els.games.innerHTML = games.map((g, i) => `<div class="gcard${i === sel ? ' sel' : ''}${n < g.minPlayers || n > g.maxPlayers ? ' dim' : ''}" data-i="${i}">`
    + `<div class="e">${g.emoji}</div><b>${esc(g.title)}</b><small>${g.minPlayers}–${g.maxPlayers} players · ${esc(g.how)}</small></div>`).join('');
  const slots = [];
  for (let i = 0; i < max; i++) {
    const p = players[i];
    slots.push(p
      ? `<div class="slot p${p.ready ? ' ready' : ''}${p.connected && !p.lost ? '' : ' lost'}"><i style="background:${p.color}"></i>`
        + `<span class="n">${esc(p.name)}</span>${p.rtt !== undefined ? `<small class="ms">${Math.round(p.rtt)} ms</small>` : ''}`
        + `<span>${LINK[p.link] ?? ''}</span><span class="r"></span></div>`
      : '<div class="slot">free</div>');
  }
  els.slots.innerHTML = slots.join('');
  els.games.children[sel]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });   // karrusellen følger valget
  const g = games[sel], missing = g.minPlayers - n;
  els.countdown.textContent = countdown !== null ? `Starting in ${Math.ceil(countdown)} …`
    : missing > 0 ? `Need ${missing} more player${missing > 1 ? 's' : ''}`
    : n > g.maxPlayers ? `At most ${g.maxPlayers} players in ${g.title}` : 'Press A when you are ready';
}
