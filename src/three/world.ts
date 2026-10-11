// Η 3D σκηνή: renderer, κάμερα (πρώτο πρόσωπο ή σταθερή), avatars, πίνακας, τελικές σκηνές.
import * as THREE from 'three';
import type { Look } from '../sim/engine';
import type { Pose } from '../net/transport';
import { Avatar, mat, PLAYER_COLORS } from './avatar';
import { FirstPerson, collide } from './controls';
import { buildOffice, ROOM, type Interactable, type Office } from './office';
import { canvasTexture, drawBoard, drawMonitor, drawTombstone, type BoardData } from './textures';

export type ViewMode = 'first' | 'third' | 'overview';

export interface WorldOptions {
  view: ViewMode;
  quality: 'low' | 'high';
  reduceMotion: boolean;
  sensitivity: () => number;
  shopTitle: string;
  shopSub: string;
}

export interface WorldPlayer {
  uid: string;
  name: string;
  look: Look;
  desk: number;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  readonly office: Office;
  private avatars = new Map<string, Avatar>();
  private players = new Map<string, WorldPlayer>();
  private poses = new Map<string, Pose>();
  private fp: FirstPerson | null = null;
  private raf = 0;
  private last = performance.now();
  private ro: ResizeObserver;
  private uiOpen = false;
  private ending: { kind: 'podium' | 'grave'; group: THREE.Group; confetti?: THREE.InstancedMesh; vel?: Float32Array } | null = null;
  private emoteSeen = new Map<string, number>();
  myUid = '';
  view: ViewMode;
  /** Ο παίκτης μου κάθεται (σταθερή κάμερα ή τερματικό ανοιχτό σε γραφείο). */
  private sitAt: number | null = null;
  private celebrateUntil = 0;
  private tagK = 1;
  onFrame: (dt: number) => void = () => {};
  onInteract: () => void = () => {};
  /** Ο παίκτης έφυγε από το «κλείδωμα» του ποντικιού με Esc. */
  onEscape: () => void = () => {};

  constructor(private container: HTMLElement, private opts: WorldOptions) {
    this.view = opts.view;
    const high = opts.quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'scene';
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#141A26');
    this.scene.fog = new THREE.Fog('#141A26', 22, 45);
    this.office = buildOffice(opts.shopTitle, opts.shopSub, high);
    this.scene.add(this.office.group);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.setView(opts.view);
  }

  setView(v: ViewMode) {
    this.view = v;
    if (v !== 'overview' && !this.fp) {
      this.fp = new FirstPerson(this.renderer.domElement, this.opts.sensitivity);
      this.fp.onInteract = () => this.onInteract();
      this.fp.onEscape = () => this.onEscape();
      const seat = this.mySeat();
      this.fp.pos.set(seat.x, 0, seat.z + 0.9);
      this.fp.yaw = 0;
      this.fp.setEnabled(!this.uiOpen);
    } else if (v === 'overview' && this.fp) {
      this.fp.dispose();
      this.fp = null;
    }
    this.avatars.get(this.myUid)?.setVisible(v !== 'first' || !!this.ending);
  }

  private mySeat() {
    const me = this.players.get(this.myUid);
    return this.office.seats[me?.desk ?? 0] ?? this.office.seats[0];
  }

  setPlayers(list: WorldPlayer[]) {
    const keep = new Set(list.map((p) => p.uid));
    for (const [uid, a] of this.avatars) {
      if (!keep.has(uid)) {
        a.dispose();
        this.avatars.delete(uid);
      }
    }
    for (const p of list) {
      const old = this.players.get(p.uid);
      this.players.set(p.uid, p);
      const changed = !old || old.name !== p.name || JSON.stringify(old.look) !== JSON.stringify(p.look);
      if (!this.avatars.has(p.uid) || changed) {
        this.avatars.get(p.uid)?.dispose();
        const a = new Avatar(p.look, p.name, PLAYER_COLORS[p.desk % PLAYER_COLORS.length]);
        const seat = this.office.seats[p.desk] ?? this.office.seats[0];
        a.group.position.set(seat.x, 0, seat.z);
        a.target.set(seat.x, 0, seat.z);
        a.targetRy = seat.ry;
        a.group.rotation.y = seat.ry;
        a.anim = 'sit';
        if (p.uid === this.myUid) {
          a.showTag(false);
          a.setVisible(this.view !== 'first');
        }
        a.setTagScale(this.tagK);
        this.avatars.set(p.uid, a);
        this.scene.add(a.group);
      }
    }
    if (this.fp && !list.some((p) => p.uid === this.myUid)) return;
  }

