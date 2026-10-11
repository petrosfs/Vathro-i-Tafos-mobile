// Η μηχανή κανόνων. Την τρέχει μόνο ο host (ή το κινητό σου στο solo)· οι υπόλοιποι λαμβάνουν
// την κατάσταση. Οι συναρτήσεις αλλάζουν την κατάσταση επί τόπου και δεν διαβάζουν ρολόι.

import type { Difficulty, Effect } from './market';
import { firstOpens } from './market';
import {
  COFFEE_MAX, COFFEE_TICKS, INTEREST, INVENTORY_SLOTS, ITEM, ITEMS, LOAN_COST, LOAN_SHARE,
  SHOP_OFFERS, STOP_LOSS, type ConsumableId, type ItemId, type PerkId,
} from './items';
import { hash, stream } from './rng';
import {
  available, ESPRESSO_TICKS, KOURABIE_TICKS, MAX_DECOR, OFFICE_DEF, type DecorId, type OfficeId, type UpgradeId,
} from './office';
import { STOCK_COUNT } from './stocks';

export interface Look {
  suit: number;
  skin: number;
  hair: number;
  hairColor: number;
  hat: number;
  tie: number;
  glasses: number;
}

export interface GameConfig {
  /** Διάρκεια μέρας σε ticks (600 = 5 λεπτά). */
  dayLen: number;
  difficulty: Difficulty;
  /** Μέρες ως το βάθρο· 0 = χωρίς τέλος. */
  podiumDays: number;
  startCash: number;
  /** Πότε τελειώνει η παρτίδα: με την πρώτη αποτυχία στόχου ή μόνο με χρεωκοπία. */
  endRule?: EndRule;
  /** Όριο χρεωκοπίας σε % του αρχικού κεφαλαίου (0–15, προεπιλογή 10). */
  bankruptPct?: number;
}

export type EndRule = 'quota' | 'bankrupt';

export const DEFAULT_CONFIG: GameConfig = { dayLen: 600, difficulty: 'normal', podiumDays: 10, startCash: 10000, endRule: 'quota', bankruptPct: 10 };

/** Χρεωκοπία: ταμείο κάτω από αυτό το ποσοστό (%) του αρχικού κεφαλαίου στο τέλος της μέρας. */
export const BANKRUPT_PCT_DEFAULT = 10;
export const BANKRUPT_PCT_MAX = 15;

export function bankruptPct(c: GameConfig): number {
  const v = Math.round(Number(c.bankruptPct ?? BANKRUPT_PCT_DEFAULT));
  return Number.isFinite(v) ? Math.max(0, Math.min(BANKRUPT_PCT_MAX, v)) : BANKRUPT_PCT_DEFAULT;
}
/** Με το αλεξίπτωτο, μετά από χρεωκοπία το ταμείο ξαναγεμίζει ως εδώ. */
export const RESCUE_SHARE = 0.25;

export interface Position {
  id: number;
  owner: string;
  stock: number;
  /** 1 = αγορά (long), -1 = ανοιχτή πώληση (short). */
  side: 1 | -1;
  qty: number;
  entry: number;
  margin: number;
  openFee: number;
  lev: number;
  tick: number;
}

export interface PlayerStats {
  trades: number;
  pnl: number;
  best: number;
  worst: number;
  items: number;
  volume: number;
  liquidations: number;
}

export interface PlayerState {
  name: string;
  look: Look;
  inv: ConsumableId[];
  /** Η επόμενη θέση θα έχει μόχλευση. */
  lev: boolean;
  ready: boolean;
  stats: PlayerStats;
  /** Κέρδος/ζημιά της τρέχουσας μέρας από κλεισμένες θέσεις. */
  dayPnl: number;
  /** Διακοσμητικά στο γραφείο του. */
  decor: DecorId[];
}

export interface DayResult {
  day: number;
  quota: number;
  profit: number;
  passed: boolean;
  saved: boolean;
  coins: number;
  equity: number;
  /** Έκλεισε επειδή χρεωκόπησε (κανόνας «χρεωκοπία»). */
  bankrupt?: boolean;
}

