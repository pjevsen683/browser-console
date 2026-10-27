// Bombs Away i 3D: en græsø i havet, skygger, der bliver mørkere, mens bomben falder, og et glimt, når den springer.
import * as THREE from 'three';
import { createRink } from '../common/rink.js';
import { WARN, BLAST } from './rules.js';

export function createView(players, radius, { warn = WARN, blast = BLAST } = {}) {   // Bomber King: kortere lunte, større bombe
  const rink = createRink(players, { radius, floor: 0x7ccf6a, rim: null, background: 0x87c7ee });
  const shadowGeo = new THREE.CircleGeometry(blast, 32), bombGeo = new THREE.SphereGeometry(0.45, 16, 12);
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.35, metalness: 0.3 });
  const shown = new Map(), flashes = [];
  return {
    scene: rink.scene, camera: rink.camera, actors: rink.actors,
    boom(x, z) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 }));
      m.position.set(x, 0.6, z);
      rink.scene.add(m);
      flashes.push({ m, t: 0.45 });
    },
    // glimtene ældes her (kaldes fra update), så prewarm uden tegning ikke hober dem op
    tick(dt) {
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.t -= dt;
        f.m.scale.setScalar(1 + (0.45 - f.t) * 3);
        f.m.material.opacity = Math.max(0, f.t * 2);
        if (f.t <= 0) { rink.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); flashes.splice(i, 1); }
      }
    },
    sync(world, s, time) {
      const seen = new Set();
      for (const b of s.bombs) {
        seen.add(b.id);
        let v = shown.get(b.id);
        if (!v) {
          const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 }));
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.set(b.x, 0.03, b.z);
          const bomb = new THREE.Mesh(bombGeo, bombMat);
          bomb.castShadow = true;
          rink.scene.add(shadow, bomb);
          v = { shadow, bomb };
          shown.set(b.id, v);
        }
        v.shadow.position.set(b.x, 0.03, b.z);            // id'erne starter forfra hver runde
        const k = 1 - Math.max(0, b.t) / warn;             // 0 -> 1, mens bomben falder
        v.shadow.material.opacity = 0.12 + k * 0.45;
        v.shadow.material.color.setHex(k > 0.75 && Math.sin(time * 40) > 0 ? 0xff2020 : 0x000000);
        v.bomb.position.set(b.x, 0.45 + (1 - k) * 14, b.z);
      }
      for (const [id, v] of shown) if (!seen.has(id)) { rink.scene.remove(v.shadow, v.bomb); v.shadow.material.dispose(); shown.delete(id); }
      rink.sync(world, time);
    },
    dispose() { shadowGeo.dispose(); bombGeo.dispose(); bombMat.dispose(); rink.dispose(); },
  };
}
