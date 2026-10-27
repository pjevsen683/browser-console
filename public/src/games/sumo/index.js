// Sumo på isflagen: 2-12 dyr, pinden glider, A skubber, sidste dyr på flagen vinder runden, først til 3.
import { createWorld, step, SHRINK_AFTER } from './physics.js';
import { createMatch, updateMatch, ranking } from './rules.js';
import { botInput } from './ai.js';
import { createView } from './view.js';

export default {
  id: 'sumo',
  title: 'Ice Floe Sumo',
  emoji: '🐧',
  how: 'stick: slide · A: push',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const view = createView(players);
    const match = createMatch(ids);
    let world = createWorld(ids, ctx.rng), time = 0, lastCount = null, overT = null, warned = false;
    const name = (id) => info.get(id)?.name ?? '?';
    const pips = (id) => '●'.repeat(match.scores[id]) + '○'.repeat(match.target - match.scores[id]);
    const tellAll = (text) => ids.forEach((id) => ctx.notify(id, { t: 'state', text, score: pips(id) }));

    function onEvent(e) {
      if (e.type === 'push') ctx.audio.whoosh();
      else if (e.type === 'hit') {
        ctx.audio.thud(e.strength);
        if (e.strength > 4) { ctx.notify(e.a, { t: 'buzz', ms: 40 }); ctx.notify(e.b, { t: 'buzz', ms: 60 }); }
      } else if (e.type === 'fall') {
        ctx.audio.splash();
        ctx.notify(e.id, { t: 'buzz', ms: 350 });
        ctx.notify(e.id, { t: 'state', text: 'Splash! You are in the water', score: pips(e.id) });
        ctx.hud.tick(e.by ? `${name(e.by)} pushed ${name(e.id)} into the sea` : `${name(e.id)} fell into the sea`);
      }
    }

    function onPhase(change) {
      if (change === 'start') {
        ctx.audio.whistle(); ctx.audio.say('go');
        ctx.hud.center(''); ctx.hud.banner('PUSH!');
        tellAll('Push!');
        warned = false;
      } else if (change === 'round') {
        const w = match.roundWinner;
        ctx.hud.banner(w ? `${name(w)} wins the round!` : 'Draw!', `Round ${match.round}`);
        if (w) ctx.audio.fanfare();
        ctx.audio.say('round');
        tellAll(w ? `${name(w)} won the round` : 'Draw');
      } else if (change === 'next') {
        world = createWorld(ids, ctx.rng);
        lastCount = null;
      } else if (change === 'match') {
        ctx.hud.banner(`${name(match.winner)} wins!`, `First to ${match.target}`);
        ctx.audio.fanfare(); ctx.audio.say('winner');
        tellAll(`${name(match.winner)} won!`);
        ctx.notify(match.winner, { t: 'buzz', ms: 500 });
        overT = 4;
      }
    }

    tellAll('Get ready …');
    return {
      done: null,
      bot: (id) => botInput(world, id, ctx.rng),
      // En telefon, der kommer (tilbage) midt i spillet, får spillets tekst i stedet for lobbyens.
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        const alive = world.animals.find((a) => a.id === id)?.alive;
        const text = match.phase === 'play' ? (alive ? 'Push!' : 'You are in the water — wait for the next round') : 'Get ready …';
        return { t: 'state', text, score: pips(id) };
      },
      update(dt, live) {
        time += dt;
        if (match.phase === 'countdown') {
          const n = Math.ceil(match.t);
          if (n !== lastCount) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
        } else {
          const inputs = new Map();
          for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
          for (const e of step(world, inputs, dt)) onEvent(e);
          if (!warned && match.phase === 'play' && world.t > SHRINK_AFTER - 2) { warned = true; ctx.hud.banner('The ice is melting!'); }
        }
        const change = updateMatch(match, world.animals.filter((a) => a.alive).map((a) => a.id), dt);
        if (change) onPhase(change);
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(match).map((id) => ({ ...info.get(id), score: match.scores[id] })) };
        }
        ctx.hud.scores(players.map((p) => ({
          name: p.name, color: p.color, score: match.scores[p.id], of: match.target,
          out: !world.animals.find((a) => a.id === p.id)?.alive,
        })));
      },
      render(renderer) { view.sync(world, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