export type LogKind = 'open' | 'close' | 'liq' | 'stop' | 'item' | 'buy' | 'eod';

export interface LogEntry {
  n: number;
  day: number;
  tick: number;
  kind: LogKind;
  who: string;
  stock?: number;
  side?: 1 | -1;
  amount?: number;
  pnl?: number;
  item?: ItemId;
  office?: OfficeId;
}

export interface Tip {
  stock: number;
  from: number;
  by: string;
}

export interface Scoop {
  from: number;
  by: string;
}

export type Phase = 'shop' | 'trading' | 'ended';

export interface GameState {
  rev: number;
  seed: number;
  config: GameConfig;
  phase: Phase;
  day: number;
  /** Χρόνος (ρολόι του server) όπου ξεκινά το tick 0 της μέρας. */
  startAt: number;
  len: number;
  coffee: number;
  opens: number[];
  cash: number;
  debt: number;
  dayStartEquity: number;
  quota: number;
  coins: number;
  perks: PerkId[];
  positions: Position[];
  effects: Effect[];
  tips: Tip[];
  scoops: Scoop[];
  players: Record<string, PlayerState>;
  order: string[];
  offers: (ItemId | null)[];
  rerolls: number;
  history: DayResult[];
  log: LogEntry[];
  result: 'podium' | 'grave' | null;
  /** Μέχρι ποιο tick έχουν ελεγχθεί stop-loss και ρευστοποιήσεις. */
  checked: number;
  nextId: number;
  logN: number;
  /** Έκδοση της μορφής της κατάστασης (για αποθηκευμένες παρτίδες από παλιότερες εκδόσεις). */
  schema: number;
  /** Ξεκλειδωμένα αντικείμενα γραφείου (από όλους τους παίκτες μαζί). */
  unlocked: OfficeId[];
  /** Αναβαθμίσεις γραφείου της ομάδας. */
  office: UpgradeId[];
}

export const SCHEMA = 2;

export type Action =
  | { t: 'open'; stock: number; side: 1 | -1; amount: number; tick: number }
  | { t: 'close'; id: number; tick: number }
  | { t: 'closeAll'; tick: number }
  | { t: 'use'; slot: number; stock?: number; tick: number }
  | { t: 'buy'; offer: number }
  | { t: 'reroll' }
  | { t: 'ready'; v: boolean }
  | { t: 'decor'; id: DecorId }
  | { t: 'upgrade'; id: UpgradeId }
  | { t: 'unlock'; ids: string[] };

export type ActionError =
  | 'phase' | 'tick' | 'amount' | 'cash' | 'stock' | 'perk' | 'max' | 'gone' | 'owner'
  | 'slot' | 'coins' | 'full' | 'owned' | 'player' | 'locked';

export type Prices = (stock: number, tick: number) => number;

export const MAX_POSITIONS = 8;
export const START_COINS = 4;
const LOG_KEEP = 25;

export const feeRate = (s: GameState) => (s.perks.includes('fees') ? 0.001 : 0.005);

const QUOTA: Record<Difficulty, { q0: number; g: number }> = {
  easy: { q0: 0.07, g: 1.22 },
  normal: { q0: 0.09, g: 1.3 },
  hard: { q0: 0.12, g: 1.38 },
};

/** Ο στόχος κέρδους μιας μέρας. */
export function quotaFor(s: GameState, day = s.day): number {
  const { q0, g } = QUOTA[s.config.difficulty];
  const n = Math.max(1, s.order.length);
  // Το ταμείο είναι κοινό: περισσότεροι παίκτες βοηθούν, αλλά όχι γραμμικά.
  const crowd = 1 + 0.15 * Math.min(n - 1, 5) + 0.05 * Math.max(0, n - 6);
  const lenMul = s.config.dayLen / 600;
  const raw = s.config.startCash * q0 * Math.pow(g, day - 1) * crowd * (0.6 + 0.4 * lenMul) *
    (s.perks.includes('mentor') ? 0.9 : 1);
  const step = raw < 2000 ? 10 : raw < 20000 ? 50 : 100;
  return Math.round(raw / step) * step;
}

