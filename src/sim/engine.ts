// Η μηχανή κανόνων. Την τρέχει μόνο ο host (ή το κινητό σου στο solo)· οι υπόλοιποι λαμβάνουν
// την κατάσταση. Οι συναρτήσεις αλλάζουν την κατάσταση επί τόπου και δεν διαβάζουν ρολόι.

import type { Boost, DayCtx, Difficulty, Effect, StockEvent } from './market';
import { bestLongGain, computeDay, firstOpens } from './market';
import { GENERIC_UP, SPECIFIC } from './headlines';
import {
  COFFEE_MAX, COFFEE_TICKS, HONEY_HEAT, INTEREST, INVENTORY_SLOTS, ITEM, ITEMS, LOAN_COST, LOAN_SHARE,
  SHOP_OFFERS, STOP_LOSS, type ConsumableId, type ItemId, type PerkId,
} from './items';
import { hash, stream, uniform } from './rng';
import { newSlot, slotBets, spinSlot, type SlotState } from './slot';
import {
  available, ESPRESSO_TICKS, KOURABIE_TICKS, MAX_DECOR, OFFICE, OFFICE_DEF, type DecorId, type OfficeId, type UpgradeId,
} from './office';
import { MAX_LISTED, START_LISTED, STOCKS, STOCK_COUNT } from './stocks';
import {
  BOT_HOLD, BOT_PERIOD, BOT_TIERS, botKey, botLook, botName, botPick, clampTier, MAX_SLAVES, MAX_TEAM_BOTS, SLAVE_SIZE,
  type BotInfo, type BotKind,
} from './bots';

export interface Look {
  suit: number;
  skin: number;
  hair: number;
  hairColor: number;
  hat: number;
  tie: number;
  glasses: number;
  /** Πρόσωπο: μάτια, στόμα, φρύδια/έκφραση (προαιρετικά για παλιά προφίλ). */
  eyes?: number;
  mouth?: number;
  brows?: number;
  /** Μούσι: 0 κανένα, 1 μουστάκι, 2 γενάκι, 3 γένια, 4 αξύριστος. */
  beard?: number;
  /** Σχήμα κεφαλιού: 0 αβγό, 1 φαρδύ σαγόνι, 2 στρογγυλό. */
  face?: number;
  /** Πάχος σώματος 0 (αδύνατος) – 100 (χοντρός)· 50 κανονικός. */
  build?: number;
  /** Χρώμα καπέλου και σκελετού γυαλιών (θέση στην παλέτα· −1 το αρχικό του αξεσουάρ). */
  hatColor?: number;
  glassColor?: number;
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
  /** Bonus κάθε παίκτη: % των κερδών του, όταν η ομάδα πιάνει τον στόχο (2, 3 ή 5). */
  bonusPct?: number;
  /** Bots από την αρχή της παρτίδας (μέλη της ομάδας) και το επίπεδό τους (0–3). */
  bots?: number;
  botTier?: number;
  /** +1% bonus για κάθε επίπεδο χώρου πάνω από το γκαράζ (1 = ναι, 0 = όχι). */
  venueBonus?: number;
}

export type EndRule = 'quota' | 'bankrupt';

export const DEFAULT_CONFIG: GameConfig = {
  dayLen: 600, difficulty: 'normal', podiumDays: 10, startCash: 10000, endRule: 'quota', bankruptPct: 10, bonusPct: 3, bots: 0, botTier: 1,
  venueBonus: 1,
};

/** Γραφεία στο γραφείο: παίκτες και bots μαζί. */
export const MAX_PLAYERS = 10;
export const BONUS_PCTS = [2, 3, 5];
/** Το bonus ανεβαίνει (upgrade, καλές μέρες) ως εδώ. */
export const BONUS_MAX = 10;

export function bonusBase(c: GameConfig): number {
  return BONUS_PCTS.includes(Number(c.bonusPct)) ? Number(c.bonusPct) : 3;
}

/** Τιμές σε δολάρια (πορτοφόλι) ανάλογα με το αρχικό κεφάλαιο. */
const usd = (s: GameState, base: number) => Math.round((base * s.config.startCash) / 10000);
/** Ένα διακοσμητικό κοστίζει τόσα δολάρια ανά «νόμισμα» της τιμής του. */
export const DECOR_USD = 20;
export const decorPrice = (s: GameState, id: DecorId) => usd(s, OFFICE_DEF[id].price * DECOR_USD);
export const slavePrice = (s: GameState, tier: number) => usd(s, BOT_TIERS[clampTier(tier)].usd);

/** Το ποσοστό bonus ενός παίκτη. */
export function bonusRate(s: GameState, p: PlayerState): number {
  const venue = s.config.venueBonus === 0 ? 0 : (s.venue ?? 0);
  return Math.min(BONUS_MAX, bonusBase(s.config) + (s.office.includes('bonuspool') ? 1 : 0) + venue + (p.rate ?? 0));
}

