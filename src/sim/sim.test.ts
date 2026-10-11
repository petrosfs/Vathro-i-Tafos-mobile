import { describe, expect, it } from 'vitest';
import { computeDay, dayNews, firstOpens, PUMP_MOVE } from './market';
import {
  advance, allReady, applyAction, createGame, DEFAULT_CONFIG, endDay, equity, quotaFor, startDay,
  type GameState, type Look,
} from './engine';
import { MarketCache } from './marketCache';
import { ITEMS } from './items';
import { STOCK_COUNT } from './stocks';
import { SPECIFIC } from './headlines';

const look: Look = { suit: 0, skin: 0, hair: 0, hairColor: 0, hat: 0, tie: 0, glasses: 0 };

function game(n = 1, config = DEFAULT_CONFIG): GameState {
  const ps = Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, name: `P${i}`, look }));
  const s = createGame(1234, config, ps);
  // οι παλιοί έλεγχοι γράφτηκαν με όλες τις 8 αρχικές μετοχές στο χρηματιστήριο
  s.listed = [0, 1, 2, 3, 4, 5, 6, 7];
  return s;
}

const params = { seed: 7, day: 1, opens: firstOpens(), baseLen: 600, len: 600, effects: [], difficulty: 'normal' as const };

describe('αγορά', () => {
  it('ίδιο seed δίνει ίδιες τιμές', () => {
    const a = computeDay(params);
    const b = computeDay(params);
    for (let s = 0; s < STOCK_COUNT; s++) expect(Array.from(a[s])).toEqual(Array.from(b[s]));
  });

  it('διαφορετικό seed δίνει διαφορετικές τιμές', () => {
    const a = computeDay(params);
    const b = computeDay({ ...params, seed: 8 });
    expect(a[0][300]).not.toBe(b[0][300]);
  });

  it('οι τιμές μένουν θετικές και λογικές σε πολλές μέρες', () => {
    let opens = firstOpens();
    for (let day = 1; day <= 30; day++) {
      const d = computeDay({ ...params, day, opens });
      for (const s of d) for (const p of s) expect(p).toBeGreaterThan(0.29);
      opens = d.map((s) => s[600]);
    }
    for (const p of opens) expect(p).toBeLessThan(5000);
  });

  it('ο καφές δεν αλλάζει το παρελθόν', () => {
    const a = computeDay(params);
    const b = computeDay({ ...params, len: 660 });
    expect(b[3][600]).toBe(a[3][600]);
    expect(b[3].length).toBe(661);
  });

  it('η φήμη ανεβάζει την τιμή, η αναστολή την παγώνει, και τίποτα πριν δεν αλλάζει', () => {
    const base = computeDay(params);
    const pumped = computeDay({ ...params, effects: [{ kind: 'pump', stock: 2, start: 100, by: 'x' }] });
    expect(pumped[2][99]).toBe(base[2][99]);
    const ratio = (pumped[2][120] / pumped[2][99]) / (base[2][120] / base[2][99]);
    expect(Math.abs(Math.log(ratio) - PUMP_MOVE)).toBeLessThan(0.005);
    const halted = computeDay({ ...params, effects: [{ kind: 'halt', stock: 4, start: 50, by: 'x' }] });
    for (let t = 50; t < 90; t++) expect(halted[4][t]).toBe(halted[4][49]);
    expect(pumped[1][300]).toBe(base[1][300]);
  });

  it('οι ειδήσεις πέφτουν μέσα στη μέρα και έχουν υπαρκτό κείμενο', () => {
    for (let seed = 1; seed < 200; seed++) {
      const news = dayNews(seed, 3, 600);
      expect(news.length).toBeGreaterThanOrEqual(2);
      for (const n of news) {
        expect(n.tick).toBeGreaterThan(0);
        expect(n.start + n.dur).toBeLessThan(600 + 1);
        if (n.kind === 'spec-up') expect(SPECIFIC[n.stock].up[n.text]).toBeDefined();
        if (n.kind === 'spec-down') expect(SPECIFIC[n.stock].down[n.text]).toBeDefined();
        if (!n.rumor) expect(n.real).toBe(n.dir);
      }
    }
  });
});

