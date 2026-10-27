// Snowball Fight i 3D: snemark med midterlinje, fort af sne, grantræer rundt om, dyrene med ring og navn i
// holdfarven, liv over hovedet, en bue for opladningen, snebolde i en bue og sne, der støver ved et træf.
import * as THREE from 'three';
import { createArena, createActors, syncActor, disposeScene } from '../common/scene.js';
import { LIVES, BODY } from './physics.js';

const SNOW = 0xf3f7ff;

function tree(x, z, h) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
  trunk.position.y = 0.4;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const r = (1.3 - i * 0.32) * h / 3, cone = new THREE.Mesh(new THREE.ConeGeometry(r, h / 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x1f5d3a, flatShading: true }));
    cone.position.y = 0.8 + i * h / 4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, h / 6, 10), new THREE.MeshStandardMaterial({ color: SNOW }));
    cap.position.y = cone.position.y + h / 7;
    g.add(cone, cap);
  }
  g.position.set(x, 0, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createView(players, field, teamColors, rng) {
  const { scene, camera, sun } = createArena({ background: 0xa9cfee, fog: [35, 80], shadow: 13 });
  const { hx, hz } = field;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), new THREE.MeshStandardMaterial({ color: SNOW, roughness: 1, emissive: 0x8796ad, emissiveIntensity: 0.35 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // holdenes halvdele, svagt farvet, og midterlinjen
  teamColors.forEach((c, t) => {
    const half = new THREE.Mesh(new THREE.PlaneGeometry(hx, hz * 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1 }));
    half.rotation.x = -Math.PI / 2;
    half.position.set((t === 0 ? -1 : 1) * hx / 2, 0.01, 0);
    scene.add(half);
  });
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.25, hz * 2), new THREE.MeshBasicMaterial({ color: 0x7d9cc4 }));
  mid.rotation.x = -Math.PI / 2;
  mid.position.y = 0.02;
  scene.add(mid);
  // snevolde langs kanten
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xe6eef9, roughness: 1 });
  for (const [w, d, x, z] of [[hx * 2 + 2, 0.8, 0, -hz - 0.6], [hx * 2 + 2, 0.8, 0, hz + 0.6], [0.8, hz * 2, -hx - 0.6, 0], [0.8, hz * 2, hx + 0.6, 0]]) {
    const bank = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), bankMat);
    bank.rotation.z = w > d ? Math.PI / 2 : 0;
    bank.rotation.x = w > d ? 0 : Math.PI / 2;
    bank.scale.set(1, (Math.max(w, d) - 0.8) / 1.8, 0.7);
    bank.position.set(x, 0.15, z);
    scene.add(bank);
  }
  // fort: en mur af sne med snebolde ovenpå
  const fortMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0x8796ad, emissiveIntensity: 0.3 });
  for (const f of field.forts) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(f.r * 0.85, f.r, 0.85, 18), fortMat);
    wall.position.y = 0.42;
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), fortMat);
      s.position.set(Math.cos(a) * f.r * 0.62, 0.9, Math.sin(a) * f.r * 0.62);
      g.add(s);
    }
    g.position.set(f.x, 0, f.z);
    scene.add(g);
  }
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, x = Math.cos(a) * (hx + 4 + rng() * 4), z = Math.sin(a) * (hz + 3 + rng() * 3);
    if (z > hz - 1) continue;                                    // ikke foran kameraet
    scene.add(tree(x, z, 3 + rng() * 2));
  }

  const actors = createActors(scene, players);
  const extra = new Map();
  for (const p of players) {
    const act = actors.get(p.id), lives = [];
    for (let i = 0; i < LIVES; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4d5e }));
      dot.position.set((i - (LIVES - 1) / 2) * 0.3, 2.45, 0);
      act.root.add(dot);
      lives.push(dot);
    }
    const charge = new THREE.Mesh(new THREE.RingGeometry(BODY * 1.45, BODY * 1.75, 40, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
    charge.rotation.x = -Math.PI / 2;
    charge.position.y = 0.03;
    act.root.add(charge);
    extra.set(p.id, { lives, charge, chargeShown: -1 });
  }

  const ballGeo = new THREE.SphereGeometry(0.2, 12, 10), ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const balls = new Map();
  const puffs = [];
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  function puff(x, z, y = 0.9) {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), puffMat.clone());
      s.userData.v = [(Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4];
      g.add(s);
    }
    g.position.set(x, y, z);
    scene.add(g);
    puffs.push({ g, t: 0.45 });
  }

  camera.position.set(0, 17, 15.5);
  camera.lookAt(0, -0.5, 0.8);
  sun.position.set(-8, 16, 10);
  sun.intensity = 2.1;

  return {
    scene, camera, puff,
    tick(dt) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.t -= dt;
        for (const s of p.g.children) {
          const v = s.userData.v;
          v[1] -= 9 * dt;
          s.position.x += v[0] * dt; s.position.y += v[1] * dt; s.position.z += v[2] * dt;
          s.material.opacity = Math.max(0, p.t * 2.2);
        }
        if (p.t <= 0) { scene.remove(p.g); p.g.children.forEach((s) => { s.geometry.dispose(); s.material.dispose(); }); puffs.splice(i, 1); }
      }
    },
    sync(s) {
      for (const p of s.field.players) {
        const act = actors.get(p.id), ex = extra.get(p.id);
        if (!act) continue;
        syncActor(act, { x: p.x, y: 0, z: p.z, face: p.face, alive: true, lean: p.charging ? -0.25 : 0 });
        act.body.scale.y = p.duck > 0 ? 0.55 : 1;
        act.body.rotation.z = p.out ? 1.45 : 0;
        act.ring.visible = !p.out;
        ex.lives.forEach((d, i) => { d.visible = !p.out; d.material.color.setHex(i < LIVES - p.hits ? 0xff4d5e : 0x5a6476); });
        ex.charge.visible = p.charging && p.charge > 0;
        const step = Math.round(p.charge * 20);
        if (ex.charge.visible && step !== ex.chargeShown) {
          ex.chargeShown = step;
          ex.charge.geometry.dispose();
          ex.charge.geometry = new THREE.RingGeometry(BODY * 1.45, BODY * 1.75, 40, 1, Math.PI / 2, Math.max(0.05, p.charge) * Math.PI * 2);
        }
      }
      const live = new Set();
      for (const b of s.field.balls) {
        live.add(b.id);
        let m = balls.get(b.id);
        if (!m) { m = new THREE.Mesh(ballGeo, ballMat); m.castShadow = true; scene.add(m); balls.set(b.id, m); }
        const u = Math.min(1, b.flown / b.range);
        m.position.set(b.x, 1.3 * (1 - u) + 0.2 * u + u * (1 - u) * b.range * 0.35, b.z);
      }
      for (const [id, m] of balls) if (!live.has(id)) { scene.remove(m); balls.delete(id); }
    },
    dispose() { disposeScene(scene); },
  };
}
