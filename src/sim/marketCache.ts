import { dayCtx, volMuls, type GameState, type Prices } from './engine';
import { computeDay } from './market';

/** Κρατά τις τιμές της μέρας και τις ξαναϋπολογίζει μόνο όταν αλλάξει κάτι που τις επηρεάζει. */
export class MarketCache {
  private key = '';
  data: Float64Array[] = [];

  get(s: GameState): Float64Array[] {
    const key = [
      s.seed, s.day, s.len, s.config.dayLen, s.config.difficulty, s.opens.join(','),
      s.effects.map((e) => `${e.kind}${e.stock}@${e.start}`).join(','),
      (s.listed ?? []).join(','), JSON.stringify(s.events ?? []), JSON.stringify(s.born ?? {}),
    ].join('|');
    if (key !== this.key) {
      this.key = key;
      this.data = computeDay({
        seed: s.seed, day: s.day, opens: s.opens, baseLen: s.config.dayLen, len: s.len,
        effects: s.effects, difficulty: s.config.difficulty, ctx: dayCtx(s), volMul: volMuls(s),
      });
    }
    return this.data;
  }

  prices(s: GameState): Prices {
    const d = this.get(s);
    return (stock, tick) => {
      const arr = d[stock];
      return arr[Math.max(0, Math.min(arr.length - 1, Math.floor(tick)))];
    };
  }
}
