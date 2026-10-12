// Σώμα χαρακτήρα από έτοιμο 3D μοντέλο (Quaternius «Ultimate Modular Men», CC0): κοστούμι, χέρια με δάχτυλα,
// σκελετός με κινήσεις. Το κεφάλι (πρόσωπο, μαλλιά, αξεσουάρ) είναι δικό μας και «κάθεται» πάνω στο κόκαλο του κεφαλιού.
// Οι στάσεις (κάθισμα, πανηγυρισμός, χειροπέδες…) εφαρμόζονται ως περιστροφές πάνω στις κινήσεις του μοντέλου.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

interface Template {
  scene: THREE.Object3D;
  clips: Map<string, THREE.AnimationClip>;
}

let SUIT: Template | null = null;
let SWAT: Template | null = null;

async function load(url: string): Promise<Template> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const g = await loader.loadAsync(url);
  return { scene: g.scene, clips: new Map(g.animations.map((a) => [a.name, a])) };
}

/** Φόρτωση των μοντέλων (μία φορά, στην αρχή). Αν αποτύχει, μένουν οι απλοί χαρακτήρες. */
export async function loadCharacterModels(base: string): Promise<boolean> {
  if (SUIT) return true;
  try {
    const [suit, swat] = await Promise.all([load(`${base}models/suit.glb`), load(`${base}models/swat.glb`)]);
    SUIT = suit;
    SWAT = swat;
    return true;
  } catch (e) {
    console.warn('character models', e);
    return false;
  }
}

export const modelsReady = () => !!SUIT;

/** Οι γωνίες της στάσης (ίδιες με του απλού χαρακτήρα): ώμοι, αγκώνες, ισχία, γόνατα, κεφάλι, κορμός, δάχτυλα. */
export interface RigPose {
  bodyY: number;
  bodyX: number;
  thighL: number;
  thighR: number;
  kneeL: number;
  kneeR: number;
  shoulderLx: number;
  shoulderRx: number;
  shoulderLz: number;
  shoulderRz: number;
  elbowL: number;
  elbowR: number;
  headX: number;
  headY: number;
  spine: number;
  fistL: number;
  fistR: number;
  midR: number;
  twistR: number;
}

export interface RigColors {
  suit: THREE.Material;
  tie: string;
  skin: string;
  shirt?: string;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const;

/**
 * Το σώμα ενός χαρακτήρα. «L/R» των στάσεων = πλευρά −x/+x (όπως στον απλό χαρακτήρα).
 * Στο μοντέλο η πλευρά −x είναι τα κόκαλα «R» (ο χαρακτήρας κοιτάζει προς +z).
 */
export class ModelRig {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private bones = new Map<string, THREE.Bone>();
  /** Η αρχική (bind) στάση του κόκαλου του κεφαλιού σε χώρο σώματος. */
  private headRest = new THREE.Quaternion();
  readonly suitMeshes: THREE.Mesh[] = [];
  /** Σημεία για ό,τι κρατάει το δεξί (+x) χέρι και για το ρολόι στο αριστερό (−x). */
  readonly holdR = new THREE.Object3D();
  readonly wristL = new THREE.Object3D();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private rootInv = new THREE.Matrix4();
  /** Η στάση κάθε κόκαλου μετά την κίνηση του προηγούμενου καρέ, πριν από τις δικές μας περιστροφές (αλλιώς θα αθροίζονταν). */
  private rest: [THREE.Bone, THREE.Quaternion, THREE.Vector3][] = [];

  /** Πάχος −1 (αδύνατος) … 0 … 1 (χοντρός). */
  private fat = 0;

