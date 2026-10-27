// Plunger Roulette: på skift vælger man en udløser på telefonen; én af dem er bomben. Sidste mand står vinder.
// Ingen 3D: fjernsynet er DOM i hud.layer. Reglerne står i rules.js.
import { createPlunger, pick, update, ranking } from './rules.js';
import { esc } from '../../console/hud.js';

const WAIT = (prompt) => ({ t: 'layout', kind: 'choices', prompt, options: [] });

export default {
  id: 'plunger',
  title: 'Plunger Roulette',
  emoji: '🧨',
  how: 'take turns picking a plunger — one is the bomb',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createPlunger(ids, ctx.rng);
    const name = (id) => info.get(id)?.name ?? '?';
    const root = document.createElement('div');
    root.className = 'pl';
    root.innerHTML = '<div class="pl-who"></div><div class="pl-row"></div><div class="pl-msg"></div>';
    ctx.hud.layer.append(root);
    const who = root.querySelector('.pl-who'), row = root.querySelector('.pl-row'), msg = root.querySelector('.pl-msg');
    let turn = null, boomAt = -1, drumAcc = 0, botAt = null, overT = null;
    const layoutFor = (id) => {
      if (!info.has(id)) return null;
      if (s.phase === 'pick' && turn?.id === id) return { t: 'layout', kind: 'choices', prompt: 'Pick a plunger!', options: turn.options.map((i) => ({ label: String(i + 1), color: '#ffd23f' })) };
      if (!s.surv.alive.includes(id)) return WAIT('You are out — watch the others');
      if (s.phase === 'drum' && turn) return WAIT(`${name(turn.id)} pushed plunger ${s.choice + 1} …`);
      return WAIT(turn ? `${name(turn.id)} is picking …` : 'Get ready …');
    };
    const tellAll = () => ids.forEach((id) => ctx.notify(id, layoutFor(id)));

    function draw() {
      row.innerHTML = Array.from({ length: s.plungers }, (_, i) => {
        const cls = i === boomAt ? 'boom' : s.picked.includes(i) ? 'safe' : s.phase === 'drum' && s.choice === i ? 'drum' : '';
        return `<div class="pl-p ${cls}"><div class="pl-h"></div><div class="pl-box">${i === boomAt ? '💥' : s.picked.includes(i) ? '✓' : i + 1}</div></div>`;
      }).join('');
    }

    ids.forEach((id) => ctx.notify(id, WAIT('Get ready …')));
    ctx.hud.banner('Plunger Roulette!', 'One of them is the bomb …');
    ctx.audio.say('pl-intro');
    return {
      done: null,
      layoutFor,
      hello: (id) => ({ t: 'state', text: info.has(id) ? '' : 'A game is on — you are in the next one', score: '' }),
      onAnswer(id, m) {
        if (m.t !== 'answer' || !Number.isInteger(m.value) || !turn || id !== turn.id) return;
        const i = turn.options[m.value];
        if (i !== undefined) pick(s, id, i);
      },
      update(dt, live) {
        if (s.phase === 'pick' && turn && s.t > 0.5) {            // den, der har tur, er væk: vælg for den med det samme
          const p = live.find((x) => x.id === turn.id);
          if (!p || !p.connected || p.lost) s.t = 0.5;
        }
        if (s.phase === 'pick' && botAt !== null && (botAt -= dt) <= 0) {
          botAt = null;
          pick(s, turn.id, turn.options[Math.floor(ctx.rng() * turn.options.length)]);
        }
        if (s.phase === 'drum' && (drumAcc += dt) >= 0.14) { drumAcc = 0; ctx.audio.blip(); }
        for (const e of update(s, dt)) {
          if (e.type === 'round') { boomAt = -1; ctx.audio.whistle(); }
          else if (e.type === 'turn') {
            turn = e;
            who.innerHTML = `<i style="background:${info.get(e.id).color}"></i>${esc(name(e.id))} picks`;
            msg.textContent = e.options.length === 1 ? 'Only the bomb is left …' : '';
            botAt = info.get(e.id).bot ? 1 + ctx.rng() * 1.5 : null;
            tellAll();
            ctx.notify(e.id, { t: 'buzz', ms: 100 });
          } else if (e.type === 'drum') {
            msg.textContent = `${name(e.id)} pushes plunger ${e.plunger + 1}${e.auto ? ' (too slow!)' : ''} …`;
            tellAll();
          } else if (e.type === 'safe') {
            msg.textContent = `Phew! ${name(e.id)} is safe`;
            ctx.audio.blip(true);
          } else if (e.type === 'boom') {
            boomAt = e.plunger;
            msg.textContent = `💥 BOOM! ${name(e.id)} is out`;
            ctx.audio.thud(9); ctx.audio.splash();
            ctx.notify(e.id, { t: 'buzz', ms: 600 });
            ctx.hud.tick(`💥 ${name(e.id)} found the bomb`);
            if (e.event === 'round') { ctx.hud.banner(`${name(e.winner)} wins round ${s.surv.round}!`, `Best of ${s.surv.target * 2 - 1}`); ctx.audio.say('round'); }
            turn = null;
            tellAll();
          } else if (e.type === 'over') {
            ctx.hud.banner(`${name(e.winner)} wins!`, 'Last one standing');
            ctx.audio.fanfare(); ctx.audio.say('winner');
            ids.forEach((id) => ctx.notify(id, WAIT(`${name(e.winner)} won!`)));
            overT = 3;
          }
        }
        draw();
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id, i) => ({ ...info.get(id), score: s.surv.wins[id], text: i === 0 ? 'survivor' : `#${i + 1}` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !s.surv.alive.includes(p.id), text: turn?.id === p.id ? '👉' : s.surv.target > 1 ? '●'.repeat(s.surv.wins[p.id]) || '·' : '' })));
      },
      render(renderer) { renderer.setClearColor(0x1a1020); renderer.clear(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};
