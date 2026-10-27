// Color Panic i 3D: farvede felter over havet (de synker, når en anden farve er meldt) og dyrene.
import * as THREE from 'three';
import { createRink } from '../common/rink.js';
import { COLORS } from './rules.js';

export function createView(players, panic) {
  const rink = createRink(players, { radius: panic.radius, floor: null, rim: 0xffffff, background: 0x101a33 });
  const mats = COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c.hex, roughness: 0.45 }));
  const geo = new THREE.BoxGeometry(panic.size * 0.94, 0.5, panic.size * 0.94);
  let meshes = [];
  function setTiles(p) {
    meshes.forEach((m) => rink.scene.remove(m));
    meshes = p.tiles.map((t) => {
      const m = new THREE.Mesh(geo, mats[t.color]);
      m.position.set(t.x, -0.25, t.z);
      m.receiveShadow = true;
      rink.scene.add(m);
      return m;
    });
  }
  setTiles(panic);
  return {
    scene: rink.scene, camera: rink.camera, setTiles,
    sync(world, p, time) {
      p.tiles.forEach((t, i) => {
        const m = meshes[i];
        if (!m) return;
        m.material = mats[t.color];
        const down = p.phase === 'sink' && t.color !== p.color;
        const warn = p.phase === 'call' && p.t < 1 && t.color !== p.color;
        const target = down ? -4.5 : warn ? -0.25 + Math.sin(time * 40) * 0.04 : -0.25;
        m.position.y += (target - m.position.y) * (down ? 0.08 : 0.25);
      });
      rink.sync(world, time);
    },
    dispose() { geo.dispose(); mats.forEach((m) => m.dispose()); rink.dispose(); },
  };
}
