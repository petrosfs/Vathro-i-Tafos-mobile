// Το γραφείο του fund: τοίχοι, γραφεία με οθόνες, ο μεγάλος πίνακας, το μηχάνημα του καταστήματος.
import * as THREE from 'three';
import { mat } from './avatar';
import { canvasTexture, drawCarpet, drawSign, drawSkyline } from './textures';

export const ROOM = { minX: -12, maxX: 12, minZ: -8, maxZ: 8, height: 4.2 };

export interface Seat {
  x: number;
  z: number;
  /** Γωνία όταν κάθεται (κοιτάει τον πίνακα). */
  ry: number;
}

export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Interactable {
  kind: 'desk' | 'shop';
  index: number;
  x: number;
  z: number;
  r: number;
}

export interface Office {
  group: THREE.Group;
  board: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D };
  monitors: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D }[];
  seats: Seat[];
  colliders: Box2[];
  interactables: Interactable[];
  shopGlow: THREE.Mesh;
  lights: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; panels: THREE.Mesh[] };
  /** Χώρος για το βάθρο ή τους τάφους στο τέλος. */
  stage: THREE.Vector3;
  bell: THREE.Group;
}

// 10 γραφεία σε 3 σειρές (4 + 3 + 3), με διαδρόμους ανάμεσα για όσους περπατούν.
const DESKS: [number, number][] = [
  [-5.1, -2.0], [-1.7, -2.0], [1.7, -2.0], [5.1, -2.0],
  [-3.6, 1.6], [0, 1.6], [3.6, 1.6],
  [-3.6, 5.0], [0, 5.0], [3.6, 5.0],
];

