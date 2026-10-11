import { describe, expect, it } from 'vitest';
import {
  advance, applyAction, bonusRate, createGame, decorPrice, DEFAULT_CONFIG, endDay, equity, MAX_PLAYERS, quotaFor, ranking,
  secEligible, startDay, type GameConfig, type Look,
} from './engine';
import { MarketCache } from './marketCache';
import { migrateState, resumeState } from './save';

const look: Look = { suit: 1, skin: 1, hair: 1, hairColor: 1, hat: 1, tie: 1, glasses: 1 };
const game = (n = 1, cfg: Partial<GameConfig> = {}) =>
  createGame(4242, { ...DEFAULT_CONFIG, ...cfg }, Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, name: `P${i}`, look })));
const flat = () => 1;

/** Μια ολόκληρη μέρα: τα bots παίζουν μόνα τους. */
function playDay(s: ReturnType<typeof game>, m = new MarketCache()) {
  startDay(s, 0);
  advance(s, s.len, m.prices(s));
  return endDay(s, m.prices(s));
}

describe('πορτοφόλι και bonus', () => {
  it('bonus μόνο όταν η ομάδα πιάσει τον στόχο, από το κοινό ταμείο, ανάλογα με τα κέρδη του καθενός', () => {
    const m = new MarketCache();
    const s = game(2, { bonusPct: 5 });
    startDay(s, 0);
    s.players.u0.dayPnl = 1000;
    s.players.u1.dayPnl = -50;
    s.cash += s.quota + 10;
    const cash = s.cash;
    const r = endDay(s, m.prices(s));
    expect(r.passed).toBe(true);
    expect(r.bonus).toEqual({ u0: 50 });
    expect(s.players.u0.wallet).toBe(50);
    expect(s.players.u1.wallet).toBe(0);
    expect(s.cash).toBe(Math.round((cash - 50) * 100) / 100);

    const f = game(1);
    startDay(f, 0);
    f.players.u0.dayPnl = 500;
    const r2 = endDay(f, m.prices(f));
    expect(r2.passed).toBe(false);
    expect(f.players.u0.wallet).toBe(0);
  });

  it('το ποσοστό ανεβαίνει με το bonus pool και όταν κάποιος πιάνει μόνος του τον στόχο (ως 10%)', () => {
    const m = new MarketCache();
    const s = game(1, { bonusPct: 3 });
    expect(bonusRate(s, s.players.u0)).toBe(3);
    s.office.push('bonuspool');
    expect(bonusRate(s, s.players.u0)).toBe(4);
    for (let d = 0; d < 9; d++) {
      startDay(s, 0);
      s.players.u0.dayPnl = s.quota * 2;
      s.cash += s.quota * 2;
      endDay(s, m.prices(s));
    }
    expect(bonusRate(s, s.players.u0)).toBe(10);
  });

  it('τα διακοσμητικά πληρώνονται από το πορτοφόλι', () => {
    const s = game(1);
    expect(applyAction(s, 'u0', { t: 'decor', id: 'lamp' }, flat)).toBe('wallet');
    s.players.u0.wallet = decorPrice(s, 'lamp');
    const coins = s.coins;
    expect(applyAction(s, 'u0', { t: 'decor', id: 'lamp' }, flat)).toBeNull();
    expect(s.players.u0.wallet).toBe(0);
    expect(s.coins).toBe(coins);
  });
});

