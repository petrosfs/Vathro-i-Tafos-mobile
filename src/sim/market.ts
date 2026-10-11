// Η αγορά: τιμές που προκύπτουν ντετερμινιστικά από το seed της παρτίδας, τη μέρα, τις ειδήσεις
// και τα αντικείμενα που χρησιμοποίησαν οι παίκτες. Κάθε συσκευή τις υπολογίζει μόνη της.

import { hash, normal, uniform } from './rng';
import { SECTORS, STOCKS, STOCK_COUNT } from './stocks';
import {
  BUST, BUST_FALSE, BUST_HINT, CRASH, EARN_BAD, EARN_GOOD, GENERIC_DOWN, GENERIC_UP, IPO_DAY, IPO_HINT_COLD, IPO_HINT_HOT,
  MARKET_DOWN, MARKET_UP, RALLY, SECTOR_NEWS, SPECIFIC,
} from './headlines';

/** Ένα tick = μισό δευτερόλεπτο. */
export const TICK_MS = 500;

export type Difficulty = 'easy' | 'normal' | 'hard';

export type EffectKind = 'pump' | 'dump' | 'halt';

export interface Effect {
  kind: EffectKind;
  stock: number;
  start: number;
  by: string;
}

export const EFFECT_LEN: Record<EffectKind, number> = { pump: 20, dump: 20, halt: 40 };
/** Συνολική λογαριθμική κίνηση της φήμης/του πανικού (~ ±18%). */
export const PUMP_MOVE = 0.17;

export type NewsKind =
  | 'up' | 'down' | 'spec-up' | 'spec-down' | 'mkt-up' | 'mkt-down' | 'crash'
  | 'ipo-hot' | 'ipo-cold' | 'ipo' | 'bust-hint' | 'bust' | 'bust-false'
  | 'sec-up' | 'sec-down' | 'earn-good' | 'earn-bad' | 'analyst-up' | 'analyst-down' | 'rally';

/** Γεγονός χρηματιστηρίου: νέα εισαγωγή ή χρεωκοπία (με είδηση-hint την προηγούμενη μέρα). */
export interface StockEvent {
  kind: 'ipo' | 'bust';
  stock: number;
  day: number;
  /** IPO: «πυρετός» την πρώτη μέρα. */
  fever?: boolean;
  /** IPO: τι λέει το hint (δεν πέφτει πάντα μέσα). */
  hot?: boolean;
  /** Χρεωκοπία: αληθινή ή ψεύτικος συναγερμός. */
  real?: boolean;
}

/** Τι υπάρχει στο χρηματιστήριο μια μέρα. */
export interface DayCtx {
  listed: number[];
  events: StockEvent[];
  /** Εγγυημένες ευκαιρίες της μέρας (για να είναι πάντα εφικτός ο στόχος). */
  boosts?: Boost[];
}

/**
 * Εγγυημένη ευκαιρία: ανοδική κίνηση σε μία μετοχή, όταν η μέρα δεν δίνει αρκετές από μόνη της.
 * Άλλοτε φαίνεται με είδηση, άλλοτε μόνο στο γράφημα (σταθερή άνοδος).
 */
export interface Boost {
  stock: number;
  start: number;
  dur: number;
  /** Λογαριθμική άνοδος. */
  mag: number;
  news: boolean;
  spec: boolean;
  text: number;
}

export const DEFAULT_CTX: DayCtx = { listed: [0, 1, 2, 3, 4, 5, 6, 7], events: [] };

export interface NewsEvent {
  id: number;
  /** Πότε εμφανίζεται ο τίτλος. */
  tick: number;
  /** -1 = όλη η αγορά. */
  stock: number;
  /** Τι λέει ο τίτλος. */
  dir: 1 | -1;
  /** Τι κάνει πραγματικά η τιμή (στις φήμες μπορεί να είναι το αντίθετο). */
  real: 1 | -1;
  rumor: boolean;
  crash: boolean;
  /** Αρχή της κίνησης (λίγο μετά τον τίτλο, για να προλάβει κανείς να αντιδράσει). */
  start: number;
  dur: number;
  /** Συνολική λογαριθμική κίνηση. */
  mag: number;
  kind: NewsKind;
  text: number;
  /** Είδηση κλάδου: ποιος κλάδος (θέση στο SECTORS). */
  sector?: number;
  /** Φήμη: πόσο αξιόπιστη είναι η πηγή (%). */
  rel?: number;
  /** Προγραμματισμένο (αποτελέσματα): γνωστό από την αρχή της μέρας. */
  sched?: boolean;
  /** Τίτλος εγγυημένης ευκαιρίας (η κίνηση έρχεται από το Boost). */
  boost?: boolean;
}

