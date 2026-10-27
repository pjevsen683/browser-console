// Mini Racers: små biler på et kæmpe køkkenbord (Micro Machines). Pinden peger, hvor bilen skal hen, A speeder, B
// bremser. Kameraet følger feltet; den, der falder for langt bagud, er ude af runden, og alle andre får et point.
// 5 runder. Reglerne står i rules.js.
import { buildLoop } from './track.js';
import { createCars, placeGrid, step } from './physics.js';
import { createCup, updateCup, ranking, gapAt, ROUNDS } from './rules.js';
import { carBot } from './ai.js';
import { createView } from './view.js';

const IDLE = { x: 0, y: 0, a: 0, b: 0 };

export default {
  id: 'racer',
  title: 'Mini Racers',
  emoji: '🏎️',
  how: 'stick: point where to drive · A: gas · B: brake',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const track = buildLoop(ctx.rng);
    const cars = createCars(ids, track);
    placeGrid(cars, track, 0, [...ids].sort(() => ctx.rng() - 0.5));
    const cup = createCup(ids), mem = new Map();
    const view = createView(players, track);
    let lastCount = null, overT = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const car = (id) => cars.find((c) => c.id === id);
    const pts = (id) => `${cup.points[id]} pts`;
    const HOW = 'Point the stick where to drive · A gas · B brake';
    const tellAll = (text) => ids.forEach((id) => ctx.notify(id, { t: 'state', text, score: pts(id) }));

    tellAll('Get ready …');
    return {
      done: null,
      bot: (id) => (cup.phase === 'play' ? carBot(cars, track, id, mem, ctx.rng) : IDLE),
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A race is on — you are in the next game', score: '' };
        return { t: 'state', text: car(id)?.out ? 'Out — wait for the next round' : HOW, score: pts(id) };
      },
      update(dt, live) {
        if (cup.phase === 'countdown') {
          const n = Math.ceil(cup.t);
          if (n !== lastCount && n > 0) {
            if (lastCount === null) ctx.hud.banner(`Round ${cup.round} of ${ROUNDS}`, 'Do not fall off the screen!');
            if (lastCount === null && cup.round === 1) ctx.audio.say('rc-intro');
            else { ctx.audio.say(`count-${n}`); }
            lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip();
          }
        } else if (cup.phase === 'play' || cup.phase === 'break') {
          const inputs = new Map();
          if (cup.phase === 'play') for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
          for (const e of step(cars, track, inputs, dt)) {
            if (e.type === 'bump') { ctx.audio.thud(Math.min(4, e.speed / 3)); ctx.notify(e.a, { t: 'buzz', ms: 40 }); ctx.notify(e.b, { t: 'buzz', ms: 40 }); }
            else if (e.type === 'hit') { ctx.audio.thud(Math.min(5, e.speed / 2)); ctx.notify(e.id, { t: 'buzz', ms: 80 }); }
            else if (e.type === 'lost') { ctx.audio.poof(); ctx.notify(e.id, { t: 'buzz', ms: 200 }); ctx.hud.tick(`${name(e.id)} got lost on the tablecloth!`); }
            else if (e.type === 'fall') { ctx.audio.whoosh(); ctx.notify(e.id, { t: 'buzz', ms: 250 }); ctx.hud.tick(`${name(e.id)} drove off the table!`); }
          }
        }
        for (const e of updateCup(cup, cars, dt)) {
          if (e.type === 'start') {
            ctx.hud.center(''); ctx.hud.banner('GO!'); ctx.audio.whistle(); ctx.audio.say('go');
            tellAll(HOW);
          } else if (e.type === 'out') {
            ctx.audio.thud(3);
            ctx.hud.tick(`💥 ${name(e.id)} is out — everyone else +1`);
            ctx.notify(e.id, { t: 'buzz', ms: 300 });
            ctx.notify(e.id, { t: 'state', text: 'Out — wait for the next round', score: pts(e.id) });
            for (const c of cars) if (!c.out) ctx.notify(c.id, { t: 'state', text: HOW, score: pts(c.id) });
          } else if (e.type === 'roundEnd') {
            ctx.hud.banner(`${name(e.winner)} wins round ${cup.round}!`, cars.filter((c) => !c.out).length > 1 ? 'Time is up' : 'Last car standing');
            ctx.audio.say('rc-last'); ctx.audio.fanfare();
            ids.forEach((id) => ctx.notify(id, { t: 'state', text: id === e.winner ? 'You won the round! 🏁' : `${name(e.winner)} won the round`, score: pts(id) }));
          } else if (e.type === 'next') {
            placeGrid(cars, track, car(cup.lastOrder[0]).p, cup.lastOrder);
            view.snapCamera();
            lastCount = null;
            tellAll('Next round — get ready …');
          } else if (e.type === 'over') {
            const w = ranking(cup)[0];
            ctx.hud.banner(`${name(w)} wins!`, `${cup.points[w]} points`);
            ctx.audio.fanfare(); ctx.audio.say('winner');
            tellAll(`${name(w)} won!`);
            overT = 4;
          }
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(cup).map((id) => ({ ...info.get(id), score: cup.points[id], text: pts(id) })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !!car(p.id)?.out, text: String(cup.points[p.id]) })));
      },
      render(renderer) {
        view.sync(cars, cup.phase === 'play' ? gapAt(cup.roundT) : gapAt(0));
        renderer.render(view.scene, view.camera);
      },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
