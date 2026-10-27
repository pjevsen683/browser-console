// Musical Chairs i 3D: et rundt dansegulv og puderne, der popper op, når musikken stopper (en taget pude får
// spillerens farve).
import * as THREE from 'three';
import { createRink } from '../common/rink.js';
import { nameSprite } from '../common/scene.js';

export function createView(players, radius) {
  const rink = createRink(players, { radius, floor: 0xf2d7b6, rim: 0xb04a6a, sea: false, background: 0x2a1530 });
  const color = new Map(players.map((p) => [p.id, p.color]));
  const geo = new THREE.CylinderGeometry(0.75, 0.8, 0.35, 24);
  let cushions = [];
  const note = nameSprite('♪ ♫ ♪', '#ffd23f');
  note.scale.set(4, 1, 1);
  note.position.set(0, 4.2, 0);
  rink.scene.add(note);
  return {
    scene: rink.scene, camera: rink.camera,
    setSeats(seats) {
      cushions.forEach((c) => { rink.scene.remove(c.mesh); c.mesh.material.dispose(); });
      cushions = seats.map((p) => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x332200 }));
        mesh.position.set(p.x, 0.17, p.z);
        mesh.scale.setScalar(0.01);
        mesh.castShadow = mesh.receiveShadow = true;
        rink.scene.add(mesh);
        return { mesh, age: 0 };
      });
    },
    tick(dt) { cushions.forEach((c) => { c.age += dt; }); },   // kaldes fra update (prewarm tegner ikke)
    sync(world, chairs, time) {
      cushions.forEach((c, i) => {
        const by = chairs.seats[i]?.by, free = !by;      // en ledig pude hopper og pulserer (hvid kan også være en spiller)
        c.mesh.scale.setScalar(Math.min(1, c.age * 5) * (1 + Math.max(0, 0.25 - c.age) * 2 + (free ? Math.sin(time * 12) * 0.08 : 0)));
        c.mesh.position.y = free ? 0.17 + Math.abs(Math.sin(time * 6)) * 0.35 : 0.17;
        c.mesh.material.color.set(by ? color.get(by) : 0xffffff);
        c.mesh.material.emissive.setHex(free ? 0x554400 : 0x000000);
      });
      note.visible = chairs.phase === 'music';
      note.position.y = 4.2 + Math.sin(time * 4) * 0.2;
      rink.sync(world, time);
    },
    dispose() { geo.dispose(); cushions.forEach((c) => c.mesh.material.dispose()); rink.dispose(); },
  };
}
