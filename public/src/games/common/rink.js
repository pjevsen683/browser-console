// En rund arena til spillene på Sumo-fysikken (Color Panic, Musical Chairs, Coin Grab, Bombs Away): scene, gulv eller
// ø, dyrene og et kamera, der ser hele arenaen. Spillet lægger sine egne ting i `scene`.
import * as THREE from 'three';
import { createArena, createSea, createActors, syncActor, disposeScene } from './scene.js';

// floor: farve på gulvet (null = intet gulv; spillet tegner selv); rim: farve på en lav kant (null = ingen);
// sea: hav under øen; background: himlen.
export function createRink(players, { radius = 7, floor = 0xdff0ff, rim = null, sea = true, background = 0x14213d } = {}) {
  const { scene, camera, sun } = createArena({ background, shadow: radius + 3 });
  const water = sea ? createSea(scene, { color: 0x24508a }) : null;
  if (floor !== null) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.95, 0.7, 64), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.35 }));
    disc.position.y = -0.35;
    disc.receiveShadow = true;
    scene.add(disc);
  }
  if (rim !== null) {
    const wall = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 10, 80), new THREE.MeshStandardMaterial({ color: rim, roughness: 0.5 }));
    wall.rotation.x = Math.PI / 2;
    wall.position.y = 0.12;
    scene.add(wall);
  }
  const actors = createActors(scene, players);
  const dist = 9 + radius * 1.6;
  camera.position.set(0, dist * 0.85, dist * 0.75);
  camera.lookAt(0, -0.5, 0.6);
  return {
    scene, camera, sun, actors,
    sync(world, time) {
      for (const a of world.animals) { const act = actors.get(a.id); if (act) syncActor(act, a); }
      water?.update(time);
    },
    dispose() { disposeScene(scene); },
  };
}
