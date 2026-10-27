// Musical Chairs: gå rundt, mens musikken spiller; når den stopper, er der én pude færre end spillere. Den, der ikke
// får en, er ude. A skubber. Sidste mand står vinder (2-3 spillere: bedst af 3). Reglerne: rules.js, common/survival.js.
import { createWorld, step } from '../sumo/physics.js';
import { createSurvival, knockOut, nextRound, ranking } from '../common/survival.js';
import { createChairs, update } from './rules.js';
import { chairsBot } from './ai.js';
import { createView } from './view.js';

const RADIUS = 7, COUNTDOWN = 3, NEXT = 3;

export default {
  id: 'chairs',
  title: 'Musical Chairs',
  emoji: '🪑',
  how: 'when the music stops, grab a cushion!',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const surv = createSurvival(ids);
    let world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS }), chairs = createChairs(ctx.rng, { radius: RADIUS });
    const view = createView(players, RADIUS), mem = new Map();
    let time = 0, count = COUNTDOWN, lastCount = null, nextT = null, overT = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: surv.target > 1 ? '●'.repeat(surv.wins[id]) : '' });
    const seatOf = (id) => chairs.seats.find((p) => p.by === id);

    function out(list) {
      const res = knockOut(surv, list);
      for (const id of res.out) {
        const a = world.animals.find((x) => x.id === id);
        if (a) { const r = Math.hypot(a.x, a.z) || 1; Object.assign(a, { alive: false, vy: 8, vx: (a.x / r) * 5, vz: (a.z / r) * 5 }); }   // kastes ud af dansegulvet
        ctx.notify(id, { t: 'buzz', ms: 400 });
        tell(id, 'No cushion — you are out!');
        ctx.hud.tick(`🪑 ${name(id)} had no cushion`);
      }
      if (res.out.length) ctx.audio.thud(5);
      if (res.event === 'round') {
        ctx.hud.banner(`${name(res.winner)} wins round ${surv.round}!`, `Best of ${surv.target * 2 - 1}`);
        ctx.audio.fanfare();
        nextT = NEXT;
      } else if (res.event === 'over') {
        ctx.hud.banner(`${name(res.winner)} wins!`, 'Last one standing');
        ctx.audio.fanfare(); ctx.audio.say('winner');
        ids.forEach((id) => tell(id, `${name(res.winner)} won!`));
        overT = 4;
      }
    }

    ids.forEach((id) => tell(id, 'Get ready …'));
    return {
      done: null,
      bot(id) { return count > 0 || surv.phase !== 'play' ? { x: 0, y: 0, a: 0 } : chairsBot(chairs, world, id, mem, ctx.rng); },
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        return { t: 'state', text: surv.alive.includes(id) ? 'Keep moving — grab a cushion when the music stops!' : (surv.target > 1 ? 'Out — wait for the next round' : 'Out — watch the others'), score: '' };
      },
      update(dt, live) {
        time += dt;
        view.tick(dt);
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); }
          if (count <= 0) {
            ctx.hud.center('');
            ctx.audio.music('chairs');
            surv.alive.forEach((id) => tell(id, 'Keep moving …'));
          }
        }
        const inputs = new Map();
        if (count <= 0 && surv.phase === 'play') for (const p of live) if (surv.alive.includes(p.id) && !seatOf(p.id)) inputs.set(p.id, p.input);
        for (const e of step(world, inputs, dt)) {
          if (e.type === 'hit') ctx.audio.thud(e.strength);
          else if (e.type === 'push') ctx.audio.whoosh();
        }
        for (const p of chairs.seats) {                // den, der sidder, bliver siddende
          const a = p.by && world.animals.find((x) => x.id === p.by);
          if (a) Object.assign(a, { x: p.x, z: p.z, vx: 0, vz: 0, mass: 50 });
        }
        if (count <= 0 && surv.phase === 'play') {
          for (const e of update(chairs, dt, world.animals)) {
            if (e.type === 'stop') {
              ctx.audio.music(null, 60);
              ctx.audio.say('ch-sit');
              view.setSeats(e.seats);
              ctx.hud.center('SIT!');
              surv.alive.forEach((id) => { ctx.notify(id, { t: 'buzz', ms: 150 }); tell(id, 'SIT! Grab a cushion!'); });
            } else if (e.type === 'sit') {
              ctx.audio.blip(true);
              tell(e.id, 'Seated ✓');
            } else if (e.type === 'result') {
              ctx.hud.center('');
              out(e.out);
            } else if (e.type === 'music') {
              view.setSeats([]);
              for (const a of world.animals) a.mass = 1;
              if (surv.phase === 'play') { ctx.audio.music('chairs'); surv.alive.forEach((id) => tell(id, 'Keep moving …')); }
            }
          }
        }
        if (nextT !== null && (nextT -= dt) <= 0) {
          nextT = null;
          nextRound(surv);
          world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS });
          chairs = createChairs(ctx.rng, { radius: RADIUS });
          view.setSeats([]);
          mem.clear();
          count = COUNTDOWN; lastCount = null;
          ids.forEach((id) => tell(id, `Round ${surv.round} — get ready …`));
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(surv).map((id, i) => ({ ...info.get(id), score: surv.wins[id], text: i === 0 ? 'last one standing' : `#${i + 1}` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !surv.alive.includes(p.id), text: seatOf(p.id) ? '🪑' : surv.target > 1 ? '●'.repeat(surv.wins[p.id]) || '·' : '' })));
      },
      render(renderer) { view.sync(world, chairs, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