export function newStats(): PlayerStats {
  return { trades: 0, pnl: 0, best: 0, worst: 0, items: 0, volume: 0, liquidations: 0 };
}

export function newPlayer(name: string, look: Look): PlayerState {
  return { name, look, inv: [], lev: false, ready: false, stats: newStats(), dayPnl: 0, decor: [] };
}

export function createGame(
  seed: number, config: GameConfig, players: { uid: string; name: string; look: Look }[], unlocked: string[] = [],
): GameState {
  const s: GameState = {
    rev: 0, seed, config, phase: 'shop', day: 1, startAt: 0, len: config.dayLen, coffee: 0,
    opens: firstOpens(), cash: config.startCash, debt: 0, dayStartEquity: config.startCash, quota: 0,
    coins: START_COINS, perks: [], positions: [], effects: [], tips: [], scoops: [], players: {},
    order: players.map((p) => p.uid), offers: [], rerolls: 0, history: [], log: [], result: null,
    checked: 0, nextId: 1, logN: 0, schema: SCHEMA, office: [],
    unlocked: [...new Set(unlocked)].filter((id) => id in OFFICE_DEF) as OfficeId[],
  };
  for (const p of players) s.players[p.uid] = newPlayer(p.name, p.look);
  s.offers = rollOffers(s);
  s.quota = quotaFor(s);
  return s;
}

export function rollOffers(s: GameState): (ItemId | null)[] {
  const rnd = stream(hash(s.seed, s.day, 5000 + s.rerolls));
  const pool = ITEMS.filter((i) => !(i.kind === 'perk' && s.perks.includes(i.id as PerkId)));
  const out: ItemId[] = [];
  while (out.length < SHOP_OFFERS && pool.length) {
    const total = pool.reduce((a, i) => a + i.weight, 0);
    let r = rnd() * total;
    let k = 0;
    while (k < pool.length - 1 && r >= pool[k].weight) r -= pool[k++].weight;
    out.push(pool[k].id);
    pool.splice(k, 1);
  }
  return out;
}

/** Αξία μιας θέσης αν έκλεινε τώρα, πριν την προμήθεια (ποτέ αρνητική). */
export function posValue(p: Position, price: number): number {
  return Math.max(0, p.margin + p.side * p.qty * (price - p.entry));
}

export function equity(s: GameState, price: (stock: number) => number): number {
  let e = s.cash - s.debt;
  for (const p of s.positions) e += posValue(p, price(p.stock));
  return e;
}

function log(s: GameState, e: Omit<LogEntry, 'n' | 'day'>) {
  s.log.push({ ...e, n: ++s.logN, day: s.day });
  if (s.log.length > LOG_KEEP) s.log.splice(0, s.log.length - LOG_KEEP);
}

function closePosition(s: GameState, p: Position, price: number, tick: number, kind: 'close' | 'liq' | 'stop' | 'eod') {
  const value = posValue(p, price);
  const fee = value > 0 ? feeRate(s) * p.qty * price : 0;
  const back = Math.max(0, value - fee);
  s.cash += back;
  const pnl = back - p.margin - p.openFee;
  s.positions = s.positions.filter((q) => q.id !== p.id);
  const pl = s.players[p.owner];
  if (pl) {
    pl.stats.pnl += pnl;
    pl.dayPnl += pnl;
    pl.stats.best = Math.max(pl.stats.best, pnl);
    pl.stats.worst = Math.min(pl.stats.worst, pnl);
    pl.stats.volume += p.qty * price;
    if (kind === 'liq') pl.stats.liquidations++;
  }
  log(s, { tick, kind, who: p.owner, stock: p.stock, side: p.side, amount: back, pnl });
  return pnl;
}

