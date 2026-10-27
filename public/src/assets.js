// Modeller fra asset-serveren, når de findes (public/models/models.json, skrevet af tools/prepare.mjs). Findes en
// model ikke, svarer loadModel null, og spillet bruger sin pladsholder -- så en ny model kræver ingen kodeændring.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
let meta = null;

function models() {
  meta ??= fetch('./models/models.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return meta;
}

// En kopi af modellen, skaleret til height meter (og højst maxSide meter bred/dyb), stående på y = 0, drejet med
// models.json's yaw.
export async function loadModel(name, height, maxSide = Infinity) {
  const m = (await models())[name];
  if (!m) return null;
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`./models/${m.file}`).then((g) => g.scene).catch(() => null));
  const src = await cache.get(name);
  if (!src) return null;
  const obj = src.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const side = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const s = Math.min(height / Math.max(1e-6, box.max.y - box.min.y), maxSide / Math.max(1e-6, side));
  obj.scale.setScalar(s);
  obj.position.y = -box.min.y * s;
  if (m.yaw) obj.rotation.y = (m.yaw * Math.PI) / 180;
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return wrap;
}
