// Hot Potato i 3D: en rund isbane med lav kant på den fælles scene, og bomben over bærerens hoved.
import * as THREE from 'three';
import { createArena, createSea, createActors, syncActor, disposeScene } from '../common/scene.js';

export function createView(players, radius) {
  const { scene, camera } = createArena({ background: 0x14213d });
  const sea = createSea(scene, { color: 0x24508a });
  const rink = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.95, 0.7, 64),
    new THREE.MeshStandardMaterial({ color: 0xdff0ff, roughness: 0.2, metalness: 0.05 }));
  rink.position.y = -0.35;
  rink.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 10, 80),
    new THREE.MeshStandardMaterial({ color: 0xff8c3a, roughness: 0.5 }));
  wall.rotation.x = Math.PI / 2;
  wall.position.y = 0.12;
  scene.add(rink, wall);
  const actors = createActors(scene, players);

  const bomb = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.35, metalness: 0.3 }));
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xc8a46a }));
  fuse.position.y = 0.5;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  spark.position.y = 0.68;
  const glow = new THREE.PointLight(0xff4d2e, 0, 6);
  bomb.add(shell, fuse, spark, glow);
  scene.add(bomb);

  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0 }));
  scene.add(flash);
  let flashT = 0;

  return {
    scene, camera,
    boom(at) { flash.position.set(at.x, 1, at.z); flashT = 0.5; },
    sync(w, p, time, dt) {
      for (const a of w.animals) { const act = actors.get(a.id); if (act) syncActor(act, a); }
      const h = w.animals.find((a) => a.id === p.holder);
      bomb.visible = p.phase === 'play' && !!h?.alive;
      if (h) bomb.position.set(h.x, 2.55 + Math.sin(time * 6) * 0.06, h.z);
      const blink = Math.sin(time * Math.PI * 2 * p.rate) > 0;
      spark.material.color.setHex(blink ? 0xffd23f : 0xff4d2e);
      glow.intensity = blink ? 6 : 1;
      shell.scale.setScalar(1 + (blink ? 0.06 : 0) + (p.fuse < 2 ? 0.1 : 0));
      if (flashT > 0) { flashT -= dt; flash.material.opacity = Math.max(0, flashT * 2); flash.scale.setScalar(1 + (0.5 - flashT) * 8); }
      sea.update(time);
      const dist = 9 + w.radius * 1.6;
      camera.position.set(0, dist * 0.85, dist * 0.75);
      camera.lookAt(0, -0.5, 0.6);
    },
    dispose() { disposeScene(scene); },
  };
}