/** Εφαρμογή μιας κίνησης παίκτη. Επιστρέφει σφάλμα ή null. */
export function applyAction(s: GameState, uid: string, a: Action, prices: Prices): ActionError | null {
  const pl = s.players[uid];
  if (!pl) return 'player';
  switch (a.t) {
    case 'open': {
      if (s.phase !== 'trading') return 'phase';
      if (a.tick < 0 || a.tick >= s.len) return 'tick';
      if (!(a.stock >= 0 && a.stock < STOCK_COUNT)) return 'stock';
      if (a.side === -1 && !s.perks.includes('short')) return 'perk';
      if (a.side !== 1 && a.side !== -1) return 'stock';
      if (s.positions.filter((p) => p.owner === uid).length >= MAX_POSITIONS) return 'max';
      if (!(a.amount >= 1)) return 'amount';
      const lev = pl.lev ? 3 : 1;
      const rate = feeRate(s);
      let amount = a.amount;
      if (amount * (1 + rate * lev) > s.cash) amount = s.cash / (1 + rate * lev);
      if (amount < 1) return 'cash';
      const price = prices(a.stock, a.tick);
      const fee = rate * amount * lev;
      s.cash -= amount + fee;
      pl.lev = false;
      const p: Position = {
        id: s.nextId++, owner: uid, stock: a.stock, side: a.side, qty: (amount * lev) / price, entry: price,
        margin: amount, openFee: fee, lev, tick: a.tick,
      };
      s.positions.push(p);
      pl.stats.trades++;
      pl.stats.volume += amount * lev;
      log(s, { tick: a.tick, kind: 'open', who: uid, stock: a.stock, side: a.side, amount });
      return null;
    }
    case 'close': {
      if (s.phase !== 'trading') return 'phase';
      const p = s.positions.find((q) => q.id === a.id);
      if (!p) return 'gone';
      if (p.owner !== uid) return 'owner';
      const tick = Math.max(p.tick, Math.min(a.tick, s.len));
      closePosition(s, p, prices(p.stock, tick), tick, 'close');
      return null;
    }
    case 'closeAll': {
      if (s.phase !== 'trading') return 'phase';
      for (const p of s.positions.filter((q) => q.owner === uid)) {
        const tick = Math.max(p.tick, Math.min(a.tick, s.len));
        closePosition(s, p, prices(p.stock, tick), tick, 'close');
      }
      return null;
    }
    case 'use': {
      if (s.phase !== 'trading') return 'phase';
      if (a.tick < 0 || a.tick >= s.len) return 'tick';
      const id = pl.inv[a.slot];
      if (!id) return 'slot';
      const def = ITEM[id];
      if (def.needsStock && !(a.stock !== undefined && a.stock >= 0 && a.stock < STOCK_COUNT)) return 'stock';
      switch (id) {
        case 'tip':
          s.tips.push({ stock: a.stock!, from: a.tick, by: uid });
          break;
        case 'pump':
        case 'dump':
        case 'halt':
          s.effects.push({ kind: id, stock: a.stock!, start: a.tick + 1, by: uid });
          break;
        case 'coffee':
          if (s.coffee + COFFEE_TICKS > COFFEE_MAX) return 'max';
          s.coffee += COFFEE_TICKS;
          s.len += COFFEE_TICKS;
          break;
        case 'lev':
          if (pl.lev) return 'max';
          pl.lev = true;
          break;
        case 'loan': {
          if (s.cash <= 1) return 'cash';
          const l = Math.round(s.cash * LOAN_SHARE);
          s.cash += l;
          s.debt += l * (1 + LOAN_COST);
          break;
        }
        case 'scoop':
          s.scoops.push({ from: a.tick, by: uid });
          break;
      }
      pl.inv.splice(a.slot, 1);
      pl.stats.items++;
      log(s, { tick: a.tick, kind: 'item', who: uid, item: id, stock: def.needsStock ? a.stock : undefined });
      return null;
    }
    case 'buy': {
      if (s.phase !== 'shop') return 'phase';
      const id = s.offers[a.offer];
      if (!id) return 'gone';
      const def = ITEM[id];
      if (s.coins < def.price) return 'coins';
      if (def.kind === 'consumable') {
        if (pl.inv.length >= INVENTORY_SLOTS) return 'full';
        pl.inv.push(id as ConsumableId);
      } else {
        if (s.perks.includes(id as PerkId)) return 'owned';
        s.perks.push(id as PerkId);
        if (id === 'mentor') s.quota = quotaFor(s);
      }
      s.coins -= def.price;
      s.offers[a.offer] = null;
      log(s, { tick: -1, kind: 'buy', who: uid, item: id });
      return null;
    }
    case 'reroll': {
      if (s.phase !== 'shop') return 'phase';
      const cost = rerollCost(s);
      if (s.coins < cost) return 'coins';
      s.coins -= cost;
      s.rerolls++;
      s.offers = rollOffers(s);
      return null;
    }
    case 'ready': {
      if (s.phase !== 'shop') return 'phase';
      pl.ready = !!a.v;
      return null;
    }
    case 'unlock': {
      // νέο μόνιμο ξεκλείδωμα κάποιου παίκτη: διαθέσιμο αμέσως και σε αυτή την παρτίδα
      const ids = (Array.isArray(a.ids) ? a.ids : []).filter((id) => id in OFFICE_DEF) as OfficeId[];
      s.unlocked = [...new Set([...s.unlocked, ...ids])];
      return null;
    }
    case 'decor': {
      if (s.phase !== 'shop') return 'phase';
      const def = OFFICE_DEF[a.id];
      if (!def || def.kind !== 'decor') return 'gone';
      if (!available(a.id, s.unlocked)) return 'locked';
      if (pl.decor.length >= MAX_DECOR) return 'full';
      if (pl.decor.includes(a.id)) return 'owned';
      if (s.coins < def.price) return 'coins';
      s.coins -= def.price;
      pl.decor.push(a.id);
      log(s, { tick: -1, kind: 'buy', who: uid, office: a.id });
      return null;
    }
    case 'upgrade': {
      if (s.phase !== 'shop') return 'phase';
      const def = OFFICE_DEF[a.id];
      if (!def || def.kind !== 'upgrade') return 'gone';
      if (!available(a.id, s.unlocked)) return 'locked';
      if (s.office.includes(a.id)) return 'owned';
      if (s.coins < def.price) return 'coins';
      s.coins -= def.price;
      s.office.push(a.id);
      log(s, { tick: -1, kind: 'buy', who: uid, office: a.id });
      return null;
    }
  }
}