describe('bots', () => {
  it('bots από το setup: μέλη της ομάδας, ως 10 γραφεία συνολικά, μετράνε στον στόχο', () => {
    const s = game(2, { bots: 3, botTier: 2 });
    expect(s.order.length).toBe(5);
    const bots = s.order.filter((u) => s.players[u].bot);
    expect(bots.length).toBe(3);
    expect(bots.every((u) => s.players[u].bot!.kind === 'member' && s.players[u].bot!.tier === 2)).toBe(true);
    expect(new Set(s.order.map((u) => s.players[u].name)).size).toBe(5);
    expect(quotaFor(s)).toBeGreaterThan(quotaFor(game(2)));
    expect(game(9, { bots: 5 }).order.length).toBe(MAX_PLAYERS);
  });

  it('τα bots παίζουν μόνα τους και ίδια, ακόμα κι αν ο host ξαναελέγξει ticks', () => {
    const a = game(1, { bots: 2, botTier: 3 });
    const b = game(1, { bots: 2, botTier: 3 });
    const m = new MarketCache();
    startDay(a, 0);
    startDay(b, 0);
    advance(a, 300, m.prices(a));
    // ο b προχωρά σε κομμάτια και «γυρνάει πίσω» (κίνηση που ήρθε με καθυστέρηση)
    advance(b, 150, m.prices(b));
    b.checked = 100;
    advance(b, 300, m.prices(b));
    expect(b.positions).toEqual(a.positions);
    expect(b.cash).toBe(a.cash);
    const ra = endDay(a, m.prices(a));
    expect(a.players[a.order[1]].stats.trades).toBeGreaterThan(3);
    expect(ra.profit).not.toBe(0);
  });

  it('πρόσληψη bot ομάδας με νομίσματα: δεν ανεβάζει τον στόχο, τα κέρδη μένουν στην ομάδα, εκτός βάθρου', () => {
    const s = game(1);
    const q = quotaFor(s);
    s.coins = 3;
    expect(applyAction(s, 'u0', { t: 'hire', tier: 3, kind: 'team' }, flat)).toBe('coins');
    expect(applyAction(s, 'u0', { t: 'hire', tier: 0, kind: 'team' }, flat)).toBeNull();
    expect(s.coins).toBe(0);
    const bot = s.order[1];
    expect(s.players[bot].bot).toMatchObject({ kind: 'team', tier: 0, owner: 'u0' });
    expect(quotaFor(s)).toBe(q);
    const r = playDay(s);
    expect(r.bonus?.[bot]).toBeUndefined();
    expect(ranking(s)).toEqual(['u0']);
  });

  it('«σκλάβος»: πληρώνεται από το πορτοφόλι, το κέρδος/η ζημιά του πάει στο πορτοφόλι, όχι στο ταμείο', () => {
    let changed = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = createGame(seed, DEFAULT_CONFIG, [{ uid: 'u0', name: 'P', look }]);
      s.players.u0.wallet = 10;
      expect(applyAction(s, 'u0', { t: 'hire', tier: 3, kind: 'slave' }, flat)).toBe('wallet');
      s.players.u0.wallet = 5000;
      expect(applyAction(s, 'u0', { t: 'hire', tier: 3, kind: 'slave' }, flat)).toBeNull();
      expect(applyAction(s, 'u0', { t: 'hire', tier: 0, kind: 'slave' }, flat)).toBe('max');
      const w = s.players.u0.wallet;
      const cash = s.cash;
      const m = new MarketCache();
      startDay(s, 0);
      advance(s, 200, m.prices(s));
      // στη διάρκεια της μέρας η ομάδα «βλέπει» μόνο ό,τι πλήρωσε για τις θέσεις του σκλάβου
      expect(equity(s, (k) => m.prices(s)(k, 200))).toBeCloseTo(cash, 6);
      const r = endDay(s, m.prices(s));
      expect(r.profit).toBeCloseTo(0, 6);
      if (s.players.u0.wallet !== w) changed++;
    }
    expect(changed).toBeGreaterThan(3);
  });

  it('απόλυση: τον σκλάβο μόνο το αφεντικό του, τα μέλη του setup κανείς', () => {
    const s = game(2, { bots: 1 });
    s.coins = 20;
    s.players.u0.wallet = 1000;
    applyAction(s, 'u0', { t: 'hire', tier: 1, kind: 'slave' }, flat);
    applyAction(s, 'u0', { t: 'hire', tier: 1, kind: 'team' }, flat);
    const [member, slave, team] = s.order.slice(2);
    expect(applyAction(s, 'u1', { t: 'fire', uid: slave }, flat)).toBe('owner');
    expect(applyAction(s, 'u1', { t: 'fire', uid: member }, flat)).toBe('gone');
    expect(applyAction(s, 'u1', { t: 'fire', uid: team }, flat)).toBeNull();
    expect(applyAction(s, 'u0', { t: 'fire', uid: slave }, flat)).toBeNull();
    expect(s.order).toEqual(['u0', 'u1', member]);
  });

  it('χωρίς ελεύθερο γραφείο δεν προσλαμβάνεται κανείς', () => {
    const s = game(MAX_PLAYERS);
    s.coins = 50;
    expect(applyAction(s, 'u0', { t: 'hire', tier: 0, kind: 'team' }, flat)).toBe('desk');
  });

  it('συνέχεια αποθηκευμένης: τα bots μένουν, ο σκλάβος μόνο αν ήρθε το αφεντικό του', () => {
    const s = game(2, { bots: 1 });
    s.players.u0.wallet = 1000;
    s.players.u1.wallet = 1000;
    applyAction(s, 'u0', { t: 'hire', tier: 1, kind: 'slave' }, flat);
    applyAction(s, 'u1', { t: 'hire', tier: 1, kind: 'slave' }, flat);
    const saved = migrateState(JSON.parse(JSON.stringify(s)));
    const r = resumeState(saved, [{ uid: 'x0', name: 'P0', look }]);
    expect(r.order[0]).toBe('x0');
    const bots = r.order.slice(1).map((u) => r.players[u].bot!);
    expect(bots.map((b) => b.kind)).toEqual(['member', 'slave']);
    expect(bots[1].owner).toBe('x0');
  });
});

