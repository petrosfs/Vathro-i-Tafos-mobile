// Μικρά αντικείμενα του γραφείου: κούπες, καφετιέρα και διακοσμητικά για τα γραφεία των παικτών.
import * as THREE from 'three';
import { mat } from './avatar';
import type { DecorId } from '../sim/office';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cylOpen: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  handle: new THREE.TorusGeometry(1, 0.28, 8, 16, Math.PI),
  cone: new THREE.ConeGeometry(1, 1, 16),
  ico: new THREE.IcosahedronGeometry(1, 1),
};

function m(g: THREE.BufferGeometry, color: string | THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const sideMat = new Map<string, THREE.Material>();
/** Υλικό που φαίνεται και από μέσα (για ανοιχτά δοχεία). */
function both(color: string) {
  if (!sideMat.has(color)) sideMat.set(color, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  return sideMat.get(color)!;
}

/** Κούπα με καφέ και χερούλι. Η βάση της είναι στο y = 0. */
export function makeMug(color = '#F2F2F2', coffee = true): THREE.Group {
  const g = new THREE.Group();
  g.add(m(G.cylOpen, both(color), 0.042, 0.095, 0.042, 0, 0.0475, 0));
  g.add(m(G.cyl, color, 0.042, 0.006, 0.042, 0, 0.003, 0));
  if (coffee) g.add(m(G.cyl, '#3B2416', 0.039, 0.004, 0.039, 0, 0.082, 0));
  const h = m(G.handle, color, 0.026, 0.028, 0.026, 0.042, 0.05, 0);
  h.rotation.z = -Math.PI / 2;
  g.add(h);
  return g;
}

/** Γωνιά καφέ: πάγκος, καφετιέρα espresso, κούπες, ζάχαρη. Κοιτάει προς +x. */
export function makeCoffeeCorner(): THREE.Group {
  const g = new THREE.Group();
  // πάγκος με ντουλάπια
  g.add(m(G.box, '#3A4150', 0.62, 0.9, 1.7, 0, 0.45, 0));
  g.add(m(G.box, '#D9D4C7', 0.66, 0.04, 1.74, 0, 0.92, 0));
  for (const z of [-0.42, 0.42]) {
    g.add(m(G.box, '#434B5C', 0.02, 0.78, 0.8, 0.315, 0.44, z));
    g.add(m(G.box, '#C9CED8', 0.025, 0.12, 0.02, 0.33, 0.62, z + (z < 0 ? 0.32 : -0.32)));
  }
  // καφετιέρα espresso
  const mc = new THREE.Group();
  mc.position.set(-0.02, 0.94, -0.35);
  mc.add(m(G.box, '#BFC5CE', 0.36, 0.06, 0.42, 0, 0.03, 0));
  mc.add(m(G.box, '#2B2F36', 0.32, 0.46, 0.4, -0.02, 0.29, 0));
  mc.add(m(G.box, '#BFC5CE', 0.36, 0.06, 0.42, 0, 0.55, 0));
  mc.add(m(G.cyl, new THREE.MeshLambertMaterial({ color: '#9FD3FF', transparent: true, opacity: 0.55 }), 0.08, 0.2, 0.08, -0.08, 0.68, -0.1));
  // ποδιά και στόμιο
  mc.add(m(G.box, '#1A1C20', 0.16, 0.12, 0.18, 0.14, 0.4, 0));
  mc.add(m(G.cyl, '#BFC5CE', 0.012, 0.05, 0.012, 0.17, 0.32, -0.03));
  mc.add(m(G.cyl, '#BFC5CE', 0.012, 0.05, 0.012, 0.17, 0.32, 0.03));
  // σχάρα και φλιτζάνι
  mc.add(m(G.box, '#7E858F', 0.16, 0.02, 0.3, 0.14, 0.07, 0));
  const cup = makeMug('#FFFFFF', true);
  cup.scale.setScalar(0.8);
  cup.position.set(0.15, 0.08, 0);
  mc.add(cup);
  // οθόνη και κουμπιά
  const screen = m(G.box, new THREE.MeshBasicMaterial({ color: '#3DDC84' }), 0.005, 0.05, 0.12, 0.165, 0.5, -0.12);
  mc.add(screen);
  for (let i = 0; i < 3; i++) mc.add(m(G.cyl, i === 0 ? '#E04848' : '#E8E8E8', 0.016, 0.012, 0.016, 0.168, 0.52, 0.03 + i * 0.045).rotateZ(Math.PI / 2));
  // ακροφύσιο ατμού
  mc.add(m(G.cyl, '#BFC5CE', 0.008, 0.16, 0.008, 0.16, 0.36, 0.16));
  g.add(mc);
  // κούπες στη σειρά, ζάχαρη, κουταλάκια
  const colors = ['#E24B4B', '#F5C542', '#4FC3F7', '#FFFFFF', '#7CE38B'];
  colors.forEach((c, i) => {
    const mug = makeMug(c, false);
    mug.position.set(0.12, 0.94, 0.05 + i * 0.12);
    mug.rotation.y = -Math.PI / 2 + (i % 2) * 0.4;
    g.add(mug);
  });
  g.add(m(G.cyl, '#E8E2D0', 0.05, 0.11, 0.05, -0.12, 0.995, 0.25));
  g.add(m(G.cyl, '#B8864E', 0.052, 0.02, 0.052, -0.12, 1.06, 0.25));
  g.add(m(G.cyl, new THREE.MeshLambertMaterial({ color: '#C8E6FF', transparent: true, opacity: 0.5 }), 0.06, 0.16, 0.06, -0.15, 1.02, 0.55));
  return g;
}

// ---------- διακοσμητικά για τα γραφεία ----------


/** Ένα διακοσμητικό, σε κλίμακα γραφείου, με βάση στο y = 0. */
export function makeDecor(id: DecorId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'lamp': {
      g.add(m(G.cyl, '#1E1E1E', 0.07, 0.02, 0.07, 0, 0.01, 0));
      const arm = m(G.cyl, '#2A2A2A', 0.008, 0.3, 0.008, 0, 0.16, 0);
      g.add(arm);
      const shade = m(G.cone, '#2E7D5B', 0.07, 0.09, 0.07, 0.04, 0.3, 0);
      shade.rotation.z = 0.9;
      g.add(shade);
      g.add(m(G.sphere, new THREE.MeshBasicMaterial({ color: '#FFF3C4' }), 0.022, 0.022, 0.022, 0.06, 0.28, 0));
      break;
    }
    case 'cactus':
      g.add(m(G.cyl, '#C9714E', 0.05, 0.07, 0.05, 0, 0.035, 0));
      g.add(m(G.sphere, '#3F8F4A', 0.035, 0.09, 0.035, 0, 0.13, 0));
      g.add(m(G.sphere, '#3F8F4A', 0.018, 0.04, 0.018, 0.035, 0.15, 0).rotateZ(-0.5));
      g.add(m(G.sphere, '#E05A8C', 0.012, 0.012, 0.012, 0, 0.22, 0));
      break;
    case 'bonsai':
      g.add(m(G.box, '#3B2E26', 0.16, 0.04, 0.1, 0, 0.02, 0));
      g.add(m(G.cyl, '#5A3D2B', 0.012, 0.14, 0.012, 0.01, 0.1, 0).rotateZ(0.25));
      g.add(m(G.ico, '#3E7F3A', 0.07, 0.045, 0.06, -0.01, 0.19, 0));
      g.add(m(G.ico, '#4C9446', 0.05, 0.035, 0.045, 0.05, 0.15, 0.01));
      break;
    case 'trophy':
      g.add(m(G.box, '#3A2A1E', 0.08, 0.03, 0.08, 0, 0.015, 0));
      g.add(m(G.cyl, '#E8B923', 0.012, 0.07, 0.012, 0, 0.065, 0));
      g.add(m(G.cone, '#E8B923', 0.05, 0.08, 0.05, 0, 0.14, 0).rotateX(Math.PI));
      for (const s of [-1, 1]) g.add(m(G.handle, '#E8B923', 0.02, 0.025, 0.02, s * 0.05, 0.15, 0).rotateZ(s * -Math.PI / 2));
      break;
    case 'lava': {
      g.add(m(G.cone, '#B0B5BE', 0.045, 0.07, 0.045, 0, 0.035, 0));
      g.add(m(G.cyl, new THREE.MeshBasicMaterial({ color: '#C7387A', transparent: true, opacity: 0.85 }), 0.032, 0.16, 0.032, 0, 0.15, 0));
      g.add(m(G.sphere, new THREE.MeshBasicMaterial({ color: '#FFB347' }), 0.018, 0.025, 0.018, 0, 0.12, 0));
      g.add(m(G.cone, '#B0B5BE', 0.03, 0.04, 0.03, 0, 0.25, 0));
      break;
    }
    case 'frame':
      g.add(m(G.box, '#C9A54A', 0.12, 0.15, 0.012, 0, 0.075, 0).rotateX(-0.2));
      g.add(m(G.box, '#7FB3E6', 0.1, 0.12, 0.004, 0, 0.078, 0.008).rotateX(-0.2));
      break;
    case 'globe':
      g.add(m(G.cyl, '#3A2A1E', 0.05, 0.015, 0.05, 0, 0.008, 0));
      g.add(m(G.cyl, '#C9A54A', 0.006, 0.08, 0.006, 0, 0.05, 0));
      g.add(m(G.sphere, '#2F7FB8', 0.065, 0.065, 0.065, 0, 0.15, 0));
      g.add(m(G.sphere, '#5DAA55', 0.04, 0.03, 0.03, 0.03, 0.17, 0.035));
      break;
    case 'bull':
      g.add(m(G.box, '#2E2E2E', 0.12, 0.02, 0.06, 0, 0.01, 0));
      g.add(m(G.sphere, '#B07D32', 0.07, 0.045, 0.035, 0, 0.07, 0));
      g.add(m(G.sphere, '#B07D32', 0.03, 0.028, 0.026, 0.07, 0.085, 0));
      for (const s of [-1, 1]) g.add(m(G.cone, '#E8E0C8', 0.006, 0.04, 0.006, 0.08, 0.115, s * 0.022).rotateX(s * 0.6));
      for (const [x, z] of [[-0.04, -0.02], [-0.04, 0.02], [0.04, -0.02], [0.04, 0.02]]) g.add(m(G.cyl, '#B07D32', 0.008, 0.04, 0.008, x, 0.035, z));
      break;
    case 'goldfish': {
      g.add(m(G.sphere, new THREE.MeshLambertMaterial({ color: '#BFE6FF', transparent: true, opacity: 0.45 }), 0.085, 0.08, 0.085, 0, 0.08, 0));
      g.add(m(G.sphere, '#FF8C1A', 0.022, 0.014, 0.01, 0.01, 0.07, 0));
      g.add(m(G.cone, '#FF8C1A', 0.012, 0.02, 0.006, -0.018, 0.07, 0).rotateZ(Math.PI / 2));
      g.add(m(G.cyl, '#E8D9A8', 0.05, 0.008, 0.05, 0, 0.004, 0));
      break;
    }
    case 'duck':
      g.add(m(G.sphere, '#FFD43B', 0.05, 0.04, 0.035, 0, 0.04, 0));
      g.add(m(G.sphere, '#FFD43B', 0.028, 0.028, 0.028, 0.035, 0.085, 0));
      g.add(m(G.cone, '#FF8C1A', 0.012, 0.025, 0.01, 0.07, 0.083, 0).rotateZ(-Math.PI / 2));
      g.add(m(G.sphere, '#111', 0.005, 0.005, 0.005, 0.05, 0.095, 0.02));
      break;
  }
  return g;
}

/** Θέσεις πάνω στο γραφείο για τα διακοσμητικά (σε σχέση με το κέντρο του γραφείου). */
export const DECOR_SPOTS: [number, number][] = [[-0.86, 0.12], [0.8, 0.22], [-0.56, 0.3], [0.35, 0.3]];

// ---------- αναβαθμίσεις γραφείου ----------

export function makeSofa(): THREE.Group {
  const g = new THREE.Group();
  const c = '#7A2E3A';
  g.add(m(G.box, c, 2.2, 0.42, 0.9, 0, 0.21, 0));
  g.add(m(G.box, c, 2.2, 0.55, 0.22, 0, 0.62, -0.34));
  for (const s of [-1, 1]) g.add(m(G.box, c, 0.22, 0.6, 0.9, s * 1.0, 0.36, 0));
  for (const s of [-0.55, 0.55]) g.add(m(G.box, '#8E3A47', 0.95, 0.12, 0.66, s, 0.48, 0.08));
  g.add(m(G.box, '#E6C35C', 0.36, 0.3, 0.12, -0.5, 0.65, -0.18).rotateZ(0.15));
  for (const [x, z] of [[-1, -0.38], [1, -0.38], [-1, 0.38], [1, 0.38]]) g.add(m(G.cyl, '#222', 0.03, 0.08, 0.03, x, 0.04, z));
  // τραπεζάκι
  g.add(m(G.box, '#5A3D2B', 1.0, 0.05, 0.5, 0, 0.42, 1.0));
  for (const [x, z] of [[-0.42, 0.8], [0.42, 0.8], [-0.42, 1.2], [0.42, 1.2]]) g.add(m(G.cyl, '#3A2A1E', 0.025, 0.4, 0.025, x, 0.2, z));
  const mug = makeMug('#E24B4B');
  mug.position.set(0.25, 0.445, 1.0);
  g.add(mug);
  return g;
}

export function makeAquarium(): THREE.Group {
  const g = new THREE.Group();
  g.add(m(G.box, '#2A2F3A', 1.8, 0.8, 0.6, 0, 0.4, 0));
  const water = new THREE.MeshLambertMaterial({ color: '#3FA9F5', transparent: true, opacity: 0.45 });
  g.add(m(G.box, water, 1.7, 0.75, 0.5, 0, 1.2, 0));
  g.add(m(G.box, '#1C2028', 1.8, 0.06, 0.6, 0, 1.6, 0));
  g.add(m(G.box, '#D9C38A', 1.68, 0.06, 0.48, 0, 0.86, 0));
  const fishColors = ['#FF8C1A', '#FFD43B', '#FF5C8A', '#7CE38B', '#4FC3F7'];
  fishColors.forEach((c, i) => {
    const f = new THREE.Group();
    f.add(m(G.sphere, c, 0.07, 0.04, 0.025));
    f.add(m(G.cone, c, 0.035, 0.05, 0.015, -0.08, 0, 0).rotateZ(Math.PI / 2));
    f.position.set(-0.6 + i * 0.3, 1.0 + (i % 3) * 0.15, -0.1 + (i % 2) * 0.2);
    f.userData.fish = { phase: i * 1.3, speed: 0.4 + i * 0.07 };
    g.add(f);
  });
  for (let i = 0; i < 4; i++) g.add(m(G.cone, '#2F7A40', 0.04, 0.3 + i * 0.05, 0.04, -0.7 + i * 0.12, 1.02 + i * 0.02, -0.15));
  return g;
}

/** Κολυμπάνε τα ψάρια (καλείται σε κάθε καρέ). */
export function animateAquarium(g: THREE.Group, t: number) {
  for (const f of g.children) {
    const d = f.userData.fish as { phase: number; speed: number } | undefined;
    if (!d) continue;
    const x = Math.sin(t * d.speed + d.phase) * 0.7;
    const dir = Math.cos(t * d.speed + d.phase);
    f.position.x = x;
    f.rotation.y = dir > 0 ? 0 : Math.PI;
  }
}

/** Χρυσή επαγγελματική καφετιέρα (αναβάθμιση). Βάση στο y = 0, κοιτάει προς +x. */
export function makeProEspresso(): THREE.Group {
  const g = new THREE.Group();
  g.add(m(G.box, '#C9A54A', 0.42, 0.06, 0.5, 0, 0.03, 0));
  g.add(m(G.box, '#D8B65A', 0.38, 0.4, 0.46, -0.03, 0.26, 0));
  g.add(m(G.box, '#C9A54A', 0.42, 0.05, 0.5, 0, 0.485, 0));
  for (const z of [-0.12, 0.12]) {
    g.add(m(G.cyl, '#2B2F36', 0.035, 0.05, 0.035, 0.18, 0.33, z));
    g.add(m(G.box, '#2B2F36', 0.12, 0.02, 0.02, 0.24, 0.33, z));
  }
  g.add(m(G.cyl, '#E8E8E8', 0.03, 0.03, 0.03, 0.17, 0.42, 0).rotateZ(Math.PI / 2));
  g.add(m(G.sphere, '#E8E8E8', 0.03, 0.03, 0.03, -0.05, 0.54, 0.18));
  g.add(m(G.box, new THREE.MeshBasicMaterial({ color: '#F5C542' }), 0.005, 0.05, 0.16, 0.17, 0.2, 0));
  return g;
}

/** Πιατέλα με κουραμπιέδες και άχνη, με ταμπελάκι. Η βάση είναι στο y = 0. */
export function makeKourabiedes(): THREE.Group {
  const g = new THREE.Group();
  g.add(m(G.cyl, '#F4F1EA', 0.2, 0.015, 0.2, 0, 0.008, 0));
  g.add(m(G.cyl, '#D9D2C2', 0.17, 0.005, 0.17, 0, 0.017, 0));
  const pos: [number, number][] = [[0, 0], [0.09, 0.05], [-0.09, 0.05], [0.07, -0.08], [-0.07, -0.08], [0, 0.11]];
  pos.forEach(([x, z], i) => {
    const k = m(G.sphere, '#FFFFFF', 0.05, 0.038, 0.05, x, 0.038, z);
    k.rotation.y = i;
    g.add(k);
  });
  g.add(m(G.sphere, '#FFFFFF', 0.045, 0.035, 0.045, 0.03, 0.085, 0.02));
  // άχνη σκορπισμένη γύρω
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 0.21 + (i % 3) * 0.025;
    g.add(m(G.cyl, '#FFFFFF', 0.012, 0.002, 0.012, Math.cos(a) * r, 0.001, Math.sin(a) * r));
  }
  return g;
}