export const rerollCost = (s: GameState) => 1 + s.rerolls;

/** Όλοι οι συνδεδεμένοι παίκτες είναι έτοιμοι για την επόμενη μέρα. */
export function allReady(s: GameState, online: (uid: string) => boolean): boolean {
  const here = s.order.filter((u) => online(u) && s.players[u]);
  return here.length > 0 && here.every((u) => s.players[u].ready);
}

export function startDay(s: GameState, startAt: number) {
  s.phase = 'trading';
  s.startAt = startAt;
  s.len = s.config.dayLen + (s.office.includes('espresso') ? ESPRESSO_TICKS : 0) + (s.office.includes('kourabie') ? KOURABIE_TICKS : 0);
  s.coffee = 0;
  s.checked = 0;
  s.quota = quotaFor(s);
  s.dayStartEquity = s.cash - s.debt;
  for (const u of s.order) {
    const p = s.players[u];
    if (p) {
      p.ready = false;
      p.dayPnl = 0;
    }
  }
}

/** Έλεγχος stop-loss και ρευστοποιήσεων ως το tick (χωρίς να ξεπερνά το τέλος της μέρας). */
export function advance(s: GameState, tick: number, prices: Prices) {
  if (s.phase !== 'trading') return;
  const upTo = Math.min(tick, s.len);
  const stop = s.perks.includes('stop');
  for (let t = s.checked + 1; t <= upTo; t++) {
    for (const p of [...s.positions]) {
      if (t <= p.tick) continue;
      const price = prices(p.stock, t);
      const v = posValue(p, price);
      if (v <= 0) closePosition(s, p, price, t, 'liq');
      else if (stop && (v - p.margin) / p.margin <= -STOP_LOSS) closePosition(s, p, price, t, 'stop');
    }
  }
  if (upTo > s.checked) s.checked = upTo;
}

