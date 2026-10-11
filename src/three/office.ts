// Το γραφείο του fund: γραφεία με οθόνες, ο μεγάλος πίνακας, το μηχάνημα του καταστήματος, τα φώτα.
// Πάτωμα, τοίχοι, παράθυρα και ό,τι φαίνεται έξω εξαρτώνται από τον χώρο (venue.ts).
import * as THREE from 'three';
import { mat, toon } from './avatar';
import { canvasTexture, drawSign } from './textures';
import { makeCoffeeCorner, makeMug } from './props';

const MUG_COLORS = ['#F2F2F2', '#E24B4B', '#2B5DB2', '#F5C542', '#2E8B57', '#1E1E1E'];

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
  kind: 'desk' | 'shop' | 'slot';
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
  /** Ομάδα ανά γραφείο για τα διακοσμητικά του παίκτη. */
  deskDecor: THREE.Group[];
  /** Υλικά των γραφείων και του πλαισίου του πίνακα (αλλάζουν με τον χώρο). */
  deskMats: { top: THREE.MeshToonMaterial; leg: THREE.MeshToonMaterial; chair: THREE.MeshToonMaterial };
  boardFrame: THREE.MeshToonMaterial;
  /** Οι οθόνες κάθε γραφείου (η πρώτη είναι η κύρια) και το κέντρο κάθε γραφείου. */
  deskScreens: THREE.Group[][];
  deskPos: { x: number; z: number }[];
}

export const MAX_DESK_SCREENS = 6;

/** Θέσεις οθονών ανά πλήθος (1–6): [x, y, z, γωνία] σε σχέση με το κέντρο του γραφείου· η πρώτη είναι η κύρια. */
export const SCREEN_LAYOUT: [number, number, number, number][][] = [
  [[-0.1, 1.12, -0.21, 0]],
  [[-0.3, 1.12, -0.21, 0], [0.45, 1.1, -0.15, -0.38]],
  [[0, 1.12, -0.22, 0], [-0.7, 1.1, -0.13, 0.42], [0.7, 1.1, -0.13, -0.42]],
  [[0, 1.12, -0.22, 0], [-0.7, 1.1, -0.13, 0.42], [0.7, 1.1, -0.13, -0.42], [0, 1.6, -0.25, 0]],
  [[0, 1.12, -0.22, 0], [-0.7, 1.1, -0.13, 0.42], [0.7, 1.1, -0.13, -0.42], [-0.37, 1.6, -0.25, 0], [0.37, 1.6, -0.25, 0]],
  [[0, 1.12, -0.22, 0], [-0.7, 1.1, -0.13, 0.42], [0.7, 1.1, -0.13, -0.42], [-0.72, 1.58, -0.15, 0.42], [0, 1.6, -0.25, 0], [0.72, 1.58, -0.15, -0.42]],
];

const extraTex: THREE.CanvasTexture[] = [];
/** Στατική οθόνη με «κεριά» και γραμμές, για τις έξτρα οθόνες (3 παραλλαγές). */
function extraScreenTex(v: number): THREE.CanvasTexture {
  if (extraTex[v]) return extraTex[v];
  const { tex, ctx } = canvasTexture(256, 160);
  ctx.fillStyle = '#071021';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#13233F';
  for (let y = 20; y < 160; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  let p = 80 + v * 10;
  let seed = 7 + v * 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 8; x < 250; x += 9) {
    const o = p;
    p = Math.max(20, Math.min(140, p + (rnd() - 0.5 + (v - 1) * 0.08) * 18));
    const up = p < o;
    ctx.fillStyle = up ? '#3DDC84' : '#FF5C5C';
    ctx.fillRect(x, Math.min(o, p), 5, Math.max(2, Math.abs(o - p)));
    ctx.fillRect(x + 2, Math.min(o, p) - 4, 1, Math.abs(o - p) + 8);
  }
  ctx.fillStyle = '#F5C542';
  ctx.font = '700 14px monospace';
  ctx.fillText(['VOL', 'RSI', 'MACD'][v], 8, 16);
  tex.needsUpdate = true;
  extraTex[v] = tex;
  return tex;
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
  // μεγάλος πίνακας
  const board = canvasTexture(1024, 512);
  // 2:1 όπως η υφή, και ολόκληρος ανάμεσα σε πάτωμα και ταβάνι (αλλιώς κρύβονται οι ειδήσεις στο κάτω μέρος)
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.8), new THREE.MeshBasicMaterial({ map: board.tex }));
  boardMesh.position.set(0, 2.2, ROOM.minZ + 0.08);
  g.add(boardMesh);
  const boardFrame = toon('#10141C');
  const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(7.85, 4.05, 0.04), boardFrame);
  frameMesh.position.set(0, 2.2, ROOM.minZ + 0.03);
  g.add(frameMesh);
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
  const deskDecor: THREE.Group[] = [];
  const deskScreens: THREE.Group[][] = [];
  const deskMats = {
    top: toon('#6E4B32'),
    leg: toon('#3A2A1E'),
    chair: toon('#20232B'),
  };
  const mbox = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    return b;
  };
  DESKS.forEach(([x, z], i) => {
    g.add(mbox(deskMats.top, 1.9, 0.06, 0.9, x, 0.76, z));
    g.add(mbox(deskMats.leg, 0.06, 0.74, 0.8, x - 0.9, 0.37, z));
    g.add(mbox(deskMats.leg, 0.06, 0.74, 0.8, x + 0.9, 0.37, z));
    // οθόνες: η κύρια με ζωντανό γράφημα και ως 5 ακόμα (ανάλογα με τον χώρο και τις αγορές)
    const mon = canvasTexture(256, 160);
    const screens: THREE.Group[] = [];
    for (let k = 0; k < MAX_DESK_SCREENS; k++) {
      const sg = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.47, 0.04), mat('#2B2F36'));
      frame.castShadow = true;
      sg.add(frame);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.42), new THREE.MeshBasicMaterial({ map: k === 0 ? mon.tex : extraScreenTex((i + k) % 3) }));
      scr.position.z = 0.021;
      sg.add(scr);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), mat('#222'));
      pole.name = 'pole';
      sg.add(pole);
      sg.visible = false;
      g.add(sg);
      screens.push(sg);
    }
    deskScreens.push(screens);
    monitors.push(mon);
    g.add(box('#2A2A2A', 0.5, 0.02, 0.16, x - 0.2, 0.8, z + 0.12));
    const mug = makeMug(MUG_COLORS[i % MUG_COLORS.length]);
    mug.position.set(x + 0.68, 0.79, z + 0.12);
    mug.rotation.y = 0.6 + i;
    g.add(mug);
    const decor = new THREE.Group();
    decor.position.set(x, 0.79, z);
    g.add(decor);
    deskDecor.push(decor);
    // καρέκλα
    const cz = z + 0.75;
    g.add(mbox(deskMats.chair, 0.5, 0.08, 0.5, x, 0.47, cz));
    g.add(mbox(deskMats.chair, 0.5, 0.55, 0.07, x, 0.78, cz + 0.25));
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
  // γωνιά καφέ (δυτικός τοίχος)
  const coffee = makeCoffeeCorner();
  coffee.position.set(ROOM.minX + 0.33, 0, -5);
  g.add(coffee);
  colliders.push({ minX: ROOM.minX, maxX: ROOM.minX + 0.75, minZ: -5.9, maxZ: -4.1 });
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
    lights: { hemi, sun, panels: [] }, stage: new THREE.Vector3(0, 0, -5), bell, deskDecor, deskMats, boardFrame,
    deskScreens, deskPos: DESKS.map(([x, z]) => ({ x, z })),
  };
}
