// Et lavpolygon-dyr (en pingvin-agtig figur) i spillerens farve, indtil GPU'en har lavet de rigtige modeller.
import * as THREE from 'three';

export function placeholderAnimal(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.7, flatShading: true });
  const black = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff9a2e, roughness: 0.5, flatShading: true });
  const mesh = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  mesh(new THREE.IcosahedronGeometry(0.5, 1), mat, 0, 0.58, 0).scale.set(1, 1.15, 0.95);
  mesh(new THREE.IcosahedronGeometry(0.4, 1), white, 0, 0.52, 0.2).scale.set(0.95, 1.05, 0.7);
  mesh(new THREE.IcosahedronGeometry(0.32, 1), mat, 0, 1.2, 0.05);
  mesh(new THREE.ConeGeometry(0.09, 0.22, 6), orange, 0, 1.17, 0.38).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.06, 10, 8), black, s * 0.12, 1.26, 0.3);
    mesh(new THREE.BoxGeometry(0.12, 0.45, 0.25), mat, s * 0.5, 0.65, 0).rotation.z = s * 0.35;
    mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), orange, s * 0.18, 0.04, 0.12);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