/** Τέλος μέρας: κλείνουν όλες οι θέσεις, εξοφλείται το δάνειο, κρίνεται ο στόχος. */
export function endDay(s: GameState, prices: Prices): DayResult {
  advance(s, s.len, prices);
  for (const p of [...s.positions]) closePosition(s, p, prices(p.stock, s.len), s.len, 'eod');
  s.cash -= s.debt;
  s.debt = 0;
  if (s.perks.includes('interest') && s.cash > 0) s.cash += s.cash * INTEREST;
  s.cash = Math.round(s.cash * 100) / 100;
  const profit = s.cash - s.dayStartEquity;
  const passed = profit >= s.quota && s.cash > 0;
  const bankruptRule = s.config.endRule === 'bankrupt';
  // με όριο 0% χρεωκοπία σημαίνει άδειο ταμείο
  let bankrupt = bankruptRule && (s.cash < (s.config.startCash * bankruptPct(s.config)) / 100 || s.cash <= 0);
  let saved = false;
  let coins = 0;
  if (passed) {
    coins = 3 + Math.max(0, Math.min(5, Math.floor((profit - s.quota) / (s.quota * 0.25))));
    if (s.perks.includes('piggy')) coins += 2;
    if (s.office.includes('goldbell')) coins += 1;
  }
  if (bankruptRule) {
    // Με χρεωκοπία: ο χαμένος στόχος κοστίζει μόνο τα νομίσματα· τέλος αν αδειάσει το ταμείο.
    if (bankrupt && s.perks.includes('parachute')) {
      saved = true;
      bankrupt = false;
      s.perks = s.perks.filter((p) => p !== 'parachute');
      s.cash = Math.max(s.cash, Math.round(s.config.startCash * RESCUE_SHARE));
    }
  } else if (!passed && s.perks.includes('parachute') && s.cash > 0) {
    saved = true;
    s.perks = s.perks.filter((p) => p !== 'parachute');
    coins = 1;
  }
  s.coins += coins;
  const r: DayResult = { day: s.day, quota: s.quota, profit, passed, saved, coins, equity: s.cash, bankrupt };
  s.history.push(r);
  const opens: number[] = [];
  for (let k = 0; k < STOCK_COUNT; k++) opens.push(Math.round(prices(k, s.len) * 10000) / 10000);
  s.opens = opens;
  s.effects = [];
  s.tips = [];
  s.scoops = [];
  for (const u of s.order) if (s.players[u]) s.players[u].lev = false;
  const over = bankruptRule ? bankrupt : !passed && !saved;
  if (over) {
    s.phase = 'ended';
    s.result = 'grave';
  } else if (s.config.podiumDays > 0 && s.day >= s.config.podiumDays) {
    s.phase = 'ended';
    s.result = 'podium';
  } else {
    s.day++;
    s.phase = 'shop';
    s.rerolls = 0;
    s.offers = rollOffers(s);
    s.quota = quotaFor(s);
    s.len = s.config.dayLen;
    s.coffee = 0;
  }
  return r;
}

/** Τρέχον tick από το ρολόι (μπορεί να είναι αρνητικό στην αντίστροφη μέτρηση). */
export function tickAt(s: GameState, now: number, tickMs: number): number {
  return Math.floor((now - s.startAt) / tickMs);
}

/** Κατάταξη για το βάθρο: συνολικό κέρδος από συναλλαγές. */
export function ranking(s: GameState): string[] {
  return [...s.order].filter((u) => s.players[u]).sort((a, b) => s.players[b].stats.pnl - s.players[a].stats.pnl);
}
