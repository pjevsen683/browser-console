// Tug of War: rød mod blå; hamr på A for at trække. Tempoet pr. spiller tæller (holdene kan være 1 forskellige).
// Først til 2 runder. Reglerne står i rules.js.
import { createTug, press, update, ranking, WIN } from './rules.js';
import { tugBot } from './ai.js';
import { createView } from './view.js';
import { TEAM_COLORS, TEAM_NAMES } from '../../console/teams.js';
import { esc } from '../../console/hud.js';

const DOT = ['🔴', '🔵'];

export default {
  id: 'tug',
  title: 'Tug of War',
  emoji: '🪢',
  how: 'red vs blue — mash A to pull!',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const s = createTug(ctx.players.map((p) => p.id));
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: TEAM_COLORS[s.teams.get(p.id)] }));
    const ids = players.map((p) => p.id), info = new Map(ctx.players.map((p) => [p.id, p]));
    const view = createView(players, s.teams), mem = new Map();
    const top = document.createElement('div');
    top.className = 'sb-top';
    ctx.hud.layer.append(top);
    let time = 0, lastCount = null, overT = null, roundWinner = null;
    const team = (id) => s.teams.get(id);
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: `${DOT[team(id)]} ${TEAM_NAMES[team(id)]}` });
    const tellAll = (fn) => ids.forEach((id) => tell(id, fn(id)));

    tellAll((id) => `You pull for ${TEAM_NAMES[team(id)].toUpperCase()} — get ready …`);
    return {
      done: null,
      bot: (id) => (s.phase === 'play' ? tugBot(id, mem, ctx.rng) : { x: 0, y: 0, a: 0, b: 0 }),
      hello(id) {
        if (!s.teams.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        const text = s.phase === 'play' ? 'MASH A!' : s.phase === 'over' ? (s.winner === null ? 'Draw!' : team(id) === s.winner ? 'Your team won! 🎉' : `${TEAM_NAMES[s.winner]} team won`) : 'Get ready …';
        return { t: 'state', text, score: `${DOT[team(id)]} ${TEAM_NAMES[team(id)]}` };
      },
      update(dt, live) {
        time += dt;
        view.tick(dt);
        if (s.phase === 'play') for (const p of live) if (p.input.aPressed && press(s, p.id)) view.jolt(p.id);
        if (s.phase === 'countdown') {
          const n = Math.ceil(s.t);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
        }
        for (const e of update(s, dt)) {
          if (e.type === 'start') {
            roundWinner = null;
            ctx.hud.center(''); ctx.hud.banner('PULL!', `Round ${s.round} · first to ${WIN}`);
            ctx.audio.say('tg-intro'); ctx.audio.whistle();
            tellAll(() => 'MASH A!');
          } else if (e.type === 'round') {
            roundWinner = e.winner;
            if (e.winner === null) ctx.hud.banner('Draw!');
            else { ctx.hud.banner(`${TEAM_NAMES[e.winner]} team wins round ${s.round}!`, `${s.wins[0]} – ${s.wins[1]}`); ctx.audio.say(e.winner === 0 ? 'sb-red' : 'sb-blue'); }
            ctx.audio.splash();
          } else if (e.type === 'next') { lastCount = null; tellAll(() => 'Next round — get ready …'); }
          else if (e.type === 'over') {
            ctx.audio.fanfare();
            if (e.winner !== null) ctx.hud.banner(`${TEAM_NAMES[e.winner]} team wins!`, `${s.wins[e.winner]} rounds to ${s.wins[1 - e.winner]}`);
            tellAll((id) => (e.winner === null ? 'Draw!' : team(id) === e.winner ? 'Your team won! 🎉' : `${TEAM_NAMES[e.winner]} team won`));
            overT = 4;
          }
        }
        const html = `<b style="color:${TEAM_COLORS[0]}">${esc(TEAM_NAMES[0])} ${s.wins[0]}</b> <span>⏱ ${Math.max(0, Math.ceil(s.phase === 'play' ? s.t : 30))}</span> <b style="color:${TEAM_COLORS[1]}">${s.wins[1]} ${esc(TEAM_NAMES[1])}</b>`;
        if (html !== top.innerHTML) top.innerHTML = html;
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { title: s.winner === null ? 'Draw' : `${TEAM_NAMES[s.winner]} team`, ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.presses[id], text: `${TEAM_NAMES[team(id)]} · ${s.presses[id]} pulls` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: String(s.presses[p.id]) })));
      },
      render(renderer) { view.sync(s.pos, time, roundWinner); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
