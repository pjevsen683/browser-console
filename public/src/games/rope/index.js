// Tightrope: gå over kløften på din line. Vip telefonen (eller pinden) imod, når du vælter; vindstød skubber. Først i
// mål vinder, ellers længst efter 75 s. Telefonen får layoutet tilt (pad + "Use tilt"). Reglerne står i rules.js.
import { createRope, step, ranking, LENGTH, TIME } from './rules.js';
import { ropeBot } from './ai.js';
import { createView } from './view.js';

const COUNTDOWN = 3;
const TILT = { t: 'layout', kind: 'tilt' };
const ORD = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export default {
  id: 'rope',
  title: 'Tightrope',
  emoji: '🤸',
  how: 'tilt your phone (or the stick) to keep your balance',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createRope(ids, ctx.rng);
    const view = createView(players), mem = new Map();
    const timer = document.createElement('div');
    timer.className = 'cc-timer';
    ctx.hud.layer.append(timer);
    let count = COUNTDOWN, lastCount = null, overT = null, finishers = 0, lastWhoosh = -1;
    const name = (id) => info.get(id)?.name ?? '?';
    const walker = (id) => s.walkers.find((w) => w.id === id);
    const meters = (id) => `${Math.floor(walker(id).dist)} / ${LENGTH} m`;
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: meters(id) });

    ids.forEach((id) => { ctx.notify(id, TILT); tell(id, 'Tap “Use tilt” — or use the stick'); });
    return {
      done: null,
      layoutFor: (id) => (info.has(id) ? TILT : null),
      bot: (id) => (count > 0 ? { x: 0, y: 0, a: 0 } : ropeBot(s, id, mem, ctx.rng)),
      hello: (id) => (info.has(id) ? { t: 'state', text: 'Keep your balance!', score: meters(id) } : { t: 'state', text: 'A game is on — you are in the next one', score: '' }),
      update(dt, live) {
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) { ctx.hud.center(''); ctx.hud.banner('Keep your balance!'); ctx.audio.say('rp-intro'); ctx.audio.whistle(); ids.forEach((id) => tell(id, 'Lean against the wobble!')); }
        } else if (!s.over) {
          const inputs = new Map();
          for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
          for (const e of step(s, inputs, dt)) {
            if (e.type === 'gust') { if (s.t - lastWhoosh > 0.5) { lastWhoosh = s.t; ctx.audio.whoosh(); } ctx.notify(e.id, { t: 'buzz', ms: 40 }); }
            else if (e.type === 'fall') { ctx.audio.splash(); ctx.notify(e.id, { t: 'buzz', ms: 300 }); tell(e.id, 'Whoops! Back to the last flag …'); ctx.hud.tick(`😱 ${name(e.id)} fell`); }
            else if (e.type === 'back') tell(e.id, 'Lean against the wobble!');
            else if (e.type === 'finish') {
              finishers++;
              if (finishers === 1) { ctx.hud.banner(`${name(e.id)} made it across!`); ctx.audio.fanfare(); }
              ctx.hud.tick(`🏁 ${name(e.id)} is across (${ORD(finishers)})`);
              tell(e.id, `Across! ${ORD(finishers)} place`);
            } else if (e.type === 'over') {
              const w = ranking(s)[0];
              ctx.hud.banner(`${name(w)} wins!`, walker(w).finished ? 'First across' : 'Furthest along');
              ctx.audio.say('winner');
              ids.forEach((id) => ctx.notify(id, { t: 'state', text: `${name(w)} won!`, score: meters(id) }));
              overT = 4;
            }
          }
        }
        const secs = `⏱ ${Math.max(0, Math.ceil(TIME - s.t))}`;
        if (timer.textContent !== secs) timer.textContent = secs;
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => { const w = walker(id); return { ...info.get(id), score: Math.floor(w.dist), text: w.finished ? `across in ${w.finishT.toFixed(1)} s` : `${Math.floor(w.dist)} m` }; }) };
        }
        ctx.hud.scores(players.map((p) => { const w = walker(p.id); return { name: p.name, color: p.color, out: w.fallT > 0, text: w.finished ? '🏁' : `${Math.floor(w.dist)}m` }; }));
      },
      render(renderer) { view.sync(s); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
