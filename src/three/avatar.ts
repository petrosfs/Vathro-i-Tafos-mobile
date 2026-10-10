// Low-poly χαρακτήρας από απλά σχήματα, με κινήσεις: στέκεται, περπατά, κάθεται, πανηγυρίζει, πέφτει.
import * as THREE from 'three';
import type { Look } from '../sim/engine';
import { HAIR_COLORS, SKINS, SUITS, TIES } from '../profile';
import { bubbleTexture, nameTagTexture } from './textures';

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  half: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.ConeGeometry(1, 1, 6),
  torus: new THREE.TorusGeometry(1, 0.18, 6, 16),
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

function part(g: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export type Anim = 'idle' | 'walk' | 'sit' | 'cheer' | 'fall' | 'podium';

export class Avatar {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
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

  constructor(look: Look, name: string, readonly color: string) {
    const suit = SUITS[look.suit] ?? SUITS[0];
    const skin = SKINS[look.skin] ?? SKINS[0];
    const hairC = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
    const tie = TIES[look.tie] ?? TIES[0];
    // πόδια (περιστρέφονται στο ισχίο)
    for (const [leg, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      leg.position.set(x, 0.82, 0);
      leg.add(part(geo.box, suit, 0.16, 0.78, 0.18, 0, -0.39, 0));
      leg.add(part(geo.box, '#1A1A1A', 0.17, 0.08, 0.28, 0, -0.78, 0.05));
      this.body.add(leg);
    }
    // κορμός
    this.body.add(part(geo.box, suit, 0.5, 0.64, 0.28, 0, 1.13, 0));
    this.body.add(part(geo.box, '#F4F4F4', 0.16, 0.3, 0.02, 0, 1.3, 0.14));
    this.body.add(part(geo.box, tie, 0.06, 0.34, 0.02, 0, 1.22, 0.155));
    // χέρια (περιστρέφονται στον ώμο)
    for (const [arm, x] of [[this.armL, -0.32], [this.armR, 0.32]] as const) {
      arm.position.set(x, 1.4, 0);
      arm.add(part(geo.box, suit, 0.13, 0.58, 0.15, 0, -0.29, 0));
      arm.add(part(geo.sphere, skin, 0.07, 0.07, 0.07, 0, -0.62, 0));
      this.body.add(arm);
    }
    // κεφάλι
    this.head.position.set(0, 1.63, 0);
    this.head.add(part(geo.sphere, skin, 0.17, 0.19, 0.17));
    this.head.add(part(geo.box, '#151515', 0.035, 0.035, 0.02, -0.06, 0.02, 0.16));
    this.head.add(part(geo.box, '#151515', 0.035, 0.035, 0.02, 0.06, 0.02, 0.16));
    this.head.add(part(geo.box, '#B8664E', 0.07, 0.02, 0.02, 0, -0.08, 0.16));
    this.addHair(look.hair, hairC);
    this.addHat(look.hat);
    this.addGlasses(look.glasses);
    this.body.add(this.head);
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
    if (style === 4) return;
    h.add(part(geo.half, c, 0.185, 0.17, 0.185, 0, 0.03, -0.005));
    if (style === 1) h.add(part(geo.box, c, 0.2, 0.06, 0.12, 0.06, 0.15, 0.06));
    if (style === 2) h.add(part(geo.box, c, 0.34, 0.36, 0.1, 0, -0.1, -0.12));
    if (style === 3) h.add(part(geo.sphere, c, 0.09, 0.09, 0.09, 0, 0.2, -0.1));
  }

  private addHat(kind: number) {
    const h = this.head;
    if (kind === 1) {
      h.add(part(geo.half, '#C43A3A', 0.195, 0.14, 0.195, 0, 0.07, 0));
      h.add(part(geo.box, '#C43A3A', 0.24, 0.02, 0.16, 0, 0.08, 0.18));
    } else if (kind === 2) {
      h.add(part(geo.cyl, '#141414', 0.15, 0.3, 0.15, 0, 0.3, 0));
      h.add(part(geo.cyl, '#141414', 0.26, 0.02, 0.26, 0, 0.15, 0));
      h.add(part(geo.cyl, '#8B1E1E', 0.152, 0.05, 0.152, 0, 0.18, 0));
    } else if (kind === 3) {
      const t = part(geo.torus, '#E23B3B', 0.18, 0.18, 0.3, 0, 0.08, 0);
      t.rotation.x = Math.PI / 2;
      h.add(t);
    } else if (kind === 4) {
      h.add(part(geo.cyl, '#E8B923', 0.16, 0.08, 0.16, 0, 0.2, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        h.add(part(geo.cone, '#E8B923', 0.035, 0.09, 0.035, Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.14));
      }
    }
  }

  private addGlasses(kind: number) {
    const h = this.head;
    if (kind === 1) {
      for (const x of [-0.065, 0.065]) {
        const g = part(geo.torus, '#222', 0.045, 0.045, 0.2, x, 0.02, 0.17);
        h.add(g);
      }
    } else if (kind === 2) {
      h.add(part(geo.box, '#0B0B0B', 0.27, 0.06, 0.03, 0, 0.025, 0.165));
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

  /** Κίνηση προς τη θέση-στόχο και ζωντάνεμα του σώματος. */
  update(dt: number, now: number, follow = true) {
    if (follow) {
      const k = 1 - Math.exp(-dt * 10);
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
    const p = this.phase;
    const b = this.body;
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    if (this.anim !== 'fall') this.fallT = 0;
    switch (this.anim) {
      case 'idle':
        b.position.y = Math.sin(p * 2) * 0.01;
        this.armL.rotation.z = 0.06;
        this.armR.rotation.z = -0.06;
        break;
      case 'walk': {
        const s = Math.sin(p * 9);
        this.legL.rotation.x = s * 0.6;
        this.legR.rotation.x = -s * 0.6;
        this.armL.rotation.x = -s * 0.5;
        this.armR.rotation.x = s * 0.5;
        b.position.y = Math.abs(Math.cos(p * 9)) * 0.04;
        break;
      }
      case 'sit':
        b.position.y = -0.36;
        this.legL.rotation.x = -Math.PI / 2;
        this.legR.rotation.x = -Math.PI / 2;
        this.armL.rotation.x = -1.1 + Math.sin(p * 18) * 0.06;
        this.armR.rotation.x = -1.1 + Math.sin(p * 18 + 1.7) * 0.06;
        this.head.rotation.x = -0.08 + Math.sin(p * 0.7) * 0.05;
        break;
      case 'cheer':
      case 'podium': {
        const s = Math.sin(p * 8);
        this.armL.rotation.z = 2.6 + s * 0.25;
        this.armR.rotation.z = -2.6 - s * 0.25;
        b.position.y = Math.abs(s) * (this.anim === 'cheer' ? 0.12 : 0.06);
        break;
      }
      case 'fall':
        this.fallT = Math.min(1, this.fallT + dt * 1.6);
        b.rotation.x = -this.fallT * Math.PI / 2;
        b.position.y = this.fallT * 0.15;
        this.armL.rotation.z = 0.9 * this.fallT;
        this.armR.rotation.z = -0.9 * this.fallT;
        break;
    }
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
export const PLAYER_COLORS = ['#F5C542', '#4FC3F7', '#FF7A7A', '#7CE38B', '#C792EA', '#FF9F43'];
