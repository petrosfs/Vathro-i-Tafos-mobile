import {
  advance, allReady, applyAction, endDay, startDay, tickAt, type Action, type ActionError, type GameState,
} from '../sim/engine';
import { TICK_MS } from '../sim/market';
import { MarketCache } from '../sim/marketCache';

export interface HostIO {
  now(): number;
  isConnected(uid: string): boolean;
  /** Δημοσίευση της κατάστασης· τα keys είναι οι κινήσεις που μόλις εφαρμόστηκαν. */
  publish(s: GameState, processed: string[], errors: Record<string, HostError>): void;
}

/** Αντίστροφη μέτρηση πριν το καμπανάκι. */
export const COUNTDOWN_MS = 4000;
/** Πόσο πίσω στον χρόνο δεχόμαστε μια κίνηση (για την καθυστέρηση του δικτύου). */
export const MAX_LAG_TICKS = 6;
/** Το καμπανάκι κλείνει λίγο μετά το τέλος, για κινήσεις που ταξιδεύουν ακόμα. */
export const END_GRACE_TICKS = 3;

export interface HostError {
  c: ActionError;
  n: number;
}

/** Ο host: τρέχει τη μηχανή, δέχεται κινήσεις, προχωρά τον χρόνο και δημοσιεύει την κατάσταση. */
export class HostRunner {
  readonly market = new MarketCache();
  private timer: ReturnType<typeof setInterval> | null = null;
  private dirty = true;
  private lastFlush = 0;
  private processed: string[] = [];
  errors: Record<string, HostError> = {};
  private errN = 0;

  constructor(public state: GameState, private io: HostIO, private flushMs = 0) {}

  start() {
    this.loop();
    this.timer = setInterval(() => this.loop(), 100);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  receive(uid: string, a: Action, key?: string) {
    const s = this.state;
    if (key) this.processed.push(key);
    if ('tick' in a && s.phase === 'trading') {
      const now = tickAt(s, this.io.now(), TICK_MS);
      a = { ...a, tick: Math.max(now - MAX_LAG_TICKS, Math.min(now, Math.floor(Number(a.tick) || 0))) };
      // Κίνηση από το «παρελθόν» (καθυστέρηση δικτύου): ξαναελέγχουμε stop-loss από εκείνη τη στιγμή.
      // Ο έλεγχος είναι ασφαλής να επαναληφθεί, γιατί οι παλιές τιμές δεν αλλάζουν.
      if (a.tick < s.checked) s.checked = Math.max(0, a.tick);
    }
    const err = applyAction(s, uid, a, this.market.prices(s));
    if (s.phase === 'trading') advance(s, tickAt(s, this.io.now(), TICK_MS), this.market.prices(s));
    if (err) this.errors[uid] = { c: err, n: ++this.errN };
    this.dirty = true;
    this.flush();
  }

  /** Ο host ξεκινά αμέσως την επόμενη μέρα (π.χ. όταν κάποιος αργεί). */
  forceStart() {
    if (this.state.phase !== 'shop') return;
    startDay(this.state, this.io.now() + COUNTDOWN_MS);
    this.dirty = true;
    this.flush(true);
  }

  loop() {
    const s = this.state;
    const now = this.io.now();
    if (s.phase === 'trading') {
      const tick = tickAt(s, now, TICK_MS);
      const before = s.positions.length;
      const logBefore = s.logN;
      advance(s, tick, this.market.prices(s));
      if (s.positions.length !== before || s.logN !== logBefore) this.dirty = true;
      if (tick >= s.len + END_GRACE_TICKS) {
        endDay(s, this.market.prices(s));
        this.dirty = true;
      }
    } else if (s.phase === 'shop' && allReady(s, (u) => this.io.isConnected(u))) {
      startDay(s, now + COUNTDOWN_MS);
      this.dirty = true;
    }
    this.flush();
  }

  private flush(force = false) {
    if (!this.dirty) return;
    const now = Date.now();
    if (!force && this.flushMs > 0 && now - this.lastFlush < this.flushMs) return;
    this.lastFlush = now;
    this.dirty = false;
    this.state.rev++;
    const keys = this.processed;
    this.processed = [];
    this.io.publish(this.state, keys, this.errors);
  }
}
