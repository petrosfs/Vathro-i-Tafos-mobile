// Χαρακτήρας από απλά σχήματα (κάψουλες, σφαίρες, κύλινδροι) με αρθρώσεις σε ώμους, αγκώνες, ισχία και
// γόνατα. Οι κινήσεις (στέκεται, περπατά, κάθεται, πανηγυρίζει, πέφτει) αλλάζουν ομαλά από τη μία στην άλλη.
import * as THREE from 'three';
import type { Look } from '../sim/engine';
import { HAIR_COLORS, SKINS, SUITS, TIES } from '../profile';
import { bubbleTexture, nameTagTexture } from './textures';

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

const matCache = new Map<string, THREE.Material>();
export function mat(color: string, emissive = 0): THREE.Material {
  const k = `${color}|${emissive}`;
  if (!matCache.has(k)) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    matCache.set(k, m);
  }
  return matCache.get(k)!;
}

/** Λίγο πιο σκούρο/ανοιχτό χρώμα για λεπτομέρειες. */
function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
  return `#${c.getHexString()}`;
}

function part(g: THREE.BufferGeometry, color: string, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(g, mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

export type Anim = 'idle' | 'walk' | 'sit' | 'cheer' | 'fall' | 'podium';

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
}

const ZERO: Pose = {
  bodyY: 0, bodyX: 0, thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, shoulderLx: 0, shoulderRx: 0,
  shoulderLz: 0, shoulderRz: 0, elbowL: 0, elbowR: 0, headX: 0, headY: 0, spine: 0,
};

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

  constructor(look: Look, name: string, readonly color: string) {
    const suit = SUITS[look.suit] ?? SUITS[0];
    const suitDark = shade(suit, 0.72);
    const skin = SKINS[look.skin] ?? SKINS[0];
    const skinDark = shade(skin, 0.88);
    const hairC = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
    const tie = TIES[look.tie] ?? TIES[0];
    // ---- πόδια: ισχίο → μηρός → γόνατο → κνήμη → παπούτσι
    for (const [hip, knee, x] of [[this.hipL, this.kneeL, -0.1], [this.hipR, this.kneeR, 0.1]] as const) {
      hip.position.set(x, 0.86, 0);
      hip.add(part(geo.thigh, suit, 1, 1, 1, 0, -0.2, 0));
      knee.position.set(0, -0.42, 0);
      knee.add(part(geo.shin, suit, 1, 1, 1, 0, -0.19, 0));
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
    this.body.add(part(geo.pelvis, suit, 1, 1, 0.8, 0, 0.88, 0).rotateZ(Math.PI / 2));
    // ---- κορμός (στρίβει λίγο στο περπάτημα)
    this.spine.position.set(0, 0.9, 0);
    const torso = part(geo.torso, suit, 1, 1, 0.62, 0, 0.29, 0);
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
    for (const sx of [-1, 1]) this.spine.add(part(geo.sphere, suit, 0.085, 0.07, 0.08, sx * 0.2, 0.53, 0));
    // ---- χέρια: ώμος → μπράτσο → αγκώνας → πήχης → μανσέτα → χέρι
    for (const [sh, el, sx] of [[this.shoulderL, this.elbowL, -1], [this.shoulderR, this.elbowR, 1]] as const) {
      sh.position.set(sx * 0.255, 0.52, 0);
      sh.add(part(geo.upperArm, suit, 1, 1, 1, 0, -0.17, 0));
      el.position.set(0, -0.33, 0);
      el.add(part(geo.foreArm, suit, 1, 1, 1, 0, -0.15, 0));
      el.add(part(geo.cyl, '#F6F6F4', 0.052, 0.035, 0.052, 0, -0.29, 0));
      const hand = new THREE.Group();
      hand.position.set(0, -0.35, 0);
      hand.add(part(geo.sphere, skin, 0.046, 0.06, 0.03));
      const thumb = part(geo.finger, skin, 1, 1, 1, sx * -0.04, 0.0, 0.018);
      thumb.rotation.z = sx * 0.6;
      hand.add(thumb);
      el.add(hand);
      sh.add(el);
      this.spine.add(sh);
    }
    // ---- κεφάλι
    this.head.position.set(0, 0.79, 0.005);
    this.head.add(part(geo.sphere, skin, 0.158, 0.185, 0.165));
    this.head.add(part(geo.sphere, skin, 0.12, 0.08, 0.12, 0, -0.1, 0.03));
    for (const sx of [-1, 1]) {
      // αυτιά
      this.head.add(part(geo.sphere, skinDark, 0.03, 0.05, 0.02, sx * 0.157, 0.0, 0.0));
      // μάτια: λευκό, κόρη, φρύδι
      const eye = new THREE.Group();
      eye.position.set(sx * 0.058, 0.02, 0.142);
      eye.add(part(geo.sphere, '#FAFAFA', 0.03, 0.022, 0.015, 0, 0, 0, false));
      eye.add(part(geo.sphere, '#1B1B1B', 0.014, 0.016, 0.01, 0, 0, 0.011, false));
      this.head.add(eye);
      this.eyes.push(eye);
      const brow = part(geo.box, shade(hairC, 0.9), 0.05, 0.011, 0.012, sx * 0.058, 0.062, 0.148, false);
      brow.rotation.z = sx * -0.12;
      this.head.add(brow);
    }
    this.head.add(part(geo.cone, skinDark, 0.022, 0.05, 0.022, 0, -0.025, 0.168).rotateX(Math.PI / 2));
    const mouth = part(geo.smile, '#5A2A22', 0.036, 0.026, 0.02, 0, -0.07, 0.15, false);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);
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

  private addHair(style: number, c: string) {
    const h = this.head;
    if (style === 4) {
      // φαλακρός: λίγα μαλλιά στο πλάι
      for (const sx of [-1, 1]) h.add(part(geo.sphere, c, 0.03, 0.06, 0.09, sx * 0.15, 0.02, -0.03));
      return;
    }
    // κάλυμμα που αφήνει ελεύθερο το μέτωπο μπροστά και κατεβαίνει στον σβέρκο πίσω
    h.add(part(geo.cap, c, 0.168, 0.2, 0.176, 0, 0.0, -0.004).rotateX(-0.44));
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
      h.add(part(geo.sphere, c, 0.08, 0.08, 0.08, 0, 0.17, -0.12));
      h.add(part(geo.torus, shade(c, 0.7), 0.05, 0.05, 0.05, 0, 0.14, -0.1).rotateX(1.1));
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
      for (const x of [-0.058, 0.058]) h.add(part(geo.sphere, '#0B0B0B', 0.048, 0.032, 0.012, x, 0.02, 0.158));
      h.add(part(geo.box, '#0B0B0B', 0.24, 0.012, 0.012, 0, 0.04, 0.155));
    }
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

  /** Η στάση που «θέλει» η κάθε κίνηση αυτή τη στιγμή. */
  private targetPose(dt: number): Pose {
    const p = this.phase;
    const t: Pose = { ...ZERO };
    if (this.anim !== 'fall') this.fallT = 0;
    switch (this.anim) {
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
        t.bodyY = Math.abs(s) * (this.anim === 'cheer' ? 0.1 : 0.05);
        t.headX = -0.15;
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
    const target = this.targetPose(dt);
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
