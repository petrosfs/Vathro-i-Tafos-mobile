// Ο χώρος του fund: γκαράζ, γραφείο σε πολυκατοικία, όροφος στη Wall Street, ρετιρέ.
// Χτίζει το «κέλυφος» (πάτωμα, τοίχους με αληθινά ανοίγματα παραθύρων, ταβάνι, φώτα, αντικείμενα)
// και τον κόσμο έξω (δρόμοι, σπίτια, πολυκατοικίες, ουρανοξύστες, ουρανός). Τα γραφεία, ο πίνακας
// και το κατάστημα μένουν ίδια σε όλους τους χώρους (ίδια κάτοψη).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash } from '../sim/rng';
import { ROOM, type Box2 } from './office';
import { canvasTexture } from './textures';
import { toon } from './avatar';

/** Πάχος τοίχων (προς τα έξω από την κάτοψη). */
const T = 0.3;
const H = ROOM.height;

// ---------------------------------------------------------------- εργαλεία

type Tile = [number, number] | null;

/** Συγκεντρώνει γεωμετρίες ανά υλικό και τις ενώνει: λίγες κλήσεις σχεδίασης για πολλά αντικείμενα. */
class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const mx = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(mx);
    if (!this.parts.has(m)) this.parts.set(m, []);
    this.parts.get(m)!.push(g);
  }

  /** Κουτί με κέντρο (x,y,z). Με tile, οι υφές επαναλαμβάνονται ανά τόσα μέτρα (ίδια πυκνότητα παντού). */
  box(m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, tile: Tile = null, ry = 0, roofUv = false) {
    this.add(boxGeo(sx, sy, sz, tile, roofUv), m, x, y, z, ry);
  }

  build(group: THREE.Group, shadows: { cast?: boolean; receive?: boolean } = {}) {
    for (const [m, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = !!shadows.cast;
      mesh.receiveShadow = !!shadows.receive;
      if ((m as THREE.MeshBasicMaterial).transparent) mesh.renderOrder = 2;
      group.add(mesh);
    }
    this.parts.clear();
  }
}

function boxGeo(sx: number, sy: number, sz: number, tile: Tile, roofUv = false): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (!tile) return g;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // σειρά πλευρών: +x, -x, +y, -y, +z, -z (4 κορυφές η καθεμία)
  const dims: [number, number][] = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (roofUv && (f === 2 || f === 3)) uv.setXY(i, 0.02, 0.02);
      else uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile[0], (uv.getY(i) * dims[f][1]) / tile[1]);
    }
  }
  return g;
}

function planeGeo(w: number, h: number, tile: Tile): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  if (tile) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile[0], (uv.getY(i) * h) / tile[1]);
  }
  return g;
}

/** Υλικά toon (σαν το υπόλοιπο γραφείο). */
const lambert = (color: string, map?: THREE.Texture) => toon(color, map ?? null);

function repeatTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const { tex, ctx } = canvasTexture(w, h, 1);
  draw(ctx, w, h);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Ντετερμινιστικό «τυχαίο» για να βγαίνει κάθε φορά ίδια πόλη. */
function rng(seed: number) {
  let n = 0;
  return () => hash(seed, n++) / 4294967296;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, colors: string[], r: () => number, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()));
  }
}

// ---------------------------------------------------------------- υφές

function concreteTex() {
  return repeatTex(256, 256, (ctx, w, h) => {
    const r = rng(11);
    ctx.fillStyle = '#8C8A84';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2600, ['#827F79', '#96938C', '#7A7771', '#9C998F'], r, 2);
    // λεκέδες από λάδια
    for (let i = 0; i < 4; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 + r() * 30);
      g.addColorStop(0, 'rgba(40,36,30,0.35)');
      g.addColorStop(1, 'rgba(40,36,30,0)');
      ctx.save();
      ctx.translate(r() * w, r() * h);
      ctx.scale(1, 0.6 + r() * 0.6);
      ctx.fillStyle = g;
      ctx.fillRect(-70, -70, 140, 140);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(60,58,54,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  });
}

function blockTex() {
  // τσιμεντόλιθοι 40×20, τέσσερις σειρές ανά υφή (1,6 × 0,8 μ.)
  return repeatTex(256, 128, (ctx, w, h) => {
    const r = rng(12);
    ctx.fillStyle = '#9A978F';
    ctx.fillRect(0, 0, w, h);
    const bw = w / 4;
    const bh = h / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let c = -1; c < 5; c++) {
        const x = c * bw + off;
        const v = 180 + Math.floor(r() * 22);
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
        ctx.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    speckle(ctx, w, h, 900, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'], r, 2);
  });
}

function woodTex(base: string[], seed: number) {
  // σανίδες 12,5 εκ., μια υφή = 1 × 1 μ.
  return repeatTex(256, 256, (ctx, w, h) => {
    const r = rng(seed);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      const cut = r() * w;
      for (const [x0, x1] of [[cut - w, cut], [cut, cut + w]] as [number, number][]) {
        ctx.fillStyle = base[Math.floor(r() * base.length)];
        ctx.fillRect(x0, y, x1 - x0, h / n);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          const yy = y + 3 + r() * (h / n - 6);
          ctx.moveTo(x0, yy);
          ctx.bezierCurveTo(x0 + w * 0.3, yy + 2, x0 + w * 0.6, yy - 2, x1, yy + 1);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y, w, 1.5);
      ctx.fillRect(cut, y, 1.5, h / n);
    }
  });
}

