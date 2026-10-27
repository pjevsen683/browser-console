// Dance Beat: alle danser samme koreografi. Pile i 4 baner ruller mod linjen nederst på fjernsynet; man trykker
// pilen på telefonen (layout `beat`) i takt. Telefonen stempler trykket med konsollens ur, så wifi-ryk ikke flytter det
// (rules.js tapTime). Bluetooth-controllere: pind/d-pad i retningen. Én sang pr. spil; takterne i public/data/dance.json
// (tools/beats.py). ?beat=<ms> forsinker spillets ur (pile, lys og bedømmelse), hvis fjernsynet forsinker lyden.
import { createDance, tap, update, ranking, tapTime } from './rules.js';
import { botSkill, botTap } from './ai.js';
import { createView } from './view.js';
import { esc } from '../../console/hud.js';

const LANE_COLORS = ['#ff5fa2', '#4fc3ff', '#5ee07a', '#ffb03a'];
const AHEAD = 2;                                      // sekunder, en pil er undervejs på fjernsynet
const BEAT = { t: 'layout', kind: 'beat', prompt: 'Tap the arrows in time!' };
const NEXT_KEY = 'konsol-dance-next';
const WORDS = { perfect: 'PERFECT!', great: 'Great!', good: 'Good', stray: 'Off beat!', miss: 'Miss' };
const WAIT = 3;                                       // så længe ventes der højst på, at sangen begynder
const OFFSET = (Number(new URLSearchParams(location.search).get('beat')) || 0) / 1000;
const fmt = (n) => n.toLocaleString('en-US');
const store = {
  get() { try { return Number(localStorage.getItem(NEXT_KEY)) || 0; } catch { return 0; } },
  set(v) { try { localStorage.setItem(NEXT_KEY, String(v)); } catch { /* privat fane */ } },
};

let songs = null;
const loaded = fetch('./data/dance.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
  .then((d) => { songs = d.songs; }).catch(() => { songs = null; });

// En pil (spids mod højre, drejet til banen) med midte i (x, y).
function arrow(g, x, y, r, lane, fill, stroke) {
  g.save();
  g.translate(x, y);
  g.rotate([Math.PI, -Math.PI / 2, Math.PI / 2, 0][lane]);
  g.beginPath();
  g.moveTo(r, 0); g.lineTo(-r * 0.1, -r * 0.85); g.lineTo(-r * 0.1, -r * 0.38); g.lineTo(-r * 0.9, -r * 0.38);
  g.lineTo(-r * 0.9, r * 0.38); g.lineTo(-r * 0.1, r * 0.38); g.lineTo(-r * 0.1, r * 0.85); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = r * 0.14; g.strokeStyle = stroke; g.stroke(); }
  g.restore();
}

