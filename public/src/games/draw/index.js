// Draw & Guess: én spiller tegner sit ord på telefonen, og tegningen vises live på fjernsynet; de andre gætter ved
// at skrive på telefonen. Reglerne står i rules.js; ordene i public/data/draw.json (LLM, læst igennem).
import { createDraw, update, choose, guess, leave, rejoin, ranking, hintText, DRAW_TIME, CHOOSE_TIME } from './rules.js';
import { esc } from '../../console/hud.js';

const USED_KEY = 'konsol-draw-used';
const OPTION_COLORS = ['#ff4d5e', '#3fa7ff', '#ffd23f'];
const PAD = { t: 'layout', kind: 'pad' };
const store = {
  get() { try { return new Set(JSON.parse(localStorage.getItem(USED_KEY) || '[]')); } catch { return new Set(); } },
  set(v) { try { localStorage.setItem(USED_KEY, JSON.stringify([...v])); } catch { /* privat fane */ } },
};

let words = null;
const loaded = fetch('./data/draw.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
  .then((w) => { words = w; }).catch(() => { words = null; });

export default {
  id: 'draw',
  title: 'Draw & Guess',
  emoji: '🎨',
  how: 'draw your word on the phone — the others type guesses',
  minPlayers: 2,
  maxPlayers: 12,
  ready: loaded,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const info = new Map(players.map((p) => [p.id, p]));
    const name = (id) => info.get(id)?.name ?? '?';
    const root = document.createElement('div');
    root.className = 'dg';
    root.innerHTML = `<div class="dg-top"><span class="dg-who"></span><span class="dg-hint"></span><span class="dg-time"></span></div>
      <div class="dg-main"><div class="dg-board"><canvas></canvas><div class="dg-over"></div></div><div class="dg-feed"></div></div>
      <div class="dg-bar"><i></i></div>`;
    ctx.hud.layer.append(root);
    const $ = (sel) => root.querySelector(sel);
    const board = $('.dg-board'), canvas = $('canvas'), g = canvas.getContext('2d'), feed = $('.dg-feed'), over = $('.dg-over');
    if (!words?.length) {
      over.textContent = 'Could not load the words';
      return { done: { ranking: [] }, update() {}, render() {}, dispose() { ctx.hud.clear(); } };
    }
    const used = store.get();
    if (words.filter((w) => !used.has(w)).length < 40) used.clear();
    const s = createDraw(players.map((p) => p.id), words, ctx.rng, used);
    let aspect = 2, overT = null;
    const strokes = [];                           // alt det tegnede i denne tur: tegnes igen, når tavlen skifter størrelse
    const botPlan = new Map();
    let botDraw = null;

    // Tavlen: lærredet får tegnerens format og så stor plads som muligt.
    function fit() {
      const w = board.clientWidth || 800, h = board.clientHeight || 400;
      const cw = Math.min(w, h * aspect), ch = cw / aspect;
      canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
      canvas.width = Math.round(cw * devicePixelRatio); canvas.height = Math.round(ch * devicePixelRatio);
      clear();
      strokes.forEach(stroke);
    }
    function clear() { g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); }
    function stroke(pts) {
      g.strokeStyle = '#111'; g.lineCap = g.lineJoin = 'round';
      g.lineWidth = Math.max(2, canvas.width * 0.006);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x * canvas.width, y * canvas.height) : g.moveTo(x * canvas.width, y * canvas.height)));
      if (pts.length === 1) g.lineTo(pts[0][0] * canvas.width + 0.1, pts[0][1] * canvas.height);
      g.stroke();
    }
    function addStroke(pts, ar) {
      strokes.push(pts);
      if (ar && Math.abs(ar - aspect) > 0.02) { aspect = ar; fit(); } else stroke(pts);
    }
    function say(text, cls = '') {
      const d = document.createElement('div');
      d.className = cls;
      d.innerHTML = text;
      feed.prepend(d);
      while (feed.children.length > 9) feed.lastChild.remove();
    }

    // Hvad hver telefon skal vise lige nu.
    function layoutFor(id) {
      if (!info.has(id)) return PAD;
      if (s.phase === 'choose' && id === s.drawer) {
        return { t: 'layout', kind: 'choices', prompt: 'Pick a word to draw', options: s.options.map((w, i) => ({ label: w, color: OPTION_COLORS[i] })) };
      }
      if (s.phase === 'draw' && id === s.drawer) return { t: 'layout', kind: 'draw', prompt: `Draw: ${s.word.toUpperCase()}` };
      if (s.phase === 'draw' && !s.guessed.includes(id)) return { t: 'layout', kind: 'text', prompt: 'What is being drawn?', max: 30 };
      return PAD;
    }
    function stateFor(id) {
      const pts = String(s.scores[id] ?? 0);
      if (s.phase === 'choose') return { t: 'state', text: id === s.drawer ? 'You draw next — pick a word' : `${name(s.drawer)} is picking a word …`, score: pts };
      if (s.phase === 'draw') {
        if (id === s.drawer) return { t: 'state', text: 'Draw it! No letters or numbers', score: pts };
        return { t: 'state', text: s.guessed.includes(id) ? '✓ You got it!' : 'Type your guess', score: pts };
      }
      if (s.phase === 'reveal' && s.word) {
        const got = s.guessed.includes(id) ? '✓ You got it! ' : '';
        return { t: 'state', text: `${got}The word was ${s.word.toUpperCase()}`, score: pts };
      }
      return { t: 'state', text: 'Get ready …', score: pts };
    }
    const tell = (id) => { ctx.notify(id, layoutFor(id)); ctx.notify(id, stateFor(id)); };
    const tellAll = () => players.forEach((p) => tell(p.id));

    function planBots() {
      botPlan.clear();
      for (const p of players) {
        if (!p.bot || p.id === s.drawer) continue;
        botPlan.set(p.id, { wrongAt: DRAW_TIME - (4 + ctx.rng() * 10), rightAt: ctx.rng() < 0.7 ? DRAW_TIME - (8 + ctx.rng() * 40) : -1 });
      }
      botDraw = info.get(s.drawer)?.bot ? { t: 0, a: ctx.rng() * Math.PI * 2 } : null;
    }
    function botScribble(dt) {                   // botten tegner en spiral med streger
      if (!botDraw) return;
      botDraw.t += dt;
      if (botDraw.t < 0.6) return;
      botDraw.t = 0;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        botDraw.a += 0.35;
        const r = 0.08 + (botDraw.a % 12) * 0.025;
        pts.push([0.5 + Math.cos(botDraw.a) * r / aspect * 1.6, 0.5 + Math.sin(botDraw.a) * r]);
      }
      addStroke(pts.map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]), 2);
    }
    function onGuess(id, text) {
      const r = guess(s, id, text);
      if (r.result === 'ignored') return;
      if (r.result === 'correct') {
        say(`✓ <b style="color:${info.get(id).color}">${esc(name(id))}</b> guessed it! +${r.points}`, 'ok');
        ctx.audio.blip(true);
        ctx.notify(id, { t: 'buzz', ms: 120 });
        tell(id);
        ctx.notify(s.drawer, stateFor(s.drawer));
      } else {
        // et næsten-rigtigt gæt vises ikke på fjernsynet (det ville afsløre ordet)
        if (r.result === 'wrong') say(`<b style="color:${info.get(id).color}">${esc(name(id))}</b> ${esc(text)}`);
        ctx.notify(id, { t: 'state', text: r.result === 'close' ? 'So close!' : `Not “${text}”`, score: String(s.scores[id]) });
      }
    }

    requestAnimationFrame(fit);
    addEventListener('resize', fit);
    ctx.hud.banner('Draw & Guess', `${s.order.length} drawings`);
    ctx.audio.say('dg-intro');
    return {
      done: null,
      layoutFor,
      hello(id) { return info.has(id) ? stateFor(id) : { t: 'state', text: 'A game is on — you are in the next one', score: '' }; },
      onAnswer(id, msg) {
        if (!info.has(id)) return;
        if (msg.t === 'stroke' && s.phase === 'draw' && id === s.drawer) {
          if (msg.clear) { strokes.length = 0; clear(); } else addStroke(msg.pts, msg.ar);
        } else if (msg.t === 'answer') {
          if (s.phase === 'choose' && id === s.drawer && Number.isInteger(msg.value)) { choose(s, id, msg.value); }
          else if (s.phase === 'draw' && typeof msg.value === 'string' && id !== s.drawer) onGuess(id, msg.value);
        }
      },
      update(dt, live) {
        for (const p of players) {
          const on = live.some((l) => l.id === p.id && l.connected !== false);
          if (!on && !s.away.has(p.id)) leave(s, p.id);
          else if (on && s.away.has(p.id)) { rejoin(s, p.id); tell(p.id); }
        }
        for (const e of update(s, dt)) {
          if (e.type === 'choose') {
            strokes.length = 0; clear(); over.textContent = ''; over.className = 'dg-over';
            $('.dg-who').innerHTML = `🎨 <b style="color:${info.get(e.drawer).color}">${esc(name(e.drawer))}</b> is picking a word`;
            $('.dg-hint').textContent = '';
            tellAll();
            if (info.get(e.drawer)?.bot) botPlan.set('choose', { at: CHOOSE_TIME - (1 + ctx.rng() * 2) });
          } else if (e.type === 'draw') {
            used.add(e.word); store.set(used);
            $('.dg-who').innerHTML = `🎨 <b style="color:${info.get(e.drawer).color}">${esc(name(e.drawer))}</b> is drawing`;
            ctx.audio.whistle();
            planBots();
            tellAll();
          } else if (e.type === 'hint') {
            $('.dg-hint').textContent = e.hint;
          } else if (e.type === 'reveal') {
            botDraw = null;
            over.className = 'dg-over show';
            over.innerHTML = e.skipped ? `${esc(name(e.drawer))} left — skipping`
              : `The word was <b>${esc(e.word.toUpperCase())}</b><small>${e.guessed.length ? e.guessed.map((id) => esc(name(id))).join(', ') + ' got it' : 'Nobody got it'}</small>`;
            ctx.audio[e.guessed.length ? 'fanfare' : 'thud'](4);
            if (!e.skipped) ctx.audio.say(e.guessed.length && e.guessed.length >= players.filter((p) => p.id !== e.drawer && !s.away.has(p.id)).length ? 'dg-all' : 'dg-up');
            tellAll();
          } else if (e.type === 'over') {
            const w = ranking(s)[0];
            ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} points`);
            ctx.audio.fanfare();
            players.forEach((p) => { ctx.notify(p.id, PAD); ctx.notify(p.id, { t: 'state', text: `${name(w)} won!`, score: String(s.scores[p.id]) }); });
            overT = 4;
          }
        }
        // bots
        const ch = botPlan.get('choose');
        if (ch && s.phase === 'choose' && s.t <= ch.at) { botPlan.delete('choose'); choose(s, s.drawer, Math.floor(ctx.rng() * 3)); }
        if (s.phase === 'draw') {
          botScribble(dt);
          for (const [id, plan] of botPlan) {
            if (id === 'choose') continue;
            if (plan.wrongAt > 0 && s.t <= plan.wrongAt) { plan.wrongAt = -1; onGuess(id, words[Math.floor(ctx.rng() * words.length)]); }
            if (plan.rightAt > 0 && s.t <= plan.rightAt) { plan.rightAt = -1; onGuess(id, s.word); }
          }
        }
        const total = s.phase === 'draw' ? DRAW_TIME : s.phase === 'choose' ? CHOOSE_TIME : 1;
        $('.dg-bar i').style.width = s.phase === 'draw' || s.phase === 'choose' ? `${Math.max(0, s.t / total) * 100}%` : '0%';
        $('.dg-time').textContent = s.phase === 'draw' ? `⏱ ${Math.max(0, Math.ceil(s.t))}` : '';
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: (p.id === s.drawer && s.phase === 'draw' ? '🎨 ' : s.guessed.includes(p.id) ? '✓ ' : '') + s.scores[p.id] })));
      },
      render(renderer) { renderer.setClearColor(0x0a1020); renderer.clear(); },
      dispose() { removeEventListener('resize', fit); ctx.hud.clear(); },
    };
  },
};
