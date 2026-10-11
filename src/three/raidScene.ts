// Η σύλληψη: σειρήνες, ελικόπτερο με ντουντούκα έξω από τα παράθυρα, η πόρτα σπάει, SWAT μπαίνουν
// από την πόρτα και πηδάνε μέσα από τα τζάμια, χέρια ψηλά, χειροπέδες, και μετά… κελί. Καρτουνίστικο.
import * as THREE from 'three';
import { Avatar, mat } from './avatar';
import { gun } from './eodScene';
import { ROOM } from './office';
import { DOOR } from './venue';
import { canvasTexture, FONT, roundRect } from './textures';
import { sfx } from '../audio';
import type { Look } from '../sim/engine';

const PLAYERS_Z = 0.2;

interface Swat {
  a: Avatar;
  path: THREE.Vector3[];
  t0: number;
  dur: number;
  jump: boolean;
  aimAt: THREE.Vector3;
}

export class RaidScene {
  readonly group = new THREE.Group();
  private start = performance.now();
  private swats: Swat[] = [];
  private heli: THREE.Group;
  private rotor: THREE.Object3D;
  private tailRotor: THREE.Object3D;
  private bubble: THREE.Sprite;
  private lights: THREE.PointLight[] = [];
  private shards: { m: THREE.Mesh; v: THREE.Vector3; r: THREE.Vector3 }[] = [];
  private dust: THREE.Mesh[] = [];
  private jail: THREE.Group | null = null;
  private fade: HTMLDivElement;
  private doorBroken = false;
  private glassBroken = false;
  private cuffed = false;
  private owned: THREE.BufferGeometry[] = [];

  constructor(
    scene: THREE.Scene,
    private players: Avatar[],
    private door: THREE.Group | null,
    private hide: THREE.Object3D[],
    container: HTMLElement,
    private reduceMotion: boolean,
  ) {
    scene.add(this.group);
    // οι παίκτες σηκώνονται και μαζεύονται στη μέση
    const n = players.length;
    players.forEach((a, i) => {
      a.setVisible(true);
      a.showTag(true);
      a.hold(null);
      const x = (i - (n - 1) / 2) * Math.min(1.3, 9 / Math.max(1, n));
      a.target.set(x, 0, PLAYERS_Z);
      a.targetRy = Math.PI / 2;
      a.anim = 'walk';
    });
    // ελικόπτερο
    this.heli = this.makeHeli();
    this.rotor = this.heli.getObjectByName('rotor')!;
    this.tailRotor = this.heli.getObjectByName('tail')!;
    this.heli.position.set(-45, 9, ROOM.maxZ + 22);
    this.group.add(this.heli);
    this.bubble = this.makeBubble();
    this.bubble.visible = false;
    this.group.add(this.bubble);
    // φάροι (κόκκινο/μπλε)
    for (const c of ['#FF2B2B', '#2B6BFF']) {
      const l = new THREE.PointLight(c, 0, 14, 1.4);
      l.position.set(ROOM.maxX - 2, 2.6, (DOOR.z0 + DOOR.z1) / 2 + (c === '#FF2B2B' ? -2 : 2));
      this.group.add(l);
      this.lights.push(l);
    }
    // SWAT: τρεις από την πόρτα, τρεις από τα παράθυρα
    const targets = players.map((a) => a.target.clone());
    const at = (k: number) => targets[k % Math.max(1, targets.length)] ?? new THREE.Vector3();
    for (let k = 0; k < 3; k++) {
      const a = this.makeSwat(k);
      const doorZ = (DOOR.z0 + DOOR.z1) / 2;
      const t = at(k);
      const end = new THREE.Vector3(t.x + 1.2, 0, t.z + 0.9 + k * 0.1);
      this.swats.push({
        a, jump: false, t0: 2300 + k * 350, dur: 2200, aimAt: t,
        path: [new THREE.Vector3(ROOM.maxX + 2.5, 0, doorZ), new THREE.Vector3(ROOM.maxX - 1.2, 0, doorZ), end],
      });
    }
    for (let k = 0; k < 3; k++) {
      const a = this.makeSwat(3 + k);
      const wx = [-8, 0, 8][k];
      const t = at(k + 1);
      this.swats.push({
        a, jump: true, t0: 2700 + k * 250, dur: 2100, aimAt: t,
        path: [new THREE.Vector3(wx, 1.2, ROOM.maxZ + 2.5), new THREE.Vector3(wx, 0, ROOM.maxZ - 1.5), new THREE.Vector3(t.x - 1.0, 0, t.z - 1.0 - k * 0.1)],
      });
    }
    for (const s of this.swats) {
      s.a.group.position.copy(s.path[0]);
      s.a.group.visible = false;
      this.group.add(s.a.group);
    }
    // σκοτείνιασμα για τη μετάβαση στο κελί
    this.fade = document.createElement('div');
    this.fade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;transition:opacity .6s;pointer-events:none;z-index:4';
    container.append(this.fade);
    sfx.siren();
  }