describe('μηχανή', () => {
  it('ξεκινά στο κατάστημα με προσφορές και στόχο', () => {
    const s = game(2);
    expect(s.phase).toBe('shop');
    expect(s.offers.length).toBe(5);
    expect(new Set(s.offers).size).toBe(5);
    expect(s.quota).toBe(quotaFor(s));
    expect(s.quota).toBeGreaterThan(0);
  });

  it('οι στόχοι μεγαλώνουν και ο μέντορας τους μειώνει', () => {
    const s = game();
    const q1 = quotaFor(s, 1);
    const q5 = quotaFor(s, 5);
    expect(q5).toBeGreaterThan(q1 * 2);
    s.perks.push('mentor');
    expect(quotaFor(s, 5)).toBeLessThan(q5);
  });

  it('αγορά και πώληση: το ταμείο ισορροπεί με τις τιμές και τις προμήθειες', () => {
    const s = game();
    const m = new MarketCache();
    startDay(s, 0);
    const pr = m.prices(s);
    expect(applyAction(s, 'u0', { t: 'open', stock: 0, side: 1, amount: 1000, tick: 10 }, pr)).toBeNull();
    expect(s.cash).toBeCloseTo(10000 - 1000 - 5, 6);
    const id = s.positions[0].id;
    expect(applyAction(s, 'u0', { t: 'close', id, tick: 200 }, pr)).toBeNull();
    const ratio = pr(0, 200) / pr(0, 10);
    const value = 1000 * ratio;
    expect(s.cash).toBeCloseTo(9000 - 5 + value - value * 0.005, 6);
    expect(s.players.u0.stats.trades).toBe(1);
  });

  it('το short χρειάζεται άδεια', () => {
    const s = game();
    const m = new MarketCache();
    startDay(s, 0);
    expect(applyAction(s, 'u0', { t: 'open', stock: 1, side: -1, amount: 100, tick: 5 }, m.prices(s))).toBe('perk');
    s.perks.push('short');
    expect(applyAction(s, 'u0', { t: 'open', stock: 1, side: -1, amount: 100, tick: 5 }, m.prices(s))).toBeNull();
  });

  it('ένας παίκτης δεν κλείνει θέση άλλου', () => {
    const s = game(2);
    const m = new MarketCache();
    startDay(s, 0);
    applyAction(s, 'u0', { t: 'open', stock: 1, side: 1, amount: 100, tick: 5 }, m.prices(s));
    expect(applyAction(s, 'u1', { t: 'close', id: s.positions[0].id, tick: 6 }, m.prices(s))).toBe('owner');
  });

  it('δεν ξοδεύεις περισσότερα από το ταμείο', () => {
    const s = game();
    const m = new MarketCache();
    startDay(s, 0);
    applyAction(s, 'u0', { t: 'open', stock: 1, side: 1, amount: 999999, tick: 5 }, m.prices(s));
    expect(s.cash).toBeGreaterThanOrEqual(-1e-9);
    expect(applyAction(s, 'u0', { t: 'open', stock: 2, side: 1, amount: 10, tick: 5 }, m.prices(s))).toBe('cash');
  });

  it('η μόχλευση ρευστοποιεί τη θέση όταν χαθεί το κεφάλαιο', () => {
    const s = game();
    s.perks.push('short');
    s.players.u0.inv = ['lev', 'pump'];
    const m = new MarketCache();
    startDay(s, 0);
    expect(applyAction(s, 'u0', { t: 'use', slot: 0, tick: 1 }, m.prices(s))).toBeNull();
    expect(s.players.u0.lev).toBe(true);
    expect(applyAction(s, 'u0', { t: 'open', stock: 4, side: -1, amount: 1000, tick: 2 }, m.prices(s))).toBeNull();
    expect(s.positions[0].lev).toBe(3);
    // Τρεις φήμες στην ίδια μετοχή: +~66%, άρα η θέση short ×3 χάνει όλο το κεφάλαιο.
    s.effects.push({ kind: 'pump', stock: 4, start: 3, by: 'u0' }, { kind: 'pump', stock: 4, start: 3, by: 'u0' }, { kind: 'pump', stock: 4, start: 3, by: 'u0' });
    advance(s, 40, m.prices(s));
    expect(s.positions.length).toBe(0);
    expect(s.players.u0.stats.liquidations).toBe(1);
    expect(s.log.some((l) => l.kind === 'liq')).toBe(true);
  });

  it('ο καφές μακραίνει τη μέρα ως ένα όριο', () => {
    const s = game();
    s.players.u0.inv = ['coffee', 'coffee', 'coffee', 'coffee'];
    const m = new MarketCache();
    startDay(s, 0);
    for (let i = 0; i < 3; i++) expect(applyAction(s, 'u0', { t: 'use', slot: 0, tick: 1 }, m.prices(s))).toBeNull();
    expect(s.len).toBe(600 + 180);
    expect(applyAction(s, 'u0', { t: 'use', slot: 0, tick: 1 }, m.prices(s))).toBe('max');
  });

  it('το δάνειο επιστρέφεται στο τέλος της μέρας με τόκο', () => {
    const s = game();
    s.players.u0.inv = ['loan'];
    const m = new MarketCache();
    startDay(s, 0);
    applyAction(s, 'u0', { t: 'use', slot: 0, tick: 1 }, m.prices(s));
    expect(s.cash).toBe(15000);
    expect(equity(s, () => 1)).toBeCloseTo(10000 - 750, 6);
    endDay(s, m.prices(s));
    expect(s.cash).toBeCloseTo(10000 - 750, 6);
  });

  it('αποτυχία στόχου: τάφος, ή επιβίωση με αλεξίπτωτο', () => {
    const a = game();
    const m = new MarketCache();
    startDay(a, 0);
    const r = endDay(a, m.prices(a));
    expect(r.passed).toBe(false);
    expect(a.result).toBe('grave');
    expect(a.phase).toBe('ended');

    const b = game();
    b.perks.push('parachute');
    startDay(b, 0);
    const r2 = endDay(b, m.prices(b));
    expect(r2.saved).toBe(true);
    expect(b.phase).toBe('shop');
    expect(b.day).toBe(2);
    expect(b.perks).not.toContain('parachute');
  });

  it('επιτυχία: νομίσματα, νέα μέρα, και βάθρο στο τέλος', () => {
    const s = game(1, { ...DEFAULT_CONFIG, podiumDays: 2 });
    const m = new MarketCache();
    startDay(s, 0);
    s.cash += s.quota * 2; // σαν να κέρδισαν
    const r = endDay(s, m.prices(s));
    expect(r.passed).toBe(true);
    expect(r.coins).toBeGreaterThanOrEqual(3);
    expect(s.day).toBe(2);
    expect(s.phase).toBe('shop');
    startDay(s, 1000);
    s.cash += s.quota;
    endDay(s, m.prices(s));
    expect(s.result).toBe('podium');
  });

  it('κατάστημα: αγορά, γεμάτη τσέπη, προνόμιο μία φορά, ανανέωση', () => {
    const s = game();
    s.coins = 100;
    s.offers = ['tip', 'tip', 'tip', 'tip', 'short'];
    for (let i = 0; i < 4; i++) expect(applyAction(s, 'u0', { t: 'buy', offer: i }, () => 1)).toBeNull();
    s.offers = ['tip', 'short', null, null, null];
    expect(applyAction(s, 'u0', { t: 'buy', offer: 0 }, () => 1)).toBe('full');
    expect(applyAction(s, 'u0', { t: 'buy', offer: 1 }, () => 1)).toBeNull();
    expect(applyAction(s, 'u0', { t: 'buy', offer: 1 }, () => 1)).toBe('gone');
    expect(applyAction(s, 'u0', { t: 'reroll' }, () => 1)).toBeNull();
    expect(s.offers).not.toContain('short');
    expect(s.coins).toBe(100 - 12 - 5 - 1);
  });

  it('έτοιμοι: μετράνε μόνο οι συνδεδεμένοι', () => {
    const s = game(3);
    s.players.u0.ready = true;
    s.players.u1.ready = true;
    expect(allReady(s, () => true)).toBe(false);
    expect(allReady(s, (u) => u !== 'u2')).toBe(true);
  });

  it('προσομοίωση: χιλιάδες τυχαίες κινήσεις χωρίς αρνητικά λεφτά ή χαμένες θέσεις', () => {
    let rnd = 99;
    const r = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let g = 0; g < 20; g++) {
      const s = game(3, { ...DEFAULT_CONFIG, podiumDays: 0 });
      const m = new MarketCache();
      s.coins = 1000;
      for (let day = 0; day < 4 && s.phase !== 'ended'; day++) {
        for (let k = 0; k < 10; k++) applyAction(s, `u${Math.floor(r() * 3)}`, { t: 'buy', offer: Math.floor(r() * 5) }, () => 1);
        startDay(s, 0);
        for (let tick = 0; tick < s.len; tick += 3) {
          const uid = `u${Math.floor(r() * 3)}`;
          const x = r();
          const pr = m.prices(s);
          if (x < 0.1) applyAction(s, uid, { t: 'open', stock: Math.floor(r() * 8), side: r() < 0.5 ? 1 : -1, amount: r() * s.cash, tick }, pr);
          else if (x < 0.15 && s.positions.length) applyAction(s, s.positions[0].owner, { t: 'close', id: s.positions[0].id, tick }, pr);
          else if (x < 0.18) applyAction(s, uid, { t: 'use', slot: 0, stock: Math.floor(r() * 8), tick }, m.prices(s));
          advance(s, tick, m.prices(s));
          expect(s.cash).toBeGreaterThan(-1e-6);
          for (const p of s.positions) expect(p.margin).toBeGreaterThan(0);
        }
        endDay(s, m.prices(s));
        expect(s.positions.length).toBe(0);
        expect(s.debt).toBe(0);
      }
    }
  });

  it('κάθε αντικείμενο έχει τιμή και περιγραφή στις δύο γλώσσες', () => {
    for (const i of ITEMS) {
      expect(i.price).toBeGreaterThan(0);
      expect(i.name.el && i.name.en && i.desc.el && i.desc.en).toBeTruthy();
    }
  });
});

