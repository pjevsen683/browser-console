// Mini Racers i 3D: et kæmpe køkkenbord med en legetøjsvej (asfalt, stiplet midte, rød-hvide kantsten, ternet start),
// ting fra Kattekaos rundt om banen og små biler af primitiver i spillernes farver. Kameraet hænger over feltet
// (mellem føreren og den sidste, der stadig er med) og går tættere på, når afstanden skrumper.
import * as THREE from 'three';
import { createArena, nameSprite, lerpAngle, disposeScene } from '../common/scene.js';
import { loadModel } from '../../assets.js';
import { FALL_TIME } from './physics.js';

// Et bånd langs banen fra sideafstand a til b, lukket rundt; y lidt over bordet.
function band(track, a, b, y, s0 = 0, s1 = track.length, stepS = 1) {
  const pos = [], idx = [];
  let k = 0;
  for (let s = s0; s <= s1 + 1e-6; s += stepS) {
    const p = track.at(s);
    pos.push(p.x + p.nx * a, y, p.z + p.nz * a, p.x + p.nx * b, y, p.z + p.nz * b);
    if (k > 0) { const i = (k - 1) * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = ['#b07a4f', '#a8724a', '#b88457', '#a46e45'][i % 4];
    g.fillRect(0, i * 64, 512, 64);
    g.strokeStyle = 'rgba(60,30,10,.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke();
    for (let j = 0; j < 6; j++) {
      g.strokeStyle = 'rgba(90,50,20,.18)'; g.lineWidth = 1;
      g.beginPath();
      const y = i * 64 + 8 + j * 9;
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 40 + i + j) * 3);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function checker() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCar(color) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.38, 1.75), paint);
  body.position.y = 0.36;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), paint);
  nose.position.set(0, 0.3, 0.95);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.32, 0.8), new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: 0.1, metalness: 0.4 }));
  cabin.position.set(0, 0.7, -0.12);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 1.76), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  stripe.position.set(0, 0.56, 0);
  car.add(body, nose, cabin, stripe);
  const tire = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });
  for (const [x, z] of [[-0.52, 0.55], [0.52, 0.55], [-0.52, -0.6], [0.52, -0.6]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12), tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.22, z);
    car.add(w);
  }
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return car;
}

export function createView(players, track) {
  const { scene, camera, sun } = createArena({ background: 0x2b2420, fog: [60, 140], shadow: 26 });
  sun.shadow.camera.far = 90;
  sun.shadow.mapSize.set(2048, 2048);
  const T = track.table;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -30;
  const wood = woodTexture();
  wood.repeat.set(T.hx / 12, T.hz / 12);
  const top = new THREE.Mesh(new THREE.BoxGeometry(T.hx * 2, 1.5, T.hz * 2), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }));
  top.position.set(T.cx, -0.75, T.cz);
  top.receiveShadow = true;
  scene.add(floor, top);

  const road = new THREE.Group();
  const half = track.width / 2;
  const asphalt = new THREE.Mesh(band(track, -half, half, 0.01), new THREE.MeshStandardMaterial({ color: 0x4b4f57, roughness: 0.85 }));
  asphalt.receiveShadow = true;
  road.add(asphalt);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), red = new THREE.MeshStandardMaterial({ color: 0xe0302e, roughness: 0.6 });
  for (let s = 0, i = 0; s < track.length; s += 2, i++) {
    const m = i % 2 ? white : red;
    const a = new THREE.Mesh(band(track, -half - 0.45, -half, 0.03, s, Math.min(s + 2, track.length), 0.5), m);
    const b = new THREE.Mesh(band(track, half, half + 0.45, 0.03, s, Math.min(s + 2, track.length), 0.5), m);
    a.receiveShadow = b.receiveShadow = true;
    road.add(a, b);
    if (i % 2 === 0) road.add(new THREE.Mesh(band(track, -0.1, 0.1, 0.02, s, s + 1.2, 0.6), white));
  }
  const p0 = track.at(0);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(track.width, 1.2), new THREE.MeshBasicMaterial({ map: checker() }));
  line.rotation.x = -Math.PI / 2;                   // flad; bredden går på tværs af vejen, når gruppen drejes
  const lineWrap = new THREE.Group();
  lineWrap.add(line);
  lineWrap.rotation.y = Math.atan2(p0.tx, p0.tz) + Math.PI;
  lineWrap.position.set(p0.x, 0.04, p0.z);
  road.add(lineWrap);
  scene.add(road);

  // tingene: en pladsholder (cylinder), indtil modellen er hentet
  const propMat = new THREE.MeshStandardMaterial({ color: 0xd9c7a7, roughness: 0.7 });
  for (const o of track.props) {
    const g = new THREE.Group();
    const ph = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, o.h, 16), propMat);
    ph.position.y = o.h / 2;
    ph.castShadow = true;
    g.add(ph);
    g.position.set(o.x, 0, o.z);
    g.rotation.y = o.rot;
    scene.add(g);
    loadModel(o.kind, o.h, o.r * 2.1).then((m) => { if (m) { g.clear(); g.add(m); } });
  }

  const cars = new Map();
  for (const p of players) {
    const root = new THREE.Group(), body = makeCar(p.color);
    root.add(body);
    const tag = nameSprite(p.name, p.color);
    tag.scale.set(3.6, 0.9, 1);
    tag.position.y = 2.2;
    root.add(tag);
    scene.add(root);
    cars.set(p.id, { root, body, tag });
  }

  const focus = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3();
  let snap = true;
  return {
    scene, camera,
    sync(list, gap) {
      for (const c of list) {
        const v = cars.get(c.id);
        if (!v) continue;
        v.root.visible = !c.out;
        if (c.fallT > 0) {
          const k = 1 - c.fallT / FALL_TIME;                  // 0 -> 1 under faldet
          if (c.lost) { v.root.position.set(c.x, 0, c.z); v.body.rotation.y += 0.3; v.body.scale.setScalar(Math.max(0.05, 1 - k)); }
          else { v.root.position.set(c.x, -k * k * 28, c.z); v.body.rotation.x += 0.15; }
          v.tag.visible = false;
        } else {
          v.root.position.set(c.x, 0, c.z);
          v.body.rotation.x = 0;
          v.body.scale.setScalar(1);
          v.body.rotation.y = lerpAngle(v.body.rotation.y, c.h, 0.5);
          v.body.rotation.z = Math.max(-0.12, Math.min(0.12, ((c.vx * Math.cos(c.h) - c.vz * Math.sin(c.h)) || 0) * 0.03));
          v.tag.visible = true;
        }
      }
      const live = list.filter((c) => !c.out);
      const ps = (live.length ? live : list).map((c) => c.p);
      const lead = Math.max(...ps), tail = Math.max(lead - gap, Math.min(...ps));
      const mid = track.at((lead + tail) / 2);
      const h = 14 + gap * 0.8;
      focus.set(mid.x, h, mid.z + h * 0.5);
      look.set(mid.x, 0, mid.z);
      if (snap) { camera.position.copy(focus); lookNow.copy(look); snap = false; }
      else { camera.position.lerp(focus, 0.08); lookNow.lerp(look, 0.08); }
      camera.lookAt(lookNow);
      sun.position.set(lookNow.x + 12, 30, lookNow.z + 14);
      sun.target.position.copy(lookNow);
    },
    snapCamera() { snap = true; },
    dispose() { disposeScene(scene); },
  };
}