/** Η Επιτροπή Κεφαλαιαγοράς: πάντα στο Δύσκολο, στο Μέτριο όταν το ταμείο φτάσει 3× το αρχικό κεφάλαιο. */
export const SEC_NORMAL_MUL = 3;
export function secEligible(s: GameState): boolean {
  if (s.config.difficulty === 'hard') return true;
  if (s.config.difficulty === 'normal') return s.cash >= s.config.startCash * SEC_NORMAL_MUL;
  return false;
}
export function secChance(s: GameState): number {
  return Math.min(0.85, (s.config.difficulty === 'hard' ? 0.1 : 0) + (s.heat ?? 0) / 100);
}
/** Αντικείμενα που απαγορεύονται όσο ερευνά η Επιτροπή. */
export const SEC_BANNED: ConsumableId[] = ['tip', 'pump', 'dump', 'scoop', 'honey'];

export const isHired = (p: PlayerState | undefined) => p?.bot?.kind === 'team' || p?.bot?.kind === 'slave';

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
  /** Θέση «σκλάβου»: το κέρδος/η ζημιά πάει στο πορτοφόλι αυτού του παίκτη, όχι στο ταμείο. */
  w?: string;
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
  /** Για τον πίνακα της μέρας (scoreboard): συναλλαγές και καλύτερη κλεισμένη θέση σήμερα. */
  dayTrades?: number;
  dayBest?: number;
  /** Διακοσμητικά στο γραφείο του. */
  decor: DecorId[];
  /** Προσωπικό πορτοφόλι (από τα bonus). */
  wallet: number;
  /** Επιπλέον ποσοστό bonus που κέρδισε με πολύ καλές μέρες. */
  rate: number;
  /** Έξτρα οθόνες που αγόρασε για το γραφείο του. */
  screens: number;
  /** Ρολόι: 0 κανένα, 1 χρυσό, 2 διαμαντένιο. */
  watch: number;
  /** Όπλο που πυροβολεί λεφτά. */
  moneyGun: boolean;
  /** Αν είναι bot. */
  bot?: BotInfo;
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
  /** Bonus ανά παίκτη. */
  bonus?: Record<string, number>;
  /** Όσοι πήραν αύξηση ποσοστού επειδή έπιασαν μόνοι τους τον στόχο. */
  stars?: string[];
  /** Έρευνα της Επιτροπής εκείνη τη μέρα και το πρόστιμο. */
  sec?: boolean;
  fine?: number;
  /** Εταιρείες που χρεωκόπησαν και βγήκαν από το χρηματιστήριο. */
  busts?: number[];
  /** Η Επιτροπή σας έπιασε: τέλος, φυλακή. */
  caught?: boolean;
}

export type LogKind = 'open' | 'close' | 'liq' | 'stop' | 'item' | 'buy' | 'eod' | 'hire' | 'fire' | 'move';

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
  /** Πρόσληψη/απόλυση bot: επίπεδο και είδος. */
  tier?: number;
  bk?: BotKind;
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
  /** «Απόσπαση πληροφορίας»: όλες οι σημερινές ειδήσεις μιας μετοχής. */
  honey: Tip[];
  players: Record<string, PlayerState>;
  order: string[];
  offers: (ItemId | null)[];
  rerolls: number;
  history: DayResult[];
  log: LogEntry[];
  result: 'podium' | 'grave' | 'jail' | null;
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
  /** Υποψίες της Επιτροπής Κεφαλαιαγοράς (0–100). */
  heat: number;
  /** Η Επιτροπή ερευνά το fund σήμερα. */
  sec: boolean;
  /** Πόσες «ύποπτες» κινήσεις (εσωτερική πληροφορία, φήμες, ρεπορτάζ) έγιναν σήμερα. */
  insider: number;
  /** Κάποιος χρησιμοποίησε απαγορευμένο αντικείμενο τη μέρα της έρευνας. */
  redHanded?: boolean;
  /** Ο χώρος του fund: 0 γκαράζ, 1 γραφείο σε πολυκατοικία, 2 Wall Street, 3 ρετιρέ. */
  venue: number;
  /** Μετοχές στο χρηματιστήριο (με σειρά εμφάνισης). */
  listed: number[];
  /** Πότε μπήκε κάθε μετοχή στο χρηματιστήριο (για την «ωρίμανση»). */
  born: Record<string, number>;
  /** Νέες εισαγωγές και χρεωκοπίες: σημερινές και αυριανές. */
  events: StockEvent[];
  /** Εταιρείες που χρεωκόπησαν (δεν ξαναμπαίνουν). */
  gone: number[];
  /** Πότε είναι η επόμενη τακτική εισαγωγή. */
  nextIpo: number;
  /** Μετά από μετακόμιση: νέα εισαγωγή την επόμενη μέρα. */
  moveIpo?: boolean;
  /** Εγγυημένες ευκαιρίες της σημερινής μέρας. */
  boosts?: Boost[];
  /** Ο κουλοχέρης του γραφείου (καζάνι και τελευταία τραβήγματα). */
  slot?: SlotState;
}

