// Η αγορά: τιμές που προκύπτουν ντετερμινιστικά από το seed της παρτίδας, τη μέρα, τις ειδήσεις
// και τα αντικείμενα που χρησιμοποίησαν οι παίκτες. Κάθε συσκευή τις υπολογίζει μόνη της.

import { hash, normal, uniform } from './rng';
import { STOCKS, STOCK_COUNT } from './stocks';
import {
  BUST, BUST_FALSE, BUST_HINT, CRASH, GENERIC_DOWN, GENERIC_UP, IPO_DAY, IPO_HINT_COLD, IPO_HINT_HOT, MARKET_DOWN, MARKET_UP, SPECIFIC,
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
  | 'ipo-hot' | 'ipo-cold' | 'ipo' | 'bust-hint' | 'bust' | 'bust-false';

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
const REVERSION = 0.0004;
const MIN_PRICE = 0.3;

export function crashChance(day: number): number {
  return Math.min(0.6, 0.12 + 0.05 * day);
}

/** Οι ειδήσεις της μέρας. Εξαρτώνται μόνο από seed, μέρα και βασική διάρκεια. */
export function dayNews(seed: number, day: number, baseLen: number, ctx: DayCtx = DEFAULT_CTX): NewsEvent[] {
  const listed = ctx.listed.length ? ctx.listed : DEFAULT_CTX.listed;
  const out: NewsEvent[] = [];
  const u = (...k: number[]) => uniform(seed, day, 7000 + k[0], k[1] ?? 0, k[2] ?? 0);
  const count = Math.max(2, Math.round((baseLen / 600) * (5 + u(1) * 3.99)));
  const from = 40;
  const to = baseLen - 40;
  const slot = (to - from) / count;
  for (let i = 0; i < count; i++) {
    const tick = Math.floor(from + slot * i + u(2, i) * slot * 0.8);
    const market = u(3, i) < 0.12;
    const stock = market ? -1 : listed[Math.floor(u(4, i) * listed.length)];
    const dir: 1 | -1 = u(5, i) < 0.5 ? 1 : -1;
    const rumor = !market && u(6, i) < 0.25;
    const real: 1 | -1 = rumor && u(7, i) < 0.5 ? (-dir as 1 | -1) : dir;
    const mag = market ? 0.04 + u(8, i) * 0.05 : (0.06 + u(8, i) * 0.14) * (rumor ? 0.6 : 1);
    const start = tick + 2 + Math.floor(u(9, i) * 5);
    const dur = 6 + Math.floor(u(10, i) * 11);
    const specific = !market && u(11, i) < 0.45 && !!SPECIFIC[stock];
    let kind: NewsKind;
    let pool: number;
    if (market) {
      kind = dir > 0 ? 'mkt-up' : 'mkt-down';
      pool = (dir > 0 ? MARKET_UP : MARKET_DOWN).length;
    } else if (specific) {
      kind = dir > 0 ? 'spec-up' : 'spec-down';
      pool = dir > 0 ? SPECIFIC[stock].up.length : SPECIFIC[stock].down.length;
    } else {
      kind = dir > 0 ? 'up' : 'down';
      pool = (dir > 0 ? GENERIC_UP : GENERIC_DOWN).length;
    }
    const text = Math.floor(u(12, i) * pool);
    out.push({ id: i, tick, stock, dir, real, rumor, crash: false, start, dur, mag, kind, text });
  }
  if (u(20) < crashChance(day)) {
    const tick = Math.floor(baseLen * (0.3 + u(21) * 0.55));
    out.push({
      id: 99, tick, stock: -1, dir: -1, real: -1, rumor: false, crash: true,
      start: tick + 2, dur: 10, mag: 0.12 + u(22) * 0.1, kind: 'crash', text: Math.floor(u(23) * CRASH.length),
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
  return out.sort((a, b) => a.tick - b.tick);
}

/** Χρονικές ζώνες με δική τους τάση: όποιος διαβάζει το γράφημα κερδίζει. */
function segments(seed: number, day: number, baseLen: number): number[] {
  const k = 3 + (hash(seed, day, 8100) % 3);
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
        const m = n.mag * (0.6 + 0.4 * def.beta);
        add(n.start, n.dur, -m);
        add(n.start + n.dur + 10, 60, m * 0.4);
      } else if (n.kind === 'ipo' || n.kind === 'ipo-hot' || n.kind === 'ipo-cold') continue;
      else if (n.stock === -1) add(n.start, n.dur, n.real * n.mag * def.beta);
      else if (n.stock === s) add(n.start, n.dur, n.real * n.mag);
    }
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
    let segDrift = normal(seed, day, 8300 + s, 0) * 0.00018 * vm * vm;
    for (let t = 1; t <= len; t++) {
      while (seg + 1 < cuts.length && t >= cuts[seg + 1]) {
        seg++;
        segDrift = normal(seed, day, 8300 + s, seg) * 0.00018 * vm * vm;
      }
      if (halted[t]) {
        prices[t] = prices[t - 1];
        continue;
      }
      const mu = segDrift - REVERSION * (lp - lbase) + drift[t];
      lp += mu + def.vol * volMul * vm * normal(seed, day, s, t);
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