  setPoses(poses: Record<string, Pose>, now: number) {
    for (const [uid, p] of Object.entries(poses)) {
      if (uid === this.myUid) continue;
      this.poses.set(uid, p);
      if (p.e && p.et && p.et !== this.emoteSeen.get(uid) && now - p.et < 4000) {
        this.emoteSeen.set(uid, p.et);
        this.avatars.get(uid)?.emote(p.e, now);
      }
    }
  }

  /** Η θέση μου για αποστολή στους άλλους. */
  myPose(): Pose {
    if (this.fp && this.sitAt === null) {
      return { x: this.fp.pos.x, z: this.fp.pos.z, ry: this.fp.bodyRy, a: this.fp.moving ? 1 : 0 };
    }
    const seat = this.sitAt !== null ? this.office.seats[this.sitAt] : this.mySeat();
    return { x: seat.x, z: seat.z, ry: seat.ry, a: 2 };
  }

  emoteMine(e: string, now: number) {
    this.avatars.get(this.myUid)?.emote(e, now);
  }

  celebrate(ms = 2500) {
    this.celebrateUntil = performance.now() + ms;
  }

  /** Ανοιχτό πάνελ: σταματά η κίνηση· σε γραφείο ο παίκτης κάθεται. */
  setUiOpen(open: boolean, deskIndex: number | null = null) {
    this.uiOpen = open;
    this.fp?.setEnabled(!open && !this.ending);
    this.sitAt = open && this.fp ? deskIndex : null;
  }

  nearInteractable(): Interactable | null {
    if (!this.fp) return null;
    let best: Interactable | null = null;
    let bd = Infinity;
    for (const it of this.office.interactables) {
      const d = Math.hypot(it.x - this.fp.pos.x, it.z - this.fp.pos.z);
      if (d < it.r && d < bd) {
        best = it;
        bd = d;
      }
    }
    return best;
  }

  setBoard(d: BoardData) {
    drawBoard(this.office.board.ctx, d);
    this.office.board.tex.needsUpdate = true;
  }

  setMonitor(i: number, ticker: string, color: string, series: number[], label: string) {
    const m = this.office.monitors[i];
    if (!m) return;
    drawMonitor(m.ctx, ticker, color, series, label);
    m.tex.needsUpdate = true;
  }

