// Η τίγρης του fund: low-poly κατοικίδιο που τριγυρνάει στους διαδρόμους του γραφείου.
// Η διαδρομή βγαίνει από το ρολόι και το seed της παρτίδας, άρα όλοι οι παίκτες τη βλέπουν στο ίδιο σημείο.
import * as THREE from 'three';
import { mat } from './avatar';
import { hash } from '../sim/rng';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cone: new THREE.ConeGeometry(1, 1, 4),
};

function m(g: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(g, mat(color));
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const ORANGE = '#E8862A';
const DARK = '#1B1410';
const WHITE = '#F3EEE4';

// Κόμβοι στους διαδρόμους (ανάμεσα στις σειρές γραφείων και γύρω τους) και οι συνδέσεις τους.
const NODES: [number, number][] = [];
const ZS = [-4.6, 0.15, 3.45];
const XS = [-9.6, -5, 0, 5, 9.6];
for (const z of ZS) for (const x of XS) NODES.push([x, z]);
const idx = (xi: number, zi: number) => zi * XS.length + xi;
const EDGES: number[][] = NODES.map(() => []);
function link(a: number, b: number) {
  EDGES[a].push(b);
  EDGES[b].push(a);
}
for (let zi = 0; zi < ZS.length; zi++) for (let xi = 0; xi + 1 < XS.length; xi++) link(idx(xi, zi), idx(xi + 1, zi));
// κάθετα: στις άκρες του γραφείου, και στη μέση μπροστά (ανάμεσα στα γραφεία της πρώτης σειράς)
for (let zi = 0; zi + 1 < ZS.length; zi++) {
  link(idx(0, zi), idx(0, zi + 1));
  link(idx(XS.length - 1, zi), idx(XS.length - 1, zi + 1));
}
link(idx(2, 0), idx(2, 1));

const SEG_MS = 8000;
const SPEED = 1.5;

/** Ο κόμβος όπου βρίσκεται η τίγρης στην αρχή του τμήματος k (ίδιο αποτέλεσμα σε κάθε συσκευή). */
function nodeAt(seed: number, k: number): number {
  const base = Math.floor(k / 64) * 64;
  let n = hash(seed, base, 77) % NODES.length;
  for (let i = base; i < k; i++) {
    const nb = EDGES[n];
    n = nb[hash(seed, i, 78) % nb.length];
  }
  return n;
}

export class Tiger {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private tail: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private ry = 0;

  constructor(private seed: number) {
    const b = this.body;
    // κορμός με ρίγες
    b.add(m(G.box, ORANGE, 0.46, 0.42, 1.15, 0, 0.62, 0));
    b.add(m(G.box, WHITE, 0.4, 0.06, 0.9, 0, 0.42, 0.02));
    for (let i = 0; i < 6; i++) {
      const z = -0.45 + i * 0.18;
      b.add(m(G.box, DARK, 0.47, 0.32, 0.045, 0, 0.66, z));
      b.add(m(G.box, DARK, 0.3, 0.02, 0.05, 0, 0.84, z + 0.03));
    }
    // κεφάλι
    const h = this.head;
    h.position.set(0, 0.86, 0.62);
    h.add(m(G.box, ORANGE, 0.42, 0.36, 0.34));
    h.add(m(G.box, WHITE, 0.26, 0.16, 0.14, 0, -0.07, 0.21));
    h.add(m(G.box, '#2A1A14', 0.08, 0.05, 0.03, 0, -0.01, 0.29));
    for (const x of [-0.11, 0.11]) {
      h.add(m(G.box, '#C8E86B', 0.06, 0.05, 0.02, x, 0.06, 0.175));
      h.add(m(G.box, '#111', 0.025, 0.045, 0.025, x, 0.06, 0.185));
      h.add(m(G.cone, ORANGE, 0.07, 0.12, 0.05, x * 1.3, 0.22, -0.04));
    }
    for (const x of [-0.16, 0.16]) h.add(m(G.box, DARK, 0.03, 0.14, 0.2, x * 1.32, 0.04, -0.02));
    h.add(m(G.box, DARK, 0.04, 0.12, 0.02, 0, 0.12, 0.172));
    b.add(h);
    // πόδια (περιστρέφονται στον ώμο)
    for (const [x, z] of [[-0.16, 0.42], [0.16, 0.42], [-0.16, -0.42], [0.16, -0.42]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.5, z);
      leg.add(m(G.box, ORANGE, 0.13, 0.46, 0.14, 0, -0.23, 0));
      leg.add(m(G.box, DARK, 0.135, 0.04, 0.145, 0, -0.18, 0));
      leg.add(m(G.box, WHITE, 0.15, 0.06, 0.18, 0, -0.47, 0.02));
      b.add(leg);
      this.legs.push(leg);
    }
    // ουρά σε κομμάτια, για να κυματίζει
    let parent: THREE.Object3D = b;
    const start = new THREE.Vector3(0, 0.75, -0.58);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.copy(i === 0 ? start : new THREE.Vector3(0, 0, -0.16));
      seg.add(m(G.cyl, i % 2 ? DARK : i === 4 ? DARK : ORANGE, 0.035, 0.17, 0.035, 0, 0, -0.08).rotateX(Math.PI / 2));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    this.group.add(b);
    this.group.scale.setScalar(1.05);
  }

  update(now: number) {
    const k = Math.floor(now / SEG_MS);
    const from = NODES[nodeAt(this.seed, k)];
    const to = NODES[nodeAt(this.seed, k + 1)];
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const dist = Math.hypot(dx, dz);
    const walkMs = Math.min(SEG_MS * 0.85, (dist / SPEED) * 1000);
    const tIn = now - k * SEG_MS;
    const f = walkMs > 0 ? Math.min(1, tIn / walkMs) : 1;
    const e = f * f * (3 - 2 * f);
    const walking = f < 1 && dist > 0.01;
    this.group.position.set(from[0] + dx * e, 0, from[1] + dz * e);
    if (walking) {
      const want = Math.atan2(dx, dz);
      let d = want - this.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ry += d * 0.15;
    }
    this.group.rotation.y = this.ry;
    const t = now / 1000;
    const s = Math.sin(t * 9);
    this.legs.forEach((leg, i) => (leg.rotation.x = walking ? (i === 0 || i === 3 ? s : -s) * 0.5 : 0));
    // όταν στέκεται, κάθεται λίγο προς τα πίσω και κουνάει το κεφάλι
    this.body.position.y = walking ? Math.abs(Math.cos(t * 9)) * 0.03 : 0;
    this.body.rotation.x = walking ? 0 : -0.12;
    this.head.rotation.y = walking ? 0 : Math.sin(t * 0.8) * 0.5;
    this.head.rotation.x = walking ? 0 : 0.12;
    this.tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * (walking ? 5 : 2) - i * 0.6) * (0.25 + i * 0.05);
      seg.rotation.x = i === 0 ? -0.6 : 0.12;
    });
  }
}
