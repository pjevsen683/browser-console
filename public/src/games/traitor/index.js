// Who's the Traitor?: alle får et hemmeligt ord på telefonen -- forræderen et beslægtet. På skift siger man ét ord
// højt om sit ord, så stemmer alle på telefonen. 4-12 spillere, 3 runder. Ordparrene ligger i public/data/traitor.json.
// Ingen 3D: fjernsynet tegnes med DOM i hud.layer over en illustreret baggrund.
import { createTraitor, update, done, vote, leave, rejoin, ranking, ROUNDS, CLUE_TIME, VOTE_TIME } from './rules.js';
import { esc } from '../../console/hud.js';

let PAIRS = [];
const loaded = typeof fetch === 'function'
  ? fetch('./data/traitor.json').then((r) => (r.ok ? r.json() : [])).then((j) => { PAIRS = j; }).catch(() => {})
  : Promise.resolve();
const SCENES = 6;

export default {
  id: 'traitor',
  title: "Who's the Traitor?",
  emoji: '🕵️',
  how: 'one word each, then vote',
  minPlayers: 4,
  maxPlayers: 12,
  ready: loaded,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const name = (id) => info.get(id)?.name ?? '?';
    ctx.hud.layer.innerHTML = `<div class="tr"><div class="tr-bg"></div><div class="tr-panel">
      <div class="tr-round"></div><div class="tr-title">Loading words …</div><div class="tr-sub"></div>
      <div class="tr-list"></div><div class="cr-bar"><i></i></div></div></div>`;
    const $ = (sel) => ctx.hud.layer.querySelector(sel);
    const bg = $('.tr-bg'), round = $('.tr-round'), title = $('.tr-title'), sub = $('.tr-sub'), list = $('.tr-list'), bar = $('.cr-bar i');
    let s = null, overT = null, voters = new Map(), failed = false;
    const bots = new Map();

    const init = () => {
      if (!PAIRS.length) { title.textContent = 'No word pairs found'; failed = true; return; }
      s = createTraitor(ids, PAIRS, ctx.rng);
    };
    if (PAIRS.length) init(); else loaded.then(init);

    const word = (id) => s.words.get(id) ?? '?';
    const panel = (prompt, options = []) => ({ t: 'layout', kind: 'choices', prompt, options });
    function layoutFor(id) {
      if (!s || !info.has(id) || !s.alive.includes(id)) return panel(s && info.has(id) ? 'You are out — watch and listen' : 'A game is on — wait for the next one');
      const mine = `Your word: ${word(id).toUpperCase()}`;
      if (s.phase === 'clues') {
        return s.order[s.turn] === id ? panel(`${mine} — your turn! Say ONE word about it, then tap Done`, [{ label: 'Done ✓', color: '#3ddc84' }])
          : panel(`${mine} · Listen to ${name(s.order[s.turn])}`);
      }
      if (s.phase === 'vote') {
        if (s.votes.has(id)) return panel(`${mine} · Vote cast — waiting for the others`);
        const opts = s.alive.filter((x) => x !== id);
        voters.set(id, opts);
        return panel(`${mine} · Who is the traitor?`, opts.map((x) => ({ label: name(x), color: info.get(x).color })));
      }
      return panel(mine);
    }
    const tellAll = () => { for (const id of ids) ctx.notify(id, layoutFor(id)); };

    function drawList() {
      if (!s) return;
      const speaking = s.phase === 'clues' ? s.order[s.turn] : null;
      const order = s.phase === 'clues' ? s.order : s.alive;
      list.innerHTML = order.map((id) => `<div class="tr-p${id === speaking ? ' now' : ''}${s.phase === 'vote' && s.votes.has(id) ? ' voted' : ''}">`
        + `<i style="background:${info.get(id)?.color}"></i>${esc(name(id))}</div>`).join('')
        + ids.filter((id) => !s.alive.includes(id)).map((id) => `<div class="tr-p out"><i style="background:${info.get(id)?.color}"></i>${esc(name(id))}</div>`).join('');
    }

    function onEvent(e) {
      if (e.type === 'deal') {
        bg.style.backgroundImage = `url(./traitor/scene-${1 + Math.floor(ctx.rng() * SCENES)}.webp)`;
        round.textContent = `Round ${s.round} of ${ROUNDS}`;
        title.textContent = 'Check your secret word!';
        sub.textContent = 'One of you has a different word — and does not know it.';
        tellAll();
        for (const id of ids) ctx.notify(id, { t: 'buzz', ms: 80 });
      } else if (e.type === 'turn') {
        if (s.clueRounds === 1 && s.turn === 0) ctx.audio.say('tr-clues');
        title.textContent = `${name(e.id)}, say one word!`;
        sub.textContent = 'Describe your word — but not too obviously.';
        ctx.audio.blip(true);
        tellAll();
        ctx.notify(e.id, { t: 'buzz', ms: 150 });
        if (info.get(e.id)?.bot) bots.set(e.id, { at: 1.5 });
      } else if (e.type === 'vote') {
        title.textContent = 'Vote! Who is the traitor?';
        sub.textContent = 'Use your phone.';
        ctx.audio.say('tr-vote');
        voters = new Map();
        tellAll();
        for (const id of s.alive) if (info.get(id)?.bot) bots.set(id, { at: 2 + ctx.rng() * 5 });
      } else if (e.type === 'tally') {
        if (e.out === null) { ctx.hud.tick('A tie — nobody is out'); }
        else if (e.out !== s.traitor) { ctx.hud.tick(`${name(e.out)} was NOT the traitor`); ctx.audio.thud(4); }
      } else if (e.type === 'caught' || e.type === 'escaped' || e.type === 'void') {
        const [civil, sly] = e.words;
        title.textContent = e.type === 'caught' ? `Caught! ${name(e.traitor)} was the traitor`
          : e.type === 'escaped' ? `${name(e.traitor)} was the traitor — and got away!` : `${name(e.traitor)} left — round cancelled`;
        sub.textContent = civil && sly ? `The word was ${civil.toUpperCase()} — the traitor had ${sly.toUpperCase()}` : '';
        if (e.type === 'caught') { ctx.audio.fanfare(); ctx.audio.say('tr-caught'); }
        if (e.type === 'escaped') { ctx.audio.thud(6); ctx.audio.say('tr-escaped'); }
        for (const id of ids) ctx.notify(id, panel(title.textContent));
      } else if (e.type === 'over') {
        const w = ranking(s)[0];
        ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} points`);
        ctx.audio.say('winner');
        overT = 4;
      }
    }

    for (const id of ids) ctx.notify(id, panel("Who's the Traitor? — get ready …"));
    return {
      done: null,
      layoutFor: (id) => (info.has(id) ? layoutFor(id) : null),
      hello: (id) => ({ t: 'state', text: info.has(id) ? '' : 'A game is on — you are in the next one', score: '' }),
      onAnswer(id, msg) {
        if (!s || msg.t !== 'answer' || !Number.isInteger(msg.value)) return;
        if (s.phase === 'clues' && msg.value === 0) done(s, id);
        else if (s.phase === 'vote') {
          const target = voters.get(id)?.[msg.value];
          if (target && vote(s, id, target)) ctx.audio.blip();
          ctx.notify(id, layoutFor(id));                 // også ved en afvist stemme: telefonen låses op igen
        }
      },
      update(dt, live) {
        if (!s) { if (failed && !this.done) this.done = { ranking: [] }; return; }
        let left = false;
        for (const p of live) {
          if (!info.has(p.id)) continue;
          if (!p.connected && s.present.has(p.id)) { for (const e of leave(s, p.id)) onEvent(e); left = true; }
          else if (p.connected && !s.present.has(p.id)) rejoin(s, p.id);
        }
        if (left && (s.phase === 'vote' || s.phase === 'clues')) tellAll();   // nye knapper uden den, der gik
        for (const [id, b] of bots) {
          if ((b.at -= dt) > 0) continue;
          bots.delete(id);
          if (s.phase === 'clues') done(s, id);
          else if (s.phase === 'vote') {
            const others = s.alive.filter((x) => x !== id);
            vote(s, id, ctx.rng() < 0.4 && id !== s.traitor ? s.traitor : others[Math.floor(ctx.rng() * others.length)]);
          }
        }
        for (const e of update(s, dt)) onEvent(e);
        drawList();
        bar.style.width = s.phase === 'clues' ? `${(100 * s.t) / CLUE_TIME}%` : s.phase === 'vote' ? `${(100 * s.t) / VOTE_TIME}%` : '0%';
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: !s.alive.includes(p.id), text: `${s.scores[p.id]}` })));
      },
      render(renderer) { renderer.setClearColor(0x0a1020); renderer.clear(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};