  setShopOpen(open: boolean) {
    (this.office.shopGlow.material as THREE.MeshBasicMaterial).opacity = open ? 0.6 : 0.12;
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt, now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(dt: number, now: number) {
    const wall = Date.now();
    if (this.fp && !this.ending) this.fp.update(dt, this.office.colliders);
    for (const [uid, a] of this.avatars) {
      if (this.ending) {
        a.update(dt, wall, false);
        continue;
      }
      if (uid === this.myUid) {
        const p = this.myPose();
        a.group.position.set(p.x, 0, p.z);
        a.group.rotation.y = p.ry;
        a.anim = now < this.celebrateUntil ? 'cheer' : p.a === 2 ? 'sit' : p.a === 1 ? 'walk' : 'idle';
        a.update(dt, wall, false);
        continue;
      }
      const p = this.poses.get(uid);
      const pl = this.players.get(uid);
      if (p) {
        a.target.set(p.x, 0, p.z);
        a.targetRy = p.ry;
        a.anim = p.a === 2 ? 'sit' : p.a === 1 ? 'walk' : 'idle';
        if (p.e && p.et && wall - p.et < 2500 && p.a !== 2) a.anim = 'cheer';
      } else if (pl) {
        const s = this.office.seats[pl.desk] ?? this.office.seats[0];
        a.target.set(s.x, 0, s.z);
        a.targetRy = s.ry;
        a.anim = 'sit';
      }
      a.update(dt, wall);
    }
    this.updateEnding(dt);
    this.updateCamera(dt, now);
    const tagK = this.ending || this.fp ? 1 : this.camera.aspect < 1 ? 1.9 : 1.5;
    if (tagK !== this.tagK) {
      this.tagK = tagK;
      for (const a of this.avatars.values()) a.setTagScale(tagK);
    }
    this.onFrame(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(_dt: number, now: number) {
    const aspect = this.camera.aspect;
    if (this.ending) {
      // πάνω από την μπροστινή σειρά γραφείων, κοιτάζοντας το βάθρο ή τους τάφους
      const sway = this.opts.reduceMotion ? 0 : Math.sin(now / 2200) * 0.5;
      const portrait = aspect < 1;
      // το σκηνικό στο πάνω μέρος της οθόνης· από κάτω ανεβαίνει η σύνοψη
      this.camera.fov = portrait ? 70 : 50;
      this.camera.position.set(sway * (portrait ? 0.3 : 1), portrait ? 3.9 : 3.7, portrait ? -0.4 : 1.0);
      this.camera.lookAt(0, portrait ? -2.4 : 0.6, this.office.stage.z);
      this.camera.updateProjectionMatrix();
      return;
    }
    if (this.fp && this.view === 'third') {
      // τρίτο πρόσωπο: η κάμερα ακολουθεί από πίσω και λίγο πάνω από τον παίκτη
      this.camera.fov = 66;
      this.camera.updateProjectionMatrix();
      const { yaw, pitch, pos } = this.fp;
      const fx = -Math.sin(yaw) * Math.cos(pitch);
      const fy = Math.sin(pitch);
      const fz = -Math.cos(yaw) * Math.cos(pitch);
      const dist = 3.2;
      const tx = pos.x;
      const ty = 1.55;
      const tz = pos.z;
      let cx = tx - fx * dist;
      let cy = ty - fy * dist + 0.7;
      let cz = tz - fz * dist;
      cx = Math.max(ROOM.minX + 0.2, Math.min(ROOM.maxX - 0.2, cx));
      cz = Math.max(ROOM.minZ + 0.2, Math.min(ROOM.maxZ - 0.2, cz));
      cy = Math.max(0.5, Math.min(ROOM.height - 0.2, cy));
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(tx + fx * 2, ty + fy * 2 + 0.2, tz + fz * 2);
      return;
    }
    if (this.fp) {
      this.camera.fov = 70;
      this.camera.updateProjectionMatrix();
      this.fp.apply(this.camera);
      return;
    }
    // σταθερή κάμερα: όλο το γραφείο με τον πίνακα στο βάθος
    const portrait = aspect < 1;
    this.camera.fov = portrait ? 64 : 62;
    this.camera.updateProjectionMatrix();
    const sway = this.opts.reduceMotion ? 0 : Math.sin(now / 5000) * 0.4;
    if (portrait) {
      // από ψηλά (μέσα από το ταβάνι, που δεν φαίνεται από πάνω) για να χωράνε όλα τα γραφεία
      this.camera.position.set(sway * 0.3, 23, 5.8);
      this.camera.lookAt(0, 0, -1.4);
    } else {
      this.camera.position.set(sway, 10, 7.7);
      this.camera.lookAt(0, 0, -1.4);
    }
  }

  /** Τελική σκηνή: βάθρο με τους 3 καλύτερους ή τάφοι για όλους. */
  showEnding(kind: 'podium' | 'grave', ranking: string[]) {
    if (this.ending) return;
    this.fp?.setEnabled(false);
    const g = new THREE.Group();
    const st = this.office.stage;
    g.position.copy(st);
    this.scene.add(g);
    this.avatars.get(this.myUid)?.setVisible(true);
    this.avatars.get(this.myUid)?.showTag(true);
    if (kind === 'podium') {
      const steps: [number, number, string][] = [[0, 0.9, '#E8B923'], [-1.25, 0.6, '#C0C6CF'], [1.25, 0.4, '#C9824A']];
      steps.forEach(([x, hgt, c], i) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, hgt, 1.2), mat(c));
        b.position.set(x, hgt / 2, 0);
        b.castShadow = b.receiveShadow = true;
        g.add(b);
        const uid = ranking[i];
        const a = uid ? this.avatars.get(uid) : undefined;
        if (a) {
          a.group.position.set(st.x + x, hgt, st.z);
          a.group.rotation.y = 0;
          a.anim = 'podium';
        }
      });
      ranking.slice(3).forEach((uid, k) => {
        const a = this.avatars.get(uid);
        if (!a) return;
        a.group.position.set(st.x + (k % 2 ? 1 : -1) * (2.5 + Math.floor(k / 2) * 0.9), 0, st.z + 0.8);
        a.group.rotation.y = 0;
        a.anim = 'cheer';
      });
      // κομφετί
      const n = this.opts.reduceMotion ? 60 : 260;
      const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
      const colors = ['#F5C542', '#4FC3F7', '#FF7A7A', '#7CE38B', '#C792EA', '#FFFFFF'];
      const vel = new Float32Array(n * 4);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m.makeTranslation((Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 4);
        conf.setMatrixAt(i, m);
        conf.setColorAt(i, new THREE.Color(colors[i % colors.length]));
        vel[i * 4] = (Math.random() - 0.5) * 0.4;
        vel[i * 4 + 1] = 0.5 + Math.random() * 0.8;
        vel[i * 4 + 2] = (Math.random() - 0.5) * 0.4;
        vel[i * 4 + 3] = Math.random() * 6;
      }
      g.add(conf);
      this.ending = { kind, group: g, confetti: conf, vel };
    } else {
      this.office.lights.hemi.intensity = 0.45;
      this.office.lights.hemi.color.set('#FF8A8A');
      this.office.lights.sun.intensity = 0.5;
      this.office.lights.sun.color.set('#FF6B6B');
      for (const p of this.office.lights.panels) (p.material as THREE.MeshBasicMaterial).color.set('#552222');
      const ids = ranking.length ? ranking : [this.myUid];
      ids.forEach((uid, i) => {
        const gap = Math.min(1.5, 11 / Math.max(1, ids.length));
        const x = (i - (ids.length - 1) / 2) * gap;
        const stone = new THREE.Group();
        const tex = canvasTexture(256, 320);
        drawTombstone(tex.ctx, this.players.get(uid)?.name ?? '');
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.22), [
          mat('#8E949C'), mat('#8E949C'), mat('#8E949C'), mat('#8E949C'),
          new THREE.MeshLambertMaterial({ map: tex.tex }), mat('#8E949C'),
        ]);
        slab.position.y = 0.55;
        slab.castShadow = true;
        stone.add(slab);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.22, 16, 1, false, 0, Math.PI), mat('#8E949C'));
        top.rotation.z = Math.PI / 2;
        top.rotation.y = Math.PI / 2;
        top.position.y = 1.1;
        stone.add(top);
        const dirt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.6), mat('#4A3626'));
        dirt.position.set(0, 0.06, 0.95);
        stone.add(dirt);
        stone.position.set(x, 0, -0.4);
        g.add(stone);
        const a = this.avatars.get(uid);
        if (a) {
          a.group.position.set(st.x + x, 0.12, st.z + 0.15);
          a.group.rotation.y = Math.PI;
          a.anim = 'fall';
        }
      });
      this.ending = { kind, group: g };
    }
  }

  private updateEnding(dt: number) {
    const e = this.ending;
    if (!e?.confetti || !e.vel) return;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const eul = new THREE.Euler();
    for (let i = 0; i < e.confetti.count; i++) {
      e.confetti.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      p.x += e.vel[i * 4] * dt;
      p.y -= e.vel[i * 4 + 1] * dt;
      p.z += e.vel[i * 4 + 2] * dt;
      e.vel[i * 4 + 3] += dt * 4;
      if (p.y < 0) p.y = 5 + Math.random();
      eul.set(e.vel[i * 4 + 3], e.vel[i * 4 + 3] * 0.7, 0);
      q.setFromEuler(eul);
      m.compose(p, q, s);
      e.confetti.setMatrixAt(i, m);
    }
    e.confetti.instanceMatrix.needsUpdate = true;
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Μετακίνηση σε σημείο (π.χ. κοντά στο κατάστημα) για το πρώτο πρόσωπο. */
  teleport(x: number, z: number, yaw: number) {
    if (!this.fp) return;
    this.fp.pos.set(x, 0, z);
    collide(this.fp.pos, this.office.colliders);
    this.fp.yaw = yaw;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.fp?.dispose();
    for (const a of this.avatars.values()) a.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