  private own<T extends THREE.Object3D>(o: T): T {
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.isMesh) this.owned.push(m.geometry);
    });
    return o;
  }

  private makeSwat(k: number): Avatar {
    const look: Look = { suit: 6, skin: (k * 3) % 6, hair: 5, hairColor: 0, hat: 0, tie: 6, glasses: 2 };
    const a = new Avatar(look, 'SWAT', '#1E3A8A');
    a.showTag(false);
    // κράνος και γιλέκο
    const helmet = this.own(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), mat('#111418')));
    helmet.position.set(0, 1.72, -0.01);
    a.group.add(helmet);
    const vest = this.own(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.3), mat('#20262E')));
    vest.position.set(0, 1.25, 0);
    a.group.add(vest);
    const tex = canvasTexture(128, 48, 1);
    tex.ctx.fillStyle = '#20262E';
    tex.ctx.fillRect(0, 0, 128, 48);
    tex.ctx.fillStyle = '#F2F2F2';
    tex.ctx.font = `900 30px ${FONT}`;
    tex.ctx.textAlign = 'center';
    tex.ctx.textBaseline = 'middle';
    tex.ctx.fillText('SWAT', 64, 26);
    tex.tex.needsUpdate = true;
    for (const z of [-0.152, 0.152]) {
      const label = this.own(new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.13), new THREE.MeshBasicMaterial({ map: tex.tex })));
      label.position.set(0, 1.3, z);
      if (z < 0) label.rotation.y = Math.PI;
      a.group.add(label);
    }
    a.hold(this.own(gun()));
    return a;
  }

  private makeHeli(): THREE.Group {
    const g = new THREE.Group();
    const body = mat('#1C2A44');
    const white = mat('#E9EEF5');
    const cab = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 12), body);
    cab.scale.set(1.5, 1, 1);
    g.add(cab);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#8FC3E8', transparent: true, opacity: 0.8 }));
    glass.position.set(0.9, 0.2, 0);
    glass.rotation.z = -0.9;
    g.add(glass);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 2.1), white);
    stripe.position.y = -0.25;
    g.add(stripe);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.12, 4.5, 10), body);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(-3.6, 0.25, 0);
    g.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.1), body);
    fin.position.set(-5.7, 0.7, 0);
    g.add(fin);
    const tail = new THREE.Group();
    tail.name = 'tail';
    tail.position.set(-5.8, 0.8, 0.12);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.04), mat('#2B2B2B'));
      b.rotation.z = (i * Math.PI) / 2;
      tail.add(b);
    }
    g.add(tail);
    const rotor = new THREE.Group();
    rotor.name = 'rotor';
    rotor.position.y = 1.55;
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.05, 0.28), mat('#2B2B2B'));
      b.rotation.y = (i * Math.PI) / 4;
      rotor.add(b);
    }
    g.add(rotor);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), mat('#2B2B2B'));
    mast.position.y = 1.3;
    g.add(mast);
    for (const z of [-0.9, 0.9]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), mat('#2B2B2B'));
      skid.rotation.z = Math.PI / 2;
      skid.position.set(0, -1.55, z);
      g.add(skid);
      for (const x of [-0.8, 0.8]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), mat('#2B2B2B'));
        leg.position.set(x, -1.25, z);
        g.add(leg);
      }
    }
    // «POLICE» στο πλάι
    const tex = canvasTexture(256, 64, 1);
    tex.ctx.fillStyle = '#1C2A44';
    tex.ctx.fillRect(0, 0, 256, 64);
    tex.ctx.fillStyle = '#FFFFFF';
    tex.ctx.font = `900 44px ${FONT}`;
    tex.ctx.textAlign = 'center';
    tex.ctx.textBaseline = 'middle';
    tex.ctx.fillText('POLICE', 128, 34);
    tex.tex.needsUpdate = true;
    for (const z of [-1.43, 1.43]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex.tex }));
      p.position.set(-0.3, 0.15, z);
      if (z < 0) p.rotation.y = Math.PI;
      g.add(p);
    }
    // προβολέας
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 14, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#FFF6C8', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    beam.name = 'beam';
    beam.position.set(0.5, -1, -7);
    beam.rotation.x = -Math.PI / 2 + 0.35;
    g.add(beam);
    // καθρέφτισμα: το ελικόπτερο κοιτάζει το γραφείο (βόρεια)
    g.rotation.y = Math.PI / 2;
    return this.own(g);
  }

  private makeBubble(): THREE.Sprite {
    const { tex, ctx } = canvasTexture(512, 160, 1);
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 8, 8, 496, 120, 30);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(220, 126);
    ctx.lineTo(250, 156);
    ctx.lineTo(270, 126);
    ctx.fill();
    ctx.fillStyle = '#B00020';
    ctx.font = `900 46px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📢 ΑΣΤΥΝΟΜΙΑ!', 256, 50);
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = '#111';
    ctx.fillText('ΚΑΝΕΙΣ ΝΑ ΜΗΝ ΚΟΥΝΗΘΕΙ!', 256, 96);
    tex.needsUpdate = true;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(5, 1.56, 1);
    s.renderOrder = 20;
    return s;
  }

  private breakGlass() {
    const m = new THREE.MeshBasicMaterial({ color: '#CFE8FA', transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.02, 0), new THREE.Vector3(0.04, 0.14, 0)]);
    g.computeVertexNormals();
    this.owned.push(g);
    for (const wx of [-8, 0, 8]) {
      for (let i = 0; i < 26; i++) {
        const sh = new THREE.Mesh(g, m);
        sh.position.set(wx + (Math.random() - 0.5) * 1.6, 1.2 + Math.random() * 1.4, ROOM.maxZ + 0.1);
        this.group.add(sh);
        this.shards.push({ m: sh, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, -1.5 - Math.random() * 3), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0) });
      }
    }
    sfx.thud();
    sfx.bang();
  }

  private breakDoor() {
    for (let i = 0; i < 10; i++) {
      const d = this.own(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#B8B2A6', transparent: true, opacity: 0.6, depthWrite: false })));
      d.position.set(ROOM.maxX - 0.4, 0.3 + Math.random() * 1.8, DOOR.z0 + Math.random() * (DOOR.z1 - DOOR.z0));
      this.group.add(d);
      this.dust.push(d);
    }
    sfx.bang();
    sfx.thud();
  }

  /** Ανά καρέ· επιστρέφει true όταν η σκηνή είναι στο κελί (μένει εκεί). */
  update(dt: number, cam: THREE.PerspectiveCamera) {
    const el = performance.now() - this.start;
    const t = el / 1000;
    const now = Date.now();
    // ελικόπτερο: έρχεται και αιωρείται έξω από τα νότια παράθυρα
    const k = Math.min(1, el / 2600);
    const ease = 1 - Math.pow(1 - k, 3);
    this.heli.position.set(-45 + 47 * ease, 9 - 5 * ease + Math.sin(t * 2) * 0.15, ROOM.maxZ + 22 - 7 * ease);
    this.rotor.rotation.y += dt * 30;
    this.tailRotor.rotation.z += dt * 40;
    this.bubble.visible = el > 1300 && el < 7800;
    this.bubble.position.copy(this.heli.position).add(new THREE.Vector3(0, 2.9, -1.5));
    // φάροι
    const on = Math.floor(t * 6) % 2 === 0;
    this.lights[0].intensity = el > 1800 ? (on ? 5 : 0) : 0;
    this.lights[1].intensity = el > 1800 ? (on ? 0 : 5) : 0;
    // πόρτα
    if (el > 2100 && !this.doorBroken) {
      this.doorBroken = true;
      this.breakDoor();
    }
    if (this.door) this.door.rotation.y = -1.7 * Math.min(1, Math.max(0, (el - 2100) / 160));
    if (el > 2650 && !this.glassBroken) {
      this.glassBroken = true;
      this.breakGlass();
    }
    for (const d of this.dust) {
      d.scale.multiplyScalar(1 + dt * 1.4);
      (d.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (d.material as THREE.MeshBasicMaterial).opacity - dt * 0.35);
      d.position.x -= dt * 0.6;
    }
    for (const s of this.shards) {
      if (s.m.position.y <= 0.01) continue;
      s.v.y -= 9 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.r.x * dt;
      s.m.rotation.y += s.r.y * dt;
      if (s.m.position.y < 0.01) s.m.position.y = 0.01;
    }
    // SWAT
    for (const s of this.swats) {
      const u = (el - s.t0) / s.dur;
      if (u < 0) continue;
      s.a.group.visible = true;
      const p = Math.min(1, u);
      const [a, b, c] = s.path;
      const split = s.jump ? 0.35 : 0.3;
      const pos = new THREE.Vector3();
      if (p < split) {
        const q = p / split;
        pos.lerpVectors(a, b, q);
        if (s.jump) pos.y = b.y + (1 - q) * a.y + Math.sin(q * Math.PI) * 1.1;
      } else pos.lerpVectors(b, c, (p - split) / (1 - split));
      s.a.group.position.copy(pos);
      const dir = p < 1 ? (p < split ? b.clone().sub(a) : c.clone().sub(b)) : s.aimAt.clone().sub(pos);
      s.a.group.rotation.y = Math.atan2(dir.x, dir.z);
      s.a.anim = p < 1 ? (s.jump && p < split ? 'cheer' : 'walk') : 'aim';
      s.a.update(dt, now, false);
    }
    // οι παίκτες: πρώτα πανικός, μετά χέρια ψηλά, μετά χειροπέδες
    for (const a of this.players) {
      if (el > 3200) {
        a.anim = el > 6300 ? 'cuffed' : 'hands';
        a.targetRy = Math.PI;
      }
      a.update(dt, now, true);
    }
    if (el > 6300 && !this.cuffed) {
      this.cuffed = true;
      sfx.thud();
    }
    // μετάβαση στο κελί
    if (el > 8000 && el < 8700) this.fade.style.opacity = '1';
    if (el > 8700 && !this.jail) this.buildJail();
    if (el > 9000) this.fade.style.opacity = '0';
    // κάμερα
    const sway = this.reduceMotion ? 0 : Math.sin(t * 0.5) * 0.4;
    cam.fov = cam.aspect < 1 ? 78 : 62;
    cam.updateProjectionMatrix();
    if (this.jail) {
      const far = Math.max(4.2, this.players.length * 0.55 + 2.6) * (cam.aspect < 1 ? 1.6 : 1);
      // από ψηλότερα, ώστε το κελί να φαίνεται στο πάνω μέρος (από κάτω ανεβαίνει η σύνοψη)
      cam.position.set(sway * 0.5, 2.3, far);
      cam.lookAt(0, 0.35, 0);
    } else if (cam.aspect < 1) {
      cam.position.set(-6 + sway, 3.8, -6.5);
      cam.lookAt(3, 0.9, 3.5);
    } else {
      cam.position.set(-9.5 + sway, 3.7, -6.8);
      cam.lookAt(2.5, 1.0, 3);
    }
  }

  /** Το κελί: γκρίζοι τοίχοι, κάγκελα, πορτοκαλί φόρμες. */
  private buildJail() {
    for (const o of this.hide) o.visible = false;
    for (const s of this.swats) s.a.group.visible = false;
    this.heli.visible = false;
    this.bubble.visible = false;
    for (const s of this.shards) s.m.visible = false;
    for (const d of this.dust) d.visible = false;
    for (const l of this.lights) l.intensity = 0;
    const j = new THREE.Group();
    const n = this.players.length;
    const w = Math.max(6, n * 1.1 + 2);
    const wallM = mat('#7D7F84');
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, 10), mat('#5C5E62'));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    j.add(floor);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 4, 0.3), wallM);
    back.position.set(0, 2, -1.6);
    j.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 3.4), wallM);
      side.position.set(sx * (w / 2), 2, 0);
      j.add(side);
    }
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 3.4), wallM);
    ceil.position.set(0, 4, 0);
    j.add(ceil);
    // σημάδια ημερών στον τοίχο και παραθυράκι με κάγκελα
    const tally = canvasTexture(256, 128, 1);
    tally.ctx.fillStyle = '#7D7F84';
    tally.ctx.fillRect(0, 0, 256, 128);
    tally.ctx.strokeStyle = '#2B2B2B';
    tally.ctx.lineWidth = 4;
    for (let g = 0; g < 5; g++) {
      for (let i = 0; i < 4; i++) {
        tally.ctx.beginPath();
        tally.ctx.moveTo(20 + g * 46 + i * 8, 30);
        tally.ctx.lineTo(20 + g * 46 + i * 8, 90);
        tally.ctx.stroke();
      }
      tally.ctx.beginPath();
      tally.ctx.moveTo(14 + g * 46, 80);
      tally.ctx.lineTo(52 + g * 46, 40);
      tally.ctx.stroke();
    }
    tally.tex.needsUpdate = true;
    const marks = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: tally.tex }));
    marks.position.set(-w / 2 + 1.4, 2.3, -1.44);
    j.add(marks);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ color: '#BFE3FF' }));
    win.position.set(w / 2 - 1.5, 3.1, -1.44);
    j.add(win);
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), mat('#2B2B2B'));
      b.position.set(w / 2 - 1.5 + i * 0.17, 3.1, -1.42);
      j.add(b);
    }
    // κρεβάτι και λεκάνη
    const bunk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.8), mat('#4A4D52'));
    bunk.position.set(w / 2 - 1.4, 0.55, -1.0);
    j.add(bunk);
    const toilet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.45, 12), mat('#F2F2F2'));
    toilet.position.set(-w / 2 + 0.6, 0.23, -1.1);
    j.add(toilet);
    // κάγκελα μπροστά
    const barM = mat('#2E3136');
    for (let x = -w / 2 + 0.15; x <= w / 2; x += 0.22) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 4, 6), barM);
      bar.position.set(x, 2, 1.55);
      j.add(bar);
    }
    for (const y of [0.15, 2.2, 3.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), barM);
      rail.position.set(0, y, 1.55);
      j.add(rail);
    }
    const light = new THREE.PointLight('#FFE8B0', 8, 12, 1.2);
    light.position.set(0, 3.4, 0.6);
    j.add(light);
    // το φως του γραφείου κρύφτηκε μαζί του: δικό τους φως στο κελί
    j.add(new THREE.HemisphereLight('#F2EEE6', '#6A6A6A', 2.3));
    const key = new THREE.DirectionalLight('#FFFFFF', 1.0);
    key.position.set(2, 5, 6);
    j.add(key);
    // οι παίκτες με πορτοκαλί φόρμες
    const orange = new THREE.MeshLambertMaterial({ color: '#F07A1A' });
    this.players.forEach((a, i) => {
      const x = (i - (n - 1) / 2) * 1.05;
      a.group.position.set(x, 0, -0.2 + (i % 2) * 0.35);
      a.target.copy(a.group.position);
      a.group.rotation.y = 0;
      a.targetRy = 0;
      a.anim = i % 3 === 0 ? 'sad' : i % 3 === 1 ? 'idle' : 'hands';
      // το κοστούμι γίνεται φόρμα φυλακής
      a.setOutfit(orange);
    });
    this.own(j);
    this.group.add(j);
    this.jail = j;
  }

  dispose() {
    this.fade.remove();
    this.owned.forEach((g) => g.dispose());
    this.group.removeFromParent();
  }
}
