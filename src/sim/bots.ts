// Τα bots: «συνάδελφοι» που κάνουν trading μόνοι τους. Τρία είδη:
//  - μέλη (από το αρχικό setup): παίζουν από το κοινό ταμείο και παίρνουν bonus σαν τους παίκτες·
//  - bots ομάδας (πρόσληψη με νομίσματα): παίζουν από το κοινό ταμείο και ό,τι βγάζουν μένει στην ομάδα·
//  - «σκλάβοι» (πρόσληψη από το πορτοφόλι ενός παίκτη): παίζουν με κεφάλαιο του fund, αλλά το κέρδος
//    ή η ζημιά τους πάει στο πορτοφόλι του αφεντικού τους.
// Οι αποφάσεις τους είναι ντετερμινιστικές (seed, μέρα, tick), ώστε ένας νέος host να συνεχίζει ακριβώς ίδια.
import type { Look } from './engine';
import { hash, uniform } from './rng';
import type { Tr } from './stocks';

export type BotKind = 'member' | 'team' | 'slave';

export interface BotTier {
  /** Πόσο συχνά «μαντεύει» σωστά την κατεύθυνση. */
  acc: number;
  /** Πόσες μετοχές κοιτάζει πριν διαλέξει (οι καλύτεροι βρίσκουν μεγαλύτερες κινήσεις). */
  scan: number;
  /** Μέγεθος θέσεων σε σχέση με το μερίδιο ενός παίκτη. */
  size: number;
  /** Τιμή πρόσληψης για την ομάδα (νομίσματα). */
  coins: number;
  /** Τιμή πρόσληψης «σκλάβου» (δολάρια πορτοφολιού, για αρχικό κεφάλαιο $10.000). */
  usd: number;
  glyph: string;
  name: Tr;
}

export const BOT_TIERS: BotTier[] = [
  { acc: 0.68, scan: 3, size: 0.5, coins: 3, usd: 30, glyph: '🤖', name: { el: 'Ασκούμενος', en: 'Intern' } },
  { acc: 0.7, scan: 4, size: 0.6, coins: 5, usd: 80, glyph: '🤖', name: { el: 'Junior trader', en: 'Junior trader' } },
  { acc: 0.72, scan: 5, size: 0.8, coins: 8, usd: 180, glyph: '🤖', name: { el: 'Senior trader', en: 'Senior trader' } },
  { acc: 0.75, scan: 8, size: 1, coins: 12, usd: 400, glyph: '🐺', name: { el: 'Λύκος', en: 'Wolf' } },
];

export const BOT_TIER_COUNT = BOT_TIERS.length;
/** Πόσα bots ομάδας μπορούν να προσληφθούν και πόσους «σκλάβους» έχει ο καθένας. */
export const MAX_TEAM_BOTS = 3;
export const MAX_SLAVES = 1;
/** Πόσο κρατά μια θέση (ticks) και κάθε πόσο αποφασίζει. */
export const BOT_HOLD = 40;
export const BOT_PERIOD = 14;
/** Οι «σκλάβοι» παίζουν με μικρότερες θέσεις. */
export const SLAVE_SIZE = 0.2;

export interface BotInfo {
  tier: number;
  kind: BotKind;
  /** Ποιος τον προσέλαβε (για τον «σκλάβο»: σε ποιο πορτοφόλι πάνε τα λεφτά του). */
  owner?: string;
  /** Τελευταίο tick που επεξεργάστηκε (για να μην παίξει δύο φορές το ίδιο tick). */
  last: number;
}

export const clampTier = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(BOT_TIER_COUNT - 1, v)) : 1;
};

const NAMES = [
  'Ρομποτάκης', 'Τάκης 2.0', 'Chip', 'Byte', 'Algo', 'Μπίτος', 'Σίλικον Σάκης', 'Νευρώνας', 'Ψηφίας', 'Gigi',
  'Κυκλωμάτης', 'Pixel', 'Data Ντίνα', 'Βολτ', 'Turbo', 'Λογαριθμής', 'Servo', 'Μάικρο Μάκης', 'Cache', 'Ρελέ',
];

export function botName(seed: number, n: number, taken: string[]): string {
  const start = hash(seed, 9500, n) % NAMES.length;
  for (let i = 0; i < NAMES.length; i++) {
    const name = `🤖 ${NAMES[(start + i) % NAMES.length]}`;
    if (!taken.includes(name)) return name;
  }
  return `🤖 Bot ${n}`;
}

export function botLook(seed: number, n: number): Look {
  const r = (k: number, m: number) => hash(seed, 9600, n, k) % m;
  return { suit: r(1, 8), skin: r(2, 6), hair: r(3, 5), hairColor: r(4, 6), hat: 0, tie: r(6, 8), glasses: 1 + r(7, 2) };
}

/** Από τον uid του bot ένας αριθμός για το RNG. */
export function botKey(uid: string): number {
  let k = 0;
  for (const c of uid) k = hash(k, c.charCodeAt(0));
  return k;
}

export interface BotPick {
  stock: number;
  side: 1 | -1;
}

/**
 * Τι θα παίξει ένα bot στο tick: κοιτάζει `scan` μετοχές, κρατά αυτή με τη μεγαλύτερη κίνηση ως το
 * τέλος της θέσης και μαντεύει την κατεύθυνση σωστά με πιθανότητα `acc`.
 */
export function botPick(
  seed: number, day: number, key: number, tick: number, tier: BotTier, price: (stock: number, tick: number) => number,
  listed: number[],
): BotPick {
  const n = listed.length;
  const base = Math.floor(uniform(seed, day, 9700, key, tick) * n);
  let best = listed[base];
  let move = 0;
  for (let i = 0; i < Math.min(tier.scan, n); i++) {
    const k = listed[(base + i) % n];
    const m = Math.log(price(k, tick + BOT_HOLD) / price(k, tick));
    if (i === 0 || Math.abs(m) > Math.abs(move)) {
      move = m;
      best = k;
    }
  }
  const real: 1 | -1 = move >= 0 ? 1 : -1;
  const right = uniform(seed, day, 9800, key, tick) < tier.acc;
  return { stock: best, side: right ? real : (-real as 1 | -1) };
}