describe('Επιτροπή Κεφαλαιαγοράς', () => {
  it('Δύσκολο: πάντα· Μέτριο: από 3× το αρχικό κεφάλαιο· Εύκολο: ποτέ', () => {
    const h = game(1, { difficulty: 'hard' });
    expect(secEligible(h)).toBe(true);
    const n = game(1, { difficulty: 'normal' });
    expect(secEligible(n)).toBe(false);
    n.cash = 30000;
    expect(secEligible(n)).toBe(true);
    const e = game(1, { difficulty: 'easy' });
    e.cash = 1e6;
    expect(secEligible(e)).toBe(false);
  });

  it('οι ύποπτες κινήσεις μαζεύουν υποψίες· στην έρευνα απαγορεύονται και ακολουθεί πρόστιμο', () => {
    const m = new MarketCache();
    const s = game(1, { difficulty: 'hard' });
    s.players.u0.inv = ['tip', 'pump', 'scoop', 'coffee'];
    startDay(s, 0);
    s.sec = false;
    expect(applyAction(s, 'u0', { t: 'use', slot: 0, stock: s.listed[0], tick: 5 }, m.prices(s))).toBeNull();
    expect(applyAction(s, 'u0', { t: 'use', slot: 0, stock: s.listed[0], tick: 5 }, m.prices(s))).toBeNull();
    endDay(s, m.prices(s));
    expect(s.heat).toBeGreaterThan(0);
    // έρευνα
    startDay(s, 0);
    s.sec = true;
    s.heat = 0;
    expect(applyAction(s, 'u0', { t: 'use', slot: 1, tick: 5 }, m.prices(s))).toBeNull(); // καφές: επιτρέπεται
    s.cash += s.quota * 2;
    const r = endDay(s, m.prices(s));
    expect(r.sec).toBe(true);
    expect(r.fine).toBeGreaterThan(0);
    expect(r.caught).toBeFalsy();
    expect(s.sec).toBe(false);
    // απαγορευμένο αντικείμενο τη μέρα της έρευνας: σύλληψη
    const t = game(1, { difficulty: 'hard', endRule: 'bankrupt' });
    t.players.u0.inv = ['tip'];
    startDay(t, 0);
    t.sec = true;
    t.heat = 0;
    expect(applyAction(t, 'u0', { t: 'use', slot: 0, stock: t.listed[0], tick: 5 }, m.prices(t))).toBeNull();
    expect(endDay(t, m.prices(t)).caught).toBe(true);
    expect(t.result).toBe('jail');
    // υποψίες 100%: σύλληψη και χωρίς έρευνα
    const u = game(1, { difficulty: 'hard', endRule: 'bankrupt' });
    startDay(u, 0);
    u.sec = false;
    u.heat = 100;
    u.insider = 3;
    expect(endDay(u, m.prices(u)).caught).toBe(true);
  });

  it('με υψηλές υποψίες η έρευνα έρχεται κάποια στιγμή· στο Εύκολο ποτέ', () => {
    let hits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame(seed, { ...DEFAULT_CONFIG, difficulty: 'hard' }, [{ uid: 'u0', name: 'P', look }]);
      s.heat = 60;
      startDay(s, 0);
      if (s.sec) hits++;
      const e = createGame(seed, { ...DEFAULT_CONFIG, difficulty: 'easy' }, [{ uid: 'u0', name: 'P', look }]);
      e.heat = 100;
      startDay(e, 0);
      expect(e.sec).toBe(false);
    }
    expect(hits).toBeGreaterThan(15);
    expect(hits).toBeLessThan(40);
  });
});

