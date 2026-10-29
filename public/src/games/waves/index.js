// Sumo Survival: spillerne mod bølger af grå bøller på isflagen. Pinden glider, A skubber (Sumo-fysikken). En bølge er
// klaret, når alle bøller er i vandet; alle spillere i vandet = slut. Alene eller sammen (1–6). Reglerne står i
// rules.js; rekorden (flest bølger) i konsollens localStorage (common/record.js).
import { createWorld, step, SHRINK_AFTER } from '../sumo/physics.js';
import { createView } from '../sumo/view.js';
import { createRun, updateRun, fall, ranking, enemyIds, enemyCount, enemySpeed, enemyEager, isEnemy, MAX_WAVE } from './rules.js';
import { waveBot } from './ai.js';
import { createRecord } from '../common/record.js';

const BULLY = '#4a5466';
const IDLE = { x: 0, y: 0, a: 0, b: 0 };
const isPlayer = (id) => !isEnemy(id);

export default {
  id: 'waves',
  title: 'Sumo Survival',
  emoji: '🌊',
  how: 'push the bullies off the ice, wave after wave',
  minPlayers: 1,
  maxPlayers: 6,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const n = ids.length, most = Math.max(...Array.from({ length: MAX_WAVE }, (_, i) => enemyCount(i + 1, n)));
    const bullies = Array.from({ length: most }, (_, i) => ({ id: `bully:${i}`, name: 'Bully', color: BULLY }));
    const view = createView([...players, ...bullies]);
    const run = createRun(ids), record = createRecord('waves'), held = new Map();
    let world = null, time = 0, lastCount = null, overT = null, warned = false;
    const name = (id) => info.get(id)?.name ?? '?';
    const pushes = (id) => `${run.pushes[id]} push${run.pushes[id] === 1 ? '' : 'es'}`;
    const score = (id) => `Wave ${run.wave} · ${pushes(id)}`;
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: score(id) });
    const tellAll = (text) => ids.forEach((id) => tell(id, text));
    const newWave = () => { world = createWorld([...ids, ...enemyIds(run.wave, n)], ctx.rng); warned = false; };
    const alive = (pred) => world.animals.filter((a) => a.alive && pred(a.id)).length;

    newWave();
    tellAll('Get ready …');
    ctx.audio.say('sv-intro');

    function onEvent(e) {
      if (e.type === 'push') ctx.audio.whoosh();
      else if (e.type === 'hit') ctx.audio.thud(e.strength);
      else if (e.type === 'fall') {
        fall(run, e);
        ctx.audio.splash();
        if (isEnemy(e.id)) {
          const left = alive(isEnemy);
          ctx.hud.tick(e.by && info.has(e.by) ? `${name(e.by)} pushed a bully into the sea!` : 'A bully fell into the sea!');
          if (left === 1) ctx.hud.banner('Last bully!');
          if (info.has(e.by)) { ctx.notify(e.by, { t: 'buzz', ms: 60 }); tell(e.by, 'Push!'); }
        } else {
          ctx.notify(e.id, { t: 'buzz', ms: 350 });
          tell(e.id, alive(isPlayer) ? 'Splash! You are back next wave' : 'Splash!');
          if (n > 1) ctx.hud.tick(`${name(e.id)} fell into the sea`);
        }
      }
    }

    function onRun(change) {
      if (change === 'start') {
        ctx.hud.center(''); ctx.hud.banner(`Wave ${run.wave}`, `${enemyIds(run.wave, n).length} ${enemyIds(run.wave, n).length === 1 ? 'bully' : 'bullies'}`);
        ctx.audio.whistle();
        if (run.wave > 1) ctx.audio.say('sv-wave');
        tellAll('Push!');
      } else if (change === 'cleared') {
        ctx.hud.center(''); ctx.hud.banner(`Wave ${run.wave} cleared!`, 'Get ready for the next one');
        ctx.audio.fanfare(); ctx.audio.say('sv-clear');
        tellAll(`Wave ${run.wave} cleared!`);
      } else if (change === 'next') {
        newWave();
        lastCount = 0;                                  // ingen ekstra banner i nedtællingen; 'start' viser bølgen
        tellAll('Get ready …');
      } else if (change === 'over' || change === 'won') {
        const isRecord = record.submit(run.cleared);
        const waves = `${run.cleared} wave${run.cleared === 1 ? '' : 's'}`;
        ctx.hud.center('');
        ctx.hud.banner(change === 'won' ? 'You beat every wave!' : `You survived ${waves}`, isRecord ? 'New record!' : record.best ? `Record: ${record.best} waves` : '');
        ctx.audio.fanfare(); ctx.audio.say(isRecord ? 'record' : 'round');
        tellAll(isRecord ? `New record: ${waves}! 🏆` : `You survived ${waves}`);
        overT = 4;
      }
    }

    return {
      done: null,
      bot: (id) => (run.phase === 'play' ? waveBot(world, id, isEnemy, ctx.rng) : IDLE),
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        const me = world.animals.find((a) => a.id === id);
        return { t: 'state', text: run.phase === 'play' ? (me?.alive ? 'Push!' : 'You are back next wave') : 'Get ready …', score: score(id) };
      },
      update(dt, live) {
        time += dt;
        if (run.phase === 'countdown') {
          const c = Math.ceil(run.t);
          if (c !== lastCount) {
            if (lastCount === null) ctx.hud.banner(`Wave ${run.wave}`, record.best ? `Record: ${record.best} waves` : 'Push the bullies off the ice!');
            lastCount = c; ctx.hud.center(String(c)); ctx.audio.blip(); ctx.audio.say(`count-${c}`);
          }
        } else if (run.phase === 'play' || run.phase === 'break') {
          const inputs = new Map(), speed = new Map();
          for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);   // også i pausen: man kan styre væk fra kanten
          if (run.phase === 'play') {
            for (const a of world.animals) {
              if (!isEnemy(a.id)) continue;
              const v = waveBot(world, a.id, isPlayer, ctx.rng, enemyEager(run.wave));
              inputs.set(a.id, { ...v, aPressed: !!v.a && !held.get(a.id) });
              held.set(a.id, v.a);
              speed.set(a.id, enemySpeed(run.wave));
            }
          }
          for (const e of step(world, inputs, dt, { speed })) onEvent(e);
          if (!warned && run.phase === 'play' && world.t > SHRINK_AFTER - 2) { warned = true; ctx.hud.banner('The ice is melting!'); }
        }
        const change = updateRun(run, alive(isPlayer), alive(isEnemy), dt);
        if (change) onRun(change);
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = {
            title: run.won ? 'Every wave beaten!' : `Survived ${run.cleared} wave${run.cleared === 1 ? '' : 's'}`,
            ranking: ranking(run).map((id) => ({ ...info.get(id), score: run.pushes[id], text: pushes(id) })),
          };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: String(run.pushes[p.id]),
          out: !world.animals.find((a) => a.id === p.id)?.alive })));
      },
      render(renderer) { view.sync(world, time); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
