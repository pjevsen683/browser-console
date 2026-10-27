// Color Panic: en farve meldes, og man skal stå på et felt i den farve, før de andre felter synker. A skubber. Sidste
// mand står vinder (2-3 spillere: bedst af 3). Reglerne står i rules.js og common/survival.js.
import { createWorld, step } from '../sumo/physics.js';
import { createSurvival, knockOut, nextRound, ranking } from '../common/survival.js';
import { createPanic, update, COLORS } from './rules.js';
import { panicBot } from './ai.js';
import { createView } from './view.js';

const RADIUS = 7, COUNTDOWN = 3, NEXT = 3;

export default {
  id: 'panic',
  title: 'Color Panic',
  emoji: '🟥',
  how: 'stand on the called color before the floor drops',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const surv = createSurvival(ids);
    let world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS }), panic = createPanic(ctx.rng, { radius: RADIUS });
    const view = createView(players, panic), mem = new Map();
    const box = document.createElement('div');
    box.className = 'pn-call';
    box.innerHTML = '<b></b><i></i>';
    ctx.hud.layer.append(box);
    let time = 0, count = COUNTDOWN, lastCount = null, nextT = null, overT = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: surv.target > 1 ? '●'.repeat(surv.wins[id]) : '' });
    const tellAlive = (text) => surv.alive.forEach((id) => tell(id, text));

    function out(list) {
      const res = knockOut(surv, list);
      for (const id of res.out) {
        const a = world.animals.find((x) => x.id === id);
        if (a) { a.alive = false; a.vy = 0; a.vx *= 0.2; a.vz *= 0.2; }
        ctx.notify(id, { t: 'buzz', ms: 400 });
        tell(id, surv.target > 1 ? 'You fell! Wait for the next round' : 'You fell! Watch the others');
        ctx.hud.tick(`💦 ${name(id)} fell`);
      }
      if (res.out.length) ctx.audio.splash();
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
      bot(id) { return count > 0 || surv.phase !== 'play' ? { x: 0, y: 0, a: 0 } : panicBot(panic, world, id, mem, ctx.rng); },
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        return { t: 'state', text: surv.alive.includes(id) ? 'Stand on the called color!' : (surv.target > 1 ? 'Out — wait for the next round' : 'Out — watch the others'), score: '' };
      },
      update(dt, live) {
        time += dt;
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) {
            ctx.hud.center('');
            if (surv.round === 1) { ctx.hud.banner('Color Panic!', 'Stand on the called color'); ctx.audio.say('pn-intro'); }
            ctx.audio.whistle();
          }
        }
        const inputs = new Map();
        if (count <= 0 && surv.phase === 'play') for (const p of live) if (surv.alive.includes(p.id)) inputs.set(p.id, p.input);
        for (const e of step(world, inputs, dt)) {
          if (e.type === 'hit') ctx.audio.thud(e.strength);
          else if (e.type === 'push') ctx.audio.whoosh();
        }
        if (count <= 0 && surv.phase === 'play') {
          for (const e of update(panic, dt, world.animals)) {
            if (e.type === 'call') {
              const c = COLORS[e.color];
              ctx.audio.say(`pn-${c.name.toLowerCase()}`);
              ctx.audio.blip(true);
              tellAlive(`Stand on ${c.name}!`);
            } else if (e.type === 'sink' || e.type === 'fall') {
              if (e.type === 'sink') ctx.audio.thud(3);
              if (e.out.length) out(e.out);
            }
          }
        }
        if (nextT !== null && (nextT -= dt) <= 0) {
          nextT = null;
          nextRound(surv);
          world = createWorld(ids, ctx.rng, { walls: true, radius: RADIUS });
          panic = createPanic(ctx.rng, { radius: RADIUS });
          view.setTiles(panic);
          mem.clear();
          count = COUNTDOWN; lastCount = null;
          ids.forEach((id) => tell(id, `Round ${surv.round} — get ready …`));
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(surv).map((id, i) => ({ ...info.get(id), score: surv.wins[id], text: i === 0 ? 'last one standing' : `#${i + 1}` })) };
        }
        // kaldet: farven og tiden, der er tilbage
        const c = panic.phase === 'call' && count <= 0 && surv.phase === 'play' ? COLORS[panic.color] : null;
        box.style.display = c ? '' : 'none';
        if (c) {
          const b = box.firstChild;
          if (b.textContent !== c.name) { b.textContent = c.name; box.style.setProperty('--c', c.hex); }
          box.lastChild.style.width = `${Math.max(0, panic.t / panic.callLen) * 100}%`;
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !surv.alive.includes(p.id), text: surv.target > 1 ? '●'.repeat(surv.wins[p.id]) || '·' : '' })));
      },
      render(renderer) { view.sync(world, panic, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
