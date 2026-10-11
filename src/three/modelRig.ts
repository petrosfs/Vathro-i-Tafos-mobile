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

  constructor(private body: THREE.Object3D, private head: THREE.Object3D, colors: RigColors, swat = false) {
    const tpl = swat && SWAT ? SWAT : SUIT!;
    this.root = cloneSkinned(tpl.scene);
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
  apply(p: RigPose, anim: string, dt: number) {
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
    this.body.updateWorldMatrix(true, false);
    this.root.updateMatrixWorld(true);
    this.rootInv.copy(this.root.matrixWorld).invert();
    const clipDriven = anim === 'walk' || anim === 'fall';
    // κορμός και κεφάλι
    if (!clipDriven && Math.abs(p.spine) > 1e-3) this.rotateBody(this.bone('Torso'), this.tmpQ.setFromAxisAngle(Y, p.spine));
    if (!clipDriven) {
      // χέρια: ώμος (μπρος-πίσω και στο πλάι) και αγκώνας, όπως στον απλό χαρακτήρα
      for (const [side, sx, sz, el] of [['R', p.shoulderLx, p.shoulderLz, p.elbowL], ['L', p.shoulderRx, p.shoulderRz, p.elbowR]] as const) {
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
    this.body.position.y = clipDriven ? 0 : p.bodyY;
    this.body.rotation.x = clipDriven ? 0 : p.bodyX;
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

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}