export interface DayParams {
  seed: number;
  day: number;
  opens: number[];
  /** Βασική διάρκεια μέρας σε ticks (από τις ρυθμίσεις). */
  baseLen: number;
  /** Τρέχουσα διάρκεια (μεγαλώνει με τον καφέ). */
  len: number;
  effects: Effect[];
  difficulty: Difficulty;
  /** Μετοχές στο χρηματιστήριο και γεγονότα. */
  ctx?: DayCtx;
  /** Πολλαπλασιαστής μεταβλητότητας ανά μετοχή (ωρίμανση, πυρετός IPO). */
  volMul?: Record<number, number>;
}

const VOL_MUL: Record<Difficulty, number> = { easy: 0.9, normal: 1, hard: 1.15 };
/** Πόσος τυχαίος θόρυβος (λιγότερος = οι ειδήσεις και οι τάσεις μετράνε περισσότερο από την τύχη). */
const NOISE = 0.6;
/** Πόσο δυνατή είναι η τάση κάθε ζώνης. */
const TREND = 0.00022;
const REVERSION = 0.0004;
const MIN_PRICE = 0.3;

export function crashChance(day: number): number {
  return Math.min(0.35, 0.1 + 0.03 * day);
}

/** Οι ειδήσεις της μέρας. Εξαρτώνται από seed, μέρα, βασική διάρκεια και ποιες μετοχές είναι στο χρηματιστήριο. */
export function dayNews(seed: number, day: number, baseLen: number, ctx: DayCtx = DEFAULT_CTX): NewsEvent[] {
  const listed = ctx.listed.length ? ctx.listed : DEFAULT_CTX.listed;
  const out: NewsEvent[] = [];
  const u = (...k: number[]) => uniform(seed, day, 7000 + k[0], k[1] ?? 0, k[2] ?? 0);
  const scale = baseLen / 600;
  // πολλές ειδήσεις: οι περισσότερες μικρές, μερικές μεγάλες
  const count = Math.max(3, Math.round(scale * (12 + u(1) * 4.99)));
  const from = 30;
  const to = baseLen - 30;
  const slot = (to - from) / count;
  // κλάδοι που έχουν τουλάχιστον μία μετοχή στο χρηματιστήριο
  const sectors = SECTORS.map((x, i) => (listed.some((id) => STOCKS[id]?.sector === x.id) ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < count; i++) {
    const tick = Math.floor(from + slot * i + u(2, i) * slot * 0.8);
    const r = u(3, i);
    const market = r < 0.08;
    const sectorNews = !market && r < 0.3 && sectors.length > 0;
    const stock = market || sectorNews ? -1 : listed[Math.floor(u(4, i) * listed.length)];
    const sector = sectorNews ? sectors[Math.floor(u(15, i) * sectors.length)] : undefined;
    const dir: 1 | -1 = u(5, i) < 0.5 ? 1 : -1;
    const big = u(13, i) < 0.4;
    const rumor = stock >= 0 && u(6, i) < 0.3;
    // κάθε φήμη έχει δηλωμένη αξιοπιστία πηγής: τόσο συχνά βγαίνει αληθινή
    const rel = rumor ? [30, 50, 80][Math.floor(u(14, i) * 3)] : undefined;
    const real: 1 | -1 = rumor && u(7, i) * 100 >= rel! ? (-dir as 1 | -1) : dir;
    const m8 = u(8, i);
    let mag = market ? (big ? 0.04 + m8 * 0.04 : 0.015 + m8 * 0.02)
      : sectorNews ? (big ? 0.05 + m8 * 0.06 : 0.02 + m8 * 0.025)
        : (big ? 0.06 + m8 * 0.1 : 0.015 + m8 * 0.03);
    if (rumor) mag *= 0.8;
    const start = tick + 2 + Math.floor(u(9, i) * 5);
    const dur = 6 + Math.floor(u(10, i) * 11);
    const specific = stock >= 0 && u(11, i) < 0.45 && !!SPECIFIC[stock];
    let kind: NewsKind;
    let pool: number;
    if (market) {
      kind = dir > 0 ? 'mkt-up' : 'mkt-down';
      pool = (dir > 0 ? MARKET_UP : MARKET_DOWN).length;
    } else if (sectorNews) {
      kind = dir > 0 ? 'sec-up' : 'sec-down';
      pool = (dir > 0 ? SECTOR_NEWS[sector!].up : SECTOR_NEWS[sector!].down).length;
    } else if (specific) {
      kind = dir > 0 ? 'spec-up' : 'spec-down';
      pool = dir > 0 ? SPECIFIC[stock].up.length : SPECIFIC[stock].down.length;
    } else {
      kind = dir > 0 ? 'up' : 'down';
      pool = (dir > 0 ? GENERIC_UP : GENERIC_DOWN).length;
    }
    const text = Math.floor(u(12, i) * pool);
    out.push({ id: i, tick, stock, dir, real, rumor, crash: false, start, dur, mag, kind, text, sector, rel });
  }
  // προγραμματισμένα αποτελέσματα (γνωστά από το πρωί) και πρόβλεψη αναλυτών νωρίτερα (σωστή 7 στις 10)
  const E = Math.max(1, Math.round(scale * 3));
  for (let e = 0; e < E; e++) {
    const stock = listed[Math.floor(u(40, e) * listed.length)];
    const tick = Math.floor(baseLen * (0.2 + (0.65 * (e + 0.5)) / E + (u(41, e) - 0.5) * 0.08));
    const good = u(42, e) < 0.5;
    const dir: 1 | -1 = good ? 1 : -1;
    const mag = 0.08 + u(43, e) * 0.08;
    out.push({
      id: 120 + e, tick, stock, dir, real: dir, rumor: false, crash: false, start: tick + 1, dur: 4, mag,
      kind: good ? 'earn-good' : 'earn-bad', text: Math.floor(u(44, e) * (good ? EARN_GOOD : EARN_BAD).length), sched: true,
    });
    const right = u(45, e) < 0.7;
    const adir: 1 | -1 = right ? dir : (-dir as 1 | -1);
    const at = Math.max(15, Math.floor(tick * (0.35 + u(46, e) * 0.3)));
    out.push({
      id: 140 + e, tick: at, stock, dir: adir, real: adir, rumor: false, crash: false, start: at + 2, dur: 8, mag: 0.015,
      kind: adir > 0 ? 'analyst-up' : 'analyst-down', text: 0,
    });
  }
  // κραχ και ράλι: εξίσου συχνά, ώστε η αγορά να μη γέρνει προς τα κάτω
  if (u(20) < crashChance(day)) {
    const tick = Math.floor(baseLen * (0.3 + u(21) * 0.55));
    out.push({
      id: 99, tick, stock: -1, dir: -1, real: -1, rumor: false, crash: true,
      start: tick + 2, dur: 10, mag: 0.1 + u(22) * 0.08, kind: 'crash', text: Math.floor(u(23) * CRASH.length),
    });
  }
  if (u(30) < crashChance(day)) {
    const tick = Math.floor(baseLen * (0.2 + u(31) * 0.6));
    out.push({
      id: 98, tick, stock: -1, dir: 1, real: 1, rumor: false, crash: false,
      start: tick + 2, dur: 12, mag: 0.07 + u(32) * 0.06, kind: 'rally', text: Math.floor(u(33) * RALLY.length),
    });
  }
  // γεγονότα: hints για αύριο και ό,τι γίνεται σήμερα
  const ev = (k: number, kind: NewsKind, stock: number, tick: number, dir: 1 | -1, mag: number, dur: number, pool: number) =>
    out.push({
      id: 200 + k, tick, stock, dir, real: dir, rumor: false, crash: false, start: tick + 2, dur, mag, kind,
      text: Math.floor(uniform(seed, day, 7600, k) * pool),
    });
  ctx.events.forEach((e, k) => {
    const at = (a: number, b: number) => Math.floor(baseLen * (a + uniform(seed, day, 7700, k) * (b - a)));
    if (e.day === day + 1 && e.kind === 'ipo') ev(k, e.hot ? 'ipo-hot' : 'ipo-cold', e.stock, at(0.25, 0.75), 1, 0, 1, (e.hot ? IPO_HINT_HOT : IPO_HINT_COLD).length);
    if (e.day === day + 1 && e.kind === 'bust' && listed.includes(e.stock)) ev(k, 'bust-hint', e.stock, at(0.3, 0.8), -1, 0.05, 10, BUST_HINT.length);
    if (e.day === day && e.kind === 'ipo') ev(k, 'ipo', e.stock, 6, 1, 0, 1, IPO_DAY.length);
    if (e.day === day && e.kind === 'bust') {
      if (e.real) ev(k, 'bust', e.stock, at(0.25, 0.6), -1, 2.0, 30, BUST.length);
      else ev(k, 'bust-false', e.stock, at(0.2, 0.5), 1, 0.12, 12, BUST_FALSE.length);
    }
  });
  (ctx.boosts ?? []).forEach((b, k) => {
    if (!b.news) return;
    out.push({
      id: 300 + k, tick: Math.max(4, b.start - 3), stock: b.stock, dir: 1, real: 1, rumor: false, crash: false,
      start: b.start, dur: b.dur, mag: b.mag, kind: b.spec ? 'spec-up' : 'up', text: b.text, boost: true,
    });
  });
  return out.sort((a, b) => a.tick - b.tick);
}

/**
 * Πόσο θα μπορούσε να κερδίσει κάποιος σήμερα μόνο με αγορές (long), με ως 2 διαδοχικές συναλλαγές,
 * κοιτάζοντας ανά 5″ και πληρώνοντας προμήθειες. Μέτρο του αν η μέρα δίνει ευκαιρίες.
 */
export function bestLongGain(data: Float64Array[], listed: number[], len: number, step = 10, fee = 0.005): number {
  // c[k]: μετρητά μετά από k ολοκληρωμένες συναλλαγές· h[k][i]: αξία αν κρατάς τη μετοχή i στην (k+1)-οστή
  const K = 2;
  const c = new Float64Array(K + 1).fill(-Infinity);
  c[0] = 1;
  const h = Array.from({ length: K }, () => new Float64Array(listed.length).fill(-Infinity));
  let prev = 0;
  for (let t = 0; t <= len; t += step) {
    for (let k = 0; k < K; k++) {
      listed.forEach((id, i) => {
        const a = data[id];
        if (h[k][i] > -Infinity) h[k][i] *= a[t] / a[prev];
      });
    }
    for (let k = K - 1; k >= 0; k--) {
      listed.forEach((_, i) => {
        if (h[k][i] > -Infinity) c[k + 1] = Math.max(c[k + 1], h[k][i] * (1 - fee));
        if (c[k] > -Infinity) h[k][i] = Math.max(h[k][i], c[k] * (1 - fee));
      });
    }
    prev = t;
  }
  return Math.max(...c) - 1;
}

/** Χρονικές ζώνες με δική τους τάση: όποιος διαβάζει το γράφημα κερδίζει. */
function segments(seed: number, day: number, baseLen: number): number[] {
  // 2–3 ζώνες τη μέρα: τάσεις που κρατάνε, για όποιον διαβάζει το γράφημα
  const k = 2 + (hash(seed, day, 8100) % 2);
  const cuts = [0];
  for (let i = 1; i < k; i++) cuts.push(Math.floor((baseLen * (i + (uniform(seed, day, 8200, i) - 0.5) * 0.6)) / k));
  return cuts;
}

/**
 * Οι τιμές όλων των μετοχών για όλη τη μέρα: prices[s][t], t = 0..len (το 0 είναι το άνοιγμα).
 * Οι τιμές μετά το «τώρα» είναι ήδη γνωστές στη συσκευή: έτσι δουλεύει η εσωτερική πληροφορία.
 */
export function computeDay(p: DayParams): Float64Array[] {
  const { seed, day, len, baseLen } = p;
  const news = dayNews(seed, day, baseLen, p.ctx);
  const volMul = VOL_MUL[p.difficulty];
  const cuts = segments(seed, day, baseLen);
  const out: Float64Array[] = [];
  const listed = new Set((p.ctx ?? DEFAULT_CTX).listed);
  for (let s = 0; s < STOCK_COUNT; s++) {
    const def = STOCKS[s];
    if (!listed.has(s)) {
      // εκτός χρηματιστηρίου: σταθερή τιμή (δεν διαπραγματεύεται)
      out.push(new Float64Array(len + 1).fill(p.opens[s] ?? def.base));
      continue;
    }
    const vm = p.volMul?.[s] ?? 1;
    const drift = new Float64Array(len + 1);
    const halted = new Uint8Array(len + 1);
    const add = (start: number, dur: number, total: number) => {
      for (let k = 0; k < dur; k++) {
        const t = start + k;
        if (t >= 1 && t <= len) drift[t] += total / dur;
      }
    };
    for (const n of news) {
      if (n.crash) {
        // κραχ και μετά ανάκαμψη κατά το μεγαλύτερο μέρος
        const m = n.mag * (0.6 + 0.4 * def.beta);
        add(n.start, n.dur, -m);
        add(n.start + n.dur + 10, 80, m * 0.85);
      } else if (n.kind === 'rally') {
        const m = n.mag * (0.6 + 0.4 * def.beta);
        add(n.start, n.dur, m);
        add(n.start + n.dur + 10, 80, -m * 0.3);
      } else if (n.boost || n.kind === 'ipo' || n.kind === 'ipo-hot' || n.kind === 'ipo-cold') continue;
      else if (n.sector !== undefined) {
        if (SECTORS[n.sector]?.id === def.sector) add(n.start, n.dur, n.real * n.mag);
      }
      else if (n.stock === -1) add(n.start, n.dur, n.real * n.mag * def.beta);
      else if (n.stock === s) add(n.start, n.dur, n.real * n.mag);
    }
    for (const b of p.ctx?.boosts ?? []) if (b.stock === s) add(b.start, b.dur, b.mag);
    for (const e of p.effects) {
      if (e.stock !== s) continue;
      const d = EFFECT_LEN[e.kind];
      if (e.kind === 'halt') for (let k = 0; k < d; k++) { const t = e.start + k; if (t >= 1 && t <= len) halted[t] = 1; }
      else add(e.start, d, e.kind === 'pump' ? PUMP_MOVE : -PUMP_MOVE);
    }
    const prices = new Float64Array(len + 1);
    let lp = Math.log(Math.max(MIN_PRICE, p.opens[s] ?? def.base));
    const lbase = Math.log(def.base);
    prices[0] = Math.exp(lp);
    let seg = 0;
    let segDrift = normal(seed, day, 8300 + s, 0) * TREND * vm;
    for (let t = 1; t <= len; t++) {
      while (seg + 1 < cuts.length && t >= cuts[seg + 1]) {
        seg++;
        segDrift = normal(seed, day, 8300 + s, seg) * TREND * vm;
      }
      if (halted[t]) {
        prices[t] = prices[t - 1];
        continue;
      }
      const mu = segDrift - REVERSION * (lp - lbase) + drift[t];
      lp += mu + def.vol * NOISE * volMul * vm * normal(seed, day, s, t);
      if (lp < Math.log(MIN_PRICE)) lp = Math.log(MIN_PRICE);
      prices[t] = Math.exp(lp);
    }
    out.push(prices);
  }
  return out;
}

/** Τιμές ανοίγματος της πρώτης μέρας. */
export function firstOpens(): number[] {
  return STOCKS.map((s) => s.base);
}

/** Μικρή στρογγυλοποίηση για να μην ξεφεύγουν δεκαδικά από συσκευή σε συσκευή. */
export const round2 = (x: number) => Math.round(x * 100) / 100;
