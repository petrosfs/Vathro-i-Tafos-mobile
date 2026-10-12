// Χορεύτριες για τα πάρτι: γυναικείο σώμα από το «Universal Base Characters» της Quaternius (CC0),
// με μπικίνι σε χρώμα της επιλογής μας, μακριά μαλλιά ή κότσους, και χορός φτιαγμένος με περιστροφές στα κόκαλα.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

let TPL: THREE.Object3D | null = null;
let loading: Promise<boolean> | null = null;

/** Φόρτωση του μοντέλου (μία φορά). Αν αποτύχει, τα πάρτι μένουν χωρίς χορεύτριες. */
export function loadDancerModel(base: string): Promise<boolean> {
  if (TPL) return Promise.resolve(true);
  if (!loading) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loading = loader
      .loadAsync(`${base}models/dancer.glb`)
      .then((g) => {
        TPL = g.scene;
        return true;
      })
      .catch((e) => {
        console.warn('dancer model', e);
        return false;
      });
  }
  return loading;
}

export const dancerReady = () => !!TPL;

/** Το δέρμα με το μπικίνι βαμμένο: τα σκούρα, άχρωμα σημεία της υφής γίνονται στο χρώμα που θέλουμε. */
const skinCache = new Map<string, THREE.Texture>();
function bikiniTexture(src: THREE.Texture, color: string, skin: string): THREE.Texture {
  const k = `${color}|${skin}`;
  if (skinCache.has(k)) return skinCache.get(k)!;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  const col = new THREE.Color(color);
  const [r0, g0, b0] = [col.r * 255, col.g * 255, col.b * 255];
  const sk = new THREE.Color(skin);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    // το μπικίνι είναι άχρωμο (γκρι)· το δέρμα έχει πάντα «ζεστό» τόνο (κόκκινο ≫ μπλε)
    if (mx - mn < 26 && r - b < 22) {
      const k2 = 0.6 + (mx / 255) * 0.55;
      d[i] = Math.min(255, r0 * k2);
      d[i + 1] = Math.min(255, g0 * k2);
      d[i + 2] = Math.min(255, b0 * k2);
    } else {
      // απόχρωση δέρματος (μόνο στο δέρμα, όχι στο μπικίνι)
      d[i] = r * sk.r;
      d[i + 1] = g * sk.g;
      d[i + 2] = b * sk.b;
    }
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = src.flipY;
  tex.anisotropy = 4;
  skinCache.set(k, tex);
  return tex;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export interface DancerOpts {
  bikini: string;
  /** Απόχρωση δέρματος (πολλαπλασιάζει την υφή· #FFFFFF = όπως είναι). */
  skin?: string;
  hair: 'long' | 'buns';
  hairColor: string;
  /** Μετατόπιση στον ρυθμό, για να μη χορεύουν όλες ίδια. */
  phase?: number;
}

export class Dancer {
  readonly group = new THREE.Group();
  private root: THREE.Object3D;
  private bones = new Map<string, THREE.Bone>();
  private rest: [THREE.Bone, THREE.Quaternion][] = [];
  private rootInv = new THREE.Matrix4();
  private t: number;
  private q = new THREE.Quaternion();
  private mats: THREE.Material[] = [];

  constructor(o: DancerOpts) {
    this.t = o.phase ?? 0;
    this.root = cloneSkinned(TPL!);
    this.root.traverse((n) => {
      const b = n as THREE.Bone;
      if (b.isBone) this.bones.set(b.name, b);
    });
    const hairM = new THREE.MeshLambertMaterial({ color: o.hairColor });
    this.mats.push(hairM);
    const hairs: THREE.Mesh[] = [];
    this.root.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const src = m.material as THREE.MeshStandardMaterial;
      if (m.name.startsWith('Hair_')) {
        m.visible = m.name === (o.hair === 'long' ? 'Hair_Long' : 'Hair_Buns');
        m.material = hairM;
        hairs.push(m);
      } else if (m.name === 'Eyebrows') {
        m.material = hairM;
      } else if (m.name === 'Eyes') {
        const mm = new THREE.MeshBasicMaterial({ map: src.map });
        this.mats.push(mm);
        m.material = mm;
      } else {
        const mm = new THREE.MeshLambertMaterial({ map: src.map ? bikiniTexture(src.map, o.bikini, o.skin ?? '#FFFFFF') : null });
        this.mats.push(mm);
        m.material = mm;
      }
    });
    // τα μαλλιά είναι ακίνητα πλέγματα: «κολλάνε» στο κόκαλο του κεφαλιού (στη στάση δεσίματος)
    this.root.updateMatrixWorld(true);
    const head = this.bones.get('Head');
    if (head) for (const h of hairs) head.attach(h);
    // στροφή των χεριών προς τα κάτω (το μοντέλο είναι σε στάση «T»)
    for (const b of this.bones.values()) this.rest.push([b, b.quaternion.clone()]);
    this.group.add(this.root);
  }

  private rot(name: string, axis: THREE.Vector3, ang: number) {
    const b = this.bones.get(name);
    if (!b || Math.abs(ang) < 1e-4) return;
    const parent = b.parent!;
    parent.updateWorldMatrix(true, false);
    const pm = new THREE.Matrix4().multiplyMatrices(this.rootInv, parent.matrixWorld);
    const pq = new THREE.Quaternion().setFromRotationMatrix(pm.extractRotation(pm));
    this.q.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(pq.clone().invert().multiply(this.q).multiply(pq));
    b.updateWorldMatrix(false, true);
  }

  /** Ίδια υπογραφή με το Avatar.update (follow δεν χρειάζεται). */
  update(dt: number, _now?: number, _follow?: boolean) {
    this.t += dt;
    const t = this.t;
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    this.rootInv.copy(this.root.matrixWorld).invert();
    const beat = t * Math.PI * 2 * 1.05; // ~126 bpm στα μισά
    const s = Math.sin(beat);
    const c = Math.cos(beat);
    const s2 = Math.sin(beat * 0.5);
    // λεκάνη: λικνίζεται δεξιά-αριστερά και στρίβει, ο κορμός αντισταθμίζει
    this.rot('pelvis', Z, s * 0.16);
    this.rot('pelvis', Y, s2 * 0.35);
    this.rot('spine_01', Z, -s * 0.12);
    this.rot('spine_03', Z, -s * 0.06);
    this.rot('spine_02', X, 0.05 + Math.abs(c) * 0.05);
    // κεφάλι: λίγο πίσω, γέρνει στον ρυθμό
    this.rot('Head', Z, s * 0.12);
    this.rot('Head', X, -0.08);
    // χέρια: από τη στάση «T» κάτω, μετά το ένα ψηλά και το άλλο στη μέση, εναλλάξ ανά 4 χτύπους
    const swap = Math.sin(beat * 0.25) > 0;
    for (const side of [1, -1] as const) {
      const n = side === 1 ? 'l' : 'r';
      const up = (side === 1) === swap;
      // γωνία από την οριζόντια: +1,25 ψηλά (πάνω από το κεφάλι), −1,3 κάτω
      const lift = up ? 1.2 + s * 0.25 : -1.0 + c * 0.12;
      this.rot(`upperarm_${n}`, Z, side * lift);
      this.rot(`upperarm_${n}`, Y, side * (up ? 0.25 : -0.2));
      this.rot(`lowerarm_${n}`, Y, side * (up ? -0.5 - s * 0.3 : -1.35));
      this.rot(`hand_${n}`, Z, side * (up ? 0.4 * s : 0.3));
    }
    // πόδια: γόνατα λυγίζουν στον ρυθμό, το ένα περισσότερο
    const kl = 0.25 + Math.max(0, s) * 0.45;
    const kr = 0.25 + Math.max(0, -s) * 0.45;
    this.rot('thigh_l', X, -kl * 0.55);
    this.rot('calf_l', X, kl);
    this.rot('thigh_r', X, -kr * 0.55);
    this.rot('calf_r', X, kr);
    this.rot('foot_l', X, -kl * 0.45);
    this.rot('foot_r', X, -kr * 0.45);
    // όλο το σώμα «πέφτει» λίγο όταν λυγίζουν τα γόνατα
    this.root.position.y = -0.045 - Math.abs(s) * 0.035;
  }

  dispose() {
    this.mats.forEach((m) => m.dispose());
    this.group.removeFromParent();
  }
}
