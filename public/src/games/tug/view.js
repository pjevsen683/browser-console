// Tug of War i 3D: græs, et mudderhul i midten og et reb; rød til venstre, blå til højre. Holdene glider med rebet og
// læner sig bagud; hvert tryk giver et lille ryk.
import * as THREE from 'three';
import { createArena, createActors, syncActor, disposeScene } from '../common/scene.js';

const GAP = 1.15, SHIFT = 3;

export function createView(players, teams) {
  const { scene, camera, sun } = createArena({ background: 0x8fd0f5, fog: [40, 90], shadow: 14 });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x5fbf4e, roughness: 0.9 }));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 }));
  mud.rotation.x = -Math.PI / 2;
  mud.scale.set(1, 2.2, 1);
  mud.position.y = 0.01;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 30, 8), new THREE.MeshStandardMaterial({ color: 0xc8a46a }));
  rope.rotation.z = Math.PI / 2;
  rope.position.y = 0.9;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0xffd23f }));
  flag.position.y = 0.6;
  scene.add(grass, mud, rope, flag);
  [[-22, 9, 0x4fa83f], [-6, 12, 0x58b548], [12, 10, 0x4b9f3c], [28, 13, 0x56ad46]].forEach(([x, r, c]) => {   // bakker bagved
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    hill.scale.y = 0.45;
    hill.position.set(x, 0, -32);
    scene.add(hill);
  });
  [[-14, 11], [3, 13], [17, 10.5]].forEach(([x, y]) => {                                                   // skyer
    const cloud = new THREE.Group();
    [[0, 0, 1.6], [1.6, -0.3, 1.2], [-1.5, -0.3, 1.1]].forEach(([dx, dy, r]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      puff.position.set(dx, dy, 0);
      cloud.add(puff);
    });
    cloud.position.set(x, y, -40);
    scene.add(cloud);
  });
  const actors = createActors(scene, players);
  const spots = new Map();
  for (const t of [0, 1]) {
    players.filter((p) => teams.get(p.id) === t).forEach((p, i) => spots.set(p.id, { team: t, x: (t === 0 ? -1 : 1) * (2 + i * GAP), z: i % 2 ? 0.35 : -0.35, jolt: 0 }));
  }
  camera.position.set(0, 4.2, 16.5);
  camera.lookAt(0, 1.6, 0);
  sun.position.set(4, 14, 10);
  return {
    scene, camera,
    jolt(id) { const s = spots.get(id); if (s) s.jolt = 0.12; },
    tick(dt) { for (const s of spots.values()) s.jolt = Math.max(0, s.jolt - dt); },
    sync(pos, time, winner) {
      const shift = pos * SHIFT;
      rope.position.x = shift;
      flag.position.x = shift;
      for (const [id, s] of spots) {
        const act = actors.get(id);
        if (!act) continue;
        const lost = winner !== null && winner !== undefined && winner !== s.team;
        syncActor(act, {
          x: s.x + shift, z: s.z, y: s.jolt > 0 ? 0.15 : 0, face: s.team === 0 ? Math.PI / 2 : -Math.PI / 2, alive: true,
          lean: lost ? 0.6 : -0.35 - Math.sin(time * 9 + s.x) * 0.05,
        });
      }
    },
    dispose() { disposeScene(scene); },
  };
}
