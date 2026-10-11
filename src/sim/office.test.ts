import { describe, expect, it } from 'vitest';
import { applyAction, createGame, DEFAULT_CONFIG, endDay, quotaFor, startDay, type GameState, type Look } from './engine';
import { MarketCache } from './marketCache';
import { ESPRESSO_TICKS, emptyProgress, OFFICE, unlockedBy } from './office';
import { migrateState, resumeState } from './save';

const look: Look = { suit: 1, skin: 1, hair: 1, hairColor: 1, hat: 1, tie: 1, glasses: 1 };
const game = (n = 2, unlocked: string[] = []) =>
  createGame(77, DEFAULT_CONFIG, Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, name: `P${i}`, look })), unlocked);

describe('γραφείο', () => {
  it('διακοσμητικά: ως 4, όχι διπλά, και τα κλειδωμένα μόνο μετά το ξεκλείδωμα', () => {
    const s = game();
    s.players.u0.wallet = 500;
    s.players.u1.wallet = 500;
    for (const id of ['lamp', 'duck', 'frame', 'cactus'] as const) expect(applyAction(s, 'u0', { t: 'decor', id }, () => 1)).toBeNull();
    expect(applyAction(s, 'u1', { t: 'decor', id: 'lamp' }, () => 1)).toBeNull();
    expect(applyAction(s, 'u1', { t: 'decor', id: 'lamp' }, () => 1)).toBe('owned');
    expect(applyAction(s, 'u0', { t: 'decor', id: 'globe' }, () => 1)).toBe('locked');
    expect(applyAction(s, 'u1', { t: 'unlock', ids: ['globe', 'nonsense'] }, () => 1)).toBeNull();
    expect(s.unlocked).toEqual(['globe']);
    expect(applyAction(s, 'u0', { t: 'decor', id: 'globe' }, () => 1)).toBe('full');
    expect(applyAction(s, 'u1', { t: 'decor', id: 'globe' }, () => 1)).toBeNull();
    expect(s.players.u0.decor.length).toBe(4);
  });

  it('η καφετιέρα μακραίνει κάθε μέρα και το χρυσό καμπανάκι δίνει νόμισμα', () => {
    const s = game(1, ['goldbell']);
    s.coins = 20;
    expect(applyAction(s, 'u0', { t: 'upgrade', id: 'espresso' }, () => 1)).toBeNull();
    expect(applyAction(s, 'u0', { t: 'upgrade', id: 'goldbell' }, () => 1)).toBeNull();
    expect(applyAction(s, 'u0', { t: 'upgrade', id: 'espresso' }, () => 1)).toBe('owned');
    const m = new MarketCache();
    startDay(s, 0);
    expect(s.len).toBe(DEFAULT_CONFIG.dayLen + ESPRESSO_TICKS);
    s.cash += s.quota;
    const r = endDay(s, m.prices(s));
    expect(r.coins).toBe(2 + 1);
  });

  it('ξεκλειδώματα από την πρόοδο', () => {
    const p = emptyProgress();
    expect(unlockedBy(p)).toEqual([]);
    p.bestDay = 5;
    expect(unlockedBy(p)).toEqual(expect.arrayContaining(['bonsai', 'globe', 'screens']));
    expect(unlockedBy(p)).not.toContain('trophy');
    p.podiums = 1;
    p.bestProfit = 60000;
    expect(unlockedBy(p)).toEqual(expect.arrayContaining(['trophy', 'aquarium', 'bull']));
    for (const o of OFFICE) expect(o.name.el && o.name.en && o.desc.el && o.desc.en).toBeTruthy();
  });
});

describe('αποθήκευση', () => {
  it('παρτίδα παλιότερης έκδοσης συμπληρώνεται με προεπιλογές', () => {
    const s = game() as Partial<GameState> & Record<string, unknown>;
    delete s.schema;
    delete s.unlocked;
    delete s.office;
    for (const p of Object.values(s.players!)) delete (p as unknown as Record<string, unknown>).decor;
    delete s.tips;
    const m = migrateState(JSON.parse(JSON.stringify(s)));
    expect(m.office).toEqual([]);
    expect(m.unlocked).toEqual([]);
    expect(m.tips).toEqual([]);
    expect(m.players.u0.decor).toEqual([]);
    expect(m.players.u0.stats.trades).toBe(0);
    expect(m.schema).toBeGreaterThan(1);
  });

  it('συνέχεια: ίδια συσκευή, ίδιο όνομα, νέος παίκτης, και όποιος λείπει βγαίνει', () => {
    const s = game(3);
    s.day = 4;
    s.cash = 23456;
    s.players.u0.inv = ['tip'];
    s.players.u1.inv = ['pump'];
    s.players.u2.inv = ['halt'];
    s.players.u1.stats.trades = 9;
    const r = resumeState(s, [
      { uid: 'u0', name: 'P0', look },
      { uid: 'newDevice', name: 'p1 ', look },
      { uid: 'stranger', name: 'Κάποιος', look },
    ], ['bonsai']);
    expect(r.order).toEqual(['u0', 'newDevice', 'stranger']);
    expect(r.players.u0.inv).toEqual(['tip']);
    expect(r.players.newDevice.inv).toEqual(['pump']);
    expect(r.players.newDevice.stats.trades).toBe(9);
    expect(r.players.stranger.inv).toEqual([]);
    expect(r.players.u2).toBeUndefined();
    expect(r.day).toBe(4);
    expect(r.cash).toBe(23456);
    expect(r.phase).toBe('shop');
    expect(r.unlocked).toContain('bonsai');
    expect(r.quota).toBe(quotaFor(r));
  });
});
