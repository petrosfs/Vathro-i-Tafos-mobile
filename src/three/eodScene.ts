// Το κλείσιμο της αγοράς: η κάμερα πάει μακριά και η ομάδα ή γιορτάζει ή τσακώνεται,
// ανάλογα με τη μέρα, τον χώρο και τα λεφτά. Χαρτοπόλεμος → κούπες → ξύλο → πιστολίδι,
// ή μπράβο → πάρτι → σαμπάνιες → πάρτι με κόσμο και χορεύτριες. Καθαρά καρτουνίστικο.
import * as THREE from 'three';
import { Avatar, mat, type Anim } from './avatar';
import { makeMug } from './props';
import { hash } from '../sim/rng';
import { sfx } from '../audio';
import type { Look } from '../sim/engine';
import { makeMoneyGun, type MoneyFx } from './moneyFx';

export type EodMood = 'great' | 'good' | 'meh' | 'bad';

export interface EodSpec {
  mood: EodMood;
  /** 0–3: πόσο «μεγάλο» είναι το γλέντι ή ο καβγάς (χώρος και λεφτά). */
  level: number;
  seed: number;
}

/** Επίπεδο από τον χώρο (0–3) και το ταμείο σε σχέση με το αρχικό κεφάλαιο. */
export function eodLevel(venue: number, cash: number, startCash: number): number {
  const x = cash / Math.max(1, startCash);
  const wealth = x >= 8 ? 3 : x >= 4 ? 2 : x >= 2 ? 1 : 0;
  return Math.max(0, Math.min(3, Math.round((venue + wealth) / 2)));
}

/** Πώς πήγε η μέρα: πολύ καλά (≥2× στόχος), καλά, μέτρια (χωρίς ζημιά), χάλια (ζημιά). */
export function eodMood(profit: number, quota: number, passed: boolean): EodMood {
  if (profit < 0) return 'bad';
  if (passed && profit >= quota * 2) return 'great';
  if (passed) return 'good';
  return 'meh';
}

const CENTER = new THREE.Vector3(0, 0, -4.6);
const WALK_MS = 1300;

interface Actor {
  a: Avatar;
  spot: THREE.Vector3;
  ry: number;
  role: Anim;
  target: number;
  last: number;
  fallen: boolean;
}

interface Flying {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t0: number;
  dur: number;
  spin: THREE.Vector3;
  landed: boolean;
}

export class EodScene {
  readonly group = new THREE.Group();
  private actors: Actor[] = [];
  private extras: Avatar[] = [];
  private flying: Flying[] = [];
  private flashes: { m: THREE.Mesh; until: number }[] = [];
  private confetti: THREE.InstancedMesh | null = null;
  private vel: Float32Array | null = null;
  private lights: THREE.PointLight[] = [];
  private foam: { m: THREE.InstancedMesh; v: Float32Array; life: Float32Array } | null = null;
  private start = performance.now();
  private rnd: () => number;
  private lastBang = 0;
  /** Γεωμετρίες που φτιάχτηκαν εδώ (οι υπόλοιπες είναι κοινές με το υπόλοιπο γραφείο). */
  private owned: THREE.BufferGeometry[] = [];