function box(color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function buildOffice(shopTitle: string, shopSub: string, shadows: boolean): Office {
  const g = new THREE.Group();
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  // πάτωμα με χαλί
  const carpet = canvasTexture(256, 256);
  drawCarpet(carpet.ctx);
  carpet.tex.wrapS = carpet.tex.wrapT = THREE.RepeatWrapping;
  carpet.tex.repeat.set(W / 4, D / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: carpet.tex }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // ταβάνι με φωτιστικά
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: '#2B3242' }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.height;
  g.add(ceil);
  const panels: THREE.Mesh[] = [];
  for (const x of [-7, 0, 7]) {
    for (const z of [-4, 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), new THREE.MeshBasicMaterial({ color: '#FFF4DA' }));
      p.rotation.x = Math.PI / 2;
      p.position.set(x, ROOM.height - 0.01, z);
      g.add(p);
      panels.push(p);
    }
  }
  // τοίχοι
  const wallMat = mat('#3B4458');
  const wallN = new THREE.Mesh(new THREE.PlaneGeometry(W, ROOM.height), wallMat);
  wallN.position.set(0, ROOM.height / 2, ROOM.minZ);
  const wallS = wallN.clone();
  wallS.rotation.y = Math.PI;
  wallS.position.z = ROOM.maxZ;
  const wallW = new THREE.Mesh(new THREE.PlaneGeometry(D, ROOM.height), wallMat);
  wallW.rotation.y = Math.PI / 2;
  wallW.position.set(ROOM.minX, ROOM.height / 2, 0);
  const wallE = wallW.clone();
  wallE.rotation.y = -Math.PI / 2;
  wallE.position.x = ROOM.maxX;
  for (const w of [wallN, wallS, wallW, wallE]) {
    w.receiveShadow = true;
    g.add(w);
  }
  // σοβατεπί
  g.add(box('#232836', W, 0.14, 0.04, 0, 0.07, ROOM.minZ + 0.02, false));
  g.add(box('#232836', W, 0.14, 0.04, 0, 0.07, ROOM.maxZ - 0.02, false));
  // παράθυρα με θέα στους ουρανοξύστες (νότιος και δυτικός τοίχος)
  const sky = canvasTexture(1024, 256);
  drawSkyline(sky.ctx, 7);
  const skyMat = new THREE.MeshBasicMaterial({ map: sky.tex });
  for (const x of [-7.5, 0, 7.5]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), skyMat);
    win.rotation.y = Math.PI;
    win.position.set(x, 2.2, ROOM.maxZ - 0.02);
    g.add(win);
    g.add(box('#1A1E28', 6.1, 0.08, 0.06, x, 3.42, ROOM.maxZ - 0.04, false));
    g.add(box('#1A1E28', 6.1, 0.08, 0.06, x, 0.98, ROOM.maxZ - 0.04, false));
    for (const dx of [-1.5, 0, 1.5]) g.add(box('#1A1E28', 0.06, 2.4, 0.06, x + dx, 2.2, ROOM.maxZ - 0.04, false));
  }
  const sky2 = canvasTexture(1024, 256);
  drawSkyline(sky2.ctx, 31);
  const win2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4), new THREE.MeshBasicMaterial({ map: sky2.tex }));
  win2.rotation.y = Math.PI / 2;
  win2.position.set(ROOM.minX + 0.02, 2.2, 2);
  g.add(win2);
  // μεγάλος πίνακας
  const board = canvasTexture(1024, 512);
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: board.tex }));
  boardMesh.position.set(0, 2.25, ROOM.minZ + 0.08);
  g.add(boardMesh);
  g.add(box('#10141C', 10.3, 5.3, 0.04, 0, 2.25, ROOM.minZ + 0.03, false));
  // καμπανάκι
  const bell = new THREE.Group();
  bell.add(box('#5A3A22', 0.8, 1.0, 0.5, 0, 0.5, 0));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.38, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#E8B923', side: THREE.DoubleSide }));
  cup.position.y = 1.25;
  bell.add(cup);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#E8B923'));
  knob.position.y = 1.47;
  bell.add(knob);
  bell.position.set(7.4, 0, ROOM.minZ + 1.0);
  g.add(bell);
  // γραφεία
  const seats: Seat[] = [];
  const colliders: Box2[] = [];
  const interactables: Interactable[] = [];
  const monitors: Office['monitors'] = [];
  DESKS.forEach(([x, z], i) => {
    g.add(box('#6E4B32', 1.9, 0.06, 0.9, x, 0.76, z));
    g.add(box('#3A2A1E', 0.06, 0.74, 0.8, x - 0.9, 0.37, z));
    g.add(box('#3A2A1E', 0.06, 0.74, 0.8, x + 0.9, 0.37, z));
    // οθόνες: η κύρια με γράφημα και μια δεύτερη διακοσμητική
    const mon = canvasTexture(256, 160);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.45), new THREE.MeshBasicMaterial({ map: mon.tex }));
    screen.position.set(x - 0.25, 1.12, z - 0.21);
    g.add(screen);
    g.add(box('#111', 0.78, 0.5, 0.04, x - 0.25, 1.12, z - 0.24));
    g.add(box('#222', 0.06, 0.3, 0.06, x - 0.25, 0.9, z - 0.26));
    const m2 = box('#111', 0.5, 0.36, 0.04, x + 0.45, 1.06, z - 0.2);
    m2.rotation.y = -0.35;
    g.add(m2);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshBasicMaterial({ color: '#12325A' }));
    s2.position.set(x + 0.44, 1.06, z - 0.175);
    s2.rotation.y = -0.35;
    g.add(s2);
    monitors.push(mon);
    g.add(box('#2A2A2A', 0.5, 0.02, 0.16, x - 0.2, 0.8, z + 0.12));
    g.add(box('#ECECEC', 0.1, 0.12, 0.08, x + 0.7, 0.85, z + 0.1));
    // καρέκλα
    const cz = z + 0.75;
    g.add(box('#20232B', 0.5, 0.08, 0.5, x, 0.47, cz));
    g.add(box('#20232B', 0.5, 0.55, 0.07, x, 0.78, cz + 0.25));
    g.add(box('#111', 0.06, 0.45, 0.06, x, 0.22, cz, false));
    seats.push({ x, z: cz, ry: Math.PI });
    colliders.push({ minX: x - 1.0, maxX: x + 1.0, minZ: z - 0.5, maxZ: z + 0.5 });
    interactables.push({ kind: 'desk', index: i, x, z: z + 0.9, r: 1.1 });
  });
  // μηχάνημα καταστήματος (ανατολικός τοίχος)
  const shop = new THREE.Group();
  shop.add(box('#1F6F4A', 1.3, 2.3, 0.9, 0, 1.15, 0));
  const sign = canvasTexture(256, 128);
  drawSign(sign.ctx, shopTitle, shopSub, '#0B2E1F', '#F5C542');
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: sign.tex }));
  signMesh.position.set(0, 1.85, 0.46);
  shop.add(signMesh);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshBasicMaterial({ color: '#3DDC84', transparent: true, opacity: 0.35 }));
  glow.position.set(0, 1.0, 0.46);
  shop.add(glow);
  shop.add(box('#0C0C0C', 0.4, 0.12, 0.05, 0, 0.35, 0.46, false));
  shop.position.set(ROOM.maxX - 0.6, 0, 0);
  shop.rotation.y = -Math.PI / 2;
  g.add(shop);
  colliders.push({ minX: ROOM.maxX - 1.1, maxX: ROOM.maxX, minZ: -0.7, maxZ: 0.7 });
  interactables.push({ kind: 'shop', index: 0, x: ROOM.maxX - 1.8, z: 0, r: 1.6 });
  // καφετιέρα και ψυγείο νερού (δυτικός τοίχος)
  g.add(box('#2E3340', 1.2, 0.9, 0.6, ROOM.minX + 0.4, 0.45, -5));
  g.add(box('#B8BEC8', 0.4, 0.45, 0.35, ROOM.minX + 0.45, 1.12, -5.2));
  g.add(box('#C43A3A', 0.25, 0.15, 0.25, ROOM.minX + 0.45, 0.98, -4.75));
  colliders.push({ minX: ROOM.minX, maxX: ROOM.minX + 1.0, minZ: -5.4, maxZ: -4.6 });
  // φυτά στις γωνίες
  for (const [x, z] of [[-11, -7], [11, -7], [-11, 7], [11, 7], [-11, 6.9 - 4]] as [number, number][]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), mat('#B5654A'));
    pot.position.set(x, 0.25, z);
    pot.castShadow = true;
    g.add(pot);
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 - k * 0.06, 0), mat(k % 2 ? '#3E8E4E' : '#2F7A40'));
      leaf.position.set(x + (k - 1) * 0.08, 0.75 + k * 0.32, z);
      leaf.castShadow = true;
      g.add(leaf);
    }
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }
  // φώτα
  const hemi = new THREE.HemisphereLight('#E6EEFF', '#3A3024', 1.4);
  g.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF2DD', 1.3);
  sun.position.set(6, 10, 6);
  sun.target.position.set(0, 0, 0);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera;
    c.left = -13;
    c.right = 13;
    c.top = 10;
    c.bottom = -10;
    c.near = 1;
    c.far = 30;
    sun.shadow.bias = -0.0008;
  }
  g.add(sun, sun.target);
  return {
    group: g, board, monitors, seats, colliders, interactables, shopGlow: glow,
    lights: { hemi, sun, panels }, stage: new THREE.Vector3(0, 0, -5), bell,
  };
}