/** Πόσο «νευρική» είναι μια μετοχή: οι νέες κινούνται πολύ, οι παλιές ηρεμούν· ο πυρετός IPO διπλασιάζει. */
export function volMuls(s: GameState): Record<number, number> {
  const out: Record<number, number> = {};
  for (const id of s.listed) {
    const age = s.day - (s.born?.[id] ?? -10);
    out[id] = 0.85 + 0.5 * Math.exp(-Math.max(0, age) / 5);
  }
  for (const e of s.events) if (e.kind === 'ipo' && e.day === s.day && e.fever && out[e.stock]) out[e.stock] *= 2.2;
  return out;
}

export const dayCtx = (s: GameState): DayCtx => ({ listed: s.listed, events: s.events, boosts: s.boosts ?? [] });

/**
 * Πόσες φορές τον στόχο πρέπει να δίνει (τουλάχιστον) η καλύτερη ευκαιρία της μέρας μόνο με αγορές:
 * έτσι ο στόχος είναι πάντα εφικτός, και η δυσκολία είναι να βρεις το σωστό μονοπάτι.
 */
export const OPPORTUNITY: Record<Difficulty, number> = { easy: 3, normal: 2, hard: 1.5 };

const pricesFor = (s: GameState) => computeDay({
  seed: s.seed, day: s.day, opens: s.opens, baseLen: s.config.dayLen, len: s.len,
  effects: [], difficulty: s.config.difficulty, ctx: dayCtx(s), volMul: volMuls(s),
});

/** Η μεγαλύτερη απόδοση της μέρας μόνο με αγορές (ως 2 διαδοχικές συναλλαγές). */
export const dayOpportunity = (s: GameState) => bestLongGain(pricesFor(s), s.listed, s.len);

/**
 * Αν η αγορά σήμερα δεν δίνει αρκετή ευκαιρία για τον στόχο, προσθέτει 1–2 ανοδικές κινήσεις:
 * άλλοτε με είδηση, άλλοτε μόνο στο γράφημα. Ντετερμινιστικό από τον σπόρο.
 */
export function planBoosts(s: GameState) {
  s.boosts = [];
  const need = (OPPORTUNITY[s.config.difficulty] * s.quota) / Math.max(1, s.dayStartEquity);
  if (!(need > 0) || dayOpportunity(s) >= need) return;
  const u = (...k: number[]) => uniform(s.seed, s.day, 9500, ...k);
  const dying = new Set(s.events.filter((e) => e.kind === 'bust' && e.day === s.day && e.real).map((e) => e.stock));
  const pool = s.listed.filter((id) => !dying.has(id) && (s.born[id] ?? 0) < s.day);
  const cands = pool.length ? pool : s.listed;
  const target = need * 1.05;
  const n = target > 0.5 ? 2 : 1;
  const per = Math.log(1 + target) / n + 0.02;
  const len = s.len;
  const used: number[] = [];
  for (let k = 0; k < n; k++) {
    const left = cands.filter((id) => !used.includes(id));
    const stock = (left.length ? left : cands)[Math.floor(u(1, k) * (left.length || cands.length))];
    used.push(stock);
    const news = u(2, k) < 0.5;
    const dur = news ? 12 + Math.floor(u(3, k) * 18) : 60 + Math.floor(u(3, k) * 50);
    const [a, b] = n === 1 ? [0.12, 0.6] : k === 0 ? [0.08, 0.35] : [0.5, 0.72];
    const start = Math.min(len - dur - 10, Math.floor(len * (a + u(4, k) * (b - a))));
    const spec = news && !!SPECIFIC[stock] && u(5, k) < 0.5;
    const pool2 = spec ? SPECIFIC[stock].up.length : GENERIC_UP.length;
    s.boosts.push({ stock, start: Math.max(8, start), dur, mag: per, news, spec, text: Math.floor(u(6, k) * pool2) });
  }
  // έλεγχος: ο θόρυβος μπορεί να «φάει» μέρος της κίνησης, οπότε τη μεγαλώνουμε όσο χρειάζεται
  for (let i = 0; i < 4; i++) {
    const got = dayOpportunity(s);
    if (got >= need) return;
    const extra = (Math.log(1 + target) - Math.log(1 + Math.max(0, got))) / n + 0.01;
    for (const b of s.boosts) b.mag += extra;
  }
}
export const isListed = (s: GameState, stock: number) => s.listed.includes(stock);

/** Οι χώροι: πότε ανοίγει ο καθένας (× αρχικό κεφάλαιο) και πόσο κοστίζει η μετακόμιση. */
export const VENUES = [
  { glyph: '🏚', unlock: 0, coins: 0, cash: 0 },
  { glyph: '🏢', unlock: 2, coins: 6, cash: 0.4 },
  { glyph: '🏙', unlock: 4, coins: 10, cash: 1 },
  { glyph: '🌇', unlock: 8, coins: 16, cash: 3 },
];
export const MAX_VENUE = VENUES.length - 1;

