// Det, 3D-spillene deler: scene med lys og tåge, hav med bølger, dyrene (art pr. spiller, farvet ring,
// navneskilt) og oprydning. Flyttet ud af sumo/view.js (fase 0); spillene bygger deres egen bane ovenpå.
import * as THREE from 'three';
import { placeholderAnimal } from './placeholder.js';
import { loadModel } from '../../assets.js';
import { SPECIES } from './species.js';

export const BODY = 0.55;           // et dyrs radius på isen (samme i alle spil)

export const lerpAngle = (a, b, k) => a + (((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * k;

export function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 36px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.65)';
  g.strokeText(text, 128, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(2, 0.5, 1);
  s.renderOrder = 10;
  return s;
}

// Scene, kamera (16:9) og lys. sun.target kan flyttes med (spil, hvor kameraet kører).
export function createArena({ background = 0x0b2a44, fog = [30, 70], shadow = 9 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.fog = new THREE.Fog(background, fog[0], fog[1]);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0a2238, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -shadow, right: shadow, top: shadow, bottom: -shadow, near: 1, far: 40 });
  scene.add(sun, sun.target);
  return { scene, camera, sun };
}

// Et hav med bølger. update(time, cx, cz) flytter det med kameraet; bølgerne følger verdens-koordinater.
export function createSea(scene, { color = 0x1565a8, y = -0.35, size = 140, segments = 70 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1, flatShading: true }));
  mesh.position.y = y;
  scene.add(mesh);
  return {
    mesh,
    update(time, cx = 0, cz = 0) {
      mesh.position.x = cx; mesh.position.z = cz;
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3] + cx, z = base[i * 3 + 2] + cz;
        p.setY(i, Math.sin(x * 0.35 + time * 1.3) * 0.12 + Math.cos(z * 0.3 + time * 1.1) * 0.12);
      }
      p.needsUpdate = true;
    },
  };
}

// Ét dyr pr. spiller: art efter tilmeldingsrækkefølge, ring i spillerens farve (de genererede dyr er mest hvide
// og grå), navneskilt. Modellen skiftes ind, når den er hentet; indtil da pladsholderen.
export function createActors(scene, players) {
  const actors = new Map();
  players.forEach((p, i) => {
    const root = new THREE.Group(), body = new THREE.Group();
    body.add(placeholderAnimal(p.color));
    root.add(body);
    const ring = new THREE.Mesh(new THREE.RingGeometry(BODY * 0.85, BODY * 1.35, 40),
      new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.95 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);
    const tag = nameSprite(p.name, p.color);
    tag.position.y = 2.0;
    root.add(tag);
    scene.add(root);
    actors.set(p.id, { root, body, ring, tag });
    loadModel(SPECIES[i % SPECIES.length], 1.6, 1.5).then((m) => { if (m) { body.clear(); body.add(m); } });
  });
  return actors;
}

// a: { x, y, z, face, alive, dash?, lean? } -- lean (radianer fremover) vinder over dash-hældningen.
export function syncActor(act, a) {
  act.root.position.set(a.x, Math.max(a.y ?? 0, -3.5), a.z);
  act.body.rotation.y = lerpAngle(act.body.rotation.y, a.face, 0.25);
  act.body.rotation.x = a.alive ? (a.lean ?? (a.dash > 0 ? 0.35 : 0)) : Math.min(1.3, -(a.y ?? 0) * 0.6);
  act.ring.visible = a.alive;
  act.tag.visible = (a.y ?? 0) > -1;
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) { m.map?.dispose(); m.dispose(); }
  });
}
