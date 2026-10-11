// Ο κουλοχέρης του γραφείου: ο καθένας παίζει από το πορτοφόλι του. Ό,τι χάνεται μένει στο μηχάνημα
// (το «καζάνι») μέχρι κάποιος να φέρει 7️⃣7️⃣7️⃣ και να το πάρει όλο. Ξεκινά με λεφτά μέσα.
import { uniform } from './rng';

export const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '💎', '7️⃣'] as const;
/** Βάρη ανά σύμβολο (άθροισμα 100). */
const WEIGHTS = [30, 27, 18, 13, 12];
/** Πολλαπλασιαστής για τρία ίδια (το 7️⃣7️⃣7️⃣ παίρνει όλο το καζάνι). */
export const SLOT_TRIPLE = [4, 6, 12, 25, 0];
/** Δύο 🍒 επιστρέφουν το ποντάρισμα, δύο 7️⃣ το τριπλασιάζουν. */
export const SLOT_TWO_CHERRY = 1;
export const SLOT_TWO_SEVEN = 3;
export const SEVEN = 4;

/** Ποντάρισμα και αρχικό καζάνι σε δολάρια (για κεφάλαιο $10.000· κλιμακώνονται). */
export const SLOT_BETS_USD = [10, 50, 200];
export const SLOT_SEED_USD = 500;
export const SLOT_LOG = 8;

export interface SlotSpin {
  n: number;
  who: string;
  bet: number;
  reels: number[];
  win: number;
  jackpot: boolean;
}

export interface SlotState {
  pot: number;
  spins: number;
  log: SlotSpin[];
}

const scale = (usd: number, startCash: number) => Math.max(1, Math.round((usd * startCash) / 10000));
export const slotBets = (startCash: number) => SLOT_BETS_USD.map((b) => scale(b, startCash));
export const slotSeed = (startCash: number) => scale(SLOT_SEED_USD, startCash);
export const newSlot = (startCash: number): SlotState => ({ pot: slotSeed(startCash), spins: 0, log: [] });

function symbol(u: number): number {
  let acc = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    acc += WEIGHTS[i] / 100;
    if (u < acc) return i;
  }
  return WEIGHTS.length - 1;
}

/** Τα τρία καρούλια του n-οστού τραβήγματος (ντετερμινιστικά από τον σπόρο). */
export function slotReels(seed: number, n: number): number[] {
  return [0, 1, 2].map((r) => symbol(uniform(seed, 9400, n, r)));
}

/** Πολλαπλασιαστής του πονταρίσματος (−1 = τζάκποτ, όλο το καζάνι). */
export function slotMultiplier(reels: number[]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return a === SEVEN ? -1 : SLOT_TRIPLE[a];
  const count = (k: number) => reels.filter((x) => x === k).length;
  if (count(SEVEN) === 2) return SLOT_TWO_SEVEN;
  if (count(0) === 2) return SLOT_TWO_CHERRY;
  return 0;
}

/**
 * Ένα τράβηγμα: το ποντάρισμα μπαίνει στο καζάνι και τα κέρδη βγαίνουν από αυτό (όχι πάνω από όσα έχει).
 * Μετά από τζάκποτ το μηχάνημα ξαναγεμίζει με τα αρχικά λεφτά.
 */
export function spinSlot(slot: SlotState, seed: number, startCash: number, who: string, bet: number): SlotSpin {
  const n = slot.spins++;
  const reels = slotReels(seed, n);
  const m = slotMultiplier(reels);
  slot.pot += bet;
  const jackpot = m === -1;
  const win = Math.round(Math.min(slot.pot, jackpot ? slot.pot : bet * m) * 100) / 100;
  slot.pot = Math.round((slot.pot - win) * 100) / 100;
  if (jackpot) slot.pot = slotSeed(startCash);
  const spin: SlotSpin = { n, who, bet, reels, win, jackpot };
  slot.log.push(spin);
  if (slot.log.length > SLOT_LOG) slot.log.splice(0, slot.log.length - SLOT_LOG);
  return spin;
}
