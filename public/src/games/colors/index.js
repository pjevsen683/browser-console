// Color Rush: ordet siger én farve, blækket en anden -- tryk på blækkets farve på telefonen. 2-12, 10 runder.
// Ingen 3D: fjernsynet tegnes med DOM i hud.layer. Demo af svarknapperne (layout 'choices').
import { createColorRush, update, answer, ranking, COLORS, ROUND_TIME } from './rules.js';
import { esc } from '../../console/hud.js';

const RULE = 'Tap the colour of the INK';

export default {
  id: 'colors',
  title: 'Color Rush',
  emoji: '🎨',
  how: 'tap the ink colour',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createColorRush(ids, ctx.rng);
    const name = (id) => info.get(id)?.name ?? '?';
    ctx.hud.layer.innerHTML = `<div class="cr"><div class="cr-rule">${RULE}</div><div class="cr-word"></div>`
      + '<div class="cr-bar"><i></i></div><div class="cr-res"></div></div>';
    const word = ctx.hud.layer.querySelector('.cr-word'), bar = ctx.hud.layer.querySelector('.cr-bar i');
    const res = ctx.hud.layer.querySelector('.cr-res');
    const botPlan = new Map();
    let overT = null;

    const choices = () => ({
      t: 'layout', kind: 'choices', prompt: RULE,
      options: s.q.options.map((c) => ({ label: COLORS[c].name, color: COLORS[c].hex })),
    });
    const waiting = (prompt) => ({ t: 'layout', kind: 'choices', prompt, options: [] });
    const tell = (id, msg) => ctx.notify(id, msg);

    function ask() {
      word.textContent = COLORS[s.q.word].name.toUpperCase();
      word.style.color = COLORS[s.q.ink].hex;
      res.textContent = `Round ${s.round} of 10`;
      ctx.audio.blip(true);
      for (const id of ids) tell(id, choices());
      botPlan.clear();
      for (const p of players) {
        if (!p.bot) continue;
        const right = ctx.rng() < 0.8;
        botPlan.set(p.id, { at: ROUND_TIME - (0.6 + ctx.rng() * 1.4), value: right ? s.q.correct : (s.q.correct + 1) % 4 });
      }
    }

    function reveal(gained) {
      const ink = COLORS[s.q.ink];
      const best = Object.entries(gained).filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1]);
      res.innerHTML = `It was <b style="color:${ink.hex}">${ink.name}</b>`
        + (best.length ? ` · fastest: <b>${esc(name(best[0][0]))}</b>` : ' · nobody got it');
      if (best.length) ctx.audio.fanfare(); else ctx.audio.thud(2);
      for (const id of ids) {
        const g = gained[id];
        tell(id, waiting(g === undefined ? 'Too slow!' : g > 0 ? `Correct! +${g}` : `Wrong — it was ${ink.name}`));
        if (g > 0) tell(id, { t: 'buzz', ms: 60 });
      }
    }

    for (const id of ids) tell(id, waiting('Get ready …'));
    return {
      done: null,
      // En, der ikke er med i spillet, får null (konsollen giver så pind) og en vent-besked.
      layoutFor: (id) => (!info.has(id) ? null
        : s.phase === 'ask' && !s.answers.some((a) => a.id === id) ? choices() : waiting('Get ready …')),
      hello: (id) => ({ t: 'state', text: info.has(id) ? '' : 'A game is on — you are in the next one', score: '' }),
      onAnswer(id, msg) {
        if (msg.t === 'answer' && Number.isInteger(msg.value) && answer(s, id, msg.value)) ctx.audio.blip();
      },
      update(dt) {
        if (s.phase === 'ask') {
          for (const [id, plan] of botPlan) if (s.t <= plan.at) { answer(s, id, plan.value); botPlan.delete(id); }
        }
        for (const e of update(s, dt)) {
          if (e.type === 'ask') ask();
          else if (e.type === 'reveal') reveal(e.gained);
          else if (e.type === 'over') {
            const w = ranking(s)[0];
            ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} points`);
            ctx.audio.say('winner');
            word.textContent = '';
            overT = 3;
          }
        }
        bar.style.width = s.phase === 'ask' ? `${(100 * s.t) / ROUND_TIME}%` : '0%';
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => ({
          name: p.name, color: p.color, text: `${s.scores[p.id]}${s.phase === 'ask' && s.answers.some((a) => a.id === p.id) ? ' ✓' : ''}`,
        })));
      },
      render(renderer) { renderer.setClearColor(0x0a1020); renderer.clear(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};