/** Μόστρα: ρολόγια (χρυσό, διαμαντένιο) και όπλο που πυροβολεί λεφτά, από το πορτοφόλι. */
export const WATCH_USD = [0, 500, 2000];
export const MONEYGUN_USD = 300;
export const watchPrice = (s: GameState, kind: number) => Math.round(((WATCH_USD[kind] ?? 0) * s.config.startCash) / 10000);
export const moneyGunPrice = (s: GameState) => Math.round((MONEYGUN_USD * s.config.startCash) / 10000);

/** Οθόνες στο γραφείο: 1 στο γκαράζ και στην πολυκατοικία, 2 από τη Wall Street, ως 6 με αγορές. */
export const MAX_SCREENS = 6;
const SCREEN_USD = [60, 120, 200, 300, 450];
export const baseScreens = (venue: number) => (venue >= 2 ? 2 : 1);
export const screensOf = (s: GameState, p: PlayerState | undefined) =>
  Math.min(MAX_SCREENS, baseScreens(s.venue ?? 0) + (p?.screens ?? 0));
/** Τιμή της επόμενης έξτρα οθόνης (null αν δεν χωράει άλλη). */
export function screenPrice(s: GameState, p: PlayerState): number | null {
  if (screensOf(s, p) >= MAX_SCREENS) return null;
  const k = Math.min(SCREEN_USD.length - 1, p.screens ?? 0);
  return Math.round((SCREEN_USD[k] * s.config.startCash) / 10000);
}
/** Κάθε επίπεδο χώρου φέρνει τις ειδήσεις 2″ νωρίτερα (καλύτερες πηγές). */
export const VENUE_NEWS_TICKS = 4;
export const venueCash = (s: GameState, v: number) => Math.round(s.config.startCash * VENUES[v].cash);
export const venueUnlockAt = (s: GameState, v: number) => s.config.startCash * VENUES[v].unlock;

export const SCHEMA = 5;

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
  | { t: 'unlock'; ids: string[] }
  | { t: 'hire'; tier: number; kind: 'team' | 'slave' }
  | { t: 'fire'; uid: string }
  | { t: 'move'; pay: 'coins' | 'cash' }
  | { t: 'screen' }
  | { t: 'watch'; kind: number }
  | { t: 'moneygun' }
  | { t: 'spin'; bet: number };

export type ActionError =
  | 'phase' | 'tick' | 'amount' | 'cash' | 'stock' | 'perk' | 'max' | 'gone' | 'owner'
  | 'slot' | 'coins' | 'full' | 'owned' | 'player' | 'locked' | 'wallet' | 'sec' | 'desk';

export type Prices = (stock: number, tick: number) => number;

export const MAX_POSITIONS = 8;
export const START_COINS = 4;
/** Νομίσματα κάθε μέρας: 1 πάντα, 2 με τον στόχο (3 με τον κουμπαρά, και τα έξτρα). */
export const DAY_COINS = 1;
export const QUOTA_COINS = 2;
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
  // τα bots που προσλαμβάνονται μέσα στο παιχνίδι δεν ανεβάζουν τον στόχο
  const n = Math.max(1, s.order.filter((u) => !isHired(s.players[u])).length);
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
  return { name, look, inv: [], lev: false, ready: false, stats: newStats(), dayPnl: 0, decor: [], wallet: 0, rate: 0, screens: 0, watch: 0, moneyGun: false };
}

export function createGame(
  seed: number, config: GameConfig, players: { uid: string; name: string; look: Look }[], unlocked: string[] = [],
): GameState {
  const s: GameState = {
    rev: 0, seed, config, phase: 'shop', day: 1, startAt: 0, len: config.dayLen, coffee: 0,
    opens: firstOpens(), cash: config.startCash, debt: 0, dayStartEquity: config.startCash, quota: 0,
    coins: START_COINS, perks: [], positions: [], effects: [], tips: [], scoops: [], honey: [], players: {},
    order: players.map((p) => p.uid), offers: [], rerolls: 0, history: [], log: [], result: null,
    checked: 0, nextId: 1, logN: 0, schema: SCHEMA, office: [], heat: 0, sec: false, insider: 0, venue: 0,
    slot: newSlot(config.startCash), listed: startListed(seed), born: {}, events: [], gone: [], nextIpo: 3 + (hash(seed, 9900) % 2),
    unlocked: [...new Set(unlocked)].filter((id) => id in OFFICE_DEF) as OfficeId[],
  };
  for (const p of players) s.players[p.uid] = newPlayer(p.name, p.look);
  const bots = Math.max(0, Math.min(MAX_PLAYERS - players.length, Math.round(Number(config.bots) || 0)));
  for (let i = 0; i < bots; i++) addBot(s, 'member', clampTier(config.botTier));
  s.offers = rollOffers(s);
  s.quota = quotaFor(s);
  return s;
}

/** Οι αρχικές μετοχές: 5 από τις 8 «κλασικές» τοπικές, διαφορετικές σε κάθε παρτίδα. */
export function startListed(seed: number): number[] {
  const ids = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = hash(seed, 9901, i) % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, START_LISTED).sort((a, b) => a - b);
}

