// Η 3D σκηνή: renderer, κάμερα (πρώτο πρόσωπο ή σταθερή), avatars, πίνακας, τελικές σκηνές.
import * as THREE from 'three';
import type { Look } from '../sim/engine';
import type { Pose } from '../net/transport';
import { Avatar, mat, PLAYER_COLORS } from './avatar';
import { animateAquarium, DECOR_SPOTS, makeAquarium, makeDecor, makeDoll, makeKourabiedes, makeProEspresso, makeSofa } from './props';
import { Tiger } from './tiger';
import { buildVenue, type VenueBuild } from './venue';
import { EodScene, type EodSpec } from './eodScene';
import { RaidScene } from './raidScene';
import { makeMoneyGun, MoneyFx } from './moneyFx';
import { SlotMachine } from './slotMachine';
import { NewsTv } from './newsTv';
import type { SlotState } from '../sim/slot';
import type { DecorId, UpgradeId } from '../sim/office';
import { FirstPerson, collide } from './controls';
import { buildOffice, MAX_DESK_SCREENS, ROOM, SCREEN_LAYOUT, type Interactable, type Office } from './office';
import { canvasTexture, drawBoard, drawMonitor, drawNeon, drawNewsScreen, drawTombstone, setTextureScale, type BoardData } from './textures';
import { pixelRatioFor, type Resolution } from '../settings';

export type ViewMode = 'first' | 'third' | 'overview';

export interface WorldOptions {
  view: ViewMode;
  quality: 'low' | 'high';
  resolution: Resolution;
  reduceMotion: boolean;
  sensitivity: () => number;
  shopTitle: string;
  shopSub: string;
  neonText: string;
  tv: { breaking: string; live: string; brand: string };
}

export interface WorldPlayer {
  uid: string;
  name: string;
  look: Look;
  desk: number;
  /** Ρολόι (0–2) και όπλο με λεφτά. */
  watch?: number;
  gun?: boolean;
}

