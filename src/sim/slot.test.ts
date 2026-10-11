import { describe, expect, it } from 'vitest';
import { applyAction, createGame, DEFAULT_CONFIG, type Look } from './engine';
import { migrateState } from './save';
import { newSlot, SEVEN, slotBets, slotMultiplier, slotReels, slotSeed, spinSlot } from './slot';

const look: Look = { suit: 1, skin: 1, hair: 1, hairColor: 1, hat: 1, tie: 1, glasses: 1 };
const game = () => createGame(77, { ...DEFAULT_CONFIG }, [{ uid: 'u0', name: 'P0', look }, { uid: 'u1', name: 'P1', look }]);
const flat = () => 1;

describe('κουλοχέρης', () => {
  it('πληρωμές', () => {
    expect(slotMultiplier([SEVEN, SEVEN, SEVEN])).toBe(-1);
    expect(slotMultiplier([3, 3, 3])).toBe(25);
    expect(slotMultiplier([0, 0, 0])).toBe(4);
    expect(slotMultiplier([0, 2, 0])).toBe(1);
    expect(slotMultiplier([SEVEN, 1, SEVEN])).toBe(3);
    expect(slotMultiplier([0, 1, 2])).toBe(0);
  });

  it('ντετερμινιστικά καρούλια και αποδόσεις', () => {
    expect(slotReels(5, 3)).toEqual(slotReels(5, 3));
    // αναμενόμενη επιστροφή χωρίς τζάκποτ ~65%: το μηχάνημα μαζεύει
    let back = 0;
    let jack = 0;
    const N = 200000;
    for (let n = 0; n < N; n++) {
      const m = slotMultiplier(slotReels(9, n));
      if (m === -1) jack++;
      else back += m;
    }
    expect(back / N).toBeGreaterThan(0.55);
    expect(back / N).toBeLessThan(0.75);
    expect(jack / N).toBeGreaterThan(0.001);
    expect(jack / N).toBeLessThan(0.0025);
  });

  it('το καζάνι μαζεύει τις χασούρες και αδειάζει στο τζάκποτ', () => {
    const slot = newSlot(10000);
    expect(slot.pot).toBe(slotSeed(10000));
    let jackpots = 0;
    let money = 0;
    for (let i = 0; i < 5000; i++) {
      const before = slot.pot;
      const r = spinSlot(slot, 123, 10000, 'u0', 10);
      money += r.win - 10;
      expect(r.win).toBeLessThanOrEqual(before + 10);
      if (r.jackpot) {
        jackpots++;
        expect(r.win).toBe(before + 10);
        expect(slot.pot).toBe(slotSeed(10000));
      } else expect(slot.pot).toBeCloseTo(before + 10 - r.win, 2);
    }
    expect(jackpots).toBeGreaterThan(0);
    expect(slot.log.length).toBe(8);
    expect(Math.abs(money)).toBeGreaterThan(0);
  });

  it('παίζεται από το πορτοφόλι μόνο αν η ομάδα έχει το μηχάνημα', () => {
    const s = game();
    const p = s.players.u0;
    expect(applyAction(s, 'u0', { t: 'spin', bet: 0 }, flat)).toBe('locked');
    s.office.push('slot');
    p.wallet = 0;
    expect(applyAction(s, 'u0', { t: 'spin', bet: 0 }, flat)).toBe('wallet');
    expect(applyAction(s, 'u0', { t: 'spin', bet: 7 }, flat)).toBe('amount');
    p.wallet = 1000;
    const pot0 = s.slot!.pot;
    expect(applyAction(s, 'u0', { t: 'spin', bet: 1 }, flat)).toBeNull();
    const r = s.slot!.log[0];
    expect(r.bet).toBe(slotBets(10000)[1]);
    expect(p.wallet).toBeCloseTo(1000 - r.bet + r.win, 2);
    expect(s.slot!.pot).toBeCloseTo(r.jackpot ? slotSeed(10000) : pot0 + r.bet - r.win, 2);
    // από βάση χωρίς κουλοχέρη (παλιά αποθήκευση)
    const old = JSON.parse(JSON.stringify(s));
    delete old.slot;
    expect(migrateState(old).slot!.pot).toBe(slotSeed(10000));
  });
});
