// Snowball Fight: rød mod blå på en snemark. Pind løber, A holdt nede lader op og slip kaster, B dukker. Tre træffere,
// og man er ude af runden; først til 2 runder. Reglerne står i rules.js.
import { createSnowball, update, ranking, LIVES, ROUND_TIME, WIN_ROUNDS } from './rules.js';
import { snowBot } from './ai.js';
import { createView } from './view.js';
import { TEAM_COLORS, TEAM_NAMES } from '../../console/teams.js';
import { esc } from '../../console/hud.js';

const COUNTDOWN = 3;
const DOT = ['🔴', '🔵'];

export default {
  id: 'snowball',
  title: 'Snowball Fight',
  emoji: '❄️',
  how: 'red vs blue — hold A to throw, B to duck',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const s = createSnowball(ctx.players.map((p) => p.id), ctx.rng);
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: TEAM_COLORS[s.teams.get(p.id)] }));
    const ids = players.map((p) => p.id), info = new Map(ctx.players.map((p) => [p.id, p]));
    const view = createView(players, s.field, TEAM_COLORS.slice(0, 2), ctx.rng);
    const mem = new Map();
    let count = COUNTDOWN, lastCount = null, overT = null;
    const top = document.createElement('div');
    top.className = 'sb-top';
    ctx.hud.layer.append(top);
    const name = (id) => info.get(id)?.name ?? '?';
    const team = (id) => s.teams.get(id);
    const me = (id) => s.field.players.find((p) => p.id === id);
    const teamText = (id) => `${DOT[team(id)]} You are ${TEAM_NAMES[team(id)].toUpperCase()} — hold A to throw, B to duck`;
    const livesText = (id) => '❤️'.repeat(Math.max(0, LIVES - (me(id)?.hits ?? 0)));
    const stateFor = (id) => (me(id)?.out ? { t: 'state', text: 'You are out — wait for the next round', score: '' }
      : { t: 'state', text: teamText(id), score: livesText(id) });
    const tellAll = () => ids.forEach((id) => ctx.notify(id, stateFor(id)));
    const sayTeam = (t) => ctx.audio.say(t === 0 ? 'sb-red' : 'sb-blue');

    tellAll();
    return {
      done: null,
      bot(id) { return count > 0 ? { x: 0, y: 0, a: 0 } : snowBot(s, id, mem, ctx.rng); },
      hello(id) { return info.has(id) && s.teams.has(id) ? stateFor(id) : { t: 'state', text: 'A game is on — you are in the next one', score: '' }; },
      update(dt, live) {
        view.tick(dt);
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) { ctx.hud.center(''); ctx.hud.banner('Snowball fight!', `Round 1 · first to ${WIN_ROUNDS}`); ctx.audio.whistle(); ctx.audio.say('sb-intro'); }
        } else if (s.phase !== 'over') {
          const inputs = new Map();
          for (const p of live) if (s.teams.has(p.id)) inputs.set(p.id, p.input);
          for (const e of update(s, inputs, dt)) {
            if (e.type === 'throw') ctx.audio.whoosh();
            else if (e.type === 'block' || e.type === 'land') { ctx.audio.poof(); view.puff(e.ball.x, e.ball.z, e.type === 'block' ? 1.1 : 0.2); }
            else if (e.type === 'hit') {
              ctx.audio.poof(); ctx.audio.thud(4); view.puff(e.x, e.z);
              ctx.notify(e.id, { t: 'buzz', ms: e.out ? 500 : 200 });
              ctx.notify(e.id, stateFor(e.id));
              ctx.notify(e.by, { t: 'buzz', ms: 60 });                   // kasteren mærker træffet; teksten forbliver holdet
              if (e.out) { ctx.audio.say('sb-out'); ctx.hud.tick(`❄️ ${name(e.by)} knocked out ${name(e.id)}`); }
            } else if (e.type === 'round') {
              if (e.winner === null) { ctx.hud.banner('Draw!', 'Nobody wins the round'); ctx.audio.say('round'); }
              else { ctx.hud.banner(`${TEAM_NAMES[e.winner]} team wins round ${s.round}!`, `${s.wins[0]} – ${s.wins[1]}`); sayTeam(e.winner); }
            } else if (e.type === 'start') {
              ctx.hud.banner(`Round ${s.round}`, `${TEAM_NAMES[0]} ${s.wins[0]} – ${s.wins[1]} ${TEAM_NAMES[1]}`);
              ctx.audio.whistle();
              tellAll();
            } else if (e.type === 'over') {
              const w = e.winner;
              if (w === null) ctx.hud.banner("It's a draw!");
              else { ctx.hud.banner(`${TEAM_NAMES[w]} team wins!`, `${s.wins[w]} rounds to ${s.wins[1 - w]}`); sayTeam(w); }
              ctx.audio.fanfare();
              ids.forEach((id) => ctx.notify(id, { t: 'state', text: w === null ? 'Draw!' : team(id) === w ? 'Your team won! 🎉' : `${TEAM_NAMES[w]} team won`, score: '' }));
              overT = 4;
            }
          }
        }
        const secs = Math.max(0, Math.ceil(count > 0 || s.phase === 'break' ? ROUND_TIME : s.t));
        const html = `<b style="color:${TEAM_COLORS[0]}">${esc(TEAM_NAMES[0])} ${s.wins[0]}</b> <span>⏱ ${secs}</span> <b style="color:${TEAM_COLORS[1]}">${s.wins[1]} ${esc(TEAM_NAMES[1])}</b>`;
        if (html !== top.innerHTML) top.innerHTML = html;
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { title: s.winner === null ? 'Draw' : `${TEAM_NAMES[s.winner]} team`, ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.hitsBy[id], text: `${TEAM_NAMES[team(id)]} · ${s.hitsBy[id]} hits` })) };
        }
        ctx.hud.scores(players.map((p) => {
          const m = me(p.id);
          return { name: p.name, color: p.color, out: !!m?.out, score: Math.max(0, LIVES - (m?.hits ?? 0)), of: LIVES };
        }));
      },
      render(renderer) { view.sync(s); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