describe('κανόνας τέλους', () => {
  it('«μόνο με χρεωκοπία»: ο χαμένος στόχος δεν τελειώνει την παρτίδα, ούτε δίνει νομίσματα', () => {
    const s = game(1, { ...DEFAULT_CONFIG, endRule: 'bankrupt' });
    const m = new MarketCache();
    startDay(s, 0);
    const coins = s.coins;
    const r = endDay(s, m.prices(s));
    expect(r.passed).toBe(false);
    expect(s.phase).toBe('shop');
    expect(s.coins).toBe(coins);
  });

  it('«μόνο με χρεωκοπία»: τέλος όταν το ταμείο πέσει κάτω από το 10%, εκτός αν υπάρχει αλεξίπτωτο', () => {
    const m = new MarketCache();
    const a = game(1, { ...DEFAULT_CONFIG, endRule: 'bankrupt' });
    startDay(a, 0);
    a.cash = 500;
    const r = endDay(a, m.prices(a));
    expect(r.bankrupt).toBe(true);
    expect(a.result).toBe('grave');

    const b = game(1, { ...DEFAULT_CONFIG, endRule: 'bankrupt' });
    b.perks.push('parachute');
    startDay(b, 0);
    b.cash = 500;
    const r2 = endDay(b, m.prices(b));
    expect(r2.saved).toBe(true);
    expect(b.phase).toBe('shop');
    expect(b.cash).toBe(2500);
  });
});

describe('όριο χρεωκοπίας και κουραμπιεδόσκονη', () => {
  it('το όριο ρυθμίζεται 0–15% και το 0% σημαίνει μόνο άδειο ταμείο', () => {
    const m = new MarketCache();
    const at = (pct: number, cash: number) => {
      const s = game(1, { ...DEFAULT_CONFIG, endRule: 'bankrupt', bankruptPct: pct });
      startDay(s, 0);
      s.cash = cash;
      return endDay(s, m.prices(s)).bankrupt;
    };
    expect(at(15, 1400)).toBe(true);
    expect(at(15, 1600)).toBe(false);
    expect(at(10, 900)).toBe(true);
    expect(at(0, 50)).toBe(false);
    expect(at(0, 0)).toBe(true);
    expect(at(40, 1600)).toBe(false); // πάνω από το μέγιστο γίνεται 15%
  });

  it('η κουραμπιεδόσκονη μακραίνει κάθε μέρα κατά 1 λεπτό (και αθροίζεται με την καφετιέρα)', () => {
    const s = game();
    s.office = ['kourabie', 'espresso'];
    startDay(s, 0);
    expect(s.len).toBe(600 + 120 + 60);
  });
});
