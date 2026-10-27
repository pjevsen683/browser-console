// Quiz Night: 10 spørgsmål med billede og vært; svar på telefonen; fart giver ekstra point. Spørgsmålene ligger i
// public/data/quiz.json (lavet med serverens LLM og læst igennem). Ingen 3D: fjernsynet tegnes med DOM i hud.layer.
import { pickQuestions, createQuiz, update, answer, ranking, COUNT, ASK_TIME } from './rules.js';

const COLORS = ['#ff4d5e', '#3fa7ff', '#ffd23f', '#3ddc84'];
const LETTERS = 'ABCD';
const USED_KEY = 'konsol-quiz-used';

let ALL = [];
const loaded = typeof fetch === 'function'
  ? fetch('./data/quiz.json').then((r) => (r.ok ? r.json() : [])).then((j) => { ALL = j; }).catch(() => {})
  : Promise.resolve();

const store = {
  get() { try { return new Set(JSON.parse(localStorage.getItem(USED_KEY) || '[]')); } catch { return new Set(); } },
  set(set) { try { localStorage.setItem(USED_KEY, JSON.stringify([...set])); } catch { /* privat fane */ } },
};

export default {
  id: 'quiz',
  title: 'Quiz Night',
  emoji: '❓',
  how: 'answer on your phone — fast!',
  minPlayers: 2,
  maxPlayers: 12,
  ready: loaded,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const name = (id) => info.get(id)?.name ?? '?';
    ctx.hud.layer.innerHTML = `<div class="qz"><div class="qz-top"><span class="qz-cat"></span><span class="qz-num"></span></div>
      <div class="qz-main"><img class="qz-img" alt=""><div class="qz-q">Loading questions …</div></div>
      <div class="qz-answers">${LETTERS.split('').map((l, i) => `<div class="qz-a" style="--c:${COLORS[i]}"><b>${l}</b><span></span><i></i></div>`).join('')}</div>
      <div class="cr-bar"><i></i></div></div>`;
    const $ = (sel) => ctx.hud.layer.querySelector(sel);
    const cat = $('.qz-cat'), num = $('.qz-num'), img = $('.qz-img'), qtext = $('.qz-q'), bar = $('.cr-bar i');
    const boxes = [...ctx.hud.layer.querySelectorAll('.qz-a')];
    let s = null, overT = null, failed = false;
    const botPlan = new Map();

    function begin() {
      const used = store.get(), n = Math.min(COUNT, ALL.length);
      const unused = ALL.filter((q) => !used.has(q.id)).length;
      const qs = pickQuestions(ALL, n, used, ctx.rng);
      if (unused <= n) store.set(new Set(qs.map((q) => q.id)));   // alle er nu brugt: forfra fra og med disse
      else { for (const q of qs) used.add(q.id); store.set(used); }
      s = createQuiz(ids, qs);
      qtext.textContent = 'Get ready …';
      ctx.hud.banner('Quiz Night', `${qs.length} questions`);
      ctx.audio.say('quiz-intro');
    }
    if (ALL.length) begin();
    else loaded.then(() => { if (ALL.length) begin(); else { qtext.textContent = 'No questions found'; failed = true; } });

    const q = () => s.qs[s.i];
    const choices = () => ({ t: 'layout', kind: 'choices', prompt: q().q, options: q().a.map((label, i) => ({ label, color: COLORS[i] })) });
    const waiting = (prompt) => ({ t: 'layout', kind: 'choices', prompt, options: [] });

    function ask() {
      const cur = q();
      cat.textContent = cur.cat;
      num.textContent = `Question ${s.i + 1} of ${s.qs.length}`;
      qtext.textContent = cur.q;
      if (cur.img) img.src = `./${cur.img}`; else img.removeAttribute?.('src');
      img.style.display = cur.img ? '' : 'none';
      $('.qz-main').classList.toggle('noimg', !cur.img);    // uden billede: spørgsmålet i midten
      boxes.forEach((b, i) => { b.className = 'qz-a'; b.querySelector('span').textContent = cur.a[i]; b.querySelector('i').textContent = ''; });
      if (cur.voice) ctx.audio.clip(`./voice/quiz/${cur.id}.mp3`);
      else ctx.audio.blip(true);
      if (s.i === s.qs.length - 1) ctx.audio.say('quiz-last');
      for (const id of ids) ctx.notify(id, choices());
      botPlan.clear();
      for (const p of players) if (p.bot) botPlan.set(p.id, { at: ASK_TIME - (2 + ctx.rng() * 6), value: ctx.rng() < 0.6 ? cur.correct : Math.floor(ctx.rng() * 4) });
    }

    function reveal({ gained, counts }) {
      const cur = q();
      boxes.forEach((b, i) => { b.classList.add(i === cur.correct ? 'right' : 'dim'); b.querySelector('i').textContent = counts[i] ? `×${counts[i]}` : ''; });
      const best = Object.entries(gained).filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1]);
      if (best.length) { ctx.audio.fanfare(); ctx.hud.tick(`Fastest: ${name(best[0][0])} +${best[0][1]}`); } else ctx.audio.thud(2);
      for (const id of ids) {
        const g = gained[id];
        ctx.notify(id, waiting(g === undefined ? `Too slow! It was ${LETTERS[cur.correct]}: ${cur.a[cur.correct]}`
          : g > 0 ? `Correct! +${g}` : `Wrong — it was ${LETTERS[cur.correct]}: ${cur.a[cur.correct]}`));
        if (g > 0) ctx.notify(id, { t: 'buzz', ms: 60 });
      }
    }

    for (const id of ids) ctx.notify(id, waiting('Quiz Night — get ready …'));
    return {
      done: null,
      layoutFor: (id) => (!info.has(id) ? null : s?.phase === 'ask' && !s.answers.some((a) => a.id === id) ? choices() : waiting('Get ready …')),
      hello: (id) => ({ t: 'state', text: info.has(id) ? '' : 'A game is on — you are in the next one', score: '' }),
      onAnswer(id, msg) {
        if (s && msg.t === 'answer' && Number.isInteger(msg.value) && answer(s, id, msg.value)) ctx.audio.blip();
      },
      update(dt) {
        if (!s) { if (failed && !this.done) this.done = { ranking: [] }; return; }

        if (s.phase === 'ask') for (const [id, plan] of botPlan) if (s.t <= plan.at) { answer(s, id, plan.value); botPlan.delete(id); }
        for (const e of update(s, dt)) {
          if (e.type === 'ask') ask();
          else if (e.type === 'reveal') reveal(e);
          else if (e.type === 'over') {
            const w = ranking(s)[0];
            ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} points`);
            ctx.audio.say('winner');
            overT = 4;
          }
        }
        bar.style.width = s.phase === 'ask' ? `${(100 * s.t) / ASK_TIME}%` : '0%';
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color,
          text: `${s.scores[p.id]}${s.phase === 'ask' && s.answers.some((a) => a.id === p.id) ? ' ✓' : ''}` })));
      },
      render(renderer) { renderer.setClearColor(0x0a1020); renderer.clear(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};

