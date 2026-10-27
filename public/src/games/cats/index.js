// Cat Chaos: alle er katte på mormors lange spisebord. Slå ting ned for point; når mormor vender sig, skal man stå
// stille. Bygger på Kattekaos (mormor, modeller); reglerne står i rules.js.
import { createCats, update, ranking, ROUND, PENALTY } from './rules.js';
import { catBot } from './ai.js';
import { createView } from './view.js';

const COUNTDOWN = 3;
const GO_TEXT = { t: 'state', text: 'Grandma is reading — knock things off the table! (A = paw)', score: '' };
const FREEZE_TEXT = { t: 'state', text: 'FREEZE! Grandma is looking', score: '🙀' };

export default {
  id: 'cats',
  title: 'Cat Chaos',
  emoji: '🐈',
  how: 'knock things off — freeze when grandma looks',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createCats(ids, ctx.rng);
    const view = createView(players, s.world);
    const mem = new Map();
    let count = COUNTDOWN, lastCount = null, overT = null, sentLook = false, hmAt = -99, time = 0;
    const timer = document.createElement('div');
    timer.className = 'cc-timer';
    ctx.hud.layer.append(timer);
    const name = (id) => info.get(id)?.name ?? '?';
    const textFor = () => (s.owner.state === 'turning' || s.owner.state === 'looking' ? FREEZE_TEXT : GO_TEXT);
    const tellAll = (msg) => ids.forEach((id) => ctx.notify(id, msg));

    tellAll({ t: 'state', text: 'Get ready …', score: '' });
    return {
      done: null,
      bot(id) { return count > 0 || s.phase !== 'play' ? { x: 0, y: 0, a: 0 } : catBot(s, id, mem, 1 / 60, ctx.rng); },
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        return count > 0 ? { t: 'state', text: 'Get ready …', score: '' } : textFor();
      },
      update(dt, live) {
        time += dt;
        view.tick(dt);
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); ctx.audio.say(`count-${n}`); }
          if (count <= 0) { ctx.hud.center(''); ctx.hud.banner('GO!', "Don't let grandma see you"); ctx.audio.say('cats-intro'); tellAll(GO_TEXT); }
        } else if (s.phase === 'play') {
          const inputs = new Map();
          for (const p of live) if (info.has(p.id)) inputs.set(p.id, p.input);
          for (const e of update(s, inputs, dt)) {
            if (e.type === 'swat') ctx.audio.whoosh();
            else if (e.type === 'bump') ctx.audio.thud(e.strength);
            else if (e.type === 'crash') {
              ctx.audio.crash(); view.shatter(e.item);
              if (s.owner.state === 'reading' && time - hmAt > 6) { hmAt = time; ctx.audio.say('gran-hm'); }
            } else if (e.type === 'thud') ctx.audio.thud(6);
            else if (e.type === 'score') {
              view.popup(e.item.x, e.item.z, `+${e.gained}`, info.get(e.id)?.color ?? '#fff');
              ctx.notify(e.id, { t: 'state', text: textFor().text, score: String(s.scores[e.id]) });
            } else if (e.type === 'caught') {
              const c = s.world.cats.find((k) => k.id === e.id);
              if (c) view.popup(c.x, c.z, `−${PENALTY}`, '#ff4d5e');
              if (!sentLook) { sentLook = true; ctx.audio.say('gran-caught'); }
              ctx.hud.tick(`👵 Grandma caught ${name(e.id)}!`);
              ctx.notify(e.id, { t: 'buzz', ms: 400 });
              ctx.notify(e.id, { t: 'state', text: `Grandma saw you! −${PENALTY}`, score: String(s.scores[e.id]) });
            } else if (e.type === 'owner') {
              if (e.state === 'turning') {
                sentLook = false;
                ctx.audio.blip(true);
                tellAll(FREEZE_TEXT);
                ids.forEach((id) => ctx.notify(id, { t: 'buzz', ms: 150 }));
              } else if (e.state === 'looking') {
                if (ctx.rng() < 0.4) ctx.audio.say('gran-look');
              } else if (e.state === 'reading') tellAll(GO_TEXT);
            } else if (e.type === 'refill') {
              ctx.hud.tick('📦 More stuff on the table!');
              ctx.audio.whoosh();
            } else if (e.type === 'over') {
              const w = ranking(s)[0];
              ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} points`);
              ctx.audio.fanfare(); ctx.audio.say('gran-done');
              tellAll({ t: 'state', text: `${name(w)} won!`, score: '' });
              overT = 4;
            }
          }
        }
        const left = Math.max(0, Math.ceil(count > 0 ? ROUND : s.t));
        timer.textContent = `⏱ ${left}`;
        timer.classList.toggle('look', s.owner.state === 'looking');
        ctx.hud.layer.classList.toggle('cc-look', s.phase === 'play' && s.owner.state === 'looking');
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: String(s.scores[p.id]) })));
      },
      render(renderer) { view.sync(s); renderer.render(view.scene, view.camera); },
      dispose() { ctx.hud.layer.classList.remove('cc-look'); ctx.hud.clear(); view.dispose(); },
    };
  },
};
