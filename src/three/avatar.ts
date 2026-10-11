// Χαρακτήρας από απλά σχήματα (κάψουλες, σφαίρες, κύλινδροι) με αρθρώσεις σε ώμους, αγκώνες, ισχία και
// γόνατα. Οι κινήσεις (στέκεται, περπατά, κάθεται, πανηγυρίζει, πέφτει) αλλάζουν ομαλά από τη μία στην άλλη.
import * as THREE from 'three';
import type { Look } from '../sim/engine';
import { HAIR_COLORS, SKINS, SUITS, TIES } from '../profile';
import { bubbleTexture, nameTagTexture, speechTexture } from './textures';

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 24, 16),
  half: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cap: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.18, 8, 24),
  smile: new THREE.TorusGeometry(1, 0.12, 6, 14, Math.PI),
  thigh: new THREE.CapsuleGeometry(0.078, 0.34, 6, 14),
  shin: new THREE.CapsuleGeometry(0.066, 0.3, 6, 14),
  upperArm: new THREE.CapsuleGeometry(0.062, 0.22, 6, 14),
  foreArm: new THREE.CapsuleGeometry(0.056, 0.2, 6, 14),
  finger: new THREE.CapsuleGeometry(0.016, 0.035, 4, 8),
  torso: new THREE.CylinderGeometry(0.205, 0.18, 0.56, 24, 1),
  pelvis: new THREE.CapsuleGeometry(0.1, 0.16, 6, 14),
  vee: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.075, 0.13);
    s.lineTo(0.075, 0.13);
    s.lineTo(0, -0.12);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  })(),
  lapel: (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.14);
    s.lineTo(0.06, 0.14);
    s.lineTo(0.0, -0.14);
    s.lineTo(-0.03, 0.02);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  })(),
  tie: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.018, 0.1);
    s.lineTo(0.018, 0.1);
    s.lineTo(0.032, -0.14);
    s.lineTo(0, -0.18);
    s.lineTo(-0.032, -0.14);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  })(),
};

/** Σκίαση «καρτούν» σε 3 τόνους (σαν ζωγραφιστή), φωτεινή. */
let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** Υλικό toon (χρώμα και, αν υπάρχει, υφή). */
export function toon(color: string, map: THREE.Texture | null = null): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, map, gradientMap: toonGradient() });
}

const matCache = new Map<string, THREE.Material>();
export function mat(color: string, emissive = 0): THREE.Material {
  const k = `${color}|${emissive}`;
  if (!matCache.has(k)) {
    const m = toon(color);
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    matCache.set(k, m);
  }
  return matCache.get(k)!;
}

const LENS = new THREE.MeshBasicMaterial({ color: '#CFE8FF', transparent: true, opacity: 0.35, depthWrite: false });

/** Λίγο πιο σκούρο/ανοιχτό χρώμα για λεπτομέρειες. */
function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
  return `#${c.getHexString()}`;
}

/** Ριγέ κοστούμι (λεπτές ρίγες), ένα υλικό ανά χρώμα. */
const stripeCache = new Map<string, THREE.Material>();
function pinstripe(color: string): THREE.Material {
  if (!stripeCache.has(color)) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    const l = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    l.getHSL(hsl);
    ctx.fillStyle = hsl.l > 0.55 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.2)';
    for (const x of [6, 38]) ctx.fillRect(x, 0, 2, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 2);
    stripeCache.set(color, toon('#FFFFFF', tex));
  }
  return stripeCache.get(color)!;
}

