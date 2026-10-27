// Bombs Away: bomber falder på øen; gå væk fra skyggerne, og pas på kanten. A skubber (gerne nogen ind under en
// bombe). Sidste mand står vinder (2-3 spillere: bedst af 3). Reglerne: rules.js og common/survival.js.
import { createWorld, step } from '../sumo/physics.js';
import { createSurvival, knockOut, nextRound, ranking } from '../common/survival.js';
import { createBombs, update } from './rules.js';
import { bombBot } from './ai.js';
import { createView } from './view.js';

const RADIUS = 7, COUNTDOWN = 3, NEXT = 3, PUSH_R = 3.2;

export default {
  id: 'bombs',
  title: 'Bombs Away',
  emoji: '💥',
  how: 'dodge the falling bombs — stay on the island',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const surv = createSurvival(ids);
    const fresh = () => createWorld(ids, ctx.rng, { radius: RADIUS });
    let world = fresh(), bombs = createBombs(ctx.rng, { radius: RADIUS });
    const view = createView(players, RADIUS), mem = new Map();
    let time = 0, count = COUNTDOWN, lastCount = null, nextT = null, overT = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: surv.target > 1 ? '●'.repeat(surv.wins[id]) : '' });

    function out(list, how) {
      const res = knockOut(surv, list);
      for (const id of list) {
        const a = world.animals.find((x) => x.id === id);
        if (!a) continue;
        if (!res.out.includes(id)) {                    // alle ville være ude: ingen er det (den faldne kommer op igen)
          if (!a.alive) Object.assign(a, { alive: true, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0 });
          continue;
        }
        if (how === 'boom') {
          const r = Math.hypot(a.x, a.z) || 1;
          Object.assign(a, { alive: false, vy: 7, vx: (a.x / r) * 6, vz: (a.z / r) * 6 });
        }
        ctx.notify(id, { t: 'buzz', ms: 400 });
        tell(id, how === 'boom' ? 'BOOM! You are out' : 'Splash! You are out');
        ctx.hud.tick(how === 'boom' ? `💥 ${name(id)} got blown up` : `💦 ${name(id)} fell in the sea`);
      }
      if (res.event) bombs.bombs = [];                   // runden er afgjort: bomberne i luften forsvinder
      if (res.event === 'round') {
        ctx.hud.banner(`${name(res.winner)} wins round ${surv.round}!`, `Best of ${surv.target * 2 - 1}`);
        ctx.audio.say('round');
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
      bot(id) { return count > 0 || surv.phase !== 'play' ? { x: 0, y: 0, a: 0 } : bombBot(bombs, world, id, mem, ctx.rng); },
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        return { t: 'state', text: surv.alive.includes(id) ? 'Dodge the bombs!' : (surv.target > 1 ? 'Out — wait for the next round' : 'Out — watch the others'), score: '' };
      },
      update(dt, live) {
        time += dt;
        view.tick(dt);
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) {
            ctx.hud.center('');
            if (surv.round === 1) { ctx.hud.banner('Bombs away!'); ctx.audio.say('bm-intro'); }
            ctx.audio.whistle();
            surv.alive.forEach((id) => tell(id, 'Dodge the bombs!'));
          }
        }
        const inputs = new Map();
        const playing = count <= 0 && surv.phase === 'play';
        if (playing) for (const p of live) if (surv.alive.includes(p.id)) inputs.set(p.id, p.input);
        const fell = [];
        for (const e of step(world, inputs, dt)) {
          if (e.type === 'hit') ctx.audio.thud(e.strength);
          else if (e.type === 'push') ctx.audio.whoosh();
          else if (e.type === 'fall') { ctx.audio.splash(); fell.push(e.id); }
        }
        if (fell.length && playing) out(fell, 'fall');    // efter afgørelsen er de ikke med mere: de bliver i vandet
        if (playing) {
          for (const e of update(bombs, dt, world.animals)) {
            if (e.type === 'boom') {
              ctx.audio.thud(9); ctx.audio.poof();
              view.boom(e.bomb.x, e.bomb.z);
              if (e.out.length) out(e.out, 'boom');
              for (const a of world.animals) {               // trykbølgen skubber dem, der står tæt på (og ikke røg ud)
                const dx = a.x - e.bomb.x, dz = a.z - e.bomb.z, d = Math.hypot(dx, dz);
                if (!a.alive || d > PUSH_R) continue;
                const k = (1 - d / PUSH_R) * 7;
                a.vx += (d < 1e-3 ? 1 : dx / d) * k; a.vz += (d < 1e-3 ? 0 : dz / d) * k;
              }
            }
          }
        }
        if (nextT !== null && (nextT -= dt) <= 0) {
          nextT = null;
          nextRound(surv);
          world = fresh();
          bombs = createBombs(ctx.rng, { radius: RADIUS });
          mem.clear();
          count = COUNTDOWN; lastCount = null;
          ids.forEach((id) => tell(id, `Round ${surv.round} — get ready …`));
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(surv).map((id, i) => ({ ...info.get(id), score: surv.wins[id], text: i === 0 ? 'last one standing' : `#${i + 1}` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !surv.alive.includes(p.id), text: surv.target > 1 ? '●'.repeat(surv.wins[p.id]) || '·' : '' })));
      },
      render(renderer) { view.sync(world, bombs, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
