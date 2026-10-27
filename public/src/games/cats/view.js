// Cat Chaos i 3D: stuen, det lange bord, mormor i lænestolen for den fjerne ende, kattene (Kattekaos' kat farvet
// med spillerens farve) og tingene. Modellerne er Kattekaos'; mangler en, står der en pladsholder af primitiver.
import * as THREE from 'three';
import { createArena, nameSprite, lerpAngle, disposeScene } from '../common/scene.js';
import { loadModel } from '../../assets.js';

const CAT_H = 1.15, OWNER_H = 5.2;

function stretch(m, w, d) {                         // bordmodellen strækkes til spillepladen, som i Kattekaos
  const box = new THREE.Box3().setFromObject(m);
  m.scale.set(w / (box.max.x - box.min.x), 1, d / (box.max.z - box.min.z));
}

function tintCat(obj, color) {
  const c = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color = c;
  });
}

function popupSprite(text, color) {
  const s = nameSprite(text, color);
  s.scale.set(2.4, 0.6, 1);
  return s;
}

export function createView(players, world) {
  const { scene, camera, sun } = createArena({ background: 0x3a2a24, fog: [40, 90], shadow: 11 });
  const { hx, hz, top } = world;
  // stuen: gulv, bagvæg med tapet
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -top;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({ color: 0xc9a77c, roughness: 0.9 }));
  wall.position.set(0, -top + 15, -hz - 9);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x7b2d3a, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.4, 0.8, 1);
  rug.position.y = -top + 0.01;
  scene.add(floor, wall, rug);

  // bordet: en plade af primitiver, indtil modellen er hentet
  const table = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.6, 0.3, hz * 2 + 0.6), new THREE.MeshStandardMaterial({ color: 0x6e4630, roughness: 0.6 }));
  slab.position.y = -0.15;
  slab.receiveShadow = true;
  table.add(slab);
  scene.add(table);
  loadModel('table', top).then((m) => {
    if (!m) return;
    stretch(m, hx * 2 + 0.6, hz * 2 + 0.6);
    m.position.y = -top;
    m.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    table.clear(); table.add(m);
  });

  // mormor: drejer fra ryggen til (0) til ansigtet mod bordet (1)
  const owner = new THREE.Group();
  owner.position.set(0, -top, -hz - 3.2);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 2.6), new THREE.MeshStandardMaterial({ color: 0x4f6d8f }));
  chair.position.y = 1.7;
  owner.add(chair);
  scene.add(owner);
  loadModel('owner', OWNER_H, 4).then((m) => { if (m) { owner.clear(); owner.add(m); } });
  const alert = nameSprite('!', '#ffd23f');
  alert.scale.set(3, 0.75, 1);
  alert.position.set(0, -top + OWNER_H + 1.2, -hz - 3.2);
  scene.add(alert);

  // kattene
  const cats = new Map();
  players.forEach((p) => {
    const root = new THREE.Group(), body = new THREE.Group();
    const ph = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.5, 4, 10), new THREE.MeshStandardMaterial({ color: p.color }));
    ph.position.y = 0.65;
    body.add(ph);
    root.add(body);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 36), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);
    const tag = nameSprite(p.name, p.color);
    tag.position.y = 1.9;
    root.add(tag);
    const angry = nameSprite('💢', '#ff4d5e');
    angry.position.y = 2.4;
    angry.visible = false;
    root.add(angry);
    scene.add(root);
    cats.set(p.id, { root, body, angry });
    loadModel('cat', CAT_H, 1.4).then((m) => { if (m) { tintCat(m, p.color); body.clear(); body.add(m); } });
  });

  // tingene: ét objekt pr. ting, hentet første gang den ses
  const items = new Map();
  function itemObj(it) {
    let o = items.get(it.id);
    if (o) return o;
    const root = new THREE.Group(), tilt = new THREE.Group();
    const ph = new THREE.Mesh(new THREE.CylinderGeometry(it.r * 0.8, it.r, it.h, 16), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }));
    ph.position.y = it.h / 2;
    ph.castShadow = true;
    tilt.add(ph);
    root.add(tilt);
    scene.add(root);
    o = { root, tilt, broken: false };
    items.set(it.id, o);
    loadModel(it.kind, it.h, it.r * 2.2).then((m) => { if (m && !o.broken) { tilt.clear(); tilt.add(m); } });
    return o;
  }
  function shatter(it) {                          // skår på gulvet i stedet for tingen
    const o = itemObj(it);
    o.broken = true;
    o.tilt.clear();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.12), mat);
      s.position.set((Math.random() - 0.5) * 1.4, 0.05, (Math.random() - 0.5) * 1.4);
      s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      o.tilt.add(s);
    }
    o.root.rotation.set(0, 0, 0);
    o.tilt.rotation.set(0, 0, 0);
  }

  const pops = [];
  function popup(x, z, text, color) {
    const s = popupSprite(text, color);
    s.position.set(x, 1.5, z);
    scene.add(s);
    pops.push({ s, t: 1.2 });
  }

  camera.position.set(0, 13, 13.8);
  camera.lookAt(0, -1.4, -0.9);
  sun.position.set(-6, 18, 10);

  return {
    scene, camera, popup, shatter,
    sync(s) {
      const w = s.world;
      for (const c of w.cats) {
        const a = cats.get(c.id);
        if (!a) continue;
        a.root.position.set(c.x, 0, c.z);
        a.body.rotation.y = lerpAngle(a.body.rotation.y, c.face, 0.3);
        a.body.rotation.x = c.swatT > 0 ? 0.4 : 0;
        a.body.scale.y = c.stun > 0 ? 0.8 : 1;
        a.angry.visible = c.stun > 0;
      }
      for (const it of w.items) {
        const o = itemObj(it);
        if (o.broken) { o.root.position.set(it.x, -top, it.z); continue; }
        o.root.position.set(it.x, it.y, it.z);
        o.root.rotation.y = it.yaw;
        o.tilt.rotation.x = it.tilt;
      }
      owner.rotation.y = (1 - s.owner.turn) * Math.PI;
      alert.visible = s.owner.state === 'turning' || s.owner.state === 'looking';
      alert.material.color.set(s.owner.state === 'looking' ? 0xff4d5e : 0xffffff);
    },
    // Popups ældes med spillets tid (også under prewarm, hvor der ikke tegnes).
    tick(dt) {
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t -= dt;
        p.s.position.y += dt * 1.5;
        p.s.material.opacity = Math.min(1, p.t * 2);
        if (p.t <= 0) { scene.remove(p.s); p.s.material.map.dispose(); p.s.material.dispose(); pops.splice(i, 1); }
      }
    },
    dispose() { disposeScene(scene); },
  };
}