  private own<T extends THREE.Object3D>(o: T): T {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.isMesh) this.owned.push(m.geometry);
    });
    return o;
  }

  constructor(
    private scene: THREE.Scene,
    avatars: Avatar[],
    readonly spec: EodSpec,
    deskPos: { x: number; z: number }[],
    readonly ms = 7000,
    private gunners: Set<Avatar> = new Set(),
    private money: MoneyFx | null = null,
  ) {
    let n = 0;
    this.rnd = () => hash(spec.seed, 4242, n++) / 4294967296;
    scene.add(this.group);
    const { mood, level } = spec;
    const N = avatars.length;
    const fight = mood === 'bad' && level === 2 && N >= 2;
    avatars.forEach((a, i) => {
      a.setVisible(true);
      a.showTag(true);
      let spot: THREE.Vector3;
      if (fight) {
        // ζευγάρια αντιμέτωπα
        const pair = Math.floor(i / 2);
        const pairs = Math.ceil(N / 2);
        const px = (pair - (pairs - 1) / 2) * 1.9;
        spot = new THREE.Vector3(px + (i % 2 ? 0.45 : -0.45), 0, CENTER.z + (pair % 2 ? 0.7 : -0.5));
      } else {
        const ang = N === 1 ? Math.PI / 2 : Math.PI * (0.15 + (0.7 * i) / Math.max(1, N - 1));
        const rx = Math.min(3.6, 1 + 0.45 * N);
        spot = new THREE.Vector3(CENTER.x - Math.cos(ang) * rx, 0, CENTER.z + Math.sin(ang) * 1.3 - 0.4);
      }
      this.actors.push({ a, spot, ry: 0, role: 'idle', target: -1, last: -1, fallen: false });
    });
    // ρόλοι και στόχοι
    this.actors.forEach((ac, i) => {
      if (mood === 'bad') {
        if (level === 3) ac.role = 'shoot';
        else if (level === 2) ac.role = N >= 2 && i < (N & ~1) ? 'punch' : 'throw';
        else ac.role = level === 1 && i % 3 === 2 ? 'punch' : 'throw';
        ac.target = N > 1 ? (fight ? i ^ 1 : (i + 1 + Math.floor(this.rnd() * (N - 1))) % N) : -1;
        if (ac.target >= N) ac.target = (i + 1) % N;
      } else if (mood === 'meh') ac.role = 'sad';
      else if (this.gunners.has(ac.a) && this.money) ac.role = 'shoot';
      else if (level >= 2 && i % 2 === 0) ac.role = 'drink';
      else ac.role = level >= 1 ? (i % 2 ? 'dance' : 'cheer') : 'cheer';
      // κατεύθυνση: προς τον στόχο στον καβγά, προς την κάμερα στο πάρτι
      const tgt = ac.target >= 0 ? this.actors[ac.target]?.spot : null;
      ac.ry = tgt ? Math.atan2(tgt.x - ac.spot.x, tgt.z - ac.spot.z) : mood === 'bad' ? Math.PI : 0;
      if (ac.role === 'shoot' && mood !== 'bad') ac.a.hold(this.own(makeMoneyGun()));
      else if (ac.role === 'shoot') ac.a.hold(this.own(gun()));
      else if (ac.role === 'drink') ac.a.hold(this.own(bottle()));
      ac.a.target.copy(ac.spot);
      ac.a.targetRy = Math.atan2(ac.spot.x - ac.a.group.position.x, ac.spot.z - ac.a.group.position.z);
      ac.a.anim = 'walk';
    });
    if (mood === 'meh') this.actors.forEach((ac, i) => setTimeout(() => ac.a.emote(i % 2 ? '😒' : '🤦', Date.now()), 1500 + i * 200));
    // πάρτι: κομφετί, φώτα, κόσμος, χορεύτριες
    if (mood === 'good' || mood === 'great') {
      if (level >= 1 || mood === 'great') this.makeConfetti(level >= 2 ? 420 : 220);
      if (level >= 2) this.makeFoam();
      if (level >= 3 || (mood === 'great' && level >= 2)) this.makeDisco();
      if (mood === 'great') {
        const crowd = [3, 5, 8, 11][level];
        for (let k = 0; k < crowd; k++) this.addExtra(this.crowdLook(k), new THREE.Vector3((this.rnd() - 0.5) * 9, 0, CENTER.z + 1.4 + this.rnd() * 1.6), 'dance', null);
        const dancers = [1, 2, 3, 4][level];
        const top = deskPos.slice(0, 4);
        for (let k = 0; k < dancers; k++) {
          const d = top[k % top.length];
          this.addExtra(this.dancerLook(k), new THREE.Vector3(d.x, 0.79, d.z + 0.2), 'dance', ['#FF4FA3', '#F5C542', '#C0C0D0', '#9B59FF'][k % 4]);
        }
      }
      if (level >= 2) sfx.pop();
    }
  }

  private crowdLook(k: number): Look {
    const r = (m: number) => hash(this.spec.seed, 77, k, m) % m;
    return { suit: r(8), skin: r(6), hair: r(5), hairColor: r(6), hat: r(3) === 0 ? 1 + r(4) : 0, tie: r(8), glasses: r(3) };
  }

  private dancerLook(k: number): Look {
    return { suit: 4, skin: (k * 2) % 6, hair: 2, hairColor: [3, 0, 5, 2][k % 4], hat: 0, tie: 5, glasses: 0 };
  }

  private addExtra(look: Look, pos: THREE.Vector3, anim: Anim, sparkle: string | null) {
    const a = new Avatar(look, '', '#FFFFFF');
    a.showTag(false);
    a.group.position.copy(pos);
    a.target.copy(pos);
    a.targetRy = 0;
    a.group.rotation.y = 0;
    a.anim = anim;
    if (sparkle) {
      // λαμπερό ρούχο στις χορεύτριες
      const glam = new THREE.MeshLambertMaterial({ color: sparkle, emissive: new THREE.Color(sparkle), emissiveIntensity: 0.35 });
      a.setOutfit(glam);
    }
    this.group.add(a.group);
    this.extras.push(a);
  }

  private makeConfetti(count: number) {
    const geo = new THREE.PlaneGeometry(0.07, 0.11);
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const inst = this.own(new THREE.InstancedMesh(geo, m, count));
    const cols = ['#F5C542', '#FF5C5C', '#3DDC84', '#4FC3F7', '#C792EA', '#FFFFFF'].map((c) => new THREE.Color(c));
    const mx = new THREE.Matrix4();
    this.vel = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      mx.makeTranslation((this.rnd() - 0.5) * 10, 2 + this.rnd() * 3.5, CENTER.z + (this.rnd() - 0.5) * 6);
      inst.setMatrixAt(i, mx);
      inst.setColorAt(i, cols[i % cols.length]);
      this.vel[i * 4] = 0.5 + this.rnd() * 0.8;
      this.vel[i * 4 + 1] = this.rnd() * 6;
      this.vel[i * 4 + 2] = (this.rnd() - 0.5) * 0.6;
      this.vel[i * 4 + 3] = this.rnd() * 6;
    }
    this.confetti = inst;
    this.group.add(inst);
  }

  private makeFoam() {
    const count = 160;
    const inst = this.own(new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#FFF8E1' }), count));
    const mx = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) inst.setMatrixAt(i, mx);
    this.foam = { m: inst, v: new Float32Array(count * 6), life: new Float32Array(count) };
    this.group.add(inst);
  }

  private makeDisco() {
    const cols = ['#FF3FA4', '#3FA9FF', '#7CFF6B'];
    for (const c of cols) {
      const l = new THREE.PointLight(c, 6, 9, 1.5);
      l.position.set(0, 3.6, CENTER.z);
      this.group.add(l);
      this.lights.push(l);
    }
    // ντισκομπάλα
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshLambertMaterial({ color: '#E0E0E8', emissive: new THREE.Color('#888'), flatShading: true }));
    ball.position.set(0, 3.75, CENTER.z);
    this.own(ball);
    ball.name = 'discoball';
    this.group.add(ball);
  }

  private throwable(): THREE.Object3D {
    const lv = this.spec.level;
    if (lv === 0) return this.own(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat('#F4F4F0')));
    if (lv === 1) {
      if (this.rnd() < 0.55) {
        const mug = makeMug(['#E24B4B', '#F2F2F2', '#2B5DB2'][Math.floor(this.rnd() * 3)], false);
        mug.scale.setScalar(1.6);
        return mug;
      }
      return this.own(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), mat('#B22222')));
    }
    // καρέκλες και οθόνες
    return this.own(this.rnd() < 0.5
      ? new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.45), mat('#20232B'))
      : new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.05), mat('#111')));
  }

  /** Ενημέρωση ανά καρέ· επιστρέφει true όταν τελειώσει. */
  update(dt: number): boolean {
    const el = performance.now() - this.start;
    const acting = el > WALK_MS;
    const now = Date.now();
    for (const ac of this.actors) {
      if (acting && ac.a.anim === 'walk') {
        ac.a.anim = ac.role;
        ac.a.targetRy = ac.ry;
      }
      ac.a.update(dt, now, true);
      if (!acting || ac.fallen) continue;
      // ρίψεις
      if (ac.role === 'throw') {
        const idx = Math.floor(ac.a.cycle / 1.2);
        const k = (ac.a.cycle % 1.2) / 1.2;
        if (k > 0.62 && idx !== ac.last) {
          ac.last = idx;
          const from = ac.a.handWorld();
          const tgt = ac.target >= 0 ? this.actors[ac.target].a.group.position.clone().setY(1.3) : new THREE.Vector3(ac.spot.x * 0.5, 2.2, -7.8);
          tgt.x += (this.rnd() - 0.5) * 0.6;
          tgt.z += (this.rnd() - 0.5) * 0.6;
          const mesh = this.throwable();
          mesh.position.copy(from);
          this.group.add(mesh);
          this.flying.push({ mesh, from, to: tgt, t0: el, dur: 450 + this.rnd() * 200, spin: new THREE.Vector3(this.rnd() * 12, this.rnd() * 12, this.rnd() * 12), landed: false });
        }
      }
      // πυροβολισμοί
      if (ac.role === 'shoot' && this.spec.mood !== 'bad') {
        // πάρτι: «βρέχει» λεφτά πάνω από τους άλλους
        const idx = Math.floor(ac.a.cycle / 0.3);
        if (idx !== ac.last && this.money) {
          ac.last = idx;
          const dir = new THREE.Vector3(Math.sin(ac.a.group.rotation.y), 0.6, Math.cos(ac.a.group.rotation.y));
          this.money.burst(ac.a.handWorld(), dir, 6, 3);
        }
      } else if (ac.role === 'shoot') {
        const idx = Math.floor(ac.a.cycle / 0.6);
        if (idx !== ac.last) {
          ac.last = idx;
          const f = this.own(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFD54A' })));
          const dir = new THREE.Vector3(Math.sin(ac.a.group.rotation.y), 0, Math.cos(ac.a.group.rotation.y));
          f.position.copy(ac.a.handWorld()).addScaledVector(dir, 0.3);
          this.group.add(f);
          this.flashes.push({ m: f, until: el + 70 });
          if (el - this.lastBang > 120) {
            this.lastBang = el;
            sfx.bang();
          }
          // κάποιος «πέφτει» (καρτουνίστικα)
          const tg = this.actors[ac.target];
          if (tg && !tg.fallen && el > 2600 && this.rnd() < 0.18) {
            tg.fallen = true;
            tg.a.hold(null);
            tg.a.anim = 'fall';
          }
        }
      }
      if (ac.role === 'punch' && el > 3000 && !ac.fallen && this.rnd() < dt * 0.25) {
        ac.fallen = true;
        ac.a.anim = 'fall';
        sfx.thud();
      }
      // αφρός από τη σαμπάνια
      if (ac.role === 'drink' && this.foam && Math.floor(ac.a.cycle / 0.9) !== ac.last) {
        ac.last = Math.floor(ac.a.cycle / 0.9);
        this.spray(ac.a.handWorld().add(new THREE.Vector3(0, 0.25, 0)));
      }
    }
    for (const x of this.extras) x.update(dt, now, false);
    // ό,τι πετάει
    for (const f of this.flying) {
      if (f.landed) continue;
      const k = Math.min(1, (el - f.t0) / f.dur);
      f.mesh.position.lerpVectors(f.from, f.to, k);
      f.mesh.position.y += Math.sin(k * Math.PI) * 0.9;
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
      if (k >= 1) {
        f.landed = true;
        f.mesh.position.y = 0.05;
        if (this.flying.length < 30) sfx.thud();
      }
    }
    for (const fl of this.flashes) fl.m.visible = el < fl.until;
    this.updateConfetti(dt);
    this.updateFoam(dt);
    const t = el / 1000;
    this.lights.forEach((l, i) => l.position.set(Math.sin(t * 2 + i * 2.1) * 4, 3.4, CENTER.z + Math.cos(t * 2 + i * 2.1) * 2.5));
    const ball = this.group.getObjectByName('discoball');
    if (ball) ball.rotation.y = t * 2;
    return el >= this.ms;
  }

  private spray(at: THREE.Vector3) {
    const f = this.foam!;
    for (let i = 0, made = 0; i < f.life.length && made < 14; i++) {
      if (f.life[i] > 0) continue;
      f.life[i] = 0.9;
      f.v.set([at.x, at.y, at.z, (this.rnd() - 0.5) * 1.2, 2 + this.rnd() * 1.5, (this.rnd() - 0.5) * 1.2], i * 6);
      made++;
    }
  }

  private updateFoam(dt: number) {
    if (!this.foam) return;
    const { m, v, life } = this.foam;
    const mx = new THREE.Matrix4();
    for (let i = 0; i < life.length; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      v[i * 6 + 4] -= 6 * dt;
      v[i * 6] += v[i * 6 + 3] * dt;
      v[i * 6 + 1] += v[i * 6 + 4] * dt;
      v[i * 6 + 2] += v[i * 6 + 5] * dt;
      const s = life[i] > 0 ? 1 : 0;
      mx.makeScale(s, s, s).setPosition(v[i * 6], v[i * 6 + 1], v[i * 6 + 2]);
      m.setMatrixAt(i, mx);
    }
    m.instanceMatrix.needsUpdate = true;
  }

  private updateConfetti(dt: number) {
    if (!this.confetti || !this.vel) return;
    const mx = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const e = new THREE.Euler();
    for (let i = 0; i < this.confetti.count; i++) {
      this.confetti.getMatrixAt(i, mx);
      mx.decompose(pos, q, sc);
      pos.y -= this.vel[i * 4] * dt;
      pos.x += Math.sin(this.vel[i * 4 + 1] + pos.y * 3) * dt * 0.4 + this.vel[i * 4 + 2] * dt;
      if (pos.y < 0.02) pos.y = 4 + Math.random();
      this.vel[i * 4 + 3] += dt * 4;
      e.set(this.vel[i * 4 + 3], this.vel[i * 4 + 1] + this.vel[i * 4 + 3] * 0.5, 0);
      q.setFromEuler(e);
      mx.compose(pos, q, sc);
      this.confetti.setMatrixAt(i, mx);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  /** Κάμερα από μακριά, με αργή περιστροφή. */
  camera(cam: THREE.PerspectiveCamera) {
    const t = (performance.now() - this.start) / 1000;
    const portrait = cam.aspect < 1;
    cam.fov = portrait ? 72 : 55;
    cam.updateProjectionMatrix();
    const r = portrait ? 1.2 : 2.4;
    // κάτω από το ταβάνι (που είναι στα 4,2 μ.), από την άλλη άκρη του γραφείου
    cam.position.set(Math.sin(t * 0.35) * r, portrait ? 3.9 : 3.6, portrait ? 5.5 : 3.6);
    cam.lookAt(0, 1.0, CENTER.z);
  }

  dispose() {
    for (const ac of this.actors) ac.a.hold(null);
    for (const x of this.extras) x.dispose();
    this.owned.forEach((g) => g.dispose());
    this.group.removeFromParent();
    this.scene.remove(this.group);
  }
}

export function gun(): THREE.Group {
  const g = new THREE.Group();
  const black = mat('#141414');
  // κάννη κατά μήκος του χεριού (το χέρι «δείχνει» προς τα κάτω στο τοπικό του σύστημα)
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.045), black);
  barrel.position.set(0, -0.11, 0.02);
  g.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.1), black);
  grip.position.set(0, -0.01, -0.03);
  g.add(grip);
  return g;
}

function bottle(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10), mat('#1F5A2E'));
  body.position.y = 0.05;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, 0.1, 10), mat('#1F5A2E'));
  neck.position.y = 0.2;
  g.add(neck);
  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), mat('#E8B923'));
  foil.position.y = 0.26;
  g.add(foil);
  return g;
}