/** Σχεδιάζει τα γεγονότα της αυριανής μέρας (τα hints βγαίνουν σήμερα στις ειδήσεις). */
function planTomorrow(s: GameState) {
  const d = s.day + 1;
  const busy = new Set(s.events.map((e) => e.stock));
  const ipos = s.events.filter((e) => e.kind === 'ipo' && e.day >= s.day).length;
  if ((d >= s.nextIpo || s.moveIpo) && s.listed.length + ipos < MAX_LISTED) {
    const era = (s.venue ?? 0) >= 2 ? 'global' : 'local';
    const free = (e: string) => STOCKS.map((_, i) => i).filter((i) => STOCKS[i].era === e && !s.listed.includes(i) && !s.gone.includes(i) && !busy.has(i));
    const pool = free(era).length ? free(era) : free(era === 'local' ? 'global' : 'local');
    if (pool.length) {
      const stock = pool[hash(s.seed, d, 9902) % pool.length];
      const fever = uniform(s.seed, d, 9903) < 0.5;
      // το hint πέφτει μέσα 3 στις 4 φορές
      const hot = uniform(s.seed, d, 9904) < 0.75 ? fever : !fever;
      s.events.push({ kind: 'ipo', stock, day: d, fever, hot });
      if (d >= s.nextIpo) s.nextIpo = d + 2 + (hash(s.seed, d, 9905) % 2);
    }
    s.moveIpo = false;
  }
  // χρεωκοπία: από τη μέρα 4, όχι πολύ συχνά, όχι σε φρέσκια μετοχή
  const recent = s.events.some((e) => e.kind === 'bust' && e.day >= s.day - 2);
  if (d >= 4 && s.listed.length > START_LISTED && !recent && uniform(s.seed, d, 9906) < 0.2) {
    const cand = s.listed.filter((i) => d - (s.born[i] ?? -10) >= 3 && !busy.has(i));
    if (cand.length) {
      const stock = cand[hash(s.seed, d, 9907) % cand.length];
      s.events.push({ kind: 'bust', stock, day: d, real: uniform(s.seed, d, 9908) < 0.75 });
    }
  }
}

/** Νέο bot σε ελεύθερο γραφείο. */
export function addBot(s: GameState, kind: BotKind, tier: number, owner?: string): string {
  const n = s.nextId++;
  const uid = `bot${n}`;
  const p = newPlayer(botName(s.seed, n, Object.values(s.players).map((q) => q.name)), botLook(s.seed, n));
  p.bot = { tier: clampTier(tier), kind, last: -1, ...(owner ? { owner } : {}) };
  p.ready = true;
  s.players[uid] = p;
  s.order.push(uid);
  return uid;
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
  // οι θέσεις των «σκλάβων» επιστρέφουν στο ταμείο μόνο ό,τι πλήρωσε (το κέρδος πάει στο πορτοφόλι)
  for (const p of s.positions) e += p.w ? p.margin + p.openFee : posValue(p, price(p.stock));
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
  const pnl = back - p.margin - p.openFee;
  if (p.w) {
    // «σκλάβος»: το κέρδος στο πορτοφόλι του αφεντικού, η ζημιά από εκεί όσο φτάνει
    const boss = s.players[p.w];
    const delta = !boss ? 0 : pnl >= 0 ? pnl : -Math.min(boss.wallet, -pnl);
    if (boss) boss.wallet = Math.round((boss.wallet + delta) * 100) / 100;
    s.cash += back - delta;
  } else s.cash += back;
  s.positions = s.positions.filter((q) => q.id !== p.id);
  const pl = s.players[p.owner];
  if (pl) {
    pl.stats.pnl += pnl;
    pl.dayPnl += pnl;
    pl.dayBest = Math.max(pl.dayBest ?? -Infinity, pnl);
    pl.stats.best = Math.max(pl.stats.best, pnl);
    pl.stats.worst = Math.min(pl.stats.worst, pnl);
    pl.stats.volume += p.qty * price;
    if (kind === 'liq') pl.stats.liquidations++;
  }
  log(s, { tick, kind, who: p.owner, stock: p.stock, side: p.side, amount: back, pnl });
  return pnl;
}

/** Ανοίγει θέση από το ταμείο (όσο φτάνει). Επιστρέφει false αν δεν υπάρχουν λεφτά. */
function openPos(
  s: GameState, uid: string, stock: number, side: 1 | -1, want: number, tick: number, price: number, lev: number, w?: string,
): boolean {
  const pl = s.players[uid];
  const rate = feeRate(s);
  let amount = want;
  if (amount * (1 + rate * lev) > s.cash) amount = s.cash / (1 + rate * lev);
  if (amount < 1 || !pl) return false;
  const fee = rate * amount * lev;
  s.cash -= amount + fee;
  const p: Position = {
    id: s.nextId++, owner: uid, stock, side, qty: (amount * lev) / price, entry: price,
    margin: amount, openFee: fee, lev, tick, ...(w ? { w } : {}),
  };
  s.positions.push(p);
  pl.stats.trades++;
  pl.dayTrades = (pl.dayTrades ?? 0) + 1;
  pl.stats.volume += amount * lev;
  log(s, { tick, kind: 'open', who: uid, stock, side, amount });
  return true;
}

