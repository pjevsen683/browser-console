// Hot Potato: en tikkende bombe går videre, når bæreren støder ind i nogen. Sprænger den, er bæreren ude.
// Sidste overlevende vinder (2 spillere: bedst af 3). Bygger på Sumo-fysikken med kant (walls).
import { createWorld, step } from '../sumo/physics.js';
import { botInput } from '../sumo/ai.js';
import { createPotato, onHit, update, ranking } from './rules.js';
import { fleeInput } from './ai.js';
import { createView } from './view.js';

const RADIUS = 7;            // plads til 12 dyr
const COUNTDOWN = 3;

export default {
  id: 'potato',
  title: 'Hot Potato',
  emoji: '💣',
  how: 'bump someone to pass the bomb',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const view = createView(players, RADIUS);
    let world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS });
    const pot = createPotato(ids, ctx.rng);
    let time = 0, count = COUNTDOWN, lastCount = null, overT = null, lastHolder = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const alive = () => world.animals.filter((a) => a.alive).map((a) => a.id);

    function tellHolder() {
      if (pot.holder === lastHolder) return;
      lastHolder = pot.holder;
      for (const id of alive()) {
        ctx.notify(id, id === pot.holder
          ? { t: 'state', text: 'You have the BOMB! Bump someone!', score: '💣' }
          : { t: 'state', text: `Run! ${name(pot.holder)} has the bomb`, score: '' });
      }
      ctx.notify(pot.holder, { t: 'buzz', ms: 120 });
    }

    function boom(id) {
      const a = world.animals.find((x) => x.id === id);
      if (a) {
        a.alive = false;
        a.vy = 7;
        const r = Math.hypot(a.x, a.z) || 1;
        a.vx = (a.x / r) * 6; a.vz = (a.z / r) * 6;
        view.boom(a);
      }
      ctx.audio.thud(9); ctx.audio.splash();
      ctx.notify(id, { t: 'buzz', ms: 500 });
      ctx.notify(id, { t: 'state', text: 'BOOM! You are out', score: '' });
      ctx.hud.tick(`💥 ${name(id)} is out`);
    }

    ctx.notify && ids.forEach((id) => ctx.notify(id, { t: 'state', text: 'Get ready …', score: '' }));
    return {
      done: null,
      bot(id) {
        if (count > 0 || pot.phase !== 'play') return { x: 0, y: 0, a: 0 };
        return id === pot.holder ? botInput(world, id, ctx.rng) : fleeInput(world, id, pot.holder);
      },
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        if (pot.out.includes(id)) return { t: 'state', text: 'You are out — wait for the next round', score: '' };
        return id === pot.holder ? { t: 'state', text: 'You have the BOMB! Bump someone!', score: '💣' }
          : { t: 'state', text: `Run! ${name(pot.holder)} has the bomb`, score: '' };
      },
      update(dt, live) {
        time += dt;
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) { ctx.hud.center(''); ctx.hud.banner('RUN!'); ctx.audio.whistle(); tellHolder(); }
        } else if (pot.phase === 'play') {
          const inputs = new Map();
          for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
          for (const e of step(world, inputs, dt, { speed: new Map([[pot.holder, 1.15]]) })) {
            if (e.type === 'hit') {
              ctx.audio.thud(e.strength);
              if (onHit(pot, e.a, e.b)) { ctx.audio.whoosh(); tellHolder(); }
            } else if (e.type === 'push') ctx.audio.whoosh();
          }
          for (const e of update(pot, dt, alive())) {
            if (e.type === 'tick') ctx.audio.blip(e.rate > 3);
            else if (e.type === 'boom') { boom(e.id); lastHolder = null; if (pot.phase === 'play') tellHolder(); }
            else if (e.type === 'round') {
              ctx.hud.banner(`${name(e.winner)} wins the round!`, 'Best of 3');
              ctx.audio.say('round');
              world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS });
              count = COUNTDOWN; lastCount = null; lastHolder = null;
            } else if (e.type === 'over') {
              ctx.hud.banner(`${name(e.winner)} wins!`, 'Last one standing');
              ctx.audio.fanfare(); ctx.audio.say('winner');
              ctx.notify(e.winner, { t: 'buzz', ms: 400 });
              ids.forEach((id) => ctx.notify(id, { t: 'state', text: `${name(e.winner)} won!`, score: '' }));
              overT = 4;
            }
          }
        } else {
          step(world, new Map(), dt);                // de sprængte dyr flyver færdig
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          const order = ranking(pot);
          this.done = { ranking: order.map((id, i) => ({ ...info.get(id), score: pot.wins[id], text: i === 0 ? 'survivor' : `#${i + 1}` })) };
        }
        ctx.hud.scores(players.map((p) => ({
          name: p.name, color: p.color, out: pot.out.includes(p.id),
          text: p.id === pot.holder && pot.phase === 'play' ? '💣' : pot.target > 1 ? '●'.repeat(pot.wins[p.id]) || '·' : '',
        })));
      },
      render(renderer) { view.sync(world, pot, time, 1 / 60); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
