// Η «εικόνα» της παρτίδας στη συσκευή: τελευταία κατάσταση από τον host, τιμές, χρόνος.
import type { Action, GameState, Position } from '../sim/engine';
import { equity, posValue } from '../sim/engine';
import { TICK_MS } from '../sim/market';
import { MarketCache } from '../sim/marketCache';
import type { HostError } from './host';
import type { Transport } from '../net/transport';

export class GameController {
  s: GameState | null = null;
  errors: Record<string, HostError> = {};
  readonly market = new MarketCache();
  private listeners: ((s: GameState, prev: GameState | null) => void)[] = [];

  constructor(readonly t: Transport) {
    t.onState((s, e) => {
      const prev = this.s;
      this.s = s;
      this.errors = e;
      for (const l of this.listeners) l(s, prev);
    });
  }

  get uid() {
    return this.t.uid;
  }

  onChange(cb: (s: GameState, prev: GameState | null) => void) {
    this.listeners.push(cb);
    if (this.s) cb(this.s, null);
  }

  /** Τρέχον tick με δεκαδικά (αρνητικό στην αντίστροφη μέτρηση). */
  tickF(): number {
    if (!this.s || this.s.phase !== 'trading') return 0;
    return (this.t.now() - this.s.startAt) / TICK_MS;
  }

  /** Το τελευταίο γνωστό tick μέσα στη μέρα. */
  tick(): number {
    if (!this.s) return 0;
    if (this.s.phase !== 'trading') return this.s.len;
    return Math.max(0, Math.min(this.s.len, Math.floor(this.tickF())));
  }

  series(): Float64Array[] {
    return this.s ? this.market.get(this.s) : [];
  }

  price(stock: number, tick = this.tick()): number {
    const d = this.series()[stock];
    return d ? d[Math.max(0, Math.min(d.length - 1, tick))] : 0;
  }

  equity(): number {
    if (!this.s) return 0;
    return equity(this.s, (k) => this.price(k));
  }

  dayProfit(): number {
    if (!this.s) return 0;
    if (this.s.phase !== 'trading') return 0;
    return this.equity() - this.s.dayStartEquity;
  }

  posValue(p: Position): number {
    return posValue(p, this.price(p.stock));
  }

  /** Κέρδος/ζημιά θέσης αν έκλεινε τώρα (μετά από προμήθειες). */
  posPnl(p: Position): number {
    const v = this.posValue(p);
    const fee = this.s && v > 0 ? (this.s.perks.includes('fees') ? 0.001 : 0.005) * p.qty * this.price(p.stock) : 0;
    return v - fee - p.margin - p.openFee;
  }

  myPositions(): Position[] {
    return this.s ? this.s.positions.filter((p) => p.owner === this.uid) : [];
  }

  me() {
    return this.s?.players[this.uid] ?? null;
  }

  name(uid: string) {
    return this.s?.players[uid]?.name ?? '?';
  }

  desk(uid: string) {
    return Math.max(0, this.s?.order.indexOf(uid) ?? 0);
  }

  send(a: Action) {
    this.t.send(a);
  }
}