export default {
  id: 'dance',
  title: 'Dance Beat',
  emoji: '💃',
  how: 'tap the arrows on your phone in time',
  minPlayers: 2,
  maxPlayers: 12,
  music: false,                                       // sangen spilles af spillet selv
  ready: loaded,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, source: p.source }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    if (!songs?.length) {
      ctx.hud.center('Could not load the songs');
      return { done: { ranking: [] }, update() {}, render() {}, dispose() { ctx.hud.clear(); } };
    }
    const next = store.get();
    const song = songs[next % songs.length];
    store.set(next + 1);
    const s = createDance(ids, song, ctx.rng);
    const view = createView(players);
    const box = document.createElement('div');
    box.className = 'dn';
    box.innerHTML = '<canvas></canvas>';
    const title = document.createElement('div');
    title.className = 'dn-song';
    title.innerHTML = `🎵 ${esc(song.title)}`;
    ctx.hud.layer.append(box, title);
    const canvas = box.firstChild, g = canvas.getContext('2d');
    const track = ctx.audio.song(song.id);
    let waiting = track.play() ? WAIT : 0;            // uret står stille, til sangen spiller (eller WAIT er gået)
    const period = 60 / song.bpm;
    const skills = new Map(players.filter((p) => p.source === 'bot').map((p) => [p.id, botSkill(ctx.rng)]));
    const rtt = new Map(), dirs = new Map(), shown = new Map();
    let clock = -OFFSET, perfAt = performance.now(), botNext = 0, overT = null, lastCount = null;
    const name = (id) => info.get(id)?.name ?? '?';
    const stateFor = (id, word = 'Tap the arrows in time!') => {
      const p = s.players[id];
      return { t: 'state', text: word, score: p.combo >= 2 ? `${fmt(p.score)} · ×${p.combo}` : fmt(p.score) };
    };
    const tell = (id, word) => {
      if (info.get(id)?.source !== 'phone') return;
      const st = stateFor(id, word), key = st.text + st.score;
      if (shown.get(id) === key) return;
      shown.set(id, key);
      ctx.notify(id, st);
    };
    const result = (id, r) => {
      if (r.kind === 'ignored') return;
      if (r.kind !== 'stray') view.popup(id, r.kind);
      tell(id, WORDS[r.kind]);
    };
    const offsetText = (id) => {
      const ms = s.players[id].offsetMs();
      return ms === null ? 'no hits' : Math.abs(ms) < 5 ? 'spot on' : `${Math.round(Math.abs(ms))} ms ${ms < 0 ? 'early' : 'late'}`;
    };
    for (const id of ids) if (info.get(id).source === 'phone') { ctx.notify(id, BEAT); ctx.notify(id, stateFor(id)); }
    ctx.hud.banner('Dance Beat!', song.title);
    ctx.audio.say('dn-intro');

    let w = 0, h = 0;
    function draw() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
      if (Math.round(r.width * dpr) !== w || Math.round(r.height * dpr) !== h) {
        w = canvas.width = Math.max(1, Math.round(r.width * dpr));
        h = canvas.height = Math.max(1, Math.round(r.height * dpr));
      }
      g.clearRect(0, 0, w, h);
      const top = h * 0.2, rowH = (h - top) / 4, x0 = w * 0.1, rad = rowH * 0.4, span = w - x0;
      // banerne og målpilene
      for (let l = 0; l < 4; l++) {
        const y = top + rowH * (l + 0.5);
        g.fillStyle = 'rgba(255,255,255,.06)';
        g.fillRect(0, y - rowH * 0.45, w, rowH * 0.9);
        arrow(g, x0, y, rad * 1.05, l, 'rgba(255,255,255,.08)', LANE_COLORS[l]);
      }
      // takt-streger
      const b0 = Math.ceil((clock - song.beats[0]) / period);
      for (let b = b0; ; b++) {
        const t = song.beats[0] + b * period;
        if (t > clock + AHEAD) break;
        const x = x0 + ((t - clock) / AHEAD) * span;
        g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)';
        g.fillRect(x - 1, top, b % 4 === 0 ? 3 : 2, h - top);
      }
      // pilene
      for (const n of s.notes) {
        const dt = n.t - clock;
        if (dt < -0.25) continue;
        if (dt > AHEAD) break;
        const x = x0 + (dt / AHEAD) * span, y = top + rowH * (n.lane + 0.5);
        g.globalAlpha = dt < 0 ? Math.max(0, 1 + dt * 4) : 1;
        arrow(g, x, y, rad, n.lane, LANE_COLORS[n.lane], 'rgba(0,0,0,.45)');
      }
      g.globalAlpha = 1;
      // sangens fremdrift
      g.fillStyle = 'rgba(255,255,255,.15)';
      g.fillRect(x0, top * 0.35, span * 0.8, top * 0.18);
      g.fillStyle = '#ffd23f';
      g.fillRect(x0, top * 0.35, span * 0.8 * Math.min(1, clock / s.end), top * 0.18);
    }

    return {
      done: null,
      bot: () => ({ x: 0, y: 0, a: 0, b: 0 }),       // botterne trykker i update (de skal ramme takten)
      layoutFor: (id) => (info.get(id)?.source === 'phone' && !s.over ? BEAT : null),
      hello(id) { return info.has(id) ? stateFor(id) : { t: 'state', text: 'A dance is on — you are in the next game', score: '' }; },
      onAnswer(id, msg) {
        if (msg.t !== 'tap' || !info.has(id) || s.over) return;
        const at = tapTime(msg, msg.recv ?? performance.now(), rtt.get(id));
        result(id, tap(s, id, msg.lane, clock + (at - perfAt) / 1000));
      },
      update(dt, live) {
        view.tick(dt);
        const st = track.time();
        if (st !== null) { waiting = 0; clock = Math.abs(st - OFFSET - clock) > 0.05 ? st - OFFSET : clock + dt + (st - OFFSET - clock - dt) * 0.2; }
        else if (waiting > 0) waiting -= dt;
        else clock += dt;
        perfAt = performance.now();
        for (const p of live) {
          if (p.rtt !== undefined) rtt.set(p.id, p.rtt);
          if (p.source !== 'pad' || !info.has(p.id) || s.over) continue;
          // Bluetooth-controller: pind/d-pad i en retning = den bane; A = banen med den nærmeste pil
          const { x, y } = p.input;
          const dir = x < -0.6 ? 0 : y < -0.6 ? 1 : y > 0.6 ? 2 : x > 0.6 ? 3 : -1;
          if (dir >= 0 && dir !== dirs.get(p.id)) result(p.id, tap(s, p.id, dir, clock));
          dirs.set(p.id, dir);
          if (p.input.aPressed) {
            const near = s.notes.reduce((b, n) => (Math.abs(n.t - clock) < Math.abs(b.t - clock) ? n : b), s.notes[0]);
            result(p.id, tap(s, p.id, near.lane, clock));
          }
        }
        while (botNext < s.notes.length && s.notes[botNext].t <= clock) {
          const n = s.notes[botNext++];
          for (const [id, sk] of skills) { const t = botTap(n, sk, ctx.rng); if (t !== null) result(id, tap(s, id, n.lane, t)); }
        }
        const first = s.notes[0]?.t ?? 0, n = Math.ceil(first - clock);
        if (n !== lastCount && n >= 1 && n <= 3) { lastCount = n; ctx.hud.center(String(n)); }
        else if (clock >= first && lastCount !== 0) { lastCount = 0; ctx.hud.center(''); }
        for (const e of update(s, clock)) {
          if (e.type === 'miss') { view.popup(e.id, 'miss'); tell(e.id, WORDS.miss); }
          else if (e.type === 'over') {
            const win = ranking(s)[0];
            ctx.hud.banner(`${name(win)} wins!`, `${fmt(s.players[win].score)} points`);
            ctx.audio.fanfare(); ctx.audio.say('dn-end');
            for (const id of ids) if (info.get(id).source === 'phone') { ctx.notify(id, { t: 'layout', kind: 'pad' }); ctx.notify(id, { t: 'state', text: id === win ? 'You won! 🕺' : `${name(win)} won!`, score: `${fmt(s.players[id].score)} · ${offsetText(id)}` }); }
            overT = 4;
          }
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.players[id].score, text: `${fmt(s.players[id].score)} · ${offsetText(id)}` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, text: fmt(s.players[p.id].score) })));
      },
      render(renderer) {
        let b = Math.floor((clock - song.beats[0]) / period);
        if (b < 0) b = 0;
        view.sync(((clock - song.beats[0]) / period - b + 1) % 1, b);
        draw();
        renderer.render(view.scene, view.camera);
      },
      dispose() { track.stop(); ctx.hud.clear(); view.dispose(); },
    };
  },
};
