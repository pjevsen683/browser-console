// Pipe Maze: en rørlabyrint på fjernsynet; vælg det rør (A-E) på telefonen, der fører vandet ned til skatten. Hurtigt
// og rigtigt giver flest point; 6 runder. Ingen 3D: et lærred i hud.layer. Reglerne står i rules.js.
import { createPipes, answer, update, ranking, trace, ROUNDS, STUDY, REVEAL, COLS } from './rules.js';
import { esc } from '../../console/hud.js';

const PIPE_COLORS = ['#ff4d5e', '#3fa7ff', '#ffd23f', '#44d07b', '#b469ff'];
const LETTERS = 'ABCDE';
const WAIT = (prompt) => ({ t: 'layout', kind: 'choices', prompt, options: [] });
const CHOICES = { t: 'layout', kind: 'choices', prompt: 'Which pipe leads to the treasure?', options: PIPE_COLORS.slice(0, COLS).map((c, i) => ({ label: LETTERS[i], color: c })) };

export default {
  id: 'pipes',
  title: 'Pipe Maze',
  emoji: '🚰',
  how: 'follow the pipes — which one reaches the treasure?',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createPipes(ids, ctx.rng);
    const name = (id) => info.get(id)?.name ?? '?';
    const root = document.createElement('div');
    root.className = 'pp';
    root.innerHTML = '<div class="pp-top"></div><canvas></canvas><div class="cr-bar"><i></i></div>';
    ctx.hud.layer.append(root);
    const top = root.querySelector('.pp-top'), canvas = root.querySelector('canvas'), g = canvas.getContext('2d'), bar = root.querySelector('.cr-bar i');
    const plans = new Map();
    let reveal = null, revealT = 0, overT = null;
    const layoutFor = (id) => (!info.has(id) ? null : s.phase === 'study' && !s.answers.has(id) ? CHOICES : WAIT('Watch the pipes …'));

    function draw() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      g.clearRect(0, 0, w, h);
      const l = s.ladder;
      if (!l) return;
      const x0 = w * 0.18, dx = (w * 0.64) / (COLS - 1), y0 = h * 0.12, y1 = h * 0.86, dy = (y1 - y0) / l.rows;
      const X = (c) => x0 + c * dx, Y = (row) => y0 + (row + 0.5) * dy;
      g.lineCap = 'round';
      g.lineWidth = dx * 0.12;
      g.strokeStyle = '#5d6b82';
      for (let c = 0; c < COLS; c++) { g.beginPath(); g.moveTo(X(c), y0); g.lineTo(X(c), y1); g.stroke(); }
      for (const rung of l.rungs) { g.beginPath(); g.moveTo(X(rung.col), Y(rung.row)); g.lineTo(X(rung.col + 1), Y(rung.row)); g.stroke(); }
      g.font = `900 ${Math.round(dy * 0.9 + h * 0.03)}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let c = 0; c < COLS; c++) {
        g.fillStyle = PIPE_COLORS[c];
        g.beginPath(); g.arc(X(c), y0 - h * 0.05, h * 0.04, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#0a1020'; g.fillText(LETTERS[c], X(c), y0 - h * 0.05);
        g.fillStyle = '#fff';
        if (c === s.treasure) g.fillText('💰', X(c), y1 + h * 0.06);
      }
      if (reveal !== null) {                           // vandet løber ned ad det rigtige rør
        const { path } = trace(l, reveal);
        const pts = path.map(([c, row]) => [X(c), row < 0 ? y0 : row >= l.rows ? y1 : Y(row)]);
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        let left = len * Math.min(1, revealT / (REVEAL * 0.6));
        g.strokeStyle = PIPE_COLORS[reveal]; g.lineWidth = dx * 0.09;
        g.beginPath(); g.moveTo(...pts[0]);
        for (let i = 1; i < pts.length && left > 0; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i], seg = Math.hypot(bx - ax, by - ay), k = Math.min(1, left / seg);
          g.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
          left -= seg;
        }
        g.stroke();
      }
    }

    ids.forEach((id) => ctx.notify(id, WAIT('Get ready …')));
    ctx.hud.banner('Pipe Maze!', 'Find the pipe that leads to the treasure');
    ctx.audio.say('pp-intro');
    return {
      done: null,
      layoutFor,
      hello: (id) => ({ t: 'state', text: info.has(id) ? '' : 'A game is on — you are in the next one', score: '' }),
      onAnswer(id, m) {
        if (m.t === 'answer' && answer(s, id, m.value)) { ctx.audio.blip(); ctx.notify(id, WAIT(`You chose ${LETTERS[m.value]} — wait …`)); }
      },
      update(dt, live) {
        s.away = new Set(live.filter((p) => !p.connected || p.lost).map((p) => p.id));
        if (s.phase === 'study') for (const [id, p] of plans) if ((p.at -= dt) <= 0) { answer(s, id, p.col); plans.delete(id); }
        revealT += dt;
        for (const e of update(s, dt)) {
          if (e.type === 'round') {
            reveal = null;
            top.textContent = `Round ${e.round} of ${ROUNDS}`;
            ctx.audio.whistle();
            ids.forEach((id) => ctx.notify(id, layoutFor(id)));
            plans.clear();
            const good = [...Array(COLS).keys()].find((c) => trace(s.ladder, c).end === s.treasure);
            for (const p of players) if (p.bot) plans.set(p.id, { at: 3 + ctx.rng() * (STUDY - 4), col: ctx.rng() < 0.55 ? good : Math.floor(ctx.rng() * COLS) });
          } else if (e.type === 'reveal') {
            reveal = e.good; revealT = 0;
            const best = Object.entries(e.gained).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            top.innerHTML = `It was <b style="color:${PIPE_COLORS[e.good]}">${LETTERS[e.good]}</b>` + (best.length ? ` · fastest: <b>${esc(name(best[0][0]))}</b>` : ' · nobody found it');
            ctx.audio.splash();
            for (const id of ids) {
              const v = e.gained[id];
              ctx.notify(id, WAIT(v === undefined ? `Too slow — it was ${LETTERS[e.good]}` : v > 0 ? `Treasure! +${v}` : `No — it was ${LETTERS[e.good]}`));
              if (v > 0) ctx.notify(id, { t: 'buzz', ms: 80 });
            }
          } else if (e.type === 'over') {
            const w = ranking(s)[0];
            ctx.hud.banner(`${name(w)} wins!`, `${s.scores[w]} points`);
            ctx.audio.fanfare(); ctx.audio.say('winner');
            ids.forEach((id) => ctx.notify(id, WAIT(`${name(w)} won!`)));
            overT = 3;
          }
        }
        bar.style.width = s.phase === 'study' ? `${(100 * Math.max(0, s.t)) / STUDY}%` : '0%';
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.scores[id], text: `${s.scores[id]} pts` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: `${s.scores[p.id]}${s.phase === 'study' && s.answers.has(p.id) ? ' ✓' : ''}` })));
      },
      render(renderer) { draw(); renderer.setClearColor(0x0e1626); renderer.clear(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};