function part(g: THREE.BufferGeometry, color: string | THREE.Material, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

export type Anim =
  | 'idle' | 'walk' | 'sit' | 'cheer' | 'fall' | 'podium'
  | 'dance' | 'throw' | 'punch' | 'shoot' | 'sad' | 'drink' | 'aim' | 'hands' | 'cuffed' | 'finger' | 'angry';

interface Pose {
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
  /** Πόσο κλειστά είναι τα δάχτυλα (0 τεντωμένα, ~1,5 γροθιά). */
  fistL: number;
  fistR: number;
  /** Ο μέσος του δεξιού χεριού τεντωμένος (0–1) και στροφή του καρπού. */
  midR: number;
  twistR: number;
}

const ZERO: Pose = {
  bodyY: 0, bodyX: 0, thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, shoulderLx: 0, shoulderRx: 0,
  shoulderLz: 0, shoulderRz: 0, elbowL: 0, elbowR: 0, headX: 0, headY: 0, spine: 0,
  fistL: 0.45, fistR: 0.45, midR: 0, twistR: 0,
};

/** Χέρι με παλάμη, 4 δάχτυλα (2 φάλαγγες το καθένα) και αντίχειρα. */
interface Hand {
  group: THREE.Group;
  /** [δάχτυλο][φάλαγγα]: δείκτης, μέσος, παράμεσος, μικρός. */
  fingers: THREE.Group[][];
  thumb: THREE.Group;
  sx: number;
}

function buildHand(sx: number, skin: string): Hand {
  const g = new THREE.Group();
  g.position.set(0, -0.35, 0);
  // παλάμη: η εσωτερική πλευρά κοιτάζει προς το σώμα
  g.add(part(geo.sphere, skin, 0.032, 0.05, 0.05, 0, -0.025, 0));
  const fingers: THREE.Group[][] = [];
  const zs = [0.032, 0.011, -0.011, -0.031];
  const lens = [0.03, 0.034, 0.031, 0.024];
  zs.forEach((z, i) => {
    const base = new THREE.Group();
    base.position.set(0, -0.068, z);
    base.add(part(geo.finger, skin, 0.95, lens[i] / 0.035, 0.95, 0, -lens[i] / 2 - 0.006, 0, false));
    const tip = new THREE.Group();
    tip.position.set(0, -lens[i] - 0.012, 0);
    tip.add(part(geo.finger, skin, 0.9, (lens[i] * 0.8) / 0.035, 0.9, 0, -lens[i] * 0.4 - 0.004, 0, false));
    base.add(tip);
    g.add(base);
    fingers.push([base, tip]);
  });
  const thumb = new THREE.Group();
  thumb.position.set(-sx * 0.012, -0.03, 0.045);
  thumb.add(part(geo.finger, skin, 1.05, 1.0, 1.05, 0, -0.022, 0, false));
  thumb.rotation.set(0.5, 0, sx * 0.35);
  g.add(thumb);
  return { group: g, fingers, thumb, sx };
}

/** Κλείσιμο των δαχτύλων (προς την παλάμη, δηλαδή προς το σώμα). */
function curlHand(h: Hand, fist: number, mid = 0, twist = 0) {
  h.group.rotation.y = twist;
  h.fingers.forEach(([base, tip], i) => {
    const c = i === 1 ? fist * (1 - mid) : fist;
    base.rotation.z = -h.sx * c;
    tip.rotation.z = -h.sx * c * 1.1;
  });
  h.thumb.rotation.z = h.sx * (0.35 - Math.min(1, fist) * 0.75);
  h.thumb.rotation.x = 0.5 + Math.min(1, fist) * 0.4;
}

export class Avatar {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private spine = new THREE.Group();
  private hipL = new THREE.Group();
  private hipR = new THREE.Group();
  private kneeL = new THREE.Group();
  private kneeR = new THREE.Group();
  private shoulderL = new THREE.Group();
  private shoulderR = new THREE.Group();
  private elbowL = new THREE.Group();
  private elbowR = new THREE.Group();
  private head = new THREE.Group();
  private tag: THREE.Sprite;
  private bubble: THREE.Sprite | null = null;
  private bubbleUntil = 0;
  anim: Anim = 'idle';
  /** Θέση-στόχος για ομαλή κίνηση των άλλων παικτών. */
  target = new THREE.Vector3();
  targetRy = 0;
  private phase = Math.random() * 10;
  private fallT = 0;
  private cur: Pose = { ...ZERO };
  private blinkAt = 2 + Math.random() * 3;
  private eyes: THREE.Object3D[] = [];
  private handR: THREE.Group | null = null;
  private hands: Hand[] = [];
  /** Χειρονομία που παίζει για λίγο πάνω από την κανονική κίνηση (κωλοδάχτυλο, θυμός). */
  private over: { anim: Anim; until: number } | null = null;
  private held: THREE.Object3D | null = null;
  /** Χρόνος (s) για τις κινήσεις με κύκλο (ρίψη, γροθιά, πυροβολισμός). */
  get cycle() {
    return this.phase;
  }

  constructor(look: Look, name: string, readonly color: string) {
    const suit = SUITS[look.suit] ?? SUITS[0];
    const suitDark = shade(suit, 0.72);
    this.suitHex = [new THREE.Color(suit).getHex(), new THREE.Color(suitDark).getHex()];
    const suitM = pinstripe(suit);
    this.suitMats.add(suitM);
    const skin = SKINS[look.skin] ?? SKINS[0];
    const skinDark = shade(skin, 0.88);
    const hairC = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
    const tie = TIES[look.tie] ?? TIES[0];
    // ---- πόδια: ισχίο → μηρός → γόνατο → κνήμη → παπούτσι
    for (const [hip, knee, x] of [[this.hipL, this.kneeL, -0.1], [this.hipR, this.kneeR, 0.1]] as const) {
      hip.position.set(x, 0.86, 0);
      hip.add(part(geo.thigh, suitM, 1, 1, 1, 0, -0.2, 0));
      knee.position.set(0, -0.42, 0);
      knee.add(part(geo.shin, suitM, 1, 1, 1, 0, -0.19, 0));
      // παπούτσι: σόλα, πάνω μέρος και μύτη, χωρίς επιφάνειες που συμπίπτουν (αλλιώς «τρεμοπαίζουν»)
      const shoe = new THREE.Group();
      shoe.position.set(0, -0.39, 0);
      shoe.add(part(geo.box, '#151515', 0.122, 0.028, 0.27, 0, -0.03, 0.045));
      shoe.add(part(geo.box, '#2A1D16', 0.108, 0.07, 0.17, 0, 0.012, 0.0));
      shoe.add(part(geo.half, '#2A1D16', 0.054, 0.06, 0.07, 0, -0.016, 0.085));
      shoe.add(part(geo.cyl, suitDark, 0.07, 0.03, 0.07, 0, 0.055, -0.005));
      knee.add(shoe);
      hip.add(knee);
      this.body.add(hip);
    }
    this.body.add(part(geo.pelvis, suitM, 1, 1, 0.8, 0, 0.88, 0).rotateZ(Math.PI / 2));
    // ---- κορμός (στρίβει λίγο στο περπάτημα)
    this.spine.position.set(0, 0.9, 0);
    const torso = part(geo.torso, suitM, 1, 1, 0.62, 0, 0.29, 0);
    this.spine.add(torso);
    // ζώνη με αγκράφα
    this.spine.add(part(geo.cyl, '#141414', 0.183, 0.035, 0.183 * 0.64, 0, 0.03, 0));
    this.spine.add(part(geo.box, '#C9A54A', 0.045, 0.03, 0.01, 0, 0.03, 0.118, false));
    const front = 0.205 * 0.62 + 0.004;
    const shirt = part(geo.vee, '#F6F6F4', 1, 1, 1, 0, 0.43, front, false);
    this.spine.add(shirt);
    for (const sx of [-1, 1]) {
      const l = part(geo.lapel, suitDark, sx, 1, 1, sx * 0.075, 0.42, front + 0.002, false);
      this.spine.add(l);
    }
    this.spine.add(part(geo.tie, tie, 1, 1, 1, 0, 0.44, front + 0.004, false));
    this.spine.add(part(geo.box, shade(tie, 0.8), 0.036, 0.03, 0.012, 0, 0.545, front + 0.006, false));
    for (const by of [0.27, 0.17]) this.spine.add(part(geo.sphere, '#111', 0.009, 0.009, 0.006, 0.05, by, front + 0.003, false));
    // γιακάς και λαιμός
    this.spine.add(part(geo.cyl, '#F6F6F4', 0.07, 0.04, 0.065, 0, 0.585, 0.005));
    this.spine.add(part(geo.cyl, skin, 0.056, 0.1, 0.056, 0, 0.63, 0));
    // ώμοι
    for (const sx of [-1, 1]) this.spine.add(part(geo.sphere, suitM, 0.085, 0.07, 0.08, sx * 0.2, 0.53, 0));
    // ---- χέρια: ώμος → μπράτσο → αγκώνας → πήχης → μανσέτα → χέρι
    for (const [sh, el, sx] of [[this.shoulderL, this.elbowL, -1], [this.shoulderR, this.elbowR, 1]] as const) {
      sh.position.set(sx * 0.255, 0.52, 0);
      sh.add(part(geo.upperArm, suitM, 1, 1, 1, 0, -0.17, 0));
      el.position.set(0, -0.33, 0);
      el.add(part(geo.foreArm, suitM, 1, 1, 1, 0, -0.15, 0));
      el.add(part(geo.cyl, '#F6F6F4', 0.052, 0.035, 0.052, 0, -0.29, 0));
      const hand = buildHand(sx, skin);
      el.add(hand.group);
      this.hands.push(hand);
      if (sx === 1) this.handR = hand.group;
      sh.add(el);
      this.spine.add(sh);
    }
    // ---- κεφάλι
    // λίγο μεγαλύτερο κεφάλι: πιο «καρτουνίστικες» αναλογίες
    this.head.position.set(0, 0.84, 0.005);
    this.head.scale.setScalar(1.3);
    this.head.add(part(geo.sphere, skin, 0.158, 0.185, 0.165));
    this.head.add(part(geo.sphere, skin, 0.12, 0.08, 0.12, 0, -0.1, 0.03));
    for (const sx of [-1, 1]) {
      // αυτιά
      this.head.add(part(geo.sphere, skinDark, 0.03, 0.05, 0.02, sx * 0.157, 0.0, 0.0));
      // μάτια (4 είδη)
      const eye = new THREE.Group();
      eye.position.set(sx * 0.058, 0.02, 0.142);
      const ek = look.eyes ?? 0;
      if (ek === 1) {
        // τελίτσες
        eye.add(part(geo.sphere, '#1B1B1B', 0.016, 0.02, 0.01, 0, 0, 0.006, false));
      } else if (ek === 2) {
        // μεγάλα καρτουνίστικα με λάμψη
        eye.add(part(geo.sphere, '#FAFAFA', 0.04, 0.034, 0.016, 0, 0.004, 0, false));
        eye.add(part(geo.sphere, '#1B1B1B', 0.021, 0.025, 0.01, 0, 0.002, 0.012, false));
        eye.add(part(geo.sphere, '#FFFFFF', 0.007, 0.007, 0.004, 0.008, 0.011, 0.02, false));
      } else {
        eye.add(part(geo.sphere, '#FAFAFA', 0.03, 0.022, 0.015, 0, 0, 0, false));
        eye.add(part(geo.sphere, '#1B1B1B', 0.014, 0.016, 0.01, 0, 0, 0.011, false));
        // νυσταγμένα: βλέφαρο που κλείνει το πάνω μισό
        if (ek === 3) eye.add(part(geo.box, skinDark, 0.066, 0.022, 0.02, 0, 0.012, 0.006, false));
      }
      this.head.add(eye);
      this.eyes.push(eye);
      // φρύδια: η έκφραση (ήρεμη, θυμωμένη, λυπημένη, ειρωνική)
      const bk = look.brows ?? 0;
      const raised = bk === 3 && sx === 1;
      // χοντρά φρύδια (σαν ζωγραφιστά)
      const brow = part(geo.box, shade(hairC, 0.75), 0.06, 0.018, 0.016, sx * 0.058, raised ? 0.084 : bk === 1 ? 0.058 : 0.064, 0.147, false);
      brow.rotation.z = bk === 1 ? sx * 0.35 : bk === 2 ? sx * -0.32 : raised ? -0.25 : sx * -0.12;
      this.head.add(brow);
    }
    this.head.add(part(geo.cone, skinDark, 0.022, 0.05, 0.022, 0, -0.025, 0.168).rotateX(Math.PI / 2));
    const beard = look.beard ?? 0;
    this.addBeard(beard, skin, hairC);
    this.addMouth(look.mouth ?? 0, beard === 3 || beard === 4 ? 0.022 : 0);
    this.addHair(look.hair, hairC);
    this.addHat(look.hat);
    this.addGlasses(look.glasses);
    this.spine.add(this.head);
    this.body.add(this.spine);
    this.group.add(this.body);
    // ετικέτα ονόματος
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTagTexture(name, color), depthWrite: false, transparent: true }));
    this.tag.scale.set(1.1, 0.275, 1);
    this.tag.position.set(0, 2.25, 0);
    this.tag.renderOrder = 10;
    this.group.add(this.tag);
  }

  /** Στόμα: χαμόγελο, σοβαρό, πλατύ χαμόγελο, στραβό χαμόγελο, «Ο». */
  /** Μούσι: μουστάκι, γενάκι, γένια ή αξύριστος. */
  private addBeard(kind: number, skin: string, c: string) {
    const h = this.head;
    const dark = shade(c, 0.85);
    if (kind === 1 || kind === 2) {
      const m = part(geo.thigh, dark, 0.32, 0.17, 0.2, 0, -0.052, 0.152, false);
      m.rotation.z = Math.PI / 2;
      h.add(m);
    }
    if (kind === 2) {
      // γενάκι: μουστάκι που κατεβαίνει στο σαγόνι
      for (const sx of [-1, 1]) {
        const side = part(geo.box, dark, 0.016, 0.07, 0.02, sx * 0.042, -0.09, 0.142, false);
        side.rotation.x = -0.25;
        h.add(side);
      }
      h.add(part(geo.sphere, dark, 0.045, 0.04, 0.03, 0, -0.135, 0.125, false));
    }
    if (kind === 3) {
      h.add(part(geo.sphere, dark, 0.158, 0.105, 0.16, 0, -0.1, 0.012));
      for (const sx of [-1, 1]) h.add(part(geo.box, dark, 0.02, 0.1, 0.05, sx * 0.152, -0.03, 0.03, false));
      const m = part(geo.thigh, shade(c, 0.75), 0.34, 0.17, 0.22, 0, -0.05, 0.168, false);
      m.rotation.z = Math.PI / 2;
      h.add(m);
    }
    if (kind === 4) {
      const mix = new THREE.Color(skin).lerp(new THREE.Color(c), 0.35);
      h.add(part(geo.sphere, `#${mix.getHexString()}`, 0.156, 0.1, 0.158, 0, -0.098, 0.014));
    }
  }

  private addMouth(kind: number, dz = 0) {
    const h = new THREE.Group();
    h.position.z = dz;
    this.head.add(h);
    const lip = '#5A2A22';
    if (kind === 1) {
      h.add(part(geo.box, lip, 0.05, 0.009, 0.01, 0, -0.072, 0.152, false));
    } else if (kind === 2) {
      const open = part(geo.half, lip, 0.045, 0.032, 0.012, 0, -0.062, 0.15, false);
      open.rotation.z = Math.PI;
      h.add(open);
      h.add(part(geo.box, '#FFFFFF', 0.07, 0.012, 0.012, 0, -0.066, 0.155, false));
    } else if (kind === 3) {
      const m = part(geo.smile, lip, 0.03, 0.022, 0.02, 0.014, -0.07, 0.15, false);
      m.rotation.z = Math.PI + 0.45;
      h.add(m);
    } else if (kind === 4) {
      h.add(part(geo.torus, lip, 0.016, 0.02, 0.03, 0, -0.078, 0.152, false));
      h.add(part(geo.sphere, '#2A1210', 0.013, 0.017, 0.006, 0, -0.078, 0.15, false));
    } else {
      const m = part(geo.smile, lip, 0.036, 0.026, 0.02, 0, -0.07, 0.15, false);
      m.rotation.z = Math.PI;
      h.add(m);
    }
  }

  private addHair(style: number, c: string) {
    const h = this.head;
    if (style === 5) return; // τελείως καραφλός
    if (style === 4) {
      // φαλακρός: λίγα μαλλιά στο πλάι
      for (const sx of [-1, 1]) h.add(part(geo.sphere, c, 0.03, 0.06, 0.09, sx * 0.15, 0.02, -0.03));
      return;
    }
    // κάλυμμα που αφήνει ελεύθερο το μέτωπο μπροστά και κατεβαίνει στον σβέρκο πίσω
    h.add(part(geo.cap, c, 0.168, 0.2, 0.176, 0, 0.0, -0.004).rotateX(-0.44));
    // χοντρές τούφες πάνω από το μέτωπο (σαν «σκαλισμένα» μαλλιά)
    for (let i = -2; i <= 2 && style !== 3; i++) {
      const tuft = part(geo.box, shade(c, i % 2 ? 0.82 : 1.12), 0.055, 0.04, 0.13, i * 0.052, 0.155 - Math.abs(i) * 0.012, 0.035, false);
      tuft.rotation.set(-0.75, i * 0.12, i * -0.15);
      h.add(tuft);
    }
    if (style === 0) {
      for (const sx of [-1, 1]) h.add(part(geo.box, c, 0.02, 0.06, 0.04, sx * 0.152, 0.0, 0.07));
    } else if (style === 1) {
      const swoop = part(geo.sphere, c, 0.12, 0.045, 0.09, 0.05, 0.15, 0.08);
      swoop.rotation.z = -0.35;
      h.add(swoop);
    } else if (style === 2) {
      h.add(part(geo.thigh, c, 1.95, 0.75, 0.75, 0, -0.1, -0.1));
      for (const sx of [-1, 1]) h.add(part(geo.box, c, 0.04, 0.24, 0.12, sx * 0.15, -0.06, -0.01));
    } else if (style === 3) {
      // αλογοουρά (αντρικό στυλ): μαλλιά τραβηγμένα πίσω, λαστιχάκι στον σβέρκο, ουρά που κρέμεται
      h.add(part(geo.torus, '#1A1A1A', 0.032, 0.032, 0.05, 0, 0.0, -0.172).rotateX(0.2));
      const tail = part(geo.thigh, c, 0.55, 0.5, 0.55, 0, -0.1, -0.2);
      tail.rotation.x = 0.28;
      h.add(tail);
    }
  }

  private addHat(kind: number) {
    const h = this.head;
    if (kind === 1) {
      h.add(part(geo.half, '#C43A3A', 0.178, 0.15, 0.185, 0, 0.07, 0));
      h.add(part(geo.cyl, '#A82E2E', 0.12, 0.012, 0.09, 0, 0.075, 0.17));
      h.add(part(geo.sphere, '#A82E2E', 0.02, 0.012, 0.02, 0, 0.22, 0));
    } else if (kind === 2) {
      h.add(part(geo.cyl, '#141414', 0.135, 0.28, 0.135, 0, 0.3, 0));
      h.add(part(geo.cyl, '#141414', 0.24, 0.015, 0.24, 0, 0.16, 0));
      h.add(part(geo.cyl, '#8B1E1E', 0.137, 0.045, 0.137, 0, 0.19, 0));
    } else if (kind === 3) {
      const t = part(geo.torus, '#E23B3B', 0.165, 0.165, 0.3, 0, 0.08, 0);
      t.rotation.x = Math.PI / 2;
      h.add(t);
    } else if (kind === 4) {
      h.add(part(geo.cyl, '#E8B923', 0.14, 0.07, 0.14, 0, 0.19, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        h.add(part(geo.cone, '#E8B923', 0.025, 0.08, 0.025, Math.cos(a) * 0.125, 0.26, Math.sin(a) * 0.125));
        if (i % 2 === 0) h.add(part(geo.sphere, i % 4 ? '#3B7DD8' : '#D83B3B', 0.016, 0.016, 0.016, Math.cos(a) * 0.14, 0.19, Math.sin(a) * 0.14));
      }
    }
  }

  private addGlasses(kind: number) {
    const h = this.head;
    if (kind === 1) {
      for (const x of [-0.058, 0.058]) h.add(part(geo.torus, '#222', 0.04, 0.04, 0.08, x, 0.02, 0.156));
      h.add(part(geo.box, '#222', 0.04, 0.008, 0.008, 0, 0.025, 0.162));
    } else if (kind === 2) {
      for (const x of [-0.058, 0.058]) h.add(part(geo.box, '#0B0B0B', 0.075, 0.042, 0.012, x, 0.022, 0.16));
      h.add(part(geo.box, '#0B0B0B', 0.25, 0.014, 0.014, 0, 0.044, 0.157));
      for (const sx of [-1, 1]) h.add(part(geo.box, '#0B0B0B', 0.008, 0.012, 0.15, sx * 0.158, 0.035, 0.08, false));
    } else if (kind === 3) {
      // χοντρός καφέ σκελετός με φακούς που γυαλίζουν
      for (const x of [-0.06, 0.06]) {
        const r = part(geo.torus, '#7A3B1E', 0.05, 0.048, 0.14, x, 0.02, 0.158);
        h.add(r);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), LENS);
        lens.position.set(x, 0.02, 0.162);
        h.add(lens);
      }
      h.add(part(geo.box, '#7A3B1E', 0.025, 0.012, 0.012, 0, 0.03, 0.163));
      for (const sx of [-1, 1]) h.add(part(geo.box, '#7A3B1E', 0.01, 0.014, 0.15, sx * 0.158, 0.03, 0.08, false));
    }
  }

  private suitHex: number[] = [];
  private suitMats = new Set<THREE.Material>();

  /** Αλλάζει το ρούχο (κοστούμι) με άλλο υλικό: φόρμα φυλακής, λαμπερό φόρεμα… */
  setOutfit(m: THREE.Material) {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const c = (mesh.material as THREE.MeshLambertMaterial | undefined)?.color;
      if (mesh.isMesh && (this.suitMats.has(mesh.material as THREE.Material) || (c && this.suitHex.includes(c.getHex())))) mesh.material = m;
    });
  }

  private watch: THREE.Group | null = null;
  watchKind = 0;

  /** Ρολόι στον αριστερό καρπό: 1 χρυσό, 2 διαμαντένιο (0 κανένα). */
  setWatch(kind: number) {
    if (kind === this.watchKind) return;
    this.watchKind = kind;
    this.watch?.removeFromParent();
    this.watch = null;
    if (!kind) return;
    const w = new THREE.Group();
    w.position.set(0, -0.265, 0);
    const gold = kind === 1;
    const band = new THREE.MeshLambertMaterial({ color: gold ? '#E2B23A' : '#DCE3EA', emissive: new THREE.Color(gold ? '#5A4200' : '#3A4A5A') });
    const face = new THREE.MeshBasicMaterial({ color: gold ? '#FFF1C2' : '#E8F7FF' });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.035, 14, 1, true), band);
    ring.material.side = THREE.DoubleSide;
    w.add(ring);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 16), band);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.z = 0.055;
    w.add(bezel);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), face);
    dial.position.z = 0.0625;
    w.add(dial);
    if (!gold) {
      // διαμάντια γύρω από το καντράν
      const gem = new THREE.MeshBasicMaterial({ color: '#B9F2FF' });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.007), gem);
        d.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.064);
        w.add(d);
      }
    }
    this.elbowL.add(w);
    this.watch = w;
  }

  /** Κάτι στο δεξί χέρι (μπουκάλι, όπλο…) ή τίποτα. */
  hold(obj: THREE.Object3D | null) {
    if (this.held) this.held.removeFromParent();
    this.held = obj;
    if (obj && this.handR) this.handR.add(obj);
  }

  /** Η θέση του δεξιού χεριού στον κόσμο (για ό,τι πετάει ή πυροβολεί). */
  handWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return this.handR ? this.handR.getWorldPosition(out) : this.group.getWorldPosition(out).setY(1.3);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  /** Μεγαλύτερη ετικέτα όταν η κάμερα είναι μακριά. */
  setTagScale(k: number) {
    this.tag.scale.set(1.1 * k, 0.275 * k, 1);
    this.tag.position.y = 2.1 + 0.15 * k;
  }

  showTag(v: boolean) {
    this.tag.visible = v;
  }

  /** Συννεφάκι με όσα λέει (για λίγα δευτερόλεπτα, ανάλογα με το μήκος). */
  say(text: string, now: number) {
    this.clearBubble();
    const { tex, aspect } = speechTexture(text);
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    const hgt = 0.8 / Math.max(1.6, aspect / 1.4);
    this.bubble.scale.set(hgt * aspect, hgt, 1);
    this.bubble.center.set(0.5, 0);
    this.bubble.position.set(0, 2.45, 0);
    this.bubble.renderOrder = 12;
    this.group.add(this.bubble);
    this.bubbleUntil = now + Math.min(7000, 2500 + text.length * 70);
  }

  private clearBubble() {
    if (this.bubble) {
      this.group.remove(this.bubble);
      (this.bubble.material as THREE.SpriteMaterial).map?.dispose();
      this.bubble.material.dispose();
      this.bubble = null;
    }
  }

  emote(text: string, now: number) {
    if (this.bubble) {
      this.group.remove(this.bubble);
      (this.bubble.material as THREE.SpriteMaterial).map?.dispose();
      this.bubble.material.dispose();
    }
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(text), depthWrite: false, transparent: true }));
    this.bubble.scale.set(0.55, 0.55, 1);
    this.bubble.position.set(0, 2.75, 0);
    this.bubble.renderOrder = 11;
    this.group.add(this.bubble);
    this.bubbleUntil = now + 3000;
  }

  /** Χειρονομία για ms χιλιοστά (πάνω από ό,τι κάνει ο χαρακτήρας). */
  gesture(anim: Anim, ms: number, now = Date.now()) {
    this.over = { anim, until: now + ms };
  }

  /** Η στάση που «θέλει» η κάθε κίνηση αυτή τη στιγμή. */
  private targetPose(dt: number, now: number): Pose {
    const p = this.phase;
    const t: Pose = { ...ZERO };
    const sitting = this.anim === 'sit';
    const anim = this.over && now < this.over.until ? this.over.anim : this.anim;
    if (anim !== 'fall') this.fallT = 0;
    switch (anim) {
      case 'idle':
        t.bodyY = Math.sin(p * 2) * 0.006;
        t.shoulderLz = -0.07;
        t.shoulderRz = 0.07;
        t.elbowL = -0.12;
        t.elbowR = -0.12;
        t.headY = Math.sin(p * 0.6) * 0.15;
        break;
      case 'walk': {
        const s = Math.sin(p * 8.5);
        t.thighL = s * 0.55;
        t.thighR = -s * 0.55;
        t.kneeL = Math.max(0, -s) * 0.8 + 0.05;
        t.kneeR = Math.max(0, s) * 0.8 + 0.05;
        t.shoulderLx = -s * 0.45;
        t.shoulderRx = s * 0.45;
        t.shoulderLz = -0.06;
        t.shoulderRz = 0.06;
        t.elbowL = -0.25;
        t.elbowR = -0.25;
        t.spine = s * 0.08;
        t.bodyY = Math.abs(Math.cos(p * 8.5)) * 0.035;
        break;
      }
      case 'sit':
        t.bodyY = -0.36;
        t.thighL = -Math.PI / 2;
        t.thighR = -Math.PI / 2;
        t.kneeL = Math.PI / 2;
        t.kneeR = Math.PI / 2;
        t.shoulderLx = -0.55 + Math.sin(p * 17) * 0.04;
        t.shoulderRx = -0.55 + Math.sin(p * 17 + 1.7) * 0.04;
        t.elbowL = -0.9;
        t.elbowR = -0.9;
        t.headX = 0.12 + Math.sin(p * 0.7) * 0.05;
        t.headY = Math.sin(p * 0.37) * 0.25;
        break;
      case 'cheer':
      case 'podium': {
        const s = Math.sin(p * 8);
        t.shoulderLz = -2.6 - s * 0.25;
        t.shoulderRz = 2.6 + s * 0.25;
        t.elbowL = -0.3;
        t.elbowR = -0.3;
        t.bodyY = Math.abs(s) * (anim === 'cheer' ? 0.1 : 0.05);
        t.fistL = t.fistR = 0.2;
        t.headX = -0.15;
        break;
      }
      case 'dance': {
        const s = Math.sin(p * 7);
        const c = Math.cos(p * 3.5);
        t.bodyY = Math.abs(s) * 0.08;
        t.spine = c * 0.35;
        t.thighL = Math.max(0, s) * 0.5;
        t.thighR = Math.max(0, -s) * 0.5;
        t.kneeL = Math.max(0, s) * 0.7;
        t.kneeR = Math.max(0, -s) * 0.7;
        t.shoulderLz = -1.6 - s * 0.9;
        t.shoulderRz = 1.6 - s * 0.9;
        t.elbowL = -0.6;
        t.elbowR = -0.6;
        t.headY = c * 0.3;
        t.headX = -0.1;
        break;
      }
      case 'throw': {
        // κύκλος 1,2″: σήκωμα πίσω, ρίψη μπροστά
        const k = (p % 1.2) / 1.2;
        t.shoulderRx = k < 0.6 ? -3.0 * (k / 0.6) : -3.0 + (k - 0.6) / 0.4 * 2.2;
        t.elbowR = k < 0.6 ? -1.2 : -0.2;
        t.shoulderLz = -0.5;
        t.spine = k < 0.6 ? 0.35 : -0.25;
        t.thighL = -0.3;
        t.headX = -0.05;
        break;
      }
      case 'punch': {
        const k = (p % 0.7) / 0.7;
        const right = Math.floor(p / 0.7) % 2 === 0;
        const jab = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
        t.shoulderRx = -1.0 - (right ? jab * 0.6 : 0);
        t.shoulderLx = -1.0 - (right ? 0 : jab * 0.6);
        t.elbowR = right ? -1.8 + jab * 1.7 : -1.8;
        t.elbowL = right ? -1.8 : -1.8 + jab * 1.7;
        t.spine = right ? -0.25 * jab : 0.25 * jab;
        t.bodyY = -0.05 + Math.abs(Math.sin(p * 9)) * 0.03;
        t.kneeL = 0.25;
        t.kneeR = 0.25;
        t.thighL = -0.2;
        t.thighR = 0.1;
        break;
      }
      case 'shoot': {
        // χέρι τεντωμένο μπροστά, μικρή ανάκρουση κάθε 0,6″
        const k = (p % 0.6) / 0.6;
        const kick = k < 0.15 ? 1 - k / 0.15 : 0;
        t.shoulderRx = -1.5 - kick * 0.35;
        t.elbowR = 0;
        t.shoulderLx = -1.3;
        t.shoulderLz = 0.45;
        t.elbowL = -0.6;
        t.headX = 0.05;
        t.spine = -0.1;
        t.kneeL = 0.15;
        t.kneeR = 0.15;
        break;
      }
      case 'aim':
        t.shoulderRx = -1.5;
        t.elbowR = 0;
        t.shoulderLx = -1.3;
        t.shoulderLz = 0.45;
        t.elbowL = -0.6;
        t.kneeL = 0.2;
        t.kneeR = 0.2;
        t.thighL = -0.15;
        t.bodyY = -0.03;
        break;
      case 'hands':
        // ψηλά τα χέρια
        t.shoulderLz = -2.9;
        t.shoulderRz = 2.9;
        t.elbowL = -0.15;
        t.elbowR = -0.15;
        t.headX = 0.1 + Math.sin(p * 9) * 0.03;
        break;
      case 'cuffed':
        // χέρια πίσω στην πλάτη, κεφάλι κάτω
        t.shoulderLx = 0.55;
        t.shoulderRx = 0.55;
        t.shoulderLz = 0.25;
        t.shoulderRz = -0.25;
        t.elbowL = -0.5;
        t.elbowR = -0.5;
        t.headX = 0.4;
        break;
      case 'sad':
        t.headX = 0.55;
        t.headY = Math.sin(p * 0.5) * 0.15;
        t.shoulderLz = -0.02;
        t.shoulderRz = 0.02;
        t.shoulderLx = 0.1;
        t.shoulderRx = 0.1;
        t.bodyY = -0.03;
        break;
      case 'drink': {
        const s = Math.sin(p * 4);
        t.shoulderRx = -2.4;
        t.elbowR = -1.5;
        t.shoulderLz = -2.5 - s * 0.3;
        t.elbowL = -0.3;
        t.headX = -0.35;
        t.bodyY = Math.abs(s) * 0.05;
        break;
      }
      case 'finger': {
        // κωλοδάχτυλο: χέρι μπροστά και ψηλά, ράχη της παλάμης προς τον άλλον, μόνο ο μέσος τεντωμένος
        const k = Math.sin(p * 6) * 0.04;
        t.shoulderRx = -1.25 + k;
        t.shoulderRz = 0.12;
        t.elbowR = -1.25;
        t.twistR = -Math.PI / 2;
        t.fistR = 1.55;
        t.midR = 1;
        t.fistL = 0.5;
        t.shoulderLz = -0.1;
        t.spine = -0.15;
        t.headX = -0.08;
        t.headY = 0.1;
        break;
      }
      case 'angry': {
        // θυμωμένος: σφιγμένες γροθιές που τρέμουν, σκυμμένος μπροστά
        const s = Math.sin(p * 22) * 0.12;
        t.shoulderLx = -0.7 + s;
        t.shoulderRx = -0.7 - s;
        t.shoulderLz = -0.25;
        t.shoulderRz = 0.25;
        t.elbowL = -1.7;
        t.elbowR = -1.7;
        t.fistL = t.fistR = 1.55;
        t.headX = 0.12;
        t.bodyY = Math.abs(Math.sin(p * 11)) * 0.03;
        break;
      }
      case 'fall':
        this.fallT = Math.min(1, this.fallT + dt * 1.6);
        t.bodyX = -this.fallT * Math.PI / 2;
        t.bodyY = this.fallT * 0.12;
        t.shoulderLz = -1.2 * this.fallT;
        t.shoulderRz = 1.2 * this.fallT;
        t.kneeL = 0.2 * this.fallT;
        break;
    }
    // χειρονομία ενώ κάθεται: τα πόδια μένουν στην καρέκλα
    if (sitting && anim !== 'sit') {
      t.bodyY = -0.36;
      t.thighL = t.thighR = -Math.PI / 2;
      t.kneeL = t.kneeR = Math.PI / 2;
    }
    // χέρια με όπλο ή μπουκάλι: κλειστή παλάμη
    if (this.held && anim !== 'finger') t.fistR = Math.max(t.fistR, 1.2);
    if (anim === 'punch' || anim === 'cuffed') t.fistL = t.fistR = 1.5;
    return t;
  }

  /** Κίνηση προς τη θέση-στόχο και ζωντάνεμα του σώματος. */
  update(dt: number, now: number, follow = true) {
    if (follow) {
      const k = 1 - Math.exp(-dt * 9);
      const dx = this.target.x - this.group.position.x;
      const dz = this.target.z - this.group.position.z;
      if (dx * dx + dz * dz > 25) this.group.position.copy(this.target);
      else this.group.position.lerp(this.target, k);
      let dr = this.targetRy - this.group.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      this.group.rotation.y += dr * k;
    }
    if (this.bubble && now > this.bubbleUntil) {
      this.group.remove(this.bubble);
      this.bubble = null;
    }
    this.phase += dt;
    // ομαλή μετάβαση ανάμεσα στις στάσεις
    const target = this.targetPose(dt, now);
    const k = this.anim === 'walk' ? 1 - Math.exp(-dt * 22) : 1 - Math.exp(-dt * 10);
    const c = this.cur;
    for (const key of Object.keys(c) as (keyof Pose)[]) c[key] += (target[key] - c[key]) * k;
    this.body.position.y = c.bodyY;
    this.body.rotation.x = c.bodyX;
    this.spine.rotation.y = c.spine;
    this.hipL.rotation.x = c.thighL;
    this.hipR.rotation.x = c.thighR;
    this.kneeL.rotation.x = c.kneeL;
    this.kneeR.rotation.x = c.kneeR;
    this.shoulderL.rotation.set(c.shoulderLx, 0, c.shoulderLz);
    this.shoulderR.rotation.set(c.shoulderRx, 0, c.shoulderRz);
    this.elbowL.rotation.x = c.elbowL;
    this.elbowR.rotation.x = c.elbowR;
    this.head.rotation.set(c.headX, c.headY, 0);
    if (this.hands[0]) curlHand(this.hands[0], c.fistL);
    if (this.hands[1]) curlHand(this.hands[1], c.fistR, c.midR, c.twistR);
    // ανοιγοκλείσιμο ματιών
    this.blinkAt -= dt;
    const closed = this.blinkAt < 0.12;
    for (const e of this.eyes) e.scale.y = closed ? 0.15 : 1;
    if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 3.5;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Sprite) {
        (o.material as THREE.SpriteMaterial).map?.dispose();
        o.material.dispose();
      }
    });
    this.group.removeFromParent();
  }
}

/** Χρώματα ομάδας για τα ονόματα και τις θέσεις στο γραφείο. */
export const PLAYER_COLORS = [
  '#F5C542', '#4FC3F7', '#FF7A7A', '#7CE38B', '#C792EA', '#FF9F43', '#F06292', '#4DD0C4', '#B0D45A', '#A9B8C9',
];