describe('χώροι', () => {
  it('ξεκινάτε στο γκαράζ· μετακόμιση όταν το ταμείο φτάσει το όριο, με νομίσματα ή μετρητά', () => {
    const s = game(1);
    expect(s.venue).toBe(0);
    s.coins = 100;
    expect(applyAction(s, 'u0', { t: 'move', pay: 'coins' }, flat)).toBe('locked');
    s.cash = 20000;
    expect(applyAction(s, 'u0', { t: 'move', pay: 'coins' }, flat)).toBeNull();
    expect([s.venue, s.coins]).toEqual([1, 94]);
    s.cash = 40000;
    expect(applyAction(s, 'u0', { t: 'move', pay: 'cash' }, flat)).toBeNull();
    expect([s.venue, s.cash, s.coins]).toEqual([2, 30000, 94]);
    expect(applyAction(s, 'u0', { t: 'move', pay: 'cash' }, flat)).toBe('locked');
    s.cash = 80000;
    expect(applyAction(s, 'u0', { t: 'move', pay: 'cash' }, flat)).toBeNull();
    expect(applyAction(s, 'u0', { t: 'move', pay: 'coins' }, flat)).toBe('owned');
    // κάθε επίπεδο: +1 νόμισμα τη μέρα που πιάνετε τον στόχο
    const m = new MarketCache();
    startDay(s, 0);
    s.cash += s.quota;
    expect(endDay(s, m.prices(s)).coins).toBe(3 + 3);
  });

  it('παλιές αποθηκευμένες παρτίδες ξεκινούν από το γκαράζ', () => {
    const s = game(1) as unknown as Record<string, unknown>;
    delete s.venue;
    expect(migrateState(JSON.parse(JSON.stringify(s))).venue).toBe(0);
  });
});

describe('οφέλη χώρου', () => {
  it('+1% bonus ανά επίπεδο μόνο αν είναι ενεργό στο setup, και ειδήσεις νωρίτερα', () => {
    const on = game(1);
    on.venue = 2;
    expect(bonusRate(on, on.players.u0)).toBe(5);
    const off = game(1, { venueBonus: 0 });
    off.venue = 2;
    expect(bonusRate(off, off.players.u0)).toBe(3);
  });
});

describe('οθόνες', () => {
  it('1 οθόνη στο γκαράζ, 2 από τη Wall Street, έξτρα από το πορτοφόλι ως 6', async () => {
    const { screensOf, screenPrice } = await import('./engine');
    const s = game(1);
    const p = s.players.u0;
    expect(screensOf(s, p)).toBe(1);
    expect(applyAction(s, 'u0', { t: 'screen' }, flat)).toBe('wallet');
    p.wallet = 10000;
    const prices: number[] = [];
    while (screenPrice(s, p) !== null) {
      prices.push(screenPrice(s, p)!);
      expect(applyAction(s, 'u0', { t: 'screen' }, flat)).toBeNull();
    }
    expect(screensOf(s, p)).toBe(6);
    expect(prices).toEqual([60, 120, 200, 300, 450]);
    expect(applyAction(s, 'u0', { t: 'screen' }, flat)).toBe('max');
    const w = game(1);
    w.venue = 2;
    expect(screensOf(w, w.players.u0)).toBe(2);
  });
});

describe('φυλακή και μόστρα', () => {
  it('στην έρευνα, με υψηλές υποψίες, η Επιτροπή μπορεί να σας πιάσει: τέλος στη φυλακή', () => {
    const m = new MarketCache();
    let caught = 0;
    let free = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame(seed, { ...DEFAULT_CONFIG, difficulty: 'hard', endRule: 'bankrupt' }, [{ uid: 'u0', name: 'P', look }]);
      startDay(s, 0);
      s.sec = true;
      s.heat = 90;
      const r = endDay(s, m.prices(s));
      if (r.caught) {
        caught++;
        expect(s.result).toBe('jail');
        expect(s.phase).toBe('ended');
      } else free++;
      // με υποψίες ως 50% κανείς δεν πιάνεται
      const z = createGame(seed, { ...DEFAULT_CONFIG, difficulty: 'hard', endRule: 'bankrupt' }, [{ uid: 'u0', name: 'P', look }]);
      startDay(z, 0);
      z.sec = true;
      z.heat = 50;
      expect(endDay(z, m.prices(z)).caught).toBeFalsy();
    }
    expect(caught).toBeGreaterThan(10);
    expect(free).toBeGreaterThan(10);
  });

  it('ρολόγια και όπλο με λεφτά από το πορτοφόλι', () => {
    const s = game(1);
    const p = s.players.u0;
    expect(applyAction(s, 'u0', { t: 'watch', kind: 1 }, flat)).toBe('wallet');
    p.wallet = 3000;
    expect(applyAction(s, 'u0', { t: 'watch', kind: 1 }, flat)).toBeNull();
    expect(applyAction(s, 'u0', { t: 'watch', kind: 1 }, flat)).toBe('owned');
    expect(applyAction(s, 'u0', { t: 'watch', kind: 2 }, flat)).toBeNull();
    expect(p.watch).toBe(2);
    expect(p.wallet).toBe(500);
    expect(applyAction(s, 'u0', { t: 'moneygun' }, flat)).toBeNull();
    expect(p.moneyGun).toBe(true);
    expect(p.wallet).toBe(200);
  });
});