/** Εφαρμογή μιας κίνησης παίκτη. Επιστρέφει σφάλμα ή null. */
export function applyAction(s: GameState, uid: string, a: Action, prices: Prices): ActionError | null {
  const pl = s.players[uid];
  if (!pl) return 'player';
  switch (a.t) {
    case 'open': {
      if (s.phase !== 'trading') return 'phase';
      if (a.tick < 0 || a.tick >= s.len) return 'tick';
      if (!isListed(s, a.stock)) return 'stock';
      if (a.side === -1 && !s.perks.includes('short')) return 'perk';
      if (a.side !== 1 && a.side !== -1) return 'stock';
      if (s.positions.filter((p) => p.owner === uid).length >= MAX_POSITIONS) return 'max';
      if (!(a.amount >= 1)) return 'amount';
      const lev = pl.lev ? 3 : 1;
      if (!openPos(s, uid, a.stock, a.side, a.amount, a.tick, prices(a.stock, a.tick), lev)) return 'cash';
      pl.lev = false;
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
      if (def.needsStock && !(a.stock !== undefined && isListed(s, a.stock))) return 'stock';
      // όσο ερευνά η Επιτροπή, όποιος τολμήσει εσωτερική πληροφορία ή φήμη πιάνεται (στο τέλος της μέρας)
      if (s.sec && SEC_BANNED.includes(id)) s.redHanded = true;
      if (SEC_BANNED.includes(id)) s.insider = (s.insider ?? 0) + 1;
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
        case 'honey':
          s.honey = [...(s.honey ?? []), { stock: a.stock!, from: a.tick, by: uid }];
          s.heat = Math.min(100, (s.heat ?? 0) + HONEY_HEAT);
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
      // το δικό σου γραφείο το πληρώνεις από το πορτοφόλι σου
      const cost = decorPrice(s, a.id);
      if (pl.wallet < cost) return 'wallet';
      pl.wallet = Math.round((pl.wallet - cost) * 100) / 100;
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
    case 'hire': {
      if (s.phase !== 'shop') return 'phase';
      if (pl.bot) return 'player';
      const tier = clampTier(a.tier);
      if (s.order.length >= MAX_PLAYERS) return 'desk';
      const hired = (k: BotKind, owner?: string) =>
        s.order.filter((u) => s.players[u]?.bot?.kind === k && (!owner || s.players[u].bot!.owner === owner)).length;
      if (a.kind === 'team') {
        if (hired('team') >= MAX_TEAM_BOTS) return 'max';
        const cost = BOT_TIERS[tier].coins;
        if (s.coins < cost) return 'coins';
        s.coins -= cost;
      } else if (a.kind === 'slave') {
        if (hired('slave', uid) >= MAX_SLAVES) return 'max';
        const cost = slavePrice(s, tier);
        if (pl.wallet < cost) return 'wallet';
        pl.wallet = Math.round((pl.wallet - cost) * 100) / 100;
      } else return 'gone';
      addBot(s, a.kind, tier, uid);
      log(s, { tick: -1, kind: 'hire', who: uid, tier, bk: a.kind });
      return null;
    }
    case 'watch': {
      if (s.phase !== 'shop') return 'phase';
      const kind = a.kind === 2 ? 2 : 1;
      if ((pl.watch ?? 0) >= kind) return 'owned';
      const cost = watchPrice(s, kind);
      if (pl.wallet < cost) return 'wallet';
      pl.wallet = Math.round((pl.wallet - cost) * 100) / 100;
      pl.watch = kind;
      return null;
    }
    case 'moneygun': {
      if (s.phase !== 'shop') return 'phase';
      if (pl.moneyGun) return 'owned';
      const cost = moneyGunPrice(s);
      if (pl.wallet < cost) return 'wallet';
      pl.wallet = Math.round((pl.wallet - cost) * 100) / 100;
      pl.moneyGun = true;
      return null;
    }
    case 'spin': {
      // κουλοχέρης: από το πορτοφόλι, και ανάμεσα στις μέρες και την ώρα της αγοράς
      if (s.phase === 'ended') return 'phase';
      if (!s.office.includes('slot')) return 'locked';
      const bets = slotBets(s.config.startCash);
      const bet = bets[Math.round(Number(a.bet))];
      if (!bet) return 'amount';
      if (pl.wallet < bet) return 'wallet';
      if (!s.slot) s.slot = newSlot(s.config.startCash);
      if (!Array.isArray(s.slot.log)) s.slot.log = [];
      const r = spinSlot(s.slot, s.seed, s.config.startCash, uid, bet);
      pl.wallet = Math.round((pl.wallet - bet + r.win) * 100) / 100;
      return null;
    }
    case 'screen': {
      if (s.phase !== 'shop') return 'phase';
      const cost = screenPrice(s, pl);
      if (cost === null) return 'max';
      if (pl.wallet < cost) return 'wallet';
      pl.wallet = Math.round((pl.wallet - cost) * 100) / 100;
      pl.screens = (pl.screens ?? 0) + 1;
      return null;
    }
    case 'move': {
      // μετακόμιση στον επόμενο χώρο: όταν το ταμείο φτάσει το όριο, με νομίσματα ή με μετρητά
      if (s.phase !== 'shop') return 'phase';
      const next = (s.venue ?? 0) + 1;
      if (next > MAX_VENUE) return 'owned';
      if (s.cash < venueUnlockAt(s, next)) return 'locked';
      if (a.pay === 'coins') {
        if (s.coins < VENUES[next].coins) return 'coins';
        s.coins -= VENUES[next].coins;
      } else {
        const cost = venueCash(s, next);
        if (s.cash < cost) return 'cash';
        s.cash = Math.round((s.cash - cost) * 100) / 100;
      }
      s.venue = next;
      s.moveIpo = true;
      s.quota = quotaFor(s);
      log(s, { tick: -1, kind: 'move', who: uid, tier: next });
      return null;
    }
    case 'fire': {
      if (s.phase !== 'shop') return 'phase';
      const b = s.players[a.uid];
      if (!b?.bot || b.bot.kind === 'member') return 'gone';
      if (b.bot.kind === 'slave' && b.bot.owner !== uid) return 'owner';
      delete s.players[a.uid];
      s.order = s.order.filter((u) => u !== a.uid);
      log(s, { tick: -1, kind: 'fire', who: uid, tier: b.bot.tier, bk: b.bot.kind });
      return null;
    }
  }
}

/** Ένα tick για ένα bot: κλείνει ό,τι κράτησε αρκετά, και κάθε λίγο ανοίγει νέα θέση. */
function botStep(s: GameState, uid: string, t: number, prices: Prices) {
  const pl = s.players[uid];
  const b = pl?.bot;
  if (!b || t <= b.last) return;
  b.last = t;
  const mine = s.positions.filter((p) => p.owner === uid);
  for (const p of mine) if (t - p.tick >= BOT_HOLD) closePosition(s, p, prices(p.stock, t), t, 'close');
  if (mine.some((p) => t - p.tick < BOT_HOLD)) return;
  const key = botKey(uid);
  if ((t + (key % BOT_PERIOD)) % BOT_PERIOD !== 0 || t < 4 || t > s.len - BOT_HOLD - 6) return;
  const tier = BOT_TIERS[clampTier(b.tier)];
  if (!s.listed.length) return;
  const pick = botPick(s.seed, s.day, key, t, tier, prices, s.listed);
  if (pick.side === -1 && !s.perks.includes('short')) return;
  const desks = Math.max(1, s.order.length);
  let amount = (s.dayStartEquity / desks) * 0.6 * tier.size;
  if (b.kind === 'slave') amount *= SLAVE_SIZE;
  amount = Math.min(amount, s.cash * 0.3);
  if (amount < 1) return;
  openPos(s, uid, pick.stock, pick.side, amount, t, prices(pick.stock, t), 1, b.kind === 'slave' ? b.owner : undefined);
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
  s.insider = 0;
  s.sec = secEligible(s) && uniform(s.seed, s.day, 9100) < secChance(s);
  // χρηματιστήριο: σημερινές εισαγωγές, σχέδιο για αύριο
  s.events = s.events.filter((e) => e.day >= s.day);
  for (const e of s.events) {
    if (e.kind !== 'ipo' || e.day !== s.day || s.listed.includes(e.stock) || s.listed.length >= MAX_LISTED) continue;
    s.listed.push(e.stock);
    s.born[e.stock] = s.day;
    s.opens[e.stock] = Math.round(STOCKS[e.stock].base * (0.8 + 0.4 * uniform(s.seed, s.day, 9909, e.stock)) * 100) / 100;
  }
  planTomorrow(s);
  planBoosts(s);
  for (const u of s.order) {
    const p = s.players[u];
    if (p) {
      p.ready = !!p.bot;
      p.dayPnl = 0;
      p.dayTrades = 0;
      delete p.dayBest;
      if (p.bot) p.bot.last = -1;
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
    for (const u of s.order) if (s.players[u]?.bot) botStep(s, u, t, prices);
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
  // bonus: μόνο όταν η ομάδα πιάσει τον στόχο, από το κοινό ταμείο στο πορτοφόλι του καθενός
  const bonus: Record<string, number> = {};
  const stars: string[] = [];
  if (passed) {
    for (const u of s.order) {
      const p = s.players[u];
      if (!p || isHired(p)) continue;
      if (p.dayPnl > 0) {
        const b = Math.round(p.dayPnl * bonusRate(s, p)) / 100;
        if (b > 0) {
          s.cash = Math.round((s.cash - b) * 100) / 100;
          p.wallet = Math.round((p.wallet + b) * 100) / 100;
          bonus[u] = b;
        }
      }
      // όποιος έπιασε μόνος του τον στόχο της μέρας παίρνει +1% (ως το ανώτατο)
      if (p.dayPnl >= s.quota && bonusRate(s, p) < BONUS_MAX) {
        p.rate = (p.rate ?? 0) + 1;
        stars.push(u);
      }
    }
  }
  // Επιτροπή Κεφαλαιαγοράς: πρόστιμο στη μέρα της έρευνας, αλλιώς οι υποψίες μαζεύονται
  const lawyer = s.office.includes('lawyer');
  let fine = 0;
  const wasSec = !!s.sec;
  const heat0 = s.heat ?? 0;
  let caught = false;
  if (wasSec) {
    // σύλληψη: πιθανότητα όσο οι υποψίες πάνω από 50% (μισή με δικηγόρο)
    caught = !!s.redHanded || uniform(s.seed, s.day, 9200) < (Math.max(0, (s.heat ?? 0) - 50) / 100) * (lawyer ? 0.5 : 1);
    const rate = Math.min(0.3, 0.08 + (s.heat ?? 0) / 400) * (lawyer ? 0.5 : 1);
    fine = Math.round(Math.max(0, profit) * rate);
    s.cash -= fine;
    s.heat = Math.round((s.heat ?? 0) * 0.3);
  } else if (s.config.difficulty !== 'easy') {
    let gain = (s.insider ?? 0) * 6 + (passed ? Math.max(0, Math.min(25, (profit / s.quota - 1) * 12)) : 0);
    if (lawyer) gain *= 0.5;
    s.heat = Math.max(0, Math.min(100, Math.round((s.heat ?? 0) + gain - 6)));
  }
  // υποψίες 100%: η Επιτροπή έρχεται χωρίς προειδοποίηση
  if (!caught && secEligible(s) && Math.max(heat0, s.heat ?? 0) >= 100) caught = true;
  s.sec = false;
  s.redHanded = false;
  // τα bots-μέλη στολίζουν κι αυτά το γραφείο τους με το bonus τους
  for (const u of s.order) {
    const p = s.players[u];
    if (p?.bot?.kind !== 'member' || p.decor.length >= MAX_DECOR) continue;
    const want = OFFICE.filter((o) => o.kind === 'decor' && available(o.id, s.unlocked) && !p.decor.includes(o.id as DecorId))
      .map((o) => o.id as DecorId);
    if (!want.length) continue;
    const id = want[(s.day + p.decor.length) % want.length];
    const cost = decorPrice(s, id);
    if (p.wallet >= cost) {
      p.wallet = Math.round((p.wallet - cost) * 100) / 100;
      p.decor.push(id);
    }
  }
  const bankruptRule = s.config.endRule === 'bankrupt';
  // με όριο 0% χρεωκοπία σημαίνει άδειο ταμείο
  let bankrupt = bankruptRule && (s.cash < (s.config.startCash * bankruptPct(s.config)) / 100 || s.cash <= 0);
  let saved = false;
  // νομίσματα: 1 κάθε μέρα· 2 αν πιάσετε τον στόχο, 3 με τον κουμπαρά· και τα έξτρα (πάνω από τον στόχο,
  // χρυσό καμπανάκι, επίπεδο χώρου) μόνο όταν πιάνετε τον στόχο
  let coins = DAY_COINS;
  if (passed) {
    coins = QUOTA_COINS + Math.max(0, Math.min(5, Math.floor((profit - s.quota) / (s.quota * 0.25))));
    if (s.perks.includes('piggy')) coins += 1;
    if (s.office.includes('goldbell')) coins += 1;
    coins += s.venue ?? 0;
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
    coins = DAY_COINS;
  }
  s.coins += coins;
  const r: DayResult = {
    day: s.day, quota: s.quota, profit, passed, saved, coins, equity: s.cash, bankrupt, bonus, stars, sec: wasSec, fine,
  };
  s.history.push(r);
  const opens: number[] = [];
  for (let k = 0; k < STOCK_COUNT; k++) opens.push(Math.round(prices(k, s.len) * 10000) / 10000);
  s.opens = opens;
  // όσες χρεωκόπησαν βγαίνουν από το χρηματιστήριο
  for (const e of s.events) {
    if (e.kind === 'bust' && e.real && e.day === s.day && s.listed.includes(e.stock)) {
      s.listed = s.listed.filter((i) => i !== e.stock);
      s.gone.push(e.stock);
      r.busts = [...(r.busts ?? []), e.stock];
    }
  }
  s.effects = [];
  s.tips = [];
  s.scoops = [];
  s.honey = [];
  for (const u of s.order) if (s.players[u]) s.players[u].lev = false;
  const over = bankruptRule ? bankrupt : !passed && !saved;
  if (caught) {
    r.caught = true;
    s.phase = 'ended';
    s.result = 'jail';
  } else if (over) {
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
  return [...s.order].filter((u) => s.players[u] && !isHired(s.players[u])).sort((a, b) => s.players[b].stats.pnl - s.players[a].stats.pnl);
}
