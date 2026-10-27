// Dance Beat i 3D: en scene med lysende gulvfelter, der blinker i takt, og dyrene i to buer. Dyrene hopper på hver
// takt; et ramt tryk giver et ekstra hop og "Perfect/Great/Good" over hovedet, en Miss får dyret til at hænge.
import * as THREE from 'three';
import { createArena, createActors, syncActor, nameSprite, disposeScene } from '../common/scene.js';

const WORD = { perfect: ['PERFECT', '#ffd23f'], great: ['GREAT', '#5ee07a'], good: ['GOOD', '#4fc3ff'], miss: ['MISS', '#ff5f6d'] };
const TILE_COLORS = [0xff5fa2, 0x4fc3ff, 0x5ee07a, 0xffb03a];

export function createView(players) {
  const { scene, camera, sun } = createArena({ background: 0x1a0d2e, fog: [30, 70], shadow: 12 });
  scene.children.find((o) => o.isHemisphereLight).intensity = 0.7;
  // gulvfelter
  const tiles = [];
  for (let x = -7; x <= 7; x++) {
    for (let z = -4; z <= 3; z++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x241536, emissive: TILE_COLORS[(x + z + 20) % 4], emissiveIntensity: 0.05, roughness: 0.4 });
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), m);
      t.position.set(x * 2, -0.1, z * 2);
      t.receiveShadow = true;
      scene.add(t);
      tiles.push({ m, k: (x * 7 + z * 3 + 40) % 4 });
    }
  }
  // bagvæg med lysbuer
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshStandardMaterial({ color: 0x120822 }));
  back.position.set(0, 8, -9);
  scene.add(back);
  const arches = [];
  for (let i = 0; i < 5; i++) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(4 + i * 2.2, 0.12, 8, 48, Math.PI), new THREE.MeshBasicMaterial({ color: TILE_COLORS[i % 4] }));
    a.position.set(0, 0, -8.8);
    scene.add(a);
    arches.push(a);
  }
  // dyrene i to buer: forreste række 6, bagerste resten
  const actors = createActors(scene, players);
  const spots = new Map();
  players.forEach((p, i) => {
    const row = i < 6 ? 0 : 1, inRow = row === 0 ? Math.min(6, players.length) : players.length - 6, j = row === 0 ? i : i - 6;
    const x = (j - (inRow - 1) / 2) * 2.4;
    spots.set(p.id, { x, z: row === 0 ? 1.5 - Math.abs(x) * 0.12 : -2.2 - Math.abs(x) * 0.12, jump: 0, sad: 0, spin: 0 });
  });
  camera.position.set(0, 6.5, 14.5);
  camera.lookAt(0, 0.6, -1);
  sun.position.set(3, 12, 8);

  const popups = [];
  function popup(id, kind) {
    const sp = spots.get(id);
    if (!sp) return;
    const [text, color] = WORD[kind];
    const s = nameSprite(text, color);
    s.scale.set(2.2, 0.55, 1);
    s.position.set(sp.x, 2.6, sp.z);
    scene.add(s);
    popups.push({ s, age: 0 });
    if (kind === 'miss') sp.sad = 0.6;
    else { sp.jump = 0.35; if (kind === 'perfect') sp.spin = 0.35; }
  }

  return {
    scene, camera, popup,
    tick(dt) {
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.age += dt;
        p.s.position.y += dt * 1.2;
        p.s.material.opacity = Math.max(0, 1 - p.age / 0.8);
        if (p.age > 0.8) { scene.remove(p.s); p.s.material.map.dispose(); p.s.material.dispose(); popups.splice(i, 1); }
      }
      for (const sp of spots.values()) { sp.jump = Math.max(0, sp.jump - dt); sp.sad = Math.max(0, sp.sad - dt); sp.spin = Math.max(0, sp.spin - dt); }
    },
    // phase: 0-1 inden for takten (0 = på slaget); beat: taktens nummer.
    sync(phase, beat) {
      const pulse = Math.max(0, 1 - phase * 3);
      tiles.forEach((t) => { t.m.emissiveIntensity = t.k === ((beat % 4) + 4) % 4 ? 0.15 + pulse * 0.9 : 0.06; });
      arches.forEach((a, i) => { a.material.color.setHex(TILE_COLORS[(i + beat + 40) % 4]); a.scale.setScalar(1 + pulse * 0.03); });
      for (const [id, sp] of spots) {
        const act = actors.get(id);
        if (!act) continue;
        const bounce = Math.abs(Math.sin(phase * Math.PI)) * 0.25;
        const hop = sp.jump > 0 ? Math.sin((sp.jump / 0.35) * Math.PI) * 0.9 : 0;
        const face = (sp.sad > 0 ? 0 : beat % 2 ? 0.35 : -0.35) + (sp.spin > 0 ? (1 - sp.spin / 0.35) * Math.PI * 2 : 0);
        syncActor(act, { x: sp.x, z: sp.z, y: sp.sad > 0 ? 0 : bounce + hop, face, alive: true, lean: sp.sad > 0 ? 0.5 : 0 });
        act.body.rotation.y = face;                     // drejet med det samme (syncActor glider)
      }
    },
    dispose() { disposeScene(scene); },
  };
}
