// Isflagen i 3D: en flage, der krymper med fysikkens radius, på den fælles scene (hav, dyr, navneskilte).
import * as THREE from 'three';
import { createArena, createSea, createActors, syncActor, disposeScene } from '../common/scene.js';
import { R0 } from './physics.js';

export function createView(players) {
  const { scene, camera } = createArena();
  const sea = createSea(scene);
  const floeGeo = new THREE.CylinderGeometry(R0, R0 * 0.92, 0.7, 48, 1);
  const pos = floeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (Math.hypot(x, z) < 0.1) continue;
    const ang = Math.atan2(z, x), k = 1 + 0.015 * Math.sin(ang * 7) + 0.01 * Math.sin(ang * 13);
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  floeGeo.computeVertexNormals();
  const floe = new THREE.Mesh(floeGeo, new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.35, flatShading: true }));
  floe.position.y = -0.35;
  floe.receiveShadow = true;
  scene.add(floe);
  const actors = createActors(scene, players);

  return {
    scene, camera,
    sync(w, time) {
      const k = w.radius / R0;
      floe.scale.set(k, 1, k);
      floe.position.y = -0.35 + Math.sin(time * 0.8) * 0.03;
      for (const act of actors.values()) act.root.visible = false;   // Sumo Survival: bøller, der ikke er med i bølgen
      for (const a of w.animals) { const act = actors.get(a.id); if (act) { act.root.visible = true; syncActor(act, a); } }
      sea.update(time);
      const dist = 9 + w.radius * 1.6;
      camera.position.set(0, dist * 0.85, dist * 0.75);
      camera.lookAt(0, -0.5, 0.6);
    },
    dispose() { disposeScene(scene); },
  };
}
