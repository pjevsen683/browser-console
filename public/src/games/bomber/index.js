// Bomber King (1 mod alle): skiftevis er én bombemand og sigter med pinden (A smider), mens de andre undviger på
// øen (A skubber). Alle er bombemand én gang; flest point vinder. Reglerne står i rules.js; øen og bomberne er
// Bombs Away's (bombs/view.js, bombs/ai.js til undvigerne).
import * as THREE from 'three';
import { createWorld, step } from '../sumo/physics.js';
import { createBomber, update, aim, drop, hit, ranking, roundTime, WARN, BLAST } from './rules.js';
import { bombBot } from '../bombs/ai.js';
import { createView } from '../bombs/view.js';
import { nameSprite } from '../common/scene.js';

const RADIUS = 7;

export default {
  id: 'bomber',
  title: 'Bomber King',
  emoji: '✈️',
  how: 'one player drops the bombs, everyone else dodges — take turns',
  minPlayers: 2,
  maxPlayers: 12,
  start(ctx) {
    const players = ctx.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.source === 'bot' }));
    const ids = players.map((p) => p.id), info = new Map(players.map((p) => [p.id, p]));
    const s = createBomber(ids, ctx.rng, { radius: RADIUS });
    const view = createView(players, RADIUS, { warn: WARN, blast: BLAST }), mem = new Map(), react = new Map(), bossMem = { t: 0 };
    const cross = new THREE.Mesh(new THREE.RingGeometry(BLAST - 0.12, BLAST, 40), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85 }));
    cross.rotation.x = -Math.PI / 2;
    cross.position.y = 0.05;
    const plane = new THREE.Group();
    view.scene.add(cross, plane);
    let world = null, tag = null, time = 0, lastCount = null, overT = null, goneT = 0;
    const timer = document.createElement('div');
    timer.className = 'cc-timer';
    ctx.hud.layer.append(timer);
    const name = (id) => info.get(id)?.name ?? '?';
    const tell = (id, text) => ctx.notify(id, { t: 'state', text, score: `${s.points[id]} pts` });

    function newRound() {
      world = createWorld(s.dodgers, ctx.rng, { radius: RADIUS });
      for (const [id, act] of view.actors) act.root.visible = id !== s.boss;
      if (tag) { plane.remove(tag); tag.material.map.dispose(); tag.material.dispose(); }
      tag = nameSprite(`✈️ ${name(s.boss)}`, info.get(s.boss).color);
      tag.scale.set(4, 1, 1);
      plane.add(tag);
      mem.clear();
      ctx.hud.banner(`${name(s.boss)} is the Bomber King!`, `Round ${s.round + 1} of ${s.bosses.length}`);
      tell(s.boss, 'You are the BOMBER! Stick aims, A drops');
      ctx.notify(s.boss, { t: 'buzz', ms: 200 });
      s.dodgers.forEach((id) => tell(id, `Dodge ${name(s.boss)}'s bombs! A pushes`));
    }
    newRound();

    // Botten som bombemand: sigter efter den undviger, der har flest naboer (tæt på sigtet tæller med), lidt foran,
    // hvor den er på vej hen, og smider, når sigtet er der.
    function bossBot() {
      const alive = world.animals.filter((a) => a.alive);
      if (!alive.length) return null;
      let best = null, bv = -Infinity;
      for (const a of alive) {
        const crowd = alive.filter((o) => Math.hypot(o.x - a.x, o.z - a.z) < BLAST * 1.5).length;
        const v = crowd * 2 - Math.hypot(a.x - s.aim.x, a.z - s.aim.z) * 0.3;
        if (v > bv) { bv = v; best = a; }
      }
      const tx = best.x + best.vx * WARN * 0.5, tz = best.z + best.vz * WARN * 0.5, dx = tx - s.aim.x, dz = tz - s.aim.z, d = Math.hypot(dx, dz) || 1;
      return { x: (dx / d) * Math.min(1, d / 1.5) * 0.8, y: (dz / d) * Math.min(1, d / 1.5) * 0.8, drop: d < 0.9 };
    }

    return {
      done: null,
      bot(id) {
        if (s.phase !== 'play' || id === s.boss || !world) return { x: 0, y: 0, a: 0 };
        // undvigerbotterne ser først bomben efter en reaktionstid (ellers rammer bombemanden aldrig)
        if (!react.has(id)) react.set(id, 0.3 + ctx.rng() * 0.45);
        return bombBot({ ...s, bombs: s.bombs.filter((b) => b.t < WARN - react.get(id)) }, world, id, mem, ctx.rng);
      },
      hello(id) {
        if (!info.has(id)) return { t: 'state', text: 'A game is on — you are in the next one', score: '' };
        return { t: 'state', text: id === s.boss ? 'You are the BOMBER! Stick aims, A drops' : 'Dodge the bombs! A pushes', score: `${s.points[id]} pts` };
      },
      update(dt, live) {
        time += dt;
        view.tick(dt);
        if (s.phase === 'countdown') {
          const n = Math.ceil(s.t);
          if (n !== lastCount && n > 0) { lastCount = n; ctx.hud.center(String(n)); ctx.audio.blip(); }
        }
        const playing = s.phase === 'play';
        const inputs = new Map();
        if (playing) {
          const boss = live.find((p) => p.id === s.boss);      // bombemanden er væk: runden slutter efter 3 s
          if (!boss || !boss.connected || boss.lost) { if ((goneT += dt) > 3) s.t = Math.min(s.t, 0); } else goneT = 0;
          for (const p of live) {
            if (p.id === s.boss) {
              aim(s, p.input, dt);
              if (p.input.aPressed && drop(s)) ctx.audio.whoosh();
            } else if (s.dodgers.includes(p.id) && !s.out.includes(p.id)) inputs.set(p.id, p.input);
          }
          if (info.get(s.boss)?.bot) {
            const b = bossBot();
            if (b) { aim(s, b, dt); if (b.drop && (bossMem.t -= dt) <= 0 && drop(s)) { bossMem.t = 0.3 + ctx.rng() * 0.6; ctx.audio.whoosh(); } }
          }
        }
        for (const e of step(world, inputs, dt)) {
          if (e.type === 'hit') ctx.audio.thud(e.strength);
          else if (e.type === 'push') ctx.audio.whoosh();
          else if (e.type === 'fall' && playing && hit(s, e.id)) {
            ctx.audio.splash(); ctx.notify(e.id, { t: 'buzz', ms: 300 }); tell(e.id, 'Splash! You are out this round');
            ctx.hud.tick(`💦 ${name(e.id)} fell in the sea`);
          }
        }
        for (const e of update(s, dt, world.animals)) {
          if (e.type === 'start') { ctx.hud.center(''); if (s.round === 0) ctx.audio.say('bk-intro'); ctx.audio.whistle(); }
          else if (e.type === 'boom') {
            ctx.audio.thud(9); ctx.audio.poof();
            view.boom(e.bomb.x, e.bomb.z);
            for (const id of e.out) {
              const a = world.animals.find((x) => x.id === id), r = Math.hypot(a.x, a.z) || 1;
              Object.assign(a, { alive: false, vy: 7, vx: (a.x / r) * 6, vz: (a.z / r) * 6 });
              ctx.notify(id, { t: 'buzz', ms: 400 }); tell(id, 'BOOM! You are out this round');
              ctx.hud.tick(`💥 ${name(s.boss)} got ${name(id)}`);
            }
            if (e.out.length) { ctx.notify(s.boss, { t: 'buzz', ms: 80 }); tell(s.boss, `Hit! ${e.out.length > 1 ? `×${e.out.length}` : ''}`); }
          } else if (e.type === 'roundEnd') {
            ctx.hud.banner(e.survivors.length ? `${e.survivors.length} survived!` : `${name(s.boss)} got everyone!`, `${name(s.boss)} hit ${s.out.length}`);
            ctx.audio.fanfare();
            e.survivors.forEach((id) => tell(id, 'You survived! +1'));
          } else if (e.type === 'next') { lastCount = null; newRound(); }
          else if (e.type === 'over') {
            const w = ranking(s)[0];
            ctx.hud.banner(`${name(w)} wins!`, `${s.points[w]} points`);
            ctx.audio.say('winner');
            ids.forEach((id) => ctx.notify(id, { t: 'state', text: `${name(w)} won!`, score: `${s.points[id]} pts` }));
            overT = 4;
          }
        }
        const secs = `⏱ ${Math.max(0, Math.ceil(s.phase === 'play' ? s.t : roundTime(ids.length)))}`;
        if (timer.textContent !== secs) timer.textContent = secs;
        if (overT !== null && (overT -= dt) <= 0 && !this.done) {
          this.done = { ranking: ranking(s).map((id) => ({ ...info.get(id), score: s.points[id], text: `${s.points[id]} pts · ${s.hits[id]} hits as bomber` })) };
        }
        ctx.hud.scores(players.map((p) => ({ name: p.name, color: p.color, out: s.out.includes(p.id), text: `${p.id === s.boss ? '✈️ ' : ''}${s.points[p.id]}` })));
      },
      render(renderer) {
        cross.position.x = s.aim.x; cross.position.z = s.aim.z;
        cross.visible = s.phase === 'play';
        plane.position.set(s.aim.x, 4.5 + Math.sin(time * 2) * 0.2, s.aim.z);
        view.sync(world, s, time);
        renderer.render(view.scene, view.camera);
      },
      dispose() { ctx.hud.clear(); view.dispose(); },
    };
  },
};