/** Φουσκωτή κούκλα (αστείο δώρο): ροζ, με μαγιό, χέρια ανοιχτά και το γνωστό «Ο» στο στόμα. */
export function makeDoll(): THREE.Group {
  const g = new THREE.Group();
  const skin = '#F6B3C2';
  const suit = '#D3263A';
  // πόδια λίγο ανοιχτά
  for (const sx of [-1, 1]) {
    const leg = m(G.cyl, skin, 0.075, 0.8, 0.075, sx * 0.1, 0.42, 0);
    leg.rotation.z = sx * 0.12;
    g.add(leg);
    g.add(m(G.sphere, skin, 0.08, 0.05, 0.1, sx * 0.15, 0.03, 0.03));
  }
  // σώμα και μαγιό
  g.add(m(G.sphere, skin, 0.19, 0.3, 0.15, 0, 1.08, 0));
  g.add(m(G.sphere, suit, 0.18, 0.1, 0.145, 0, 0.86, 0));
  g.add(m(G.box, suit, 0.3, 0.1, 0.24, 0, 1.2, 0.02));
  g.add(m(G.cyl, skin, 0.06, 0.12, 0.06, 0, 1.4, 0));
  // χέρια ανοιχτά προς τα πάνω
  for (const sx of [-1, 1]) {
    const arm = m(G.cyl, skin, 0.06, 0.62, 0.06, sx * 0.33, 1.42, 0);
    arm.rotation.z = sx * -1.0;
    g.add(arm);
    g.add(m(G.sphere, skin, 0.06, 0.06, 0.06, sx * 0.6, 1.62, 0));
  }
  // κεφάλι, ξανθά μαλλιά με κοτσιδάκια, μάτια, κόκκινο «Ο»
  g.add(m(G.sphere, skin, 0.16, 0.18, 0.16, 0, 1.6, 0));
  g.add(m(G.sphere, '#F2D16B', 0.17, 0.12, 0.17, 0, 1.69, -0.02));
  for (const sx of [-1, 1]) {
    g.add(m(G.sphere, '#F2D16B', 0.06, 0.13, 0.06, sx * 0.19, 1.55, -0.03));
    g.add(m(G.sphere, '#FFFFFF', 0.035, 0.03, 0.02, sx * 0.06, 1.63, 0.145));
    g.add(m(G.sphere, '#1B3B8C', 0.018, 0.018, 0.01, sx * 0.06, 1.63, 0.16));
  }
  const mouth = m(G.handle, suit, 0.035, 0.035, 0.035, 0, 1.53, 0.155);
  g.add(mouth);
  const mouth2 = m(G.handle, suit, 0.035, 0.035, 0.035, 0, 1.53, 0.155);
  mouth2.rotation.z = Math.PI;
  g.add(mouth2);
  return g;
}
