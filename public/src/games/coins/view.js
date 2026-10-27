// Coin Grab i 3D: en sandø med lav kant, og guldmønter, der drejer rundt (de store er større og glimter).
import * as THREE from 'three';
import { createRink } from '../common/rink.js';

export function createView(players, radius) {
  const rink = createRink(players, { radius, floor: 0xf0d9a0, rim: 0x2fb36b, background: 0x5ab4e6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.15, roughness: 0.3, emissive: 0x8a5a00 });   // uden miljøkort bliver metal mørkt
  const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20);
  const meshes = new Map();
  return {
    scene: rink.scene, camera: rink.camera,
    sync(world, s, time) {
      const seen = new Set();
      for (const c of s.coins) {
        seen.add(c.id);
        let m = meshes.get(c.id);
        if (!m) {
          m = new THREE.Mesh(geo, gold);
          m.scale.setScalar(c.value > 1 ? 1.9 : 1);
          m.castShadow = true;
          rink.scene.add(m);
          meshes.set(c.id, m);
        }
        m.position.set(c.x, c.y + 0.45 + (c.y === 0 ? Math.sin(time * 3 + c.id) * 0.08 : 0), c.z);
        m.rotation.set(Math.PI / 2, 0, time * 3 + c.id);
      }
      for (const [id, m] of meshes) if (!seen.has(id)) { rink.scene.remove(m); meshes.delete(id); }
      rink.sync(world, time);
    },
    dispose() { geo.dispose(); gold.dispose(); rink.dispose(); },
  };
}