function marbleTex() {
  // πλάκες 1,5 × 1,5 μ. (μία υφή = 2 πλάκες)
  return repeatTex(256, 256, (ctx, w, h) => {
    const r = rng(14);
    ctx.fillStyle = '#ECE8E1';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(${120 + r() * 40},${115 + r() * 30},${110 + r() * 30},${0.15 + r() * 0.25})`;
      ctx.lineWidth = 0.6 + r() * 1.6;
      ctx.beginPath();
      let x = r() * w;
      let y = r() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.3) * 60;
        y += (r() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(150,140,130,0.6)';
    ctx.fillRect(0, 0, w, 1.5);
    ctx.fillRect(0, h / 2, w, 1.5);
    ctx.fillRect(0, 0, 1.5, h);
    ctx.fillRect(w / 2, 0, 1.5, h);
  });
}

function carpetTiles() {
  // πλακάκια μοκέτας 50×50, μια υφή = 1 × 1 μ.
  return repeatTex(128, 128, (ctx, w, h) => {
    const r = rng(18);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#8E98A6' : '#98A2AF';
        ctx.fillRect((x * w) / 2, (y * h) / 2, w / 2, h / 2);
      }
    }
    speckle(ctx, w, h, 900, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)'], r, 2);
  });
}

function plasterTex(color: string, seed: number) {
  return repeatTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 700, ['rgba(0,0,0,0.035)', 'rgba(255,255,255,0.05)'], rng(seed), 3);
  });
}

function asphaltTex() {
  return repeatTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3B3D40';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1400, ['#35373A', '#44464A', '#2F3133', '#4A4C4F'], rng(15), 1.5);
  });
}

function pavingTex(color: string) {
  return repeatTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 500, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)'], rng(16), 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i <= 4; i++) {
      ctx.fillRect(0, (i * h) / 4, w, 1);
      ctx.fillRect((i * w) / 4, 0, 1, h);
    }
  });
}

function grassTex() {
  return repeatTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5E8A3E';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1800, ['#55803A', '#6A9746', '#4E7535', '#78A452'], rng(17), 2);
  });
}

function garageDoorTex() {
  // ένα «φύλλο» της πόρτας: 1,25 × 0,55 μ.
  return repeatTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#E9E7E1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#D2CFC6';
    ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#F4F2EC';
    ctx.fillRect(12, 12, w - 24, 3);
    ctx.fillStyle = '#B9B5AB';
    ctx.fillRect(0, h - 3, w, 3);
  });
}

type FacadeStyle = 'glass' | 'stone' | 'dark' | 'apartment' | 'house' | 'sunset' | 'shop';

/** Πρόσοψη κτιρίου: 4 κολόνες × 4 όροφοι παράθυρα. */
function facadeTex(style: FacadeStyle, seed: number) {
  return repeatTex(256, 256, (ctx, w, h) => {
    const r = rng(seed);
    const pal: Record<FacadeStyle, { wall: string; glass: string[]; lit: number; frame?: string }> = {
      glass: { wall: '#A9B8C8', glass: ['#BFD3E6', '#CFE0EE', '#B3C9DD', '#D8E6F2'], lit: 0.02 },
      stone: { wall: '#D8D2C6', glass: ['#8FA4B8', '#9DB1C4', '#8499AE'], lit: 0.04, frame: '#B9B1A2' },
      dark: { wall: '#94A3B3', glass: ['#A9BDD0', '#B6C8DA', '#9FB3C8'], lit: 0.06 },
      apartment: { wall: '#E9E2D2', glass: ['#3F4954', '#56616D', '#4A5560'], lit: 0.02, frame: '#C9C1AE' },
      house: { wall: '#EFE6D6', glass: ['#4E6A82', '#5A7790'], lit: 0, frame: '#FFFFFF' },
      sunset: { wall: '#2C2638', glass: ['#E48A5A', '#C9705E', '#9C5A6E', '#5A4664'], lit: 0.35 },
      shop: { wall: '#C9BBA2', glass: ['#2F3A44', '#3A4652'], lit: 0.1, frame: '#6B5B47' },
    };
    const p = pal[style];
    ctx.fillStyle = p.wall;
    ctx.fillRect(0, 0, w, h);
    if (style === 'house') {
      // ένα παράθυρο με παντζούρια ανά «κομμάτι»
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const cx = x * 128 + 64;
          const cy = y * 128 + 64;
          ctx.fillStyle = '#7A5A3A';
          ctx.fillRect(cx - 36, cy - 30, 14, 60);
          ctx.fillRect(cx + 22, cy - 30, 14, 60);
          ctx.fillStyle = p.frame!;
          ctx.fillRect(cx - 22, cy - 32, 44, 64);
          ctx.fillStyle = p.glass[(x + y) % 2];
          ctx.fillRect(cx - 18, cy - 28, 36, 56);
          ctx.fillStyle = p.frame!;
          ctx.fillRect(cx - 1.5, cy - 28, 3, 56);
        }
      }
      return;
    }
    const cols = 4;
    const rows = 4;
    const cw = w / cols;
    const rh = h / rows;
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = row * rh;
        if (style === 'glass' || style === 'dark' || style === 'sunset') {
          // υαλοπέτασμα: σχεδόν όλο τζάμι με λεπτά πλαίσια
          const g = ctx.createLinearGradient(x, y, x + cw, y + rh);
          const c1 = p.glass[Math.floor(r() * p.glass.length)];
          g.addColorStop(0, c1);
          g.addColorStop(1, p.glass[Math.floor(r() * p.glass.length)]);
          ctx.fillStyle = r() < p.lit ? (style === 'sunset' ? '#FFD38A' : '#F6E3A2') : g;
          ctx.fillRect(x + 3, y + 4, cw - 6, rh - 10);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x + 3, y + 4, cw - 6, 4);
        } else {
          const ww = cw * 0.52;
          const wh = rh * 0.5;
          const wx = x + (cw - ww) / 2;
          const wy = y + rh * 0.2;
          if (style === 'apartment') {
            // μπαλκόνι σε όλο το πλάτος με κάγκελα και τέντα
            ctx.fillStyle = '#CFC6B2';
            ctx.fillRect(x, y + rh * 0.78, cw, rh * 0.08);
            ctx.fillStyle = 'rgba(40,40,40,0.55)';
            for (let k = 2; k < cw; k += 5) ctx.fillRect(x + k, y + rh * 0.62, 1.2, rh * 0.16);
            ctx.fillRect(x, y + rh * 0.62, cw, 1.5);
            if (r() < 0.45) {
              const awn = ['#2E7D5B', '#C9572E', '#2B5D9B', '#D9A521'][Math.floor(r() * 4)];
              ctx.fillStyle = awn;
              ctx.fillRect(x + 2, y + rh * 0.06, cw - 4, rh * 0.13);
            }
          }
          ctx.fillStyle = p.frame ?? '#555';
          ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          ctx.fillStyle = r() < p.lit ? '#F6E3A2' : p.glass[Math.floor(r() * p.glass.length)];
          ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = p.frame ?? '#555';
          ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        }
      }
    }
  });
}

interface SkySpec {
  stops: [number, string][];
  clouds?: number;
  sun?: { az: number; el: number; color: string; size: number };
  hills?: string;
}

/** Ουρανός (ισοορθογώνια προβολή): κλίση χρωμάτων, σύννεφα, ήλιος, βουνά στον ορίζοντα. */
function skyTex(spec: SkySpec) {
  const { tex, ctx } = canvasTexture(1024, 512, 1);
  const W = 1024;
  const Hh = 512;
  const g = ctx.createLinearGradient(0, 0, 0, Hh);
  for (const [k, c] of spec.stops) g.addColorStop(k, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Hh);
  const r = rng(21);
  if (spec.sun) {
    const sx = (spec.sun.az / (Math.PI * 2)) * W;
    const sy = Hh / 2 - (spec.sun.el / Math.PI) * Hh;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, spec.sun.size * 8);
    glow.addColorStop(0, spec.sun.color);
    glow.addColorStop(0.12, spec.sun.color);
    glow.addColorStop(0.14, 'rgba(255,200,140,0.55)');
    glow.addColorStop(1, 'rgba(255,160,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - spec.sun.size * 8, sy - spec.sun.size * 8, spec.sun.size * 16, spec.sun.size * 16);
  }
  for (let i = 0; i < (spec.clouds ?? 0); i++) {
    const cx = r() * W;
    const cy = Hh * (0.18 + r() * 0.26);
    const n = 4 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const rr = 10 + r() * 22;
      const gx = cx + (k - n / 2) * rr * 0.9;
      const gy = cy + (r() - 0.5) * 8;
      const cg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
      cg.addColorStop(0, 'rgba(255,255,255,0.75)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(gx - rr, gy - rr, rr * 2, rr * 2);
    }
  }
  if (spec.hills) {
    // βουνά λίγο πάνω από τον ορίζοντα
    ctx.fillStyle = spec.hills;
    ctx.beginPath();
    ctx.moveTo(0, Hh / 2 + 2);
    let y = Hh / 2 - 10;
    for (let x = 0; x <= W; x += 8) {
      y += (r() - 0.5) * 6;
      y = Math.max(Hh / 2 - 34, Math.min(Hh / 2 - 4, y));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, Hh / 2 + 2);
    ctx.fill();
  }
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- τοίχοι και παράθυρα

interface Opening {
  /** Από/ως κατά μήκος του τοίχου (x για νότιο/βόρειο, z για δυτικό/ανατολικό). */
  a0: number;
  a1: number;
  y0: number;
  y1: number;
  /** Κάθετα και οριζόντια χωρίσματα (αριθμός). */
  cols?: number;
  transom?: number;
  /** Πόρτα: χωρίς τζάμι (το φύλλο μπαίνει χωριστά). */
  door?: boolean;
}

/** Η πόρτα του γραφείου (ανατολικός τοίχος): εδώ μπαίνει η αστυνομία. */
export const DOOR = { z0: 1.3, z1: 2.5, h: 2.2 };
const DOOR_OPENING: Opening = { a0: DOOR.z0, a1: DOOR.z1, y0: 0, y1: DOOR.h, door: true };

type Side = 'S' | 'N' | 'W' | 'E';

interface WallStyle {
  mat: THREE.Material;
  tile: Tile;
  frame: THREE.Material;
  sill: THREE.Material | null;
  /** Πλάτος πλαισίου (μ.). */
  fw: number;
}

/**
 * Τοίχος με ανοίγματα: κομμάτια γύρω από κάθε παράθυρο, πλαίσιο, χωρίσματα, τζάμι και εσωτερικό περβάζι.
 * Ο τοίχος είναι έξω από την κάτοψη, ώστε το εσωτερικό να μένει ίδιο.
 */
function wall(b: Batch, glassB: Batch, glass: THREE.Material, side: Side, openings: Opening[], st: WallStyle) {
  const along = side === 'S' || side === 'N';
  const lo = along ? ROOM.minX - T : ROOM.minZ - T;
  const hi = along ? ROOM.maxX + T : ROOM.maxZ + T;
  // κέντρο του πάχους
  const c = side === 'S' ? ROOM.maxZ + T / 2 : side === 'N' ? ROOM.minZ - T / 2 : side === 'W' ? ROOM.minX - T / 2 : ROOM.maxX + T / 2;
  const inner = side === 'S' ? ROOM.maxZ : side === 'N' ? ROOM.minZ : side === 'W' ? ROOM.minX : ROOM.maxX;
  const inward = side === 'S' || side === 'E' ? -1 : 1;
  const piece = (a0: number, a1: number, y0: number, y1: number, m = st.mat, depth = T, off = 0) => {
    if (a1 - a0 < 0.001 || y1 - y0 < 0.001) return;
    const len = a1 - a0;
    const mid = (a0 + a1) / 2;
    const ym = (y0 + y1) / 2;
    if (along) b.box(m, len, y1 - y0, depth, mid, ym, c + off, st.tile);
    else b.box(m, depth, y1 - y0, len, c + off, ym, mid, st.tile);
  };
  const sorted = [...openings].sort((p, q) => p.a0 - q.a0);
  let cur = lo;
  for (const o of sorted) {
    piece(cur, o.a0, 0, H);
    piece(o.a0, o.a1, 0, o.y0);
    piece(o.a0, o.a1, o.y1, H);
    cur = o.a1;
  }
  piece(cur, hi, 0, H);
  // πλαίσια, χωρίσματα, τζάμια
  for (const o of sorted) {
    const fw = st.fw;
    const fd = T * 0.6;
    piece(o.a0, o.a0 + fw, o.y0, o.y1, st.frame, fd);
    piece(o.a1 - fw, o.a1, o.y0, o.y1, st.frame, fd);
    piece(o.a0, o.a1, o.y0, o.y0 + fw, st.frame, fd);
    piece(o.a0, o.a1, o.y1 - fw, o.y1, st.frame, fd);
    const cols = o.cols ?? 1;
    for (let k = 1; k < cols; k++) {
      const a = o.a0 + ((o.a1 - o.a0) * k) / cols;
      piece(a - fw * 0.4, a + fw * 0.4, o.y0, o.y1, st.frame, fd * 0.8);
    }
    if (o.transom) piece(o.a0, o.a1, o.transom - fw * 0.4, o.transom + fw * 0.4, st.frame, fd * 0.8);
    const gw = o.a1 - o.a0;
    const gh = o.y1 - o.y0;
    const gy = (o.y0 + o.y1) / 2;
    const ga = (o.a0 + o.a1) / 2;
    if (!o.door) {
      const pg = planeGeo(gw, gh, null);
      if (along) glassB.add(pg, glass, ga, gy, c);
      else glassB.add(pg, glass, c, gy, ga, Math.PI / 2);
    }
    // εσωτερικό περβάζι
    if (st.sill && o.y0 > 0.2) {
      const d = 0.18;
      const p = inner + (inward * d) / 2 - (inward * 0.02);
      if (along) b.box(st.sill, gw + 0.12, 0.04, d, ga, o.y0, p);
      else b.box(st.sill, d, 0.04, gw + 0.12, p, o.y0, ga);
    }
  }
}

// ---------------------------------------------------------------- κόσμος έξω

/** Κτίριο: κουτί με πρόσοψη (η ταράτσα παίρνει το χρώμα του τοίχου). */
function building(b: Batch, m: THREE.Material, roof: THREE.Material, x: number, z: number, w: number, d: number, y0: number, y1: number, tile: [number, number]) {
  b.box(m, w, y1 - y0, d, x, (y0 + y1) / 2, z, tile, 0, true);
  // στηθαίο και μηχανήματα στην ταράτσα
  b.box(roof, w * 0.3, 1.6, d * 0.3, x + w * 0.15, y1 + 0.8, z - d * 0.1);
}

function tree(b: Batch, trunk: THREE.Material, leaves: THREE.Material[], x: number, y: number, z: number, s = 1) {
  b.add(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.4 * s, 6), trunk, x, y + 1.2 * s, z);
  const k = Math.abs(Math.round(x * 7 + z * 13)) % leaves.length;
  b.add(new THREE.IcosahedronGeometry(1.4 * s, 0), leaves[k], x, y + 3.0 * s, z);
  b.add(new THREE.IcosahedronGeometry(1.0 * s, 0), leaves[(k + 1) % leaves.length], x + 0.5 * s, y + 3.8 * s, z - 0.3 * s);
}

function car(b: Batch, body: THREE.Material, dark: THREE.Material, glassM: THREE.Material, x: number, y: number, z: number, ry: number) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (dx: number, dz: number): [number, number] => [x + dx * c + dz * s, z - dx * s + dz * c];
  let p = at(0, 0);
  b.box(body, 4.2, 0.7, 1.8, p[0], y + 0.55, p[1], null, ry);
  p = at(-0.2, 0);
  b.box(glassM, 2.2, 0.55, 1.6, p[0], y + 1.15, p[1], null, ry);
  for (const [dx, dz] of [[-1.3, -0.85], [1.3, -0.85], [-1.3, 0.85], [1.3, 0.85]] as [number, number][]) {
    p = at(dx, dz);
    b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), dark, p[0], y + 0.34, p[1], ry, Math.PI / 2);
  }
}

function house(b: Batch, wallM: THREE.Material, roofM: THREE.Material, x: number, y: number, z: number, w: number, d: number, h: number) {
  b.box(wallM, w, h, d, x, y + h / 2, z, [4, 3], 0, true);
  // τετράριχτη στέγη (πυραμίδα με 4 πλευρές)
  const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(w * 1.12, h * 0.55, d * 1.12);
  b.add(roof, roofM, x, y + h + h * 0.275, z);
}

// ---------------------------------------------------------------- χώροι

export interface VenueBuild {
  group: THREE.Group;
  ceiling: THREE.Group;
  /** Το φύλλο της πόρτας (περιστρέφεται γύρω από τον άξονα y). */
  door: THREE.Group;
  colliders: Box2[];
  panels: THREE.Mesh[];
  fog: { color: string; near: number; far: number };
  light: { sky: string; ground: string; hemi: number; sun: string; sunI: number; sunPos: [number, number, number] };
  desk: { top: string; leg: string; chair: string };
  boardFrame: string;
  /** Οι δείκτες του ρολογιού τοίχου. */
  clock: { hour: THREE.Object3D; minute: THREE.Object3D };
  dispose: () => void;
}

/** Χτίζει τον χώρο (0–3). */
export function buildVenue(level: number, shadows: boolean): VenueBuild {
  const group = new THREE.Group();
  const inside = new Batch();
  const glassB = new Batch();
  const out = new Batch();
  /** Ό,τι κρέμεται από το ταβάνι: κρύβεται στη θέα από ψηλά. */
  const top = new Batch();
  const ceilingGroup = new THREE.Group();
  group.add(ceilingGroup);
  const colliders: Box2[] = [];
  const panels: THREE.Mesh[] = [];
  const textures: THREE.Texture[] = [];
  const tex = <X extends THREE.Texture>(t: X) => {
    textures.push(t);
    return t;
  };
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const glass = new THREE.MeshBasicMaterial({ color: '#BFD8EE', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const lv = Math.max(0, Math.min(3, Math.round(level)));

  // κοινά υλικά έξω
  const asphalt = lambert('#FFFFFF', tex(asphaltTex()));
  const white = lambert('#E8E8E2');
  const trunk = lambert('#5A4030');
  const leaves = [lambert('#3F7A3A'), lambert('#4F8C44'), lambert('#356B33')];
  const tyre = lambert('#1E1E20');
  const carGlass = lambert('#2A3440');
  const carCols = ['#B0281F', '#E8E8E8', '#1F3F7A', '#2B2B2B', '#8A8F96', '#D9A521'].map((c) => lambert(c));

  const floorPlane = (m: THREE.Material, tile: [number, number]) => {
    const f = new THREE.Mesh(planeGeo(W, D, tile), m);
    f.rotation.x = -Math.PI / 2;
    f.receiveShadow = true;
    group.add(f);
  };
  const ceiling = (color: string, tiles = false) => {
    // ψευδοροφή: πλάκες 60×60 με μεταλλικό σκελετό
    const map = tiles
      ? tex(repeatTex(64, 64, (c, w, h) => {
        c.fillStyle = '#FFFFFF';
        c.fillRect(0, 0, w, h);
        const r = rng(91);
        for (let i = 0; i < 90; i++) {
          c.fillStyle = 'rgba(0,0,0,0.05)';
          c.fillRect(r() * w, r() * h, 1.5, 1.5);
        }
        c.fillStyle = '#B9BDC3';
        c.fillRect(0, 0, w, 3);
        c.fillRect(0, 0, 3, h);
      }))
      : null;
    if (map) map.repeat.set((W + 2 * T) / 0.6, (D + 2 * T) / 0.6);
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * T, D + 2 * T), new THREE.MeshBasicMaterial({ color, map }));
    cm.rotation.x = Math.PI / 2;
    cm.position.y = H;
    group.add(cm);
  };
  const lightPanel = (color: string, w: number, d: number, x: number, z: number, y = H - 0.01) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color }));
    p.rotation.x = Math.PI / 2;
    p.position.set(x, y, z);
    group.add(p);
    panels.push(p);
    return p;
  };
  const sky = (spec: SkySpec) => {
    const m = new THREE.MeshBasicMaterial({ map: tex(skyTex(spec)), side: THREE.BackSide, fog: false, depthWrite: false });
    const s = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), m);
    s.renderOrder = -1;
    group.add(s);
  };
  const plant = (x: number, z: number, big = false) => {
    const k = big ? 1.5 : 1;
    inside.add(new THREE.CylinderGeometry(0.28 * k, 0.22 * k, 0.5 * k, 10), lambert(big ? '#2A2A2A' : '#B5654A'), x, 0.25 * k, z);
    for (let i = 0; i < 3; i++) inside.add(new THREE.IcosahedronGeometry((0.32 - i * 0.06) * k, 0), leaves[i % 3], x + (i - 1) * 0.08, (0.75 + i * 0.32) * k, z);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  };
  const baseboard = (m: THREE.Material) => {
    inside.box(m, W, 0.12, 0.03, 0, 0.06, ROOM.minZ + 0.015);
    inside.box(m, W, 0.12, 0.03, 0, 0.06, ROOM.maxZ - 0.015);
    inside.box(m, 0.03, 0.12, D, ROOM.minX + 0.015, 0.06, 0);
    inside.box(m, 0.03, 0.12, D, ROOM.maxX - 0.015, 0.06, 0);
  };
  /**
   * Δίχρωμοι τοίχοι (όπως στα γραφεία των indie παιχνιδιών): σκούρα ζώνη κάτω και μπορντούρα κάτω από το ταβάνι.
   * Οι ζώνες κάτω μπαίνουν μόνο σε τοίχους χωρίς χαμηλά παράθυρα· η πόρτα (ανατολικά) μένει ελεύθερη.
   */
  const bands = (lowM: THREE.Material, lowH: number, topM: THREE.Material, sides: ('N' | 'E' | 'S' | 'W')[], lineM?: THREE.Material, topSides = sides) => {
    const d = 0.025;
    const run = (side: 'N' | 'E' | 'S' | 'W', a0: number, a1: number, y0: number, y1: number, m: THREE.Material) => {
      const len = a1 - a0;
      const mid = (a0 + a1) / 2;
      const ym = (y0 + y1) / 2;
      if (side === 'N') inside.box(m, len, y1 - y0, d, mid, ym, ROOM.minZ + d / 2 + 0.002);
      if (side === 'S') inside.box(m, len, y1 - y0, d, mid, ym, ROOM.maxZ - d / 2 - 0.002);
      if (side === 'W') inside.box(m, d, y1 - y0, len, ROOM.minX + d / 2 + 0.002, ym, mid);
      if (side === 'E') inside.box(m, d, y1 - y0, len, ROOM.maxX - d / 2 - 0.002, ym, mid);
    };
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const along = side === 'N' || side === 'S';
      const lo = along ? ROOM.minX : ROOM.minZ;
      const hi = along ? ROOM.maxX : ROOM.maxZ;
      if (topSides.includes(side)) run(side, lo, hi, H - 0.28, H, topM);
      if (!sides.includes(side)) continue;
      const segs: [number, number][] = side === 'E' ? [[lo, DOOR.z0 - 0.05], [DOOR.z1 + 0.05, hi]] : [[lo, hi]];
      for (const [a, b] of segs) {
        run(side, a, b, 0.12, lowH, lowM);
        if (lineM) run(side, a, b, lowH, lowH + 0.05, lineM);
      }
    }
  };
  /** Πόλη σε πλέγμα γύρω από το κτίριο μας (για τους ψηλούς ορόφους). */
  const city = (ground: number, mats: THREE.Material[], roof: THREE.Material, hMin: number, hMax: number, seed: number, near: number) => {
    const r = rng(seed);
    const step = 34;
    for (let gx = -6; gx <= 6; gx++) {
      for (let gz = -6; gz <= 6; gz++) {
        const cx = gx * step;
        const cz = gz * step;
        // ελεύθερη θέα: κανένα κτίριο στα διπλανά τετράγωνα
        if (Math.abs(cx) <= step && Math.abs(cz) <= step) continue;
        // ένα ή δύο κτίρια ανά οικοδομικό τετράγωνο
        const two = r() < 0.5;
        for (let k = 0; k < (two ? 2 : 1); k++) {
          const w = two ? 10 + r() * 6 : 16 + r() * 8;
          const d = 14 + r() * 10;
          const x = cx + (two ? (k ? 7 : -7) : 0) + (r() - 0.5) * 3;
          const z = cz + (r() - 0.5) * 4;
          const dist = Math.hypot(x, z);
          const tall = dist < near ? 1.25 : 1;
          const h = (hMin + Math.pow(r(), 1.6) * (hMax - hMin)) * tall;
          building(out, mats[Math.floor(r() * mats.length)], roof, x, z, w, d, ground, ground + h, [12, 14]);
        }
      }
    }
    // δρόμοι ανάμεσα στα τετράγωνα (στο έδαφος)
    const gm = new THREE.Mesh(planeGeo(900, 900, [8, 8]), asphalt);
    gm.rotation.x = -Math.PI / 2;
    gm.position.y = ground;
    group.add(gm);
  };
  /** Η πρόσοψη του δικού μας κτιρίου κάτω από τον όροφο. */
  const ourTower = (ground: number, m: THREE.Material) => {
    out.box(m, W + 2 * T + 0.4, -ground - 0.05, D + 2 * T + 0.4, 0, ground / 2 - 0.03, 0, [12, 14], 0, true);
  };

  let fog: VenueBuild['fog'];
  let light: VenueBuild['light'];
  let desk: VenueBuild['desk'];
  let boardFrame = '#10141C';

  if (lv === 0) {
    // ------------------------------------------------ γκαράζ σπιτιού
    floorPlane(lambert('#FFFFFF', tex(concreteTex())), [4, 4]);
    ceiling('#4A4038');
    const blocks = lambert('#FFFFFF', tex(blockTex()));
    const st: WallStyle = { mat: blocks, tile: [1.6, 0.8], frame: lambert('#E4E2DC'), sill: lambert('#CFCBC2'), fw: 0.07 };
    // δύο πόρτες γκαράζ με σειρά από τζαμάκια
    const doors = [-5.5, 5.5];
    const south: Opening[] = [];
    for (const dc of doors) for (const k of [-1.875, -0.625, 0.625, 1.875]) south.push({ a0: dc + k - 0.5, a1: dc + k + 0.5, y0: 2.2, y1: 2.55 });
    wall(inside, glassB, glass, 'S', south, { ...st, frame: lambert('#F0EEE8'), fw: 0.04, sill: null });
    wall(inside, glassB, glass, 'W', [{ a0: 0.2, a1: 2.6, y0: 1.3, y1: 2.4, cols: 2 }], st);
    wall(inside, glassB, glass, 'N', [], st);
    wall(inside, glassB, glass, 'E', [DOOR_OPENING], st);
    const doorM = lambert('#FFFFFF', tex(garageDoorTex()));
    const doorFrame = lambert('#8E8A82');
    for (const dc of doors) {
      // φύλλα πόρτας μπροστά από τον τοίχο, με κενά στα τζαμάκια
      const z = ROOM.maxZ - 0.025;
      inside.box(doorM, 5, 2.2, 0.05, dc, 1.1, z, [1.25, 0.55]);
      inside.box(doorM, 5, 0.45, 0.05, dc, 2.775, z, [1.25, 0.55]);
      for (const k of [-2.5, -1.25, 0, 1.25, 2.5]) {
        const w = k === -2.5 || k === 2.5 ? 0.125 : 0.25;
        const x = dc + k + (k === -2.5 ? w / 2 : k === 2.5 ? -w / 2 : 0);
        inside.box(doorM, w, 0.35, 0.05, x, 2.375, z, [1.25, 0.55]);
      }
      inside.box(doorFrame, 5.3, 0.15, 0.08, dc, 3.07, ROOM.maxZ - 0.04);
      inside.box(doorFrame, 0.15, 3.0, 0.08, dc - 2.575, 1.5, ROOM.maxZ - 0.04);
      inside.box(doorFrame, 0.15, 3.0, 0.08, dc + 2.575, 1.5, ROOM.maxZ - 0.04);
      // ράγες της πόρτας στο ταβάνι
      top.box(doorFrame, 0.06, 0.08, 3.2, dc - 2.45, 3.25, ROOM.maxZ - 1.6);
      top.box(doorFrame, 0.06, 0.08, 3.2, dc + 2.45, 3.25, ROOM.maxZ - 1.6);
      top.box(lambert('#6E6A62'), 0.5, 0.25, 0.5, dc, 3.9, ROOM.maxZ - 3.4);
    }
    // ξύλινα δοκάρια στο ταβάνι και λάμπες φθορίου
    const joist = lambert('#7A5C3E');
    for (let x = -11; x <= 11; x += 1.6) top.box(joist, 0.14, 0.22, D, x, H - 0.11, 0);
    const tube = lambert('#D8D8D8');
    for (const x of [-7, 0, 7]) {
      for (const z of [-4, 2]) {
        top.box(tube, 1.5, 0.08, 0.22, x, H - 0.45, z);
        top.box(tube, 0.02, 0.35, 0.02, x - 0.6, H - 0.25, z);
        top.box(tube, 0.02, 0.35, 0.02, x + 0.6, H - 0.25, z);
        lightPanel('#F4FBFF', 1.4, 0.12, x, z, H - 0.495);
      }
    }
    // ράφια με κούτες και μπογιές (βόρειος τοίχος, αριστερά)
    const metal = lambert('#6F7378');
    const card = [lambert('#B98B57'), lambert('#A87A48'), lambert('#C79C66')];
    for (const sx of [-11.5, -9.0]) for (const sz of [-7.95, -7.35]) inside.box(metal, 0.05, 2.2, 0.05, sx, 1.1, sz);
    for (const y of [0.3, 0.95, 1.6, 2.2]) inside.box(metal, 2.55, 0.04, 0.65, -10.25, y, -7.65);
    const rr = rng(31);
    for (const y of [0.32, 0.97, 1.62]) {
      let x = -11.4;
      while (x < -9.3) {
        const w = 0.35 + rr() * 0.3;
        const h = 0.25 + rr() * 0.3;
        if (rr() < 0.3) inside.add(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10), lambert(['#D24B3A', '#E8E8E8', '#3A6FD2'][Math.floor(rr() * 3)]), x + 0.12, y + 0.14, -7.6);
        else inside.box(card[Math.floor(rr() * 3)], w, h, 0.5, x + w / 2, y + 0.02 + h / 2, -7.62);
        x += w + 0.05;
      }
    }
    colliders.push({ minX: -11.7, maxX: -8.8, minZ: -8, maxZ: -7.2 });
    // πάγκος εργασίας με διάτρητο πάνελ (ανατολικός τοίχος)
    inside.box(lambert('#8B6A48'), 0.7, 0.06, 2.0, ROOM.maxX - 0.4, 0.92, -6.5);
    for (const dz of [-0.9, 0.9]) inside.box(metal, 0.06, 0.9, 0.06, ROOM.maxX - 0.7, 0.45, -6.5 + dz);
    inside.box(lambert('#C9A97C'), 0.03, 1.0, 2.0, ROOM.maxX - 0.02, 1.6, -6.5);
    for (let k = 0; k < 6; k++) inside.box(lambert(['#C0392B', '#2C3E50', '#7F8C8D'][k % 3]), 0.05, 0.3 + (k % 3) * 0.08, 0.06, ROOM.maxX - 0.06, 1.55, -7.2 + k * 0.28);
    colliders.push({ minX: ROOM.maxX - 0.8, maxX: ROOM.maxX, minZ: -7.6, maxZ: -5.4 });
    // λάστιχα στη γωνία
    for (let k = 0; k < 3; k++) inside.add(new THREE.TorusGeometry(0.33, 0.13, 8, 16), tyre, 11.0, 0.13 + k * 0.26, 7.0, 0, Math.PI / 2);
    colliders.push({ minX: 10.5, maxX: 11.6, minZ: 6.5, maxZ: 7.6 });
    // προβολέας για τον «πίνακα»
    top.box(lambert('#2B2B2B'), 0.4, 0.15, 0.35, 0, H - 0.5, -2.5);
    top.box(metal, 0.04, 0.4, 0.04, 0, H - 0.22, -2.5);
    plant(-11, 6.9 - 4);
    baseboard(lambert('#7A776F'));

    // έξω: ράμπα, πεζοδρόμιο, δρόμος, σπίτια απέναντι
    const drive = lambert('#FFFFFF', tex(pavingTex('#A9A59B')));
    out.box(drive, W + 2 * T, 0.04, 6, 0, -0.02, ROOM.maxZ + T + 3, [2, 2]);
    out.box(drive, 400, 0.04, 2.5, 0, 0.0, ROOM.maxZ + T + 7.25, [2, 2]);
    out.box(asphalt, 400, 0.02, 9, 0, -0.04, ROOM.maxZ + T + 13, [4, 4]);
    for (let x = -196; x < 200; x += 6) out.box(white, 2.5, 0.01, 0.15, x, -0.02, ROOM.maxZ + T + 13);
    out.box(drive, 400, 0.04, 2.5, 0, 0.0, ROOM.maxZ + T + 18.75, [2, 2]);
    const grass = new THREE.Mesh(planeGeo(500, 500, [4, 4]), lambert('#FFFFFF', tex(grassTex())));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.06;
    group.add(grass);
    const houseWall = [lambert('#FFFFFF', tex(facadeTex('house', 41))), lambert('#F3D9B1', textures[textures.length - 1])];
    const roofM = lambert('#B5532E');
    const r = rng(43);
    for (let x = -60; x <= 60; x += 15) {
      const w = 9 + r() * 3;
      house(out, houseWall[Math.floor(r() * 2)], roofM, x + (r() - 0.5) * 2, 0, ROOM.maxZ + 34, w, 8, 5.5 + r() * 3);
      tree(out, trunk, leaves, x + 7, 0, ROOM.maxZ + 22.5, 0.9 + r() * 0.4);
    }
    // φράχτης και σπίτι του γείτονα (δυτικά)
    for (let z = -12; z <= 18; z += 2) out.box(white, 0.08, 1.0, 1.9, ROOM.minX - 5, 0.5, z);
    house(out, houseWall[0], roofM, ROOM.minX - 16, 0, 2, 12, 10, 6);
    tree(out, trunk, leaves, ROOM.minX - 4, 0, 10, 1.1);
    tree(out, trunk, leaves, ROOM.minX - 8, 0, -6, 1.3);
    // σπίτι από πάνω και πίσω (για την κάτοψη από ψηλά)
    house(out, houseWall[1], roofM, 0, 0, ROOM.minZ - 9, 26, 14, 6);
    house(out, houseWall[0], roofM, ROOM.maxX + 14, 0, 0, 12, 12, 6);
    car(out, carCols[1], tyre, carGlass, -4, 0, ROOM.maxZ + T + 11, 0);
    car(out, carCols[2], tyre, carGlass, 9, 0, ROOM.maxZ + T + 15, Math.PI);
    car(out, carCols[0], tyre, carGlass, -14, 0, ROOM.maxZ + T + 4, Math.PI / 2);
    sky({ stops: [[0, '#3F7FC9'], [0.42, '#9CC8EE'], [0.5, '#DCEBF5'], [1, '#6E7F66']], clouds: 18 });
    fog = { color: '#CFE2F0', near: 60, far: 240 };
    light = { sky: '#EAF2FF', ground: '#5A554C', hemi: 1.35, sun: '#FFFFFF', sunI: 1.15, sunPos: [6, 10, 6] };
    desk = { top: '#E8E6E0', leg: '#7D8187', chair: '#2E3138' };
    boardFrame = '#F2F2F2';
  } else if (lv === 1) {
    // ------------------------------------------------ γραφείο σε πολυκατοικία (2ος όροφος)
    const ground = -7.5;
    floorPlane(lambert('#FFFFFF', tex(woodTex(['#B98A57', '#AD7E4C', '#C29462', '#A47546'], 51))), [2, 2]);
    ceiling('#EDEBE6', true);
    const plaster = lambert('#FFFFFF', tex(plasterTex('#E7DFD0', 52)));
    const st: WallStyle = { mat: plaster, tile: [2, 2], frame: lambert('#F4F4F2'), sill: lambert('#D8D2C4'), fw: 0.06 };
    const south: Opening[] = [-8.4, -2.8, 2.8, 8.4].map((x) => ({ a0: x - 1.2, a1: x + 1.2, y0: 0.9, y1: 3.0, cols: 2, transom: 2.5 }));
    wall(inside, glassB, glass, 'S', south, st);
    wall(inside, glassB, glass, 'W', [-1, 3.4].map((z) => ({ a0: z - 1, a1: z + 1, y0: 0.9, y1: 3.0, cols: 2, transom: 2.5 })), st);
    wall(inside, glassB, glass, 'N', [], st);
    wall(inside, glassB, glass, 'E', [DOOR_OPENING], st);
    // στόρια μισοκατεβασμένα και καλοριφέρ κάτω από τα παράθυρα
    const blind = lambert('#F1ECE0');
    const rad = lambert('#F2F2F0');
    for (const o of south) {
      const x = (o.a0 + o.a1) / 2;
      inside.box(blind, 2.3, 0.55, 0.03, x, 2.72, ROOM.maxZ - 0.06);
      inside.box(lambert('#C9C2B2'), 2.4, 0.1, 0.1, x, 3.05, ROOM.maxZ - 0.06);
      for (let k = -0.7; k <= 0.71; k += 0.1) inside.box(rad, 0.06, 0.55, 0.08, x + k, 0.42, ROOM.maxZ - 0.09);
    }
    for (const z of [-1, 3.4]) inside.box(blind, 0.03, 0.55, 1.9, ROOM.minX + 0.06, 2.72, z);
    // φώτα οροφής
    for (const x of [-7, 0, 7]) for (const z of [-4, 2]) {
      top.box(lambert('#D8D8D8'), 1.24, 0.05, 1.24, x, H - 0.03, z);
      lightPanel('#FFFDF4', 1.15, 1.15, x, z, H - 0.06);
    }
    // βιβλιοθήκη με κλασέρ
    const shelf = lambert('#7A5A3E');
    inside.box(shelf, 2.4, 2.2, 0.4, -10.3, 1.1, ROOM.minZ + 0.22);
    const binders = ['#2B5DB2', '#C0392B', '#2E8B57', '#D9A521', '#5B3B78', '#1E1E1E'].map((c) => lambert(c));
    for (const y of [0.35, 0.9, 1.45]) for (let k = 0; k < 12; k++) inside.box(binders[(k + Math.round(y * 10)) % binders.length], 0.12, 0.38, 0.3, -11.3 + k * 0.17, y + 0.2, ROOM.minZ + 0.2);
    colliders.push({ minX: -11.6, maxX: -9.0, minZ: ROOM.minZ, maxZ: ROOM.minZ + 0.5 });
    // ψύκτης νερού
    inside.box(lambert('#E8E8E8'), 0.4, 1.0, 0.4, 11.5, 0.5, 6.6);
    inside.add(new THREE.CylinderGeometry(0.15, 0.15, 0.45, 12), lambert('#7FB6E6'), 11.5, 1.25, 6.6);
    colliders.push({ minX: 11.2, maxX: 12, minZ: 6.3, maxZ: 6.9 });
    for (const [x, z] of [[-11, -7], [11, -7], [-11, 7]] as [number, number][]) plant(x, z);
    baseboard(lambert('#8A6A4A'));
    bands(lambert('#9B7A55'), 0.9, lambert('#CFC6B4'), ['N', 'E', 'S', 'W'], lambert('#6E5236'));

    // έξω: δρόμος από κάτω, πολυκατοικίες απέναντι, βουνά στον ορίζοντα
    const pave = lambert('#FFFFFF', tex(pavingTex('#B9B3A6')));
    ourTower(ground, lambert('#FFFFFF', tex(facadeTex('shop', 53))));
    out.box(pave, 400, 0.1, 6, 0, ground, ROOM.maxZ + T + 3.2, [2, 2]);
    out.box(asphalt, 400, 0.05, 10, 0, ground - 0.02, ROOM.maxZ + T + 11.2, [4, 4]);
    for (let x = -196; x < 200; x += 6) out.box(white, 2.5, 0.01, 0.15, x, ground + 0.02, ROOM.maxZ + T + 11.2);
    out.box(pave, 400, 0.1, 5, 0, ground, ROOM.maxZ + T + 18.7, [2, 2]);
    const apt = [lambert('#FFFFFF', tex(facadeTex('apartment', 54))), lambert('#F2E6CF', tex(facadeTex('apartment', 55)))];
    const roof = lambert('#9A948A');
    const r = rng(56);
    let x = -120;
    while (x < 120) {
      const w = 13 + r() * 9;
      const h = 15 + Math.floor(r() * 4) * 3;
      building(out, apt[Math.floor(r() * 2)], roof, x + w / 2, ROOM.maxZ + T + 28.5, w, 14, ground, ground + h, [12, 12]);
      x += w + 0.4 + r() * 1.2;
    }
    // πλαϊνός δρόμος δυτικά και κτίρια
    out.box(asphalt, 9, 0.05, 400, ROOM.minX - T - 9, ground - 0.02, 0, [4, 4]);
    out.box(pave, 5, 0.1, 400, ROOM.minX - T - 2.5, ground, 0, [2, 2]);
    for (let z = -60; z < 60; z += 17) building(out, apt[1], roof, ROOM.minX - T - 22, z, 16, 15.5, ground, ground + 15 + (Math.abs(z) % 3) * 3, [12, 12]);
    // πίσω και ανατολικά (φαίνονται από ψηλά)
    for (let k = -2; k <= 2; k++) building(out, apt[k & 1], roof, k * 17, ROOM.minZ - 14, 16, 18, ground, ground + 18, [12, 12]);
    for (let z = -40; z < 40; z += 17) building(out, apt[0], roof, ROOM.maxX + 14, z, 16, 15.5, ground, ground + 16, [12, 12]);
    for (let k = -110; k < 110; k += 9) {
      tree(out, trunk, leaves, k, ground, ROOM.maxZ + T + 5, 1.5);
      tree(out, trunk, leaves, k + 4, ground, ROOM.maxZ + T + 18.5, 1.4);
    }
    const r2 = rng(57);
    for (let k = 0; k < 9; k++) car(out, carCols[Math.floor(r2() * carCols.length)], tyre, carGlass, -60 + k * 14 + r2() * 4, ground, ROOM.maxZ + T + (k % 2 ? 13.6 : 8.8), k % 2 ? Math.PI : 0);
    const gm = new THREE.Mesh(planeGeo(600, 600, [2, 2]), pave);
    gm.rotation.x = -Math.PI / 2;
    gm.position.y = ground - 0.05;
    group.add(gm);
    sky({ stops: [[0, '#3C78C2'], [0.4, '#8EBDE6'], [0.5, '#E1ECF2'], [1, '#8A8578']], clouds: 12, hills: '#8C97A6' });
    fog = { color: '#D6E3EC', near: 70, far: 260 };
    light = { sky: '#FFF6E8', ground: '#6A5A48', hemi: 1.45, sun: '#FFF1D6', sunI: 1.25, sunPos: [6, 10, 8] };
    desk = { top: '#B08A5E', leg: '#4A3828', chair: '#2A2D35' };
    boardFrame = '#2A2A2A';
  } else {
    // ------------------------------------------------ Wall Street (2) και ρετιρέ (3)
    const pent = lv === 3;
    const ground = pent ? -160 : -70;
    if (pent) floorPlane(lambert('#FFFFFF', tex(marbleTex())), [3, 3]);
    else {
      // ανοιχτόχρωμη μοκέτα σε πλακάκια (φωτεινό, σύγχρονο γραφείο)
      floorPlane(lambert('#FFFFFF', tex(carpetTiles())), [2, 2]);
    }
    ceiling(pent ? '#F2EFEA' : '#E9ECF0', !pent);
    const wallM = pent ? lambert('#FFFFFF', tex(plasterTex('#F1ECE4', 61))) : lambert('#FFFFFF', tex(plasterTex('#D9DEE5', 62)));
    const frame = lambert(pent ? '#1B1B1D' : '#E4E7EC');
    const st: WallStyle = { mat: wallM, tile: [2, 2], frame, sill: pent ? null : lambert('#C9CED6'), fw: pent ? 0.05 : 0.08 };
    const y0 = pent ? 0.03 : 0.55;
    const y1 = pent ? H - 0.03 : 3.85;
    wall(inside, glassB, glass, 'S', [-9.5, -5.7, -1.9, 1.9, 5.7, 9.5].map((x) => ({ a0: x - 1.8, a1: x + 1.8, y0, y1, cols: 2 })), st);
    wall(inside, glassB, glass, 'W', [-4.6, 0, 4.6].map((z) => ({ a0: z - 2.2, a1: z + 2.2, y0, y1, cols: 2 })), st);
    wall(inside, glassB, glass, 'N', [], st);
    wall(inside, glassB, glass, 'E', [DOOR_OPENING], st);
    if (pent) {
      // στρογγυλά χωνευτά φώτα και μεγάλο χαλί κάτω από τα γραφεία
      for (let x = -9; x <= 9; x += 3) for (const z of [-5, -1, 3, 6.5]) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: '#FFF4DE' }));
        p.rotation.x = Math.PI / 2;
        p.position.set(x, H - 0.01, z);
        group.add(p);
        panels.push(p);
      }
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(14, 10.5), lambert('#5A2630'));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.006, 1.6);
      rug.receiveShadow = true;
      group.add(rug);
      for (const [x, z] of [[-11, -7], [11, -7], [11, 7], [-11, 2.9]] as [number, number][]) plant(x, z, true);
      baseboard(lambert('#D8D2C8'));
      // ρετιρέ: κόκκινη ζώνη με χρυσή γραμμή
      bands(lambert('#7A1E24'), 1.0, lambert('#7A1E24'), ['N', 'E'], lambert('#C9A54A'));
    } else {
      for (const x of [-7, 0, 7]) for (const z of [-4, 2]) lightPanel('#FFF4DA', 3, 1, x, z);
      for (const [x, z] of [[-11, -7], [11, -7], [-11, 7], [11, 7], [-11, 2.9]] as [number, number][]) plant(x, z);
      baseboard(lambert('#8C95A3'));
      // Wall Street: μπλε-γκρι ζώνη κάτω και σκούρα μπορντούρα πάνω
      bands(lambert('#4A5566'), 0.55, lambert('#3B4452'), ['N', 'E', 'S', 'W']);
    }

    // έξω: πόλη σε πλέγμα, το κτίριο μας από κάτω, ουρανός
    const glassF = lambert('#FFFFFF', tex(facadeTex(pent ? 'sunset' : 'glass', 63)));
    const stone = lambert('#FFFFFF', tex(facadeTex('stone', 64)));
    const dark = lambert('#FFFFFF', tex(facadeTex(pent ? 'sunset' : 'dark', 65)));
    const roof = lambert(pent ? '#3A3040' : '#6B6F75');
    ourTower(ground, pent ? dark : glassF);
    if (pent) city(ground, [glassF, dark, stone], roof, 40, 185, 66, 80);
    else city(ground, [glassF, stone, dark], roof, 45, 190, 67, 70);
    if (pent) {
      sky({
        stops: [[0, '#1C1E4A'], [0.3, '#5B3A78'], [0.42, '#D9667A'], [0.49, '#FFB36B'], [0.52, '#7A4A5A'], [1, '#2A1E2A']],
        clouds: 8, sun: { az: Math.PI * 0.62, el: 0.06, color: '#FFE2A8', size: 9 },
      });
      fog = { color: '#B9727A', near: 90, far: 300 };
      light = { sky: '#FFE2C8', ground: '#4A3040', hemi: 1.3, sun: '#FFB07A', sunI: 1.45, sunPos: [-8, 7, 10] };
      desk = { top: '#F2F2F0', leg: '#1A1A1A', chair: '#1A1A1A' };
      boardFrame = '#1A1A1A';
    } else {
      sky({ stops: [[0, '#3E86D6'], [0.42, '#93C5EF'], [0.5, '#D9EBF8'], [1, '#7C8A99']], clouds: 10 });
      fog = { color: '#CFE2F0', near: 90, far: 300 };
      light = { sky: '#E6EEFF', ground: '#3A3024', hemi: 1.4, sun: '#FFF2DD', sunI: 1.3, sunPos: [6, 10, 6] };
      desk = { top: '#E3E5E8', leg: '#2A2D33', chair: '#2A2F38' };
    }
  }
  // ---- τοίχος με τον πίνακα: ασπροπίνακας, διπλώματα, πίνακας ανακοινώσεων, ρολόι, τουαλέτα
  const wz = ROOM.minZ + 0.02;
  const painted = (w: number, h: number, px: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void) => {
    const { tex: t2, ctx } = canvasTexture(Math.round(w * px), Math.round(h * px), 1);
    draw(ctx, Math.round(w * px), Math.round(h * px));
    t2.needsUpdate = true;
    tex(t2);
    return new THREE.MeshBasicMaterial({ map: t2, toneMapped: false });
  };
  const plaque = (m: THREE.Material, w: number, h: number, x: number, y: number, z = wz + 0.05) => {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    pm.position.set(x, y, z);
    group.add(pm);
    return pm;
  };
  const alu = lambert('#B9BEC6');
  if (lv >= 1) {
    // ασπροπίνακας με ροδάκια (δίπλα στον δυτικό τοίχο), με μουτζούρες από τη σύσκεψη
    const wb = new THREE.Group();
    wb.position.set(-11.0, 0, -0.4);
    wb.rotation.y = Math.PI / 2;
    group.add(wb);
    const wbBox = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      bm.position.set(x, y, z);
      bm.castShadow = shadows;
      wb.add(bm);
    };
    wbBox(alu, 2.3, 1.3, 0.04, 0, 1.65, 0);
    for (const x of [-1.08, 1.08]) {
      wbBox(alu, 0.05, 1.05, 0.05, x, 0.52, 0);
      wbBox(lambert('#3A3F48'), 0.06, 0.04, 0.62, x, 0.04, 0);
    }
    colliders.push({ minX: -11.35, maxX: -10.65, minZ: -1.6, maxZ: 0.8 });
    const wbFace = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), painted(2.2, 1.2, 160, (c, W, H) => {
      c.fillStyle = '#FAFBFC';
      c.fillRect(0, 0, W, H);
      c.lineCap = 'round';
      // γράφημα με βέλος προς τα πάνω (αριστερά κάτω)
      c.strokeStyle = '#1F5FBF';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(18, H - 22);
      [[50, H - 40], [78, H - 32], [108, H - 70], [134, H - 58], [160, H - 98]].forEach(([x, y]) => c.lineTo(x, y));
      c.stroke();
      c.beginPath();
      c.moveTo(144, H - 100);
      c.lineTo(162, H - 99);
      c.lineTo(158, H - 80);
      c.stroke();
      const hand = '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive';
      c.textBaseline = 'alphabetic';
      c.font = `700 38px ${hand}`;
      c.fillStyle = '#C62828';
      c.fillText('BUY!!', 16, 46);
      // λίστα με τον «σχεδιασμό»
      c.fillStyle = '#1B1B1B';
      c.font = `600 19px ${hand}`;
      const lx = W - 168;
      ['1) Αγόρασε φτηνά', '2) Πούλα ακριβά', '3) $$$'].forEach((tx, i) => c.fillText(tx, lx, 70 + i * 30));
      c.strokeStyle = '#2E7D32';
      c.lineWidth = 3;
      c.strokeRect(lx - 10, 44, 166, 108);
      c.fillStyle = '#2E7D32';
      c.font = `700 18px ${hand}`;
      c.fillText('ΣΤΟΧΟΣ ↑↑↑', lx, 30);
    }));
    wbFace.position.set(0, 1.65, 0.025);
    wb.add(wbFace);
    wbBox(alu, 1.6, 0.04, 0.08, 0, 1.0, 0.05);
    for (const [x, col] of [[-0.4, '#1F5FBF'], [-0.2, '#C62828'], [0, '#2E7D32']] as [number, string][]) wbBox(lambert(col), 0.12, 0.025, 0.025, x, 1.035, 0.06);
    // διπλώματα σε κορνίζες
    const dip = painted(0.42, 0.32, 200, (c, W, H) => {
      c.fillStyle = '#FFF8E6';
      c.fillRect(0, 0, W, H);
      c.strokeStyle = '#C9A54A';
      c.lineWidth = 5;
      c.strokeRect(8, 8, W - 16, H - 16);
      c.fillStyle = '#3A2A1A';
      c.fillRect(W * 0.2, H * 0.22, W * 0.6, 7);
      for (let k = 0; k < 3; k++) c.fillRect(W * 0.18, H * (0.42 + k * 0.1), W * 0.64, 3);
      c.fillStyle = '#C62828';
      c.beginPath();
      c.arc(W * 0.78, H * 0.78, 10, 0, Math.PI * 2);
      c.fill();
    });
    for (const [x, y] of [[-4.95, 2.05], [-4.4, 2.05], [-4.95, 1.55], [-4.4, 1.55]] as [number, number][]) {
      inside.box(lambert('#4A3020'), 0.48, 0.38, 0.03, x, y, wz + 0.01);
      plaque(dip, 0.42, 0.32, x, y);
    }
    // πόρτα τουαλέτας
    inside.box(lambert('#E4E2DC'), 1.1, 2.25, 0.05, 10.55, 1.125, wz + 0.01);
    inside.box(lambert(lv === 1 ? '#8A6440' : '#5F6B7A'), 0.95, 2.12, 0.04, 10.55, 1.06, wz + 0.04);
    inside.box(lambert('#C9CED6'), 0.16, 0.035, 0.05, 10.8, 1.05, wz + 0.08);
    plaque(painted(0.3, 0.2, 200, (c, W, H) => {
      c.fillStyle = '#1E4F9C';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#FFFFFF';
      c.font = '800 26px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('WC', W / 2, H / 2 + 2);
    }), 0.3, 0.2, 10.55, 1.6, wz + 0.07);
    colliders.push({ minX: 10.0, maxX: 11.1, minZ: ROOM.minZ, maxZ: ROOM.minZ + 0.15 });
    if (lv >= 2) {
      // ψύκτης νερού και στη Wall Street
      inside.box(lambert('#E8E8E8'), 0.4, 1.0, 0.4, 11.5, 0.5, -5.2);
      inside.add(new THREE.CylinderGeometry(0.15, 0.15, 0.45, 12), lambert('#5FA8E8'), 11.5, 1.25, -5.2);
      colliders.push({ minX: 11.2, maxX: 12, minZ: -5.5, maxZ: -4.9 });
    }
  }
  // πίνακας ανακοινώσεων (φελλός με χαρτάκια) σε όλους τους χώρους
  inside.box(lambert('#6E4B32'), 1.5, 1.0, 0.04, 8.35, 1.65, wz + 0.01);
  plaque(painted(1.4, 0.9, 160, (c, W, H) => {
    c.fillStyle = '#C99A62';
    c.fillRect(0, 0, W, H);
    const r = rng(77 + lv);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = r() < 0.5 ? '#B98A54' : '#D7AB74';
      c.fillRect(r() * W, r() * H, 3, 3);
    }
    const notes = ['#FFF176', '#FF8A80', '#80D8FF', '#CCFF90', '#FFFFFF', '#FFD180'];
    for (let i = 0; i < 7; i++) {
      const nx = 14 + (i % 4) * 54 + r() * 10;
      const ny = 12 + Math.floor(i / 4) * 70 + r() * 10;
      c.save();
      c.translate(nx + 24, ny + 24);
      c.rotate((r() - 0.5) * 0.3);
      c.fillStyle = notes[i % notes.length];
      c.fillRect(-24, -24, 48, i === 4 ? 60 : 48);
      c.fillStyle = 'rgba(40,40,40,0.55)';
      for (let k = 0; k < 3; k++) c.fillRect(-18, -12 + k * 10, 26 + r() * 10, 3);
      c.fillStyle = ['#D32F2F', '#1976D2', '#388E3C'][i % 3];
      c.beginPath();
      c.arc(0, -20, 4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }), 1.4, 0.9, 8.35, 1.65);
  // ρολόι τοίχου: δείχνει την ώρα της αγοράς (09:30 → 16:00)
  const clock = new THREE.Group();
  clock.position.set(8.35, 3.05, wz + 0.04);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32), lambert('#C9A54A'));
  rim.rotation.x = Math.PI / 2;
  clock.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), painted(0.52, 0.52, 200, (c, W) => {
    c.fillStyle = '#FFFDF5';
    c.beginPath();
    c.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#222';
    c.font = '700 15px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let k = 1; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      c.fillText(String(k), W / 2 + Math.sin(a) * W * 0.38, W / 2 - Math.cos(a) * W * 0.38);
    }
  }));
  face.position.z = 0.032;
  clock.add(face);
  const hand = (len: number, w: number, z: number) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.008), lambert('#1A1A1A'));
    m.position.y = len / 2 - 0.02;
    pivot.add(m);
    pivot.position.z = z;
    clock.add(pivot);
    return pivot;
  };
  const hourHand = hand(0.14, 0.022, 0.04);
  const minuteHand = hand(0.21, 0.014, 0.046);
  group.add(clock);

  // το φύλλο της πόρτας σε μεντεσέ (για να ανοίγει με φόρα στην έφοδο)
  const door = new THREE.Group();
  door.position.set(ROOM.maxX + 0.04, 0, DOOR.z0);
  const leafCol = lv === 0 ? '#8A8F96' : lv === 1 ? '#7A5232' : lv === 2 ? '#2B3242' : '#1A1A1A';
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, DOOR.h - 0.02, DOOR.z1 - DOOR.z0 - 0.02), lambert(leafCol));
  leaf.position.set(0, DOOR.h / 2, (DOOR.z1 - DOOR.z0) / 2);
  leaf.castShadow = true;
  door.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lambert('#D4AF37'));
  knob.position.set(-0.06, 1.02, DOOR.z1 - DOOR.z0 - 0.15);
  door.add(knob);
  if (lv >= 1) {
    // ταμπέλα με το όνομα του fund (μικρό τζαμάκι)
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), glass);
    pane.rotation.y = -Math.PI / 2;
    pane.position.set(-0.035, 1.55, (DOOR.z1 - DOOR.z0) / 2);
    door.add(pane);
  }
  group.add(door);
  // οι τοίχοι, η οροφή και τα δοκάρια δεν ρίχνουν σκιά: ο ήλιος είναι πάνω από τη σκεπή και θα σκοτείνιαζε
  // όλο τον χώρο με λοξές σκιές και ρίγες· σκιές ρίχνουν μόνο τα έπιπλα και οι χαρακτήρες
  inside.build(group, { receive: true, cast: false });
  top.build(ceilingGroup);
  out.build(group);
  glassB.build(group);
  return {
    group, ceiling: ceilingGroup, door, colliders, panels, fog, light, desk, boardFrame,
    clock: { hour: hourHand, minute: minuteHand },
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const ms = Array.isArray(m.material) ? m.material : [m.material];
          ms.forEach((x) => x.dispose());
        }
      });
      textures.forEach((t) => t.dispose());
    },
  };
}
