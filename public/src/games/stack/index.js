// Tower Stack: hver bygger sit tårn; en klods glider frem og tilbage, A taber den, det overhængende skæres af. Alle
// samtidig, side om side (alene: ét stort tårn). Ingen 3D: et lærred i hud.layer. Reglerne står i rules.js; rekorden
// (højeste tårn) i konsollens localStorage (common/record.js).
import { createStack, step, drop, ranking, endIfIdle, START_W, SWING, TIME } from './rules.js';
import { stackBot } from './ai.js';
import { createRecord } from '../common/record.js';
import { esc } from '../../console/hud.js';

const COUNTDOWN = 3;
const IDLE = { x: 0, y: 0, a: 0, b: 0 };
const HOW = 'Press A to drop the block';

export default {
  id: 'stack',
  title: 'Tower Stack',
  emoji: '🧱',
  how: 'A drops the block — build the tallest tower',
  minPlayers: 1,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createStack(ids), mem = new Map(), record = createRecord('stack');
    const root = document.createElement('div');
    root.className = 'st';
    root.innerHTML = '<canvas></canvas>';
    ctx.hud.layer.append(root);
    const canvas = root.firstChild, g = canvas.getContext('2d');
    // pr. tårn: kameraets højde (i klodser), blink ved perfect, faldende stykker
    const look = new Map(ids.map((id) => [id, { cam: 0, flash: 0 }]));
    let bits = [], count = COUNTDOWN, lastCount = null, overT = null, warned = false;
    const name = (id) => info.get(id)?.name ?? '?';
    const score = (id) => `Height ${s.towers[id].score}`;
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: score(id) });

    ids.forEach((id) => tell(id, 'Get ready …'));
    ctx.hud.banner('Tower Stack', record.best ? `Record: ${record.best}` : 'Stack it high!');
    ctx.audio.say('st-intro');

    function onDrop(id, e) {
      if (!e) return;
      const t = s.towers[id];
      if (e.cut) bits.push({ id, x: e.cut.x, w: e.cut.w, h: t.blocks.length - 1, vy: 0, age: 0 });
      if (e.type === 'perfect') {
        look.get(id).flash = 0.5;
        ctx.audio.blip();
        ctx.notify(id, { t: 'buzz', ms: 30 });
        if (t.streak % 3 === 0) ctx.audio.say('st-perfect');
        tell(id, t.streak >= 2 ? `Perfect ×${t.streak}!` : 'Perfect!');
      } else if (e.type === 'place') {
        ctx.audio.thud(1.5);
        tell(id, HOW);
      } else {
        bits.push({ id, x: e.block.x, w: e.block.w, h: t.blocks.length, vy: 0, age: 0 });
        ctx.audio.whoosh();
        ctx.notify(id, { t: 'buzz', ms: 250 });
        tell(id, `Done — ${t.score} blocks`);
        if (ids.length > 1) ctx.hud.tick(`${name(id)}: ${t.score} blocks`);
      }
    }

    function finish() {
      const order = ranking(s), best = s.towers[order[0]].score, isRecord = record.submit(best);
      if (ids.length === 1) ctx.hud.banner(`${best} blocks!`, isRecord ? 'New record!' : `Record: ${record.best}`);
      else ctx.hud.banner(`${name(order[0])} wins!`, `${best} blocks${isRecord ? ' — new record!' : ''}`);
      ctx.audio.fanfare();
      ctx.audio.say(isRecord ? 'record' : 'winner');
      ids.forEach((id) => tell(id, ids.length === 1 ? (isRecord ? 'New record! 🏆' : 'Tower done!') : id === order[0] ? 'You won! 🏆' : `${name(order[0])} won!`));
      overT = 4;
    }

    // rows: så mange klodser er der mellem jorden og TOP (sættes af draw efter skærmens mål)
    const view = { rows: 8 };
    const GROUND = 0.86, TOP = 0.32;
    let w = 0, h = 0;
    function draw() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
      if (Math.round(r.width * dpr) !== w || Math.round(r.height * dpr) !== h) {
        w = canvas.width = Math.max(1, Math.round(r.width * dpr));
        h = canvas.height = Math.max(1, Math.round(r.height * dpr));
      }
      g.clearRect(0, 0, w, h);
      const n = ids.length, colW = Math.min((w * 0.94) / n, w * 0.34), x0 = (w - colW * n) / 2;
      const u = (colW * 0.9) / (2 * SWING + START_W), bh = Math.min(u * 0.3, h * 0.045), ground = h * GROUND;
      view.rows = Math.max(3, Math.floor((ground - h * TOP) / bh));
      ids.forEach((id, i) => {
        const t = s.towers[id], p = info.get(id), lk = look.get(id), cx = x0 + colW * (i + 0.5);
        const yOf = (lvl) => ground - (lvl + 1 - lk.cam) * bh;          // klodsens overkant
        g.save();
        g.beginPath(); g.rect(x0 + colW * i, 0, colW, h); g.clip();
        if (i % 2) { g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(x0 + colW * i, 0, colW, h); }
        // rekorden
        if (record.best > 0) {
          const y = yOf(record.best);
          if (y > h * 0.12 && y < ground) {
            g.strokeStyle = 'rgba(255,210,63,.55)'; g.setLineDash([u * 0.12, u * 0.1]); g.lineWidth = Math.max(1, bh * 0.08);
            g.beginPath(); g.moveTo(cx - colW * 0.45, y); g.lineTo(cx + colW * 0.45, y); g.stroke(); g.setLineDash([]);
            if (n <= 4) { g.fillStyle = 'rgba(255,210,63,.8)'; g.font = `700 ${Math.round(Math.max(10, bh * 0.45))}px system-ui`; g.textAlign = 'left'; g.fillText('BEST', cx - colW * 0.45, y - bh * 0.15); }
          }
        }
        // tårnet (kun de klodser, der kan ses)
        const from = Math.max(0, Math.floor(lk.cam) - 2);
        for (let k = from; k < t.blocks.length; k++) {
          const b = t.blocks[k], y = yOf(k);
          if (y > h) continue;
          g.fillStyle = p.color; g.fillRect(cx + (b.x - b.w / 2) * u, y, b.w * u, bh - 1);
          g.fillStyle = k % 2 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)'; g.fillRect(cx + (b.x - b.w / 2) * u, y, b.w * u, bh - 1);
        }
        if (lk.flash > 0) {
          const b = t.blocks.at(-1), y = yOf(t.blocks.length - 1);
          g.fillStyle = `rgba(255,255,255,${lk.flash * 1.4})`; g.fillRect(cx + (b.x - b.w / 2) * u - 3, y - 3, b.w * u + 6, bh + 5);
        }
        // den glidende klods
        if (!t.done && count <= 0) {
          const c = t.cur, y = yOf(t.blocks.length);
          g.fillStyle = p.color; g.fillRect(cx + (c.x - c.w / 2) * u, y, c.w * u, bh - 1);
          g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(cx + (c.x - c.w / 2) * u, y, c.w * u, bh * 0.25);
        }
        // faldende stykker
        for (const bit of bits) {
          if (bit.id !== id) continue;
          g.globalAlpha = Math.max(0, 1 - bit.age / 1.4);
          g.fillStyle = p.color; g.fillRect(cx + (bit.x - bit.w / 2) * u, yOf(bit.h) + bit.vy * bh, bit.w * u, bh - 1);
          g.globalAlpha = 1;
        }
        // jorden, højden og navnet
        g.fillStyle = '#2a3a5c'; g.fillRect(x0 + colW * i, Math.max(ground + lk.cam * bh, ground), colW, h);
        g.fillStyle = 'rgba(10,16,32,.7)'; g.fillRect(x0 + colW * i, h * 0.915, colW, h);    // plade under navnet
        g.textAlign = 'center';
        g.fillStyle = '#fff'; g.font = `900 ${Math.round(Math.min(colW * 0.32, h * 0.09))}px system-ui`;
        g.fillText(String(t.score), cx, h * 0.2);
        g.fillStyle = p.color; g.font = `800 ${Math.round(Math.min(colW * 0.14, h * 0.04))}px system-ui`;
        g.fillText(name(id), cx, h * 0.955);
        if (t.done) { g.fillStyle = 'rgba(10,16,32,.45)'; g.fillRect(x0 + colW * i, 0, colW, h); }
        g.restore();
      });
    }

    return {
      done: null,
      bot: (id) => (count <= 0 ? stackBot(s, id, mem, ctx.rng) : IDLE),
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        return { t: 'state', text: s.towers[id].done ? `Done — ${s.towers[id].score} blocks` : HOW, score: score(id) };
      },
      update(dt, live) {
        for (const lk of look.values()) lk.flash = Math.max(0, lk.flash - dt);
        for (const b of bits) { b.age += dt; b.vy += dt * 9 * b.age; }
        bits = bits.filter((b) => b.age < 1.4);
        for (const id of ids) {                         // kameraet følger toppen: den glidende klods højst ved TOP
          const lk = look.get(id), want = Math.max(0, s.towers[id].blocks.length + 1 - view.rows);
          lk.cam += (want - lk.cam) * Math.min(1, dt * 4);
        }
        if (count > 0) {
          count -= dt;
          const n = Math.ceil(count);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); }
          if (count <= 0) { ctx.hud.center(''); ctx.audio.whistle(); ids.forEach((id) => tell(id, HOW)); }
        } else if (!s.over) {
          for (const p of live) if (info.has(p.id) && p.input.aPressed) onDrop(p.id, drop(s, p.id));
          step(s, dt);
          if (!s.over) endIfIdle(s, live.filter((p) => p.connected).map((p) => p.id));
          if (s.over) finish();
          else if (Math.ceil(TIME - s.t) === 10 && !warned) { warned = true; ctx.hud.banner('10 seconds left!'); }
        }
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.towers[id].score, text: `${s.towers[id].score} blocks` })) };
          if (ids.length === 1) this.done.title = `${s.towers[ids[0]].score} blocks`;
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: s.towers[p.id].done, text: String(s.towers[p.id].score) })));
      },
      render() { draw(); },
      dispose() { ctx.hud.clear(); },
    };
  },
};
