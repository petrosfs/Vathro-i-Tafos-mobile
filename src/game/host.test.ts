import { describe, expect, it } from 'vitest';
import { HostRunner, COUNTDOWN_MS, END_GRACE_TICKS, MAX_LAG_TICKS } from './host';
import { createGame, DEFAULT_CONFIG, type GameState } from '../sim/engine';
import { TICK_MS } from '../sim/market';

const look = { suit: 0, skin: 0, hair: 0, hairColor: 0, hat: 0, tie: 0, glasses: 0 };

function setup(n = 2) {
  let now = 1_000_000;
  const online = new Set(Array.from({ length: n }, (_, i) => `u${i}`));
  const published: GameState[] = [];
  const s = createGame(42, { ...DEFAULT_CONFIG, dayLen: 40 }, [...online].map((uid) => ({ uid, name: uid, look })));
  s.listed = [0, 1, 2, 3, 4, 5, 6, 7];
  const host = new HostRunner(s, {
    now: () => now,
    isConnected: (u) => online.has(u),
    publish: (st) => published.push(structuredClone(st)),
  });
  return { host, s, published, online, at: (ms: number) => (now = ms), get now() { return now; } };
}

describe('host', () => {
  it('ξεκινά τη μέρα όταν είναι έτοιμοι όλοι οι συνδεδεμένοι', () => {
    const t = setup(2);
    t.host.receive('u0', { t: 'ready', v: true });
    t.host.loop();
    expect(t.s.phase).toBe('shop');
    t.online.delete('u1');
    t.host.loop();
    expect(t.s.phase).toBe('trading');
    expect(t.s.startAt).toBe(t.now + COUNTDOWN_MS);
  });

  it('δέχεται κινήσεις με καθυστέρηση δικτύου, αλλά όχι από το μέλλον ή πολύ παλιές', () => {
    const t = setup(1);
    t.host.receive('u0', { t: 'ready', v: true });
    t.host.loop();
    t.at(t.s.startAt + 20 * TICK_MS);
    t.host.loop();
    t.host.receive('u0', { t: 'open', stock: 0, side: 1, amount: 100, tick: 17 });
    expect(t.s.positions[0].tick).toBe(17);
    t.host.receive('u0', { t: 'open', stock: 0, side: 1, amount: 100, tick: 999 });
    expect(t.s.positions[1].tick).toBe(20);
    t.host.receive('u0', { t: 'open', stock: 0, side: 1, amount: 100, tick: 0 });
    expect(t.s.positions[2].tick).toBe(20 - MAX_LAG_TICKS);
  });

  it('κλείνει τη μέρα λίγο μετά το τέλος και δημοσιεύει', () => {
    const t = setup(1);
    t.host.receive('u0', { t: 'ready', v: true });
    t.host.loop();
    t.at(t.s.startAt + 40 * TICK_MS);
    t.host.loop();
    expect(t.s.phase).toBe('trading');
    t.at(t.s.startAt + (40 + END_GRACE_TICKS) * TICK_MS);
    t.host.loop();
    expect(t.s.phase).toBe('ended');
    expect(t.published.at(-1)!.phase).toBe('ended');
    expect(t.published.at(-1)!.rev).toBeGreaterThan(t.published[0].rev);
  });

  it('καταγράφει σφάλματα ανά παίκτη', () => {
    const t = setup(1);
    t.host.receive('u0', { t: 'buy', offer: 0 });
    t.s.coins = 0;
    t.host.receive('u0', { t: 'buy', offer: 1 });
    expect(t.host.errors.u0.c).toBe('coins');
  });
});
