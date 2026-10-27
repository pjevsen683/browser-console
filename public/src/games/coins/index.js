// Coin Grab: mønter regner ned; saml dem op, og skub (A) de andre, så de taber deres. Flest mønter efter 60 s vinder.
// Reglerne står i rules.js.
import { createWorld, step } from '../sumo/physics.js';
import { createCoins, update, bump, ranking, ROUND } from './rules.js';
import { coinBot } from './ai.js';
import { createView } from './view.js';

const RADIUS = 7, COUNTDOWN = 3;

export default {
  id: 'coins',
  title: 'Coin Grab',
  emoji: '🪙',
  how: 'grab the falling coins — A bumps others so they drop theirs',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS });
    const s = createCoins(ids, ctx.rng, { radius: RADIUS });
    const view = createView(players, RADIUS);
    const timer = document.createElement('div');
    timer.className = 'cc-timer';
    ctx.hud.layer.append(timer);
    let time = 0, count = COUNTDOWN, lastCount = null, overT = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const tell = (id, text = 'Grab the coins! A bumps') => ctx.notify(id, { t: 'state', text, score: `🪙 ${s.scores[id]}` });

    ids.forEach((id) => tell(id, 'Get ready …'));
    return {
      done: null,
      bot(id) { return count > 0 || s.over ? { x: 0, y: 0, a: 0 } : coinBot(s, world, id, ctx.rng); },
      hello(id) { return info.has(id) ? { t: 'state', text: 'Grab the coins! A bumps', score: `🪙 ${s.scores[id]}` } : { t: 'state', text: 'A game is on — you are in the next one', score: '' }; },
      update(dt, live) {
        time += dt;
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) { ctx.hud.center(''); ctx.hud.banner('Grab the coins!'); ctx.audio.say('cn-intro'); ctx.audio.whistle(); ids.forEach((id) => tell(id)); }
        }
        const inputs = new Map();
        if (count <= 0 && !s.over) for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
        for (const e of step(world, inputs, dt)) {
          if (e.type === 'push') ctx.audio.whoosh();
          else if (e.type === 'hit') {
            ctx.audio.thud(e.strength);
            if (e.dasher && !s.over && count <= 0) {
              const victim = e.dasher === e.a ? e.b : e.a, a = world.animals.find((x) => x.id === victim);
              const r = bump(s, victim, a.x, a.z);
              if (r.dropped) {
                ctx.audio.blip(true);
                ctx.notify(victim, { t: 'buzz', ms: 200 });
                tell(victim, `Ouch! You dropped ${r.dropped}`);
                if (r.dropped >= 5) ctx.hud.tick(`💥 ${name(e.dasher)} made ${name(victim)} drop ${r.dropped} coins`);
              }
            }
          }
        }
        if (count <= 0 && !s.over) {
          for (const e of update(s, dt, world.animals)) {
            if (e.type === 'pick') { ctx.audio.blip(e.value > 1); tell(e.id); }
            else if (e.type === 'over') {
              const w = ranking(s)[0];
              ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} coins`);
              ctx.audio.fanfare(); ctx.audio.say('winner');
              ids.forEach((id) => tell(id, id === w ? 'You won! 🪙' : `${name(w)} won!`));
              overT = 4;
            }
          }
        }
        const secs = String(Math.max(0, Math.ceil(count > 0 ? ROUND : s.t)));
        if (timer.textContent !== `⏱ ${secs}`) timer.textContent = `⏱ ${secs}`;
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} coins` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: String(s.scores[p.id]) })));
      },
      render(renderer) { view.sync(world, s, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
