// Penguin Race: alle glider på maven ned ad en bugtet isbane. Pind styrer, A hopper, fisk giver fart. Mere end
// OUT_GAP bag føreren: ude af løbet. 3 løb, point N-1-placering, flest point vinder.
import { buildTrack } from './track.js';
import { createRace, step } from './physics.js';
import { createSeries, updateSeries, ranking, RACES } from './rules.js';
import { botRace } from './ai.js';
import { createView } from './view.js';

const ORD = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

export default {
  id: 'race',
  title: 'Penguin Race',
  emoji: '🛷',
  how: 'stick: steer · A: jump',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const view = createView(players);
    const series = createSeries(ids);
    let track = buildTrack(ctx.rng), race = createRace(ids, track), time = 0, lastCount = null, overT = null, finishers = 0;
    view.setTrack(track);
    const name = (id) => info.get(id)?.name ?? '?';
    const tellAll = (text) => ids.forEach((id) => ctx.notify(id, { t: 'state', text, score: `${series.totals[id]} pts` }));

    function onEvent(e) {
      if (e.type === 'jump') ctx.audio.whoosh();
      else if (e.type === 'fish') ctx.audio.blip(true);
      else if (e.type === 'bump') { ctx.audio.thud(4); ctx.notify(e.id, { t: 'buzz', ms: 60 }); }
      else if (e.type === 'fall') { ctx.audio.splash(); ctx.notify(e.id, { t: 'buzz', ms: 200 }); }
      else if (e.type === 'out') {
        ctx.audio.thud(3);
        ctx.hud.tick(`${name(e.id)} fell behind — out!`);
        ctx.notify(e.id, { t: 'state', text: 'Too far behind — out of this race', score: '' });
        ctx.notify(e.id, { t: 'buzz', ms: 300 });
      } else if (e.type === 'finish') {
        finishers++;
        if (finishers === 1) { ctx.audio.fanfare(); ctx.hud.banner(`${name(e.id)} wins race ${series.race}!`); }
        ctx.hud.tick(`${name(e.id)} finished ${ORD(finishers)}`);
        ctx.notify(e.id, { t: 'state', text: `You finished ${ORD(finishers)}!`, score: '' });
      }
    }

    tellAll('Get ready …');
    return {
      done: null,
      bot: (id) => (series.phase === 'play' ? botRace(race, track, id) : { x: 0, y: 0, a: 0 }),
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A race is on — you are in the next game', score: '' };
        const a = race.racers.find((r) => r.id === id);
        return { t: 'state', text: a?.out ? 'Out of this race — wait for the next' : 'Steer with the stick, A to jump', score: `${series.totals[id]} pts` };
      },
      update(dt, live) {
        time += dt;
        if (series.phase === 'countdown') {
          const n = Math.ceil(series.t);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
        } else if (series.phase === 'play') {
          const inputs = new Map();
          for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
          for (const e of step(race, track, inputs, dt)) onEvent(e);
        }
        const c = updateSeries(series, race, dt);
        if (c?.type === 'start') {
          ctx.hud.center(''); ctx.hud.banner('GO!', `Race ${series.race} of ${RACES}`);
          ctx.audio.whistle(); ctx.audio.say('go');
          tellAll('Steer with the stick, A to jump!');
        } else if (c?.type === 'raceEnd') {
          ctx.audio.say('round');
          c.order.forEach((id, i) => ctx.notify(id, { t: 'state', text: `${ORD(i + 1)} in race ${series.race} · +${c.gained[id]}`, score: `${series.totals[id]} pts` }));
        } else if (c?.type === 'next') {
          track = buildTrack(ctx.rng); race = createRace(ids, track); finishers = 0; lastCount = null;
          view.setTrack(track); view.snapCamera();
          tellAll('Next race — get ready …');
        } else if (c?.type === 'over') {
          const w = ranking(series)[0];
          ctx.hud.banner(`${name(w)} wins!`, `${series.totals[w]} points`);
          ctx.audio.fanfare(); ctx.audio.say('winner');
          tellAll(`${name(w)} won!`);
          overT = 4;
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(series).map((id) => ({ ...info.get(id), score: series.totals[id], text: `${series.totals[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => {
          const a = race.racers.find((r) => r.id === p.id);
          return { name: p.name, color: p.color, out: a?.out, text: `${series.totals[p.id]}${a?.finished ? ' 🏁' : ''}` };
        }));
      },
      render(renderer) { view.sync(race, track, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