  constructor(private body: THREE.Object3D, private head: THREE.Object3D, colors: RigColors, swat = false, fat = 0) {
    const tpl = swat && SWAT ? SWAT : SUIT!;
    this.root = cloneSkinned(tpl.scene);
    this.fat = swat ? 0 : Math.max(-1, Math.min(1, fat));
    this.root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) this.bones.set(b.name, b);
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const name = (m.material as THREE.Material).name;
      // το δικό μας κεφάλι αντικαθιστά το κεφάλι του μοντέλου
      if (m.parent?.name.endsWith('_Head') || ['Hair', 'Eyebrows', 'Eye'].includes(name)) {
        m.visible = false;
        return;
      }
      const src = m.material as THREE.MeshStandardMaterial;
      let mat: THREE.Material;
      if (name === 'Suit') {
        mat = colors.suit;
        this.suitMeshes.push(m);
      } else if (name === 'Tie') mat = new THREE.MeshLambertMaterial({ color: colors.tie });
      else if (name === 'Skin') mat = new THREE.MeshLambertMaterial({ color: colors.skin });
      else if (name === 'White') mat = new THREE.MeshLambertMaterial({ color: colors.shirt ?? '#F4F4F2' });
      else mat = new THREE.MeshLambertMaterial({ color: src.color, side: src.side });
      m.material = mat;
    });
    body.add(this.root);
    body.add(this.holdR, this.wristL);
    if (Math.abs(this.fat) > 0.01) this.fatten(this.fat);
    const anim = SUIT!.clips;
    this.mixer = new THREE.AnimationMixer(this.root);
    for (const [k, clip] of anim) this.actions.set(k, this.mixer.clipAction(clip));
    for (const b of this.bones.values()) this.rest.push([b, b.quaternion.clone(), b.position.clone()]);
    this.root.updateMatrixWorld(true);
    this.rootInv.copy(this.root.matrixWorld).invert();
    this.bodyQuat(this.bone('Head'), this.headRest);
    this.play('Idle', 0);
  }

  private bone(n: string): THREE.Bone {
    return this.bones.get(n)!;
  }

  private play(name: string, fade = 0.25) {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (prev && fade > 0) prev.crossFadeTo(next, fade, false);
    else prev?.stop();
    this.current = name;
  }

  /** Περιστροφή σε κόσμο σώματος (q κατά τον χώρο του χαρακτήρα) πάνω σε ένα κόκαλο. */
  private rotateBody(b: THREE.Bone, q: THREE.Quaternion) {
    const parent = b.parent!;
    parent.updateWorldMatrix(true, false);
    // γονέας σε χώρο σώματος
    const pm = new THREE.Matrix4().multiplyMatrices(this.rootInv, parent.matrixWorld);
    const pq = this.tmpQ2.setFromRotationMatrix(pm.extractRotation(pm));
    const inv = pq.clone().invert();
    b.quaternion.premultiply(inv.multiply(q).multiply(pq));
    b.updateWorldMatrix(false, true);
  }

  private bodyQuat(b: THREE.Bone, out: THREE.Quaternion) {
    b.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().multiplyMatrices(this.rootInv, b.matrixWorld);
    return out.setFromRotationMatrix(m.extractRotation(m));
  }

  private bodyPos(b: THREE.Object3D, out: THREE.Vector3) {
    b.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(b.matrixWorld).applyMatrix4(this.rootInv);
  }

  /** Κλείσιμο δαχτύλων ενός χεριού (side: 'L'/'R' κόκαλα του μοντέλου). */
  private curl(side: 'L' | 'R', fist: number, mid: number) {
    const i2 = this.bodyPos(this.bone(`Index2${side}`), new THREE.Vector3());
    const p2 = this.bodyPos(this.bone(`Pinky2${side}`), new THREE.Vector3());
    const k = p2.sub(i2).normalize();
    // η φορά ώστε τα δάχτυλα να κλείνουν προς την παλάμη
    const sign = side === 'L' ? 1 : -1;
    for (const f of FINGERS) {
      const c = f === 'Middle' ? fist * (1 - mid) : fist;
      if (Math.abs(c) < 0.01) continue;
      for (const j of [2, 3, 4]) {
        const b = this.bones.get(`${f}${j}${side}`);
        if (b) this.rotateBody(b, this.tmpQ.setFromAxisAngle(k, sign * c * (j === 2 ? 0.9 : 1.05)));
      }
    }
    const t = this.bones.get(`Thumb2${side}`);
    if (t) this.rotateBody(t, this.tmpQ.setFromAxisAngle(k, sign * Math.min(1, fist) * 0.5));
  }

  /** Στάση: κίνηση του μοντέλου + οι γωνίες από πάνω. */
  apply(p: RigPose, anim: string, dt: number, lift = 0) {
    const clip = anim === 'walk' ? 'Walk' : anim === 'fall' ? 'Death' : anim === 'idle' ? 'Idle' : 'Idle_Neutral';
    this.play(clip);
    // κάθε καρέ ξεκινάμε από την «καθαρή» στάση της κίνησης (χωρίς τις δικές μας περιστροφές του προηγούμενου καρέ)
    for (const [b, q, v] of this.rest) {
      b.quaternion.copy(q);
      b.position.copy(v);
    }
    this.mixer.update(dt);
    // η πτώση μένει στο τελευταίο καρέ (ο χαρακτήρας μένει κάτω)
    const death = this.current === 'Death' ? this.actions.get('Death') : null;
    if (death && death.time > death.getClip().duration - 0.12) {
      death.time = death.getClip().duration - 0.04;
      death.timeScale = 0;
      this.mixer.update(0);
    }
    for (const r of this.rest) {
      r[1].copy(r[0].quaternion);
      r[2].copy(r[0].position);
    }
    // σώμα: ύψος (κάθισμα, άλμα) και κλίση (πτώση) πριν από τους υπολογισμούς σε χώρο σώματος,
    // αλλιώς το κεφάλι μένει ένα καρέ πίσω (π.χ. «ακίνητο» στο άλμα)
    const clipBody = anim === 'walk' || anim === 'fall';
    this.body.position.y = (clipBody ? 0 : p.bodyY) + lift;
    this.body.rotation.x = clipBody ? 0 : p.bodyX;
    this.body.updateWorldMatrix(true, false);
    this.root.updateMatrixWorld(true);
    this.rootInv.copy(this.root.matrixWorld).invert();
    const clipDriven = anim === 'walk' || anim === 'fall';
    // χοντρός: τα χέρια λίγο πιο ανοιχτά για να μη «μπαίνουν» στην κοιλιά
    const spread = this.fat > 0 ? this.fat * 0.22 : 0;
    if (clipDriven && spread && anim === 'walk') {
      this.rotateBody(this.bone('UpperArmR'), this.tmpQ.setFromAxisAngle(Z, -spread));
      this.rotateBody(this.bone('UpperArmL'), this.tmpQ.setFromAxisAngle(Z, spread));
    }
    // κορμός και κεφάλι
    if (!clipDriven && Math.abs(p.spine) > 1e-3) this.rotateBody(this.bone('Torso'), this.tmpQ.setFromAxisAngle(Y, p.spine));
    if (!clipDriven) {
      // χέρια: ώμος (μπρος-πίσω και στο πλάι) και αγκώνας, όπως στον απλό χαρακτήρα
      for (const [side, sx, sz, el] of [['R', p.shoulderLx, p.shoulderLz - spread, p.elbowL], ['L', p.shoulderRx, p.shoulderRz + spread, p.elbowR]] as const) {
        const qs = new THREE.Quaternion().setFromAxisAngle(X, sx).multiply(new THREE.Quaternion().setFromAxisAngle(Z, sz));
        this.rotateBody(this.bone(`UpperArm${side}`), qs);
        const axis = X.clone().applyQuaternion(qs);
        if (Math.abs(el) > 1e-3) this.rotateBody(this.bone(`LowerArm${side}`), this.tmpQ.setFromAxisAngle(axis, el));
      }
      // πόδια
      for (const [side, th, kn] of [['R', p.thighL, p.kneeL], ['L', p.thighR, p.kneeR]] as const) {
        const qt = new THREE.Quaternion().setFromAxisAngle(X, th);
        if (Math.abs(th) > 1e-3) this.rotateBody(this.bone(`UpperLeg${side}`), qt);
        if (Math.abs(kn) > 1e-3) this.rotateBody(this.bone(`LowerLeg${side}`), this.tmpQ.setFromAxisAngle(X.clone().applyQuaternion(qt), kn));
      }
      // στροφή του δεξιού καρπού (κωλοδάχτυλο: η ράχη της παλάμης προς τον άλλον)
      if (Math.abs(p.twistR) > 1e-3) {
        const w = this.bodyPos(this.bone('WristL'), this.tmpV);
        const e = this.bodyPos(this.bone('LowerArmL'), this.tmpV2);
        this.rotateBody(this.bone('WristL'), this.tmpQ.setFromAxisAngle(w.clone().sub(e).normalize(), p.twistR));
      }
    }
    this.curl('R', p.fistL, 0);
    this.curl('L', p.fistR, p.midR);
    if (Math.abs(p.headX) > 1e-3 || Math.abs(p.headY) > 1e-3) {
      this.rotateBody(this.bone('Head'), this.tmpQ.setFromEuler(new THREE.Euler(p.headX, p.headY, 0, 'YXZ')));
    }
    // σώμα: ύψος (κάθισμα) και κλίση (πτώση)
    // το δικό μας κεφάλι ακολουθεί το κόκαλο του κεφαλιού
    const hb = this.bone('Head');
    const hq = this.bodyQuat(hb, new THREE.Quaternion());
    const rel = hq.multiply(this.headRest.clone().invert());
    this.bodyPos(hb, this.head.position);
    this.head.quaternion.copy(rel);
    this.head.position.add(new THREE.Vector3(0, 0.2, 0.0).applyQuaternion(rel));
    // σημεία για τα χέρια
    this.place(this.holdR, 'WristL', 'Middle2L');
    this.place(this.wristL, 'LowerArmR', 'WristR');
  }

  /** Θέση/προσανατολισμός ενός σημείου στο χέρι: κοιτάζει κατά μήκος του χεριού (−y), μπροστά +z. */
  private place(o: THREE.Object3D, from: string, to: string) {
    const a = this.bodyPos(this.bone(from), new THREE.Vector3());
    const b = this.bodyPos(this.bone(to), new THREE.Vector3());
    const dir = b.clone().sub(a).normalize();
    o.position.copy(to === 'WristR' ? b.clone().addScaledVector(dir, -0.04) : a.clone().lerp(b, 0.6));
    // −y κατά τη φορά του χεριού
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }

  /**
   * Πάχος: κάθε κορυφή του σώματος απομακρύνεται (ή πλησιάζει) από τον άξονα των κόκαλων που την κινούν.
   * Ο κορμός φουσκώνει και μπροστά (κοιλιά)· το κεφάλι, οι παλάμες και τα πόδια μένουν ίδια.
   * Οι υπολογισμοί γίνονται στη στάση «δεσίματος» του κάθε πλέγματος, όπου οι κορυφές είναι αυτούσιες.
   */
  private fatten(f: number) {
    const K: Record<string, [string, number, number]> = {
      // κόκαλο: [παιδί (τέλος του άξονα), πόσο φουσκώνει, κοιλιά]
      Hips: ['Abdomen', 0.5, 0.5],
      Abdomen: ['Torso', 0.75, 1],
      Torso: ['Chest', 0.6, 0.8],
      Chest: ['Neck', 0.4, 0.2],
      Neck: ['Head', 0.15, 0],
      ShoulderL: ['UpperArmL', 0.25, 0], ShoulderR: ['UpperArmR', 0.25, 0],
      UpperArmL: ['LowerArmL', 0.5, 0], UpperArmR: ['LowerArmR', 0.5, 0],
      LowerArmL: ['WristL', 0.25, 0], LowerArmR: ['WristR', 0.25, 0],
      UpperLegL: ['LowerLegL', 0.4, 0], UpperLegR: ['LowerLegR', 0.4, 0],
      LowerLegL: ['FootL', 0.14, 0], LowerLegR: ['FootR', 0.14, 0],
    };
    const TORSO = new Set(['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck']);
    const tmpM = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const d = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const delta = new THREE.Vector3();
    const si = new THREE.Vector4();
    const sw = new THREE.Vector4();
    this.root.traverse((obj) => {
      const m = obj as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const sk = m.skeleton;
      // αρθρώσεις στη στάση δεσίματος (στον ίδιο χώρο με bindMatrix·p)
      const joint = new Map<string, THREE.Vector3>();
      sk.bones.forEach((b, k) => joint.set(b.name, new THREE.Vector3().setFromMatrixPosition(tmpM.copy(sk.boneInverses[k]).invert())));
      const J = (n: string) => joint.get(n);
      const hips = J('Hips');
      const neck = J('Neck');
      const al = J('UpperArmL');
      const ar = J('UpperArmR');
      if (!hips || !neck || !al || !ar) return;
      // άξονες του σώματος και κλίμακα σε μέτρα (λεκάνη–λαιμός ≈ 0,61 μ.)
      const up = neck.clone().sub(hips);
      const metre = up.length() / 0.61;
      up.normalize();
      const side = al.clone().sub(ar).normalize();
      const front = new THREE.Vector3().crossVectors(side, up).normalize();
      const seg = new Map<string, [THREE.Vector3, THREE.Vector3]>();
      for (const [n, [ch]] of Object.entries(K)) {
        const a = J(n);
        const b = J(ch);
        if (a && b) seg.set(n, [a, b]);
      }
      m.geometry = m.geometry.clone();
      this.ownGeo.push(m.geometry);
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      const idx = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
      const wgt = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
      const toLocal = new THREE.Matrix3().setFromMatrix4(m.bindMatrixInverse);
      const lim = (x: number) => (pos.normalized ? Math.max(-1, Math.min(1, x)) : x);
      for (let i = 0; i < pos.count; i++) {
        si.fromBufferAttribute(idx, i);
        sw.fromBufferAttribute(wgt, i);
        v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
        delta.set(0, 0, 0);
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(k);
          if (w < 1e-3) continue;
          const bn = sk.bones[si.getComponent(k)]?.name;
          const spec = bn ? K[bn] : undefined;
          const sg = bn ? seg.get(bn) : undefined;
          if (!bn || !spec || !sg) continue;
          const [a, b] = sg;
          ab.copy(b).sub(a);
          const tt = Math.max(0, Math.min(1, d.copy(v).sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
          c.copy(a).addScaledVector(ab, tt);
          d.copy(v).sub(c);
          let k1 = spec[1] * f;
          if (TORSO.has(bn)) {
            // οριζόντια μόνο· στα πλάγια λιγότερο από μπροστά/πίσω
            const h = v.clone().sub(hips).dot(up) / metre;
            if (bn === 'Hips') k1 *= Math.max(0, Math.min(1, 1 + h / 0.08));
            const dx = d.dot(side);
            const dz = d.dot(front);
            delta.addScaledVector(side, dx * k1 * 0.7 * w);
            delta.addScaledVector(front, dz * k1 * w);
            // κοιλιά: στρογγυλό φούσκωμα μπροστά, λίγο πάνω από τη λεκάνη
            const len = Math.hypot(dx, dz);
            if (f > 0 && dz > 0 && len > 1e-9) {
              const g = Math.exp(-(((h - 0.3) / 0.18) ** 2));
              delta.addScaledVector(front, f * spec[2] * 0.16 * metre * g * (dz / len) ** 1.5 * w);
            }
          } else {
            if (f < 0) k1 *= 0.7;
            // μόνο κάθετα στο κόκαλο (όχι μάκρεμα του χεριού/ποδιού)
            const u = ab.normalize();
            d.addScaledVector(u, -d.dot(u));
            delta.addScaledVector(d, k1 * w);
          }
        }
        if (delta.lengthSq() === 0) continue;
        delta.applyMatrix3(toLocal);
        // οι συντεταγμένες είναι κβαντισμένες (−1…1): χωρίς όριο θα «αναποδογύριζαν»
        pos.setXYZ(i, lim(pos.getX(i) + delta.x), lim(pos.getY(i) + delta.y), lim(pos.getZ(i) + delta.z));
      }
      pos.needsUpdate = true;
    });
  }

  private ownGeo: THREE.BufferGeometry[] = [];

  dispose() {
    for (const g of this.ownGeo) g.dispose();
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}
