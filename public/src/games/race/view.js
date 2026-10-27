// Penguin Race i 3D: isbanen som et bånd langs midterlinjen, sneklumper, fisk, målstreg, og kameraet over feltet
// (mellem føreren og den sidste, der stadig er med). Dyrene ligger på maven, når de glider.
import * as THREE from 'three';
import { createArena, createSea, createActors, syncActor, disposeScene } from '../common/scene.js';
import { OUT_GAP } from './physics.js';

function ribbon(track, from, to) {
  const pos = [], idx = [];
  for (let s = 0; s <= track.length; s++) {
    const p = track.at(s);
    pos.push(p.x + p.nx * from, 0, p.z + p.nz * from, p.x + p.nx * to, 0, p.z + p.nz * to);
    if (s > 0) { const k = (s - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function checker() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createView(players) {
  const { scene, camera, sun } = createArena({ background: 0x9cc9ee, fog: [45, 110], shadow: 22 });
  sun.shadow.camera.far = 80;
  const sea = createSea(scene, { color: 0x2f6fb0, y: -1.2, size: 200, segments: 60 });
  const actors = createActors(scene, players);
  let course = null;

  const iceMat = new THREE.MeshStandardMaterial({ color: 0xe9f5ff, roughness: 0.25, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x3fa7ff, roughness: 0.4, side: THREE.DoubleSide });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const fishMat = new THREE.MeshStandardMaterial({ color: 0xff8c3a, roughness: 0.4, flatShading: true });

  function setTrack(track) {
    if (course) { scene.remove(course); disposeScene(course); }
    course = new THREE.Group();
    const half = track.width / 2;
    const ice = new THREE.Mesh(ribbon(track, -half, half), iceMat);
    ice.receiveShadow = true;
    course.add(ice, new THREE.Mesh(ribbon(track, -half - 0.35, -half), edgeMat), new THREE.Mesh(ribbon(track, half, half + 0.35), edgeMat));
    const skirt = new THREE.Mesh(ribbon(track, -half - 0.35, half + 0.35), new THREE.MeshStandardMaterial({ color: 0xa9d2f2, side: THREE.DoubleSide }));
    skirt.position.y = -0.6;
    course.add(skirt);
    for (const o of track.obstacles) {
      const p = track.at(o.s), pile = new THREE.Group();
      [[0, 0.35, 0, 0.55], [0.35, 0.25, 0.2, 0.4], [-0.3, 0.22, -0.15, 0.38]].forEach(([x, y, z, r]) => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), snowMat);
        m.position.set(x, y, z); m.castShadow = true; pile.add(m);
      });
      pile.position.set(p.x + p.nx * o.d, 0, p.z + p.nz * o.d);
      course.add(pile);
    }
    track.fishMeshes = track.fish.map((f) => {
      const p = track.at(f.s), fish = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), fishMat);
      body.scale.set(1.6, 1, 0.6);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 4), fishMat);
      tail.rotation.z = Math.PI / 2; tail.position.x = -0.55;
      fish.add(body, tail);
      fish.position.set(p.x + p.nx * f.d, 0.7, p.z + p.nz * f.d);
      course.add(fish);
      return fish;
    });
    const fp = track.at(track.finish);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(track.width + 0.7, 1.4), new THREE.MeshBasicMaterial({ map: checker() }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(fp.tx, fp.tz) + Math.PI / 2;
    line.position.set(fp.x, 0.02, fp.z);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(half + 0.6, 0.15, 8, 30, Math.PI), new THREE.MeshStandardMaterial({ color: 0xff4d5e }));
    arch.position.set(fp.x, 0, fp.z);
    arch.rotation.y = Math.atan2(fp.tx, fp.tz);       // buen står på tværs af banen
    course.add(line, arch);
    scene.add(course);
  }

  const focus = new THREE.Vector3(), look = new THREE.Vector3();
  let snap = true;                                   // første billede og hvert nyt løb: kameraet springer på plads
  return {
    scene, camera, setTrack,
    sync(race, track, time) {
      const live = race.racers.filter((a) => !a.out && !a.finished);
      const ss = (live.length ? live : race.racers).map((a) => a.s);
      const lead = Math.max(...ss), tail = Math.max(lead - OUT_GAP, Math.min(...ss));
      const mid = Math.min((lead + tail) / 2, track.finish);
      for (const a of race.racers) {
        const act = actors.get(a.id);
        if (!act) continue;
        act.root.visible = !a.out;
        const p = track.at(a.s);
        const falling = a.fallT > 0;
        syncActor(act, {
          x: p.x + p.nx * a.d, z: p.z + p.nz * a.d, y: falling ? -1.2 + a.fallT * 0.5 - 0.6 : a.y,
          face: Math.atan2(p.tx, p.tz) + a.vd * 0.06, alive: !falling, lean: a.y > 0 ? 0.4 : 1.05,
        });
      }
      track.fishMeshes?.forEach((f, i) => { f.rotation.y = time * 2 + i; f.position.y = 0.7 + Math.sin(time * 3 + i) * 0.12; });
      const c = track.at(mid - 13), t = track.at(mid + 4);
      focus.set(c.x, 17, c.z);
      look.set(t.x, 0, t.z);
      if (snap) { camera.position.copy(focus); snap = false; } else camera.position.lerp(focus, 0.15);
      camera.lookAt(look);
      const m = track.at(mid);
      sun.position.set(m.x + 8, 20, m.z + 10);
      sun.target.position.set(m.x, 0, m.z);
      sea.update(time, m.x, m.z);
    },
    snapCamera() { snap = true; },
    dispose() { if (course) disposeScene(course); disposeScene(scene); },
  };
}
