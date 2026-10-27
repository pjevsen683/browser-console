// Tightrope i 3D: to klipper med en dyb kløft imellem og én line pr. spiller. Dyrene vipper med theta og bærer en
// balancestang; et fald går ned i kløften. Kameraet følger feltet bagfra.
import * as THREE from 'three';
import { createArena, createActors, syncActor, disposeScene } from '../common/scene.js';
import { LENGTH, CHECK, FALL_TIME } from './rules.js';

const LANE = 1.5;

export function createView(players) {
  const { scene, camera, sun } = createArena({ background: 0xf2b07a, fog: [30, 95], shadow: 14 });
  const n = players.length, laneX = (i) => (i - (n - 1) / 2) * LANE, width = n * LANE + 6;
  const rock = new THREE.MeshStandardMaterial({ color: 0xa0603a, roughness: 1, flatShading: true });
  const near = new THREE.Mesh(new THREE.BoxGeometry(width, 30, 20), rock);
  near.position.set(0, -15, 10);
  const far = new THREE.Mesh(new THREE.BoxGeometry(width, 30, 20), rock);
  far.position.set(0, -15, -LENGTH - 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x4a2a1a }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -30;
  scene.add(near, far, floor);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c8 });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd23f });
  players.forEach((p, i) => {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, LENGTH, 6), ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(laneX(i), -0.05, -LENGTH / 2);
    scene.add(rope);
  });
  for (let d = CHECK; d < LENGTH; d += CHECK) {
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), flagMat);
      pole.position.set(side * (width / 2 - 2.5), -0.4, -d);
      scene.add(pole);
    }
  }
  const actors = createActors(scene, players);
  const poles = new Map();
  for (const p of players) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
    pole.position.y = 0.9;
    actors.get(p.id).root.add(pole);                  // på root: modellen erstatter body's indhold, når den er hentet
    poles.set(p.id, pole);
  }
  const focus = new THREE.Vector3();
  let camZ = 17, camH = 12;
  return {
    scene, camera,
    sync(s) {
      s.walkers.forEach((w, i) => {
        const act = actors.get(w.id);
        if (!act) return;
        const y = w.fallT > 0 ? -((FALL_TIME - w.fallT) ** 2) * 6 : 0;
        syncActor(act, { x: laneX(i), z: -w.dist, y, face: Math.PI, alive: true, lean: 0 });
        act.body.rotation.z = w.fallT > 0 ? w.theta * 2 : w.theta;
        const pole = poles.get(w.id);
        pole.rotation.z = Math.PI / 2 + act.body.rotation.z;
        pole.visible = w.fallT <= 0;
        act.tag.visible = w.fallT <= 0;
        act.ring.visible = false;                     // ringen hører til isen, ikke til en line
      });
      const live = s.walkers.filter((w) => !w.finished);
      const ds = (live.length ? live : s.walkers).map((w) => w.dist);
      const mid = (Math.max(...ds) + Math.min(...ds)) / 2, spread = Math.max(...ds) - Math.min(...ds);
      camZ += (-mid + 17 + spread * 0.5 - camZ) * 0.05;      // et spredt felt: længere tilbage og højere op
      camH += (12 + spread * 0.35 - camH) * 0.05;
      camera.position.set(0, camH, camZ);
      focus.set(0, -1, camZ - 22 - spread * 0.3);
      camera.lookAt(focus);
      sun.position.set(5, 20, camZ);
      sun.target.position.set(0, 0, camZ - 14);
    },
    dispose() { disposeScene(scene); },
  };
}