/** Το emote που σημαίνει «βρέχω λεφτά» (περνάει στους άλλους μαζί με τη θέση). */
export const MONEY_EMOTE = '💸';
/** Κωλοδάχτυλο: «🖕>uid» (σε ποιον). */
export const FINGER = '🖕>';

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 320);
  readonly office: Office;
  private avatars = new Map<string, Avatar>();
  private players = new Map<string, WorldPlayer>();
  private poses = new Map<string, Pose>();
  private poseAt = new Map<string, { t: number; vx: number; vz: number }>();
  private camPos = new THREE.Vector3();
  private camInit = false;
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
  private decorKey = '';
  private upgradesKey = '';
  private upgrades = new Map<UpgradeId, THREE.Group>();
  private baseColliders: number;
  private coreColliders: number;
  private venue: VenueBuild | null = null;
  private venueLevel = -1;
  private screensKey = '';
  private eod: EodScene | null = null;
  private raid: RaidScene | null = null;
  /** Περιγράμματα: ένα ανά γραφείο και το τελευταίο για το κατάστημα. */
  private outlines: THREE.Mesh[] = [];
  readonly money: MoneyFx;
  /** Ποιος «βρέχει» λεφτά αυτή τη στιγμή (ως πότε, πότε η επόμενη ριπή). */
  private gunFx = new Map<string, { until: number; next: number }>();
  onEodEnd: () => void = () => {};
  private aquarium: THREE.Group | null = null;
  private slot: SlotMachine | null = null;
  private tv: NewsTv;
  private slotSeen = -1;
  /** Θέση του κουλοχέρη (δυτικός τοίχος, κοιτάζει προς τα γραφεία). */
  static readonly SLOT_POS = { x: -11.3, z: 5.6 };
  private tiger: Tiger | null = null;
  private petSeed = 1;
  private speedBoost = 1;
  private newsScreens: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D }[] = [];
  private lastHeadline = '';
  onFrame: (dt: number) => void = () => {};
  onInteract: () => void = () => {};
  /** Ο παίκτης έφυγε από το «κλείδωμα» του ποντικιού με Esc. */
  onEscape: () => void = () => {};

  constructor(private container: HTMLElement, private opts: WorldOptions) {
    this.view = opts.view;
    const high = opts.quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: 'high-performance' });
    const ratio = pixelRatioFor(opts.resolution);
    this.renderer.setPixelRatio(ratio);
    setTextureScale(ratio >= 1.5 ? 2 : 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'scene';
    container.append(this.renderer.domElement);
    this.office = buildOffice(opts.shopTitle, opts.shopSub, high);
    this.money = new MoneyFx(this.scene);
    // τηλεόραση με δελτίο ειδήσεων δίπλα στον πίνακα (από την πολυκατοικία και πάνω)
    this.tv = new NewsTv(opts.tv);
    this.tv.group.position.set(5.85, 2.3, ROOM.minZ + 0.1);
    this.tv.group.visible = false;
    this.scene.add(this.tv.group);
    // λευκό περίγραμμα σε ό,τι μπορείς να χρησιμοποιήσεις όταν είσαι κοντά (οθόνη γραφείου, κατάστημα)
    const line = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.BackSide });
    this.outlines = this.office.deskScreens.map((list) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.47, 0.04), line);
      o.scale.set(1.08, 1.12, 1.6);
      o.visible = false;
      list[0].add(o);
      return o;
    });
    const shopOutline = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.9), line);
    shopOutline.position.set(0, 1.15, 0);
    shopOutline.scale.set(1.05, 1.03, 1.08);
    shopOutline.visible = false;
    this.office.shopGlow.parent?.add(shopOutline);
    this.outlines.push(shopOutline);
    this.coreColliders = this.office.colliders.length;
    this.baseColliders = this.coreColliders;
    this.scene.add(this.office.group);
    this.setVenue(0);
    this.setScreens([]);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.setView(opts.view);
  }

  /** Αλλαγή ανάλυσης την ώρα του παιχνιδιού (χωρίς να ξαναφτιαχτεί η σκηνή). */
  setResolution(r: Resolution) {
    this.renderer.setPixelRatio(pixelRatioFor(r));
    this.resize();
  }

  setView(v: ViewMode) {
    this.view = v;
    if (v !== 'overview' && !this.fp) {
      this.fp = new FirstPerson(this.renderer.domElement, this.opts.sensitivity);
      this.fp.speedMul = this.speedBoost;
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
    this.syncCeiling();
  }

  /** Από ψηλά (σταθερή κάμερα) δεν φαίνεται ό,τι κρέμεται από το ταβάνι. */
  private syncCeiling() {
    if (this.venue) this.venue.ceiling.visible = this.view !== 'overview' || !!this.ending;
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
      this.avatars.get(p.uid)?.setWatch(p.watch ?? 0);
    }
    if (this.fp && !list.some((p) => p.uid === this.myUid)) return;
  }

  setPoses(poses: Record<string, Pose>, now: number) {
    for (const [uid, p] of Object.entries(poses)) {
      if (uid === this.myUid) continue;
      // ταχύτητα από τις δύο τελευταίες θέσεις: προβλέπουμε λίγο μπροστά ώσπου να έρθει η επόμενη
      const prev = this.poses.get(uid);
      const old = this.poseAt.get(uid);
      const t = performance.now();
      if (prev && old && (prev.x !== p.x || prev.z !== p.z)) {
        const dtp = Math.max(0.05, (t - old.t) / 1000);
        this.poseAt.set(uid, { t, vx: (p.x - prev.x) / dtp, vz: (p.z - prev.z) / dtp });
      } else if (!old || prev?.x !== p.x || prev?.z !== p.z) this.poseAt.set(uid, { t, vx: 0, vz: 0 });
      this.poses.set(uid, p);
      if (p.e && p.et && p.et !== this.emoteSeen.get(uid) && now - p.et < 4000) {
        this.emoteSeen.set(uid, p.et);
        if (p.e === MONEY_EMOTE) this.startMoneyGun(uid);
        else if (p.e.startsWith(FINGER)) this.flipOff(uid, p.e.slice(FINGER.length));
        else this.avatars.get(uid)?.emote(p.e, now);
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

  /** Κάποιος κάνει κωλοδάχτυλο σε κάποιον: ο ένας χειρονομεί, ο άλλος θυμώνει. */
  onFingered: (from: string) => void = () => {};
  flipOff(from: string, to: string) {
    this.avatars.get(from)?.gesture('finger', 2600);
    setTimeout(() => this.avatars.get(to)?.gesture('angry', 2200), 500);
    if (to === this.myUid) this.onFingered(from);
  }

  /** Ο πιο κοντινός συνάδελφος μπροστά μου (ως 6 μ., μέσα σε ±50°). */
  facing(): string | null {
    const me = this.myPose();
    const yaw = this.fp && this.sitAt === null ? this.fp.yaw : me.ry;
    const fx = this.fp && this.sitAt === null ? -Math.sin(yaw) : Math.sin(yaw);
    const fz = this.fp && this.sitAt === null ? -Math.cos(yaw) : Math.cos(yaw);
    let best: string | null = null;
    let bd = Infinity;
    for (const [uid, a] of this.avatars) {
      if (uid === this.myUid || !a.group.visible) continue;
      const dx = a.group.position.x - me.x;
      const dz = a.group.position.z - me.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3 || d > 6) continue;
      const cos = (dx * fx + dz * fz) / d;
      const score = d * (2 - cos);
      if (cos > 0.64 && score < bd) {
        bd = score;
        best = uid;
      }
    }
    // κανείς μπροστά: ο πιο κοντινός σε 4 μ.
    if (!best) {
      for (const [uid, a] of this.avatars) {
        if (uid === this.myUid) continue;
        const d = Math.hypot(a.group.position.x - me.x, a.group.position.z - me.z);
        if (d < 4 && d < bd) {
          bd = d;
          best = uid;
        }
      }
    }
    return best;
  }

  /** Το ρολόι τοίχου δείχνει την ώρα της αγοράς: 09:30 στο άνοιγμα, 16:00 στο κλείσιμο. */
  setMarketTime(frac: number) {
    const c = this.venue?.clock;
    if (!c) return;
    const mins = 9.5 * 60 + Math.max(0, Math.min(1, frac)) * 6.5 * 60;
    c.minute.rotation.z = -((mins % 60) / 60) * Math.PI * 2;
    c.hour.rotation.z = -(((mins / 60) % 12) / 12) * Math.PI * 2;
  }

  /** Είναι ο παίκτης κοντά μου (το συννεφάκι του φαίνεται); */
  isNear(uid: string): boolean {
    const a = this.avatars.get(uid);
    if (!a || !this.fp) return !!a && this.view === 'overview';
    const me = this.myPose();
    return Math.hypot(a.group.position.x - me.x, a.group.position.z - me.z) < 9;
  }

  /** Συννεφάκι με όσα λέει ένας παίκτης. */
  say(uid: string, text: string, now: number) {
    this.avatars.get(uid)?.say(text, now);
  }

  emoteMine(e: string, now: number) {
    if (e === MONEY_EMOTE) return this.startMoneyGun(this.myUid);
    if (e.startsWith(FINGER)) return this.flipOff(this.myUid, e.slice(FINGER.length));
    this.avatars.get(this.myUid)?.emote(e, now);
  }

  /** Το όπλο με λεφτά: 2,5″ ριπές χαρτονομισμάτων μπροστά από τον παίκτη. */
  startMoneyGun(uid: string) {
    const a = this.avatars.get(uid);
    if (!a) return;
    if (!this.gunFx.has(uid)) a.hold(makeMoneyGun());
    this.gunFx.set(uid, { until: performance.now() + 2500, next: 0 });
  }

  private updateMoneyGuns(now: number) {
    for (const [uid, g] of this.gunFx) {
      const a = this.avatars.get(uid);
      if (!a || now > g.until) {
        a?.hold(null);
        this.gunFx.delete(uid);
        continue;
      }
      if (now < g.next) continue;
      g.next = now + 120;
      let from: THREE.Vector3;
      let dir: THREE.Vector3;
      if (uid === this.myUid && this.fp && this.view === 'first' && this.sitAt === null) {
        // πρώτο πρόσωπο: από μπροστά από την κάμερα
        dir = new THREE.Vector3(-Math.sin(this.fp.yaw), 0.15, -Math.cos(this.fp.yaw));
        from = new THREE.Vector3(this.fp.pos.x, 1.3, this.fp.pos.z).addScaledVector(dir, 0.6);
      } else {
        const ry = a.group.rotation.y;
        dir = new THREE.Vector3(Math.sin(ry) * 0.8, 0.8, Math.cos(ry) * 0.8);
        from = a.handWorld().addScaledVector(dir, 0.2);
      }
      this.money.burst(from, dir, 8, 3.4);
    }
  }

  /** Χαρτονομίσματα πάνω από ένα γραφείο (κερδοφόρα συναλλαγή). */
  /**
   * Ο κουλοχέρης: δείχνει το καζάνι και παίζει κάθε νέο τράβηγμα.
   * Επιστρέφει τα νέα τραβήγματα (για ήχους/μηνύματα).
   */
  setSlot(st: SlotState | undefined, potText: string): SlotState['log'] {
    if (!this.slot || !st) return [];
    this.slot.setPot(potText);
    const log = st.log ?? [];
    const last = log[log.length - 1];
    if (!last) return [];
    if (this.slotSeen < 0) {
      // μόλις μπήκαμε: χωρίς animation για τα παλιά
      this.slotSeen = last.n;
      this.slot.show(last.reels);
      return [];
    }
    const fresh = log.filter((r) => r.n > this.slotSeen);
    if (!fresh.length) return [];
    this.slotSeen = last.n;
    this.slot.play(last.reels, last.jackpot);
    if (last.jackpot) {
      const { x, z } = World.SLOT_POS;
      setTimeout(() => this.money.burst(new THREE.Vector3(x + 0.4, 1.4, z), new THREE.Vector3(1, 0.4, 0), 120, 2.5), 1500);
    }
    return fresh;
  }

  moneyAtDesk(desk: number, count: number) {
    const d = this.office.deskPos[desk];
    if (!d) return;
    this.money.burst(new THREE.Vector3(d.x, 1.3, d.z - 0.1), null, count, 1.2);
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

  private lastBoard: BoardData | null = null;
  setBoard(d: BoardData) {
    this.lastBoard = d;
    this.tv.setData(d);
    // στο γκαράζ δεν υπάρχει τηλεόραση: ο πίνακας δίνει περισσότερο χώρο στις ειδήσεις
    drawBoard(this.office.board.ctx, { ...d, bigNews: (this.venueLevel ?? 0) === 0 });
    this.office.board.tex.needsUpdate = true;
    if (d.headline !== this.lastHeadline) {
      this.lastHeadline = d.headline;
      for (const tv of this.newsScreens) {
        drawNewsScreen(tv.ctx, d.headline);
        tv.tex.needsUpdate = true;
      }
    }
  }

  /** Πόσες οθόνες έχει κάθε γραφείο (1–6). */
  setScreens(counts: number[]) {
    const key = counts.join(',');
    if (key === this.screensKey) return;
    this.screensKey = key;
    this.office.deskScreens.forEach((list, d) => {
      const n = Math.max(1, Math.min(MAX_DESK_SCREENS, counts[d] ?? 1));
      const lay = SCREEN_LAYOUT[n - 1];
      const { x, z } = this.office.deskPos[d];
      list.forEach((g, k) => {
        g.visible = k < n;
        if (!g.visible) return;
        const [lx, ly, lz, ry] = lay[k];
        g.position.set(x + lx, ly, z + lz);
        g.rotation.y = ry;
        // βάση ως το γραφείο, πίσω από την οθόνη
        const pole = g.getObjectByName('pole')!;
        const h = ly - 0.79 - 0.2;
        pole.scale.y = Math.max(0.05, h);
        pole.position.set(0, -0.2 - h / 2, -0.04);
      });
    });
  }

  setMonitor(i: number, ticker: string, color: string, series: number[], label: string) {
    const m = this.office.monitors[i];
    if (!m) return;
    drawMonitor(m.ctx, ticker, color, series, label);
    m.tex.needsUpdate = true;
  }

  /** Διακοσμητικά στα γραφεία των παικτών (ανά θέση γραφείου). */
  setDecor(byDesk: DecorId[][]) {
    const key = JSON.stringify(byDesk);
    if (key === this.decorKey) return;
    this.decorKey = key;
    this.office.deskDecor.forEach((grp, i) => {
      grp.clear();
      (byDesk[i] ?? []).slice(0, DECOR_SPOTS.length).forEach((id, k) => {
        const d = makeDecor(id);
        const [x, z] = DECOR_SPOTS[k];
        d.position.set(x, 0, z);
        d.rotation.y = 0.4 - k * 0.3;
        grp.add(d);
      });
    });
  }

  /** Αναβαθμίσεις της ομάδας: εμφανίζονται στο γραφείο. */
  /** Ο χώρος του fund (γκαράζ, πολυκατοικία, Wall Street, ρετιρέ): ξαναχτίζεται μόνο όταν αλλάζει. */
  setVenue(level: number) {
    if (level === this.venueLevel) return;
    this.venueLevel = level;
    if (this.venue) {
      this.scene.remove(this.venue.group);
      this.venue.dispose();
    }
    const v = buildVenue(level, this.opts.quality === 'high');
    this.venue = v;
    this.tv.group.visible = level >= 1;
    // μικρότερος πίνακας στο γκαράζ
    const k = level === 0 ? 0.8 : 1;
    for (const m of this.office.boardMeshes) {
      m.scale.setScalar(k);
      m.position.y = level === 0 ? 2.05 : 2.2;
    }
    if (this.lastBoard) this.setBoard(this.lastBoard);
    this.scene.add(v.group);
    this.syncCeiling();
    this.office.colliders.length = this.coreColliders;
    this.office.colliders.push(...v.colliders);
    this.baseColliders = this.office.colliders.length;
    this.office.lights.panels = v.panels;
    const { hemi, sun } = this.office.lights;
    hemi.color.set(v.light.sky);
    hemi.groundColor.set(v.light.ground);
    hemi.intensity = v.light.hemi;
    sun.color.set(v.light.sun);
    sun.intensity = v.light.sunI;
    sun.position.set(...v.light.sunPos);
    this.office.deskMats.top.color.set(v.desk.top);
    this.office.deskMats.leg.color.set(v.desk.leg);
    this.office.deskMats.chair.color.set(v.desk.chair);
    this.office.boardFrame.color.set(v.boardFrame);
    this.scene.background = new THREE.Color(v.fog.color);
    this.scene.fog = new THREE.Fog(v.fog.color, v.fog.near, v.fog.far);
    // οι αναβαθμίσεις ξαναβάζουν τα δικά τους εμπόδια
    const ids = [...this.upgrades.keys()];
    this.upgradesKey = '';
    this.setUpgrades(ids, this.petSeed);
  }

  setUpgrades(ids: UpgradeId[], seed = 1) {
    this.petSeed = seed;
    this.speedBoost = ids.includes('kourabie') ? 1.3 : 1;
    if (this.fp) this.fp.speedMul = this.speedBoost;
    const key = [...ids].sort().join(',');
    if (key === this.upgradesKey) return;
    this.upgradesKey = key;
    for (const [id, g] of this.upgrades) {
      if (!ids.includes(id)) {
        g.removeFromParent();
        this.upgrades.delete(id);
        if (id === 'tiger') this.tiger = null;
        if (id === 'slot') {
          this.slot = null;
          this.slotSeen = -1;
        }
      }
    }
    const its = this.office.interactables;
    const si = its.findIndex((it) => it.kind === 'slot');
    if (si >= 0 && !ids.includes('slot')) its.splice(si, 1);
    if (si < 0 && ids.includes('slot')) its.push({ kind: 'slot', index: 0, x: World.SLOT_POS.x + 1.0, z: World.SLOT_POS.z, r: 1.3 });
    this.office.colliders.length = this.baseColliders;
    for (const id of ids) {
      if (!this.upgrades.has(id)) {
        const g = this.buildUpgrade(id);
        this.upgrades.set(id, g);
        this.scene.add(g);
      }
      if (id === 'sofa') this.office.colliders.push({ minX: -9.2, maxX: -6.8, minZ: 6.0, maxZ: 8 });
      if (id === 'aquarium') this.office.colliders.push({ minX: 11.0, maxX: 12, minZ: 4.5, maxZ: 6.5 });
      if (id === 'slot') {
        const { x, z } = World.SLOT_POS;
        this.office.colliders.push({ minX: ROOM.minX, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45 });
      }
      if (id === 'doll') this.office.colliders.push({ minX: ROOM.minX + 0.3, maxX: ROOM.minX + 1.1, minZ: -3.6, maxZ: -2.8 });
    }
    const gold = ids.includes('goldbell');
    this.office.bell.scale.setScalar(gold ? 1.35 : 1);
  }

  private buildUpgrade(id: UpgradeId): THREE.Group {
    const g = new THREE.Group();
    switch (id) {
      case 'sofa': {
        const s = makeSofa();
        s.position.set(-8, 0, 7.3);
        s.rotation.y = Math.PI;
        g.add(s);
        break;
      }
      case 'aquarium': {
        const a = makeAquarium();
        a.position.set(11.55, 0, 5.5);
        a.rotation.y = -Math.PI / 2;
        g.add(a);
        this.aquarium = a;
        break;
      }
      case 'espresso': {
        const e = makeProEspresso();
        e.position.set(ROOM.minX + 0.31, 0.94, -4.45);
        g.add(e);
        break;
      }
      case 'screens': {
        for (const z of [-4.5, 4]) {
          const tv = canvasTexture(512, 288);
          this.newsScreens.push(tv);
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: tv.tex }));
          mesh.position.set(ROOM.maxX - 0.06, 2.4, z);
          mesh.rotation.y = -Math.PI / 2;
          g.add(mesh);
          const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.45, 2.5), mat('#111'));
          frame.position.set(ROOM.maxX - 0.03, 2.4, z);
          g.add(frame);
          drawNewsScreen(tv.ctx, this.lastHeadline);
          tv.tex.needsUpdate = true;
        }
        break;
      }
      case 'neon': {
        const tex = canvasTexture(512, 128);
        drawNeon(tex.ctx, this.opts.neonText);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex.tex, transparent: true }));
        sign.position.set(-8.6, 3.0, ROOM.minZ + 0.05);
        g.add(sign);
        break;
      }
      case 'goldbell':
        break;
      case 'doll': {
        // στη γωνία δίπλα στον καφέ, να κοιτάζει τα γραφεία
        const d = makeDoll();
        d.position.set(ROOM.minX + 0.7, 0, -3.2);
        d.rotation.y = Math.PI / 2;
        g.add(d);
        break;
      }
      case 'slot': {
        this.slot = new SlotMachine();
        this.slot.group.position.set(World.SLOT_POS.x, 0, World.SLOT_POS.z);
        this.slot.group.rotation.y = Math.PI / 2;
        g.add(this.slot.group);
        break;
      }
      case 'kourabie': {
        // πιατέλα πάνω στον πάγκο του καφέ, δίπλα στις κούπες
        const k = makeKourabiedes();
        k.position.set(ROOM.minX + 0.36, 0.94, -5.55);
        g.add(k);
        break;
      }
      case 'tiger': {
        this.tiger = new Tiger(this.petSeed);
        g.add(this.tiger.group);
        break;
      }
    }
    return g;
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

  /** Το κλείσιμο της αγοράς: πάρτι ή καβγάς, για όλους όσοι είναι στο γραφείο. */
  playEod(spec: EodSpec, ms = 7000) {
    if (this.ending || this.eod) return;
    this.fp?.setEnabled(false);
    const list = [...this.avatars.values()];
    this.syncCeilingFor(true);
    const gunners = new Set([...this.players.values()].filter((p) => p.gun).map((p) => this.avatars.get(p.uid)).filter((a): a is Avatar => !!a));
    this.eod = new EodScene(this.scene, list, spec, this.office.deskPos, ms, gunners, this.money);
  }

  get eodPlaying() {
    return !!this.eod;
  }

  private endEod() {
    this.eod?.dispose();
    this.eod = null;
    // όλοι πίσω στις θέσεις τους (στο επόμενο καρέ)
    for (const [uid, a] of this.avatars) {
      const pl = this.players.get(uid);
      const seat = this.office.seats[pl?.desk ?? 0];
      if (seat) {
        a.group.position.set(seat.x, 0, seat.z);
        a.group.rotation.set(0, seat.ry, 0);
      }
      a.anim = 'sit';
    }
    this.avatars.get(this.myUid)?.setVisible(this.view !== 'first');
    this.avatars.get(this.myUid)?.showTag(false);
    this.syncCeilingFor(false);
    this.fp?.setEnabled(!this.uiOpen);
    this.onEodEnd();
  }

  private syncCeilingFor(eod: boolean) {
    if (this.venue) this.venue.ceiling.visible = eod || this.view !== 'overview' || !!this.ending;
  }

  private frame(dt: number, now: number) {
    const wall = Date.now();
    if (this.raid) {
      this.raid.update(dt, this.camera);
      this.money.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.eod) {
      const done = this.eod.update(dt);
      this.money.update(dt);
      if (this.aquarium) animateAquarium(this.aquarium, now / 1000);
      if (this.tiger) this.tiger.update(Date.now());
      this.eod.camera(this.camera);
      this.onFrame(dt);
      this.renderer.render(this.scene, this.camera);
      if (done) this.endEod();
      return;
    }
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
        if (this.gunFx.has(uid) && p.a !== 2) a.anim = 'shoot';
        a.update(dt, wall, false);
        continue;
      }
      const p = this.poses.get(uid);
      const pl = this.players.get(uid);
      if (p) {
        const v = this.poseAt.get(uid);
        const ahead = v && p.a === 1 ? Math.min(0.2, (performance.now() - v.t) / 1000) : 0;
        a.target.set(p.x + (v?.vx ?? 0) * ahead, 0, p.z + (v?.vz ?? 0) * ahead);
        a.targetRy = p.ry;
        a.anim = p.a === 2 ? 'sit' : p.a === 1 ? 'walk' : 'idle';
        if (p.e && p.et && wall - p.et < 2500 && p.a !== 2) a.anim = 'cheer';
      } else if (pl) {
        const s = this.office.seats[pl.desk] ?? this.office.seats[0];
        a.target.set(s.x, 0, s.z);
        a.targetRy = s.ry;
        a.anim = 'sit';
      }
      if (this.gunFx.has(uid) && a.anim !== 'sit') a.anim = 'shoot';
      a.update(dt, wall);
    }
    this.updateEnding(dt);
    // περίγραμμα σε ό,τι είναι κοντά
    const near = !this.ending && !this.uiOpen ? this.nearInteractable() : null;
    this.outlines.forEach((o, i) => {
      o.visible = !!near && (near.kind === 'shop' ? i === this.outlines.length - 1 : near.kind === 'desk' && i === near.index);
    });
    this.slot?.update(performance.now());
    this.tv.update(performance.now());
    this.updateMoneyGuns(performance.now());
    this.money.update(dt);
    if (this.aquarium) animateAquarium(this.aquarium, now / 1000);
    if (this.tiger && !this.ending) this.tiger.update(Date.now());
    this.updateCamera(dt, now);
    const tagK = this.ending || this.fp ? 1 : this.camera.aspect < 1 ? 1.9 : 1.5;
    if (tagK !== this.tagK) {
      this.tagK = tagK;
      for (const a of this.avatars.values()) a.setTagScale(tagK);
    }
    this.onFrame(dt);
    this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV) {
      (window as unknown as { __calls: number }).__calls = this.renderer.info.render.calls;
      (window as unknown as { __world: World }).__world = this;
    }
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
      // η κάμερα ακολουθεί με λίγη «ελαστικότητα» για να μην τρέμει
      const want = new THREE.Vector3(cx, cy, cz);
      if (!this.camInit || this.camPos.distanceTo(want) > 4) this.camPos.copy(want);
      else this.camPos.lerp(want, 1 - Math.exp(-_dt * 14));
      this.camInit = true;
      this.camera.position.copy(this.camPos);
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
  showEnding(kind: 'podium' | 'grave' | 'jail', ranking: string[]) {
    if (this.ending || this.raid) return;
    if (kind === 'jail') {
      // σύλληψη: έφοδος SWAT και κελί
      if (this.eod) this.endEod();
      this.fp?.setEnabled(false);
      for (const g of this.gunFx.keys()) this.avatars.get(g)?.hold(null);
      this.gunFx.clear();
      const list = [...this.players.keys()].map((u) => this.avatars.get(u)).filter((a): a is Avatar => !!a);
      if (this.venue) this.venue.ceiling.visible = true;
      this.raid = new RaidScene(this.scene, list, this.venue?.door ?? null,
        [this.office.group, ...(this.venue ? [this.venue.group] : []), this.money.mesh], this.container, this.opts.reduceMotion);
      return;
    }
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
      this.syncCeiling();
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
      this.syncCeiling();
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
    this.raid?.dispose();
    this.eod?.dispose();
    this.money.dispose();
    this.ro.disconnect();
    this.fp?.dispose();
    for (const a of this.avatars.values()) a.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
