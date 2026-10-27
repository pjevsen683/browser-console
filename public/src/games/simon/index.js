// Simon Says: værten råber RED/BLUE/NOT RED/NOT BLUE/DON'T TOUCH, og man trykker (eller lader være) på telefonen inden
// tidsgrænsen. Forkert = ude; sidste mand står. Ingen 3D: fjernsynet er DOM i hud.layer. Reglerne står i rules.js.
import { createSimon, answer, update, ranking, GRACE } from './rules.js';

const RED = '#ff4d5e', BLUE = '#3fa7ff';
const BUTTONS = { t: 'layout', kind: 'choices', prompt: 'Simon says …', options: [{ label: 'RED', color: RED }, { label: 'BLUE', color: BLUE }] };
const WAIT = (prompt) => ({ t: 'layout', kind: 'choices', prompt, options: [] });
const VOICE = { 'RED!': 'pn-red', 'BLUE!': 'pn-blue', 'NOT RED!': 'sm-notred', 'NOT BLUE!': 'sm-notblue', "DON'T TOUCH!": 'sm-dont' };

export default {
  id: 'simon',
  title: 'Simon Says',
  emoji: '🚩',
  how: 'tap RED or BLUE as told — or don\'t touch!',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createSimon(ids, ctx.rng);
    const name = (id) => info.get(id)?.name ?? '?';
    const root = document.createElement('div');
    root.className = 'sm';
    root.innerHTML = '<div class="sm-flags"><i class="r"></i><i class="b"></i></div><div class="sm-cmd"></div><div class="cr-bar"><i></i></div><div class="sm-msg"></div>';
    ctx.hud.layer.append(root);
    const cmdEl = root.querySelector('.sm-cmd'), bar = root.querySelector('.cr-bar i'), msg = root.querySelector('.sm-msg'), flags = root.querySelector('.sm-flags');
    const plans = new Map();
    let limitT = 1, overT = null;
    const layoutFor = (id) => (!info.has(id) ? null : !s.surv.alive.includes(id) ? WAIT('You are out — watch the others')
      : s.phase === 'cmd' && !s.answers.has(id) ? BUTTONS : WAIT('Get ready …'));

    ids.forEach((id) => ctx.notify(id, WAIT('Get ready …')));
    ctx.hud.banner('Simon says!', 'Tap the colour you are told');
    ctx.audio.say('sm-intro');
    return {
      done: null,
      layoutFor,
      hello: (id) => ({ t: 'state', text: info.has(id) ? '' : 'A game is on — you are in the next one', score: '' }),
      onAnswer(id, m) { if (m.t === 'answer' && answer(s, id, m.value)) ctx.audio.blip(); },
      update(dt) {
        if (s.phase === 'cmd') {
          for (const [id, p] of plans) if ((p.at -= dt) <= 0) { if (p.value !== null) answer(s, id, p.value); plans.delete(id); }
        }
        for (const e of update(s, dt)) {
          if (e.type === 'cmd') {
            const c = e.cmd;
            cmdEl.textContent = c.text;
            cmdEl.style.color = c.text.includes('RED') ? RED : c.text.includes('BLUE') ? BLUE : '#fff';
            flags.dataset.up = c.answer === 0 ? 'r' : c.answer === 1 ? 'b' : '';
            msg.textContent = '';
            limitT = e.limit;
            ctx.audio.say(VOICE[c.text]);
            for (const id of s.surv.alive) ctx.notify(id, layoutFor(id));
            plans.clear();
            const skill = Math.max(0.8, 0.98 - e.n * 0.008);
            for (const p of players) {
              if (!p.bot || !s.surv.alive.includes(p.id)) continue;
              const right = ctx.rng() < skill;
              plans.set(p.id, { at: 0.35 + ctx.rng() * (e.limit - 0.5), value: right ? c.answer : c.answer === null ? Math.floor(ctx.rng() * 2) : ctx.rng() < 0.5 ? 1 - c.answer : null });
            }
          } else if (e.type === 'result') {
            flags.dataset.up = '';
            msg.textContent = e.out.length ? `Out: ${e.out.map(name).join(', ')}` : e.wrong ? 'Everybody missed — nobody is out!' : 'Everyone made it!';
            if (e.out.length) ctx.audio.thud(5); else ctx.audio.blip(true);
            for (const id of e.out) { ctx.notify(id, { t: 'buzz', ms: 400 }); ctx.hud.tick(`🚩 ${name(id)} is out`); }
            for (const id of ids) ctx.notify(id, WAIT(e.out.includes(id) ? 'Wrong — you are out!' : !s.surv.alive.includes(id) ? 'You are out — watch the others' : e.wrong && !e.out.length ? 'Everybody missed — you live!' : 'Safe ✓'));
            if (e.event === 'round') { ctx.hud.banner(`${name(e.winner)} wins round ${s.surv.round}!`, `Best of ${s.surv.target * 2 - 1}`); ctx.audio.say('round'); }
          } else if (e.type === 'over') {
            cmdEl.textContent = '';
            ctx.hud.banner(`${name(e.winner)} wins!`, 'Last one standing');
            ctx.audio.fanfare(); ctx.audio.say('winner');
            ids.forEach((id) => ctx.notify(id, WAIT(`${name(e.winner)} won!`)));
            overT = 3;
          }
        }
        if (s.phase !== 'cmd' && s.phase !== 'result') cmdEl.textContent = '';
        bar.style.width = s.phase === 'cmd' ? `${(100 * Math.max(0, s.t - GRACE)) / limitT}%` : '0%';
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id, i) => ({ ...info.get(id), score: s.surv.wins[id], text: i === 0 ? 'last one standing' : `#${i + 1}` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !s.surv.alive.includes(p.id), text: s.phase === 'cmd' && s.answers.has(p.id) ? '✓' : s.surv.target > 1 ? '●'.repeat(s.surv.wins[p.id]) || '·' : '' })));
      },
      render(renderer) { renderer.setClearColor(0x101828); renderer.clear(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};
