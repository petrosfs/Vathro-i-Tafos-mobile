import { describe, expect, it } from 'vitest';
import { applyAction, createGame, DEFAULT_CONFIG, endDay, startDay, type GameState, type Look } from './engine';
import { MarketCache } from './marketCache';
import { dayNews } from './market';
import { migrateState } from './save';
import { MAX_LISTED, START_LISTED, STOCKS } from './stocks';
import { dayCtx } from './engine';

const look: Look = { suit: 1, skin: 1, hair: 1, hairColor: 1, hat: 1, tie: 1, glasses: 1 };
const game = (seed = 5) => createGame(seed, { ...DEFAULT_CONFIG, endRule: 'bankrupt', podiumDays: 0 }, [{ uid: 'u0', name: 'P', look }]);

/** Περνάει μια μέρα «στα γρήγορα» (με κέρδος ίσο με τον στόχο). */
function day(s: GameState, m = new MarketCache()) {
  startDay(s, 0);
  const news = dayNews(s.seed, s.day, s.config.dayLen, dayCtx(s));
  const prices = m.prices(s);
  s.cash += s.quota;
  const r = endDay(s, prices);
  return { news, r, prices };
}

describe('χρηματιστήριο που αλλάζει', () => {
  it('ξεκινά με 5 τοπικές μετοχές, διαφορετικές ανά παρτίδα', () => {
    const a = game(1);
    expect(a.listed.length).toBe(START_LISTED);
    expect(a.listed.every((i) => STOCKS[i].era === 'local' && i < 8)).toBe(true);
    const sets = new Set([1, 2, 3, 4, 5, 6].map((sd) => game(sd).listed.join(',')));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('νέες εισαγωγές κάθε 2–3 μέρες, με hint στις ειδήσεις την προηγούμενη μέρα, ως 12', () => {
    const s = game(9);
    let ipos = 0;
    let hinted = 0;
    for (let d = 0; d < 40; d++) {
      const before = [...s.listed];
      const tomorrow = s.events.filter((e) => e.kind === 'ipo' && e.day === s.day + 1);
      const { news } = day(s);
      // όσα σχεδιάστηκαν για αύριο έχουν hint σήμερα
      for (const e of s.events.filter((x) => x.kind === 'ipo' && x.day === s.day)) {
        if (news.some((n) => (n.kind === 'ipo-hot' || n.kind === 'ipo-cold') && n.stock === e.stock)) hinted++;
      }
      void tomorrow;
      ipos += s.listed.filter((i) => !before.includes(i)).length;
      expect(s.listed.length).toBeLessThanOrEqual(MAX_LISTED);
    }
    expect(ipos).toBeGreaterThan(7);
    expect(hinted).toBeGreaterThan(5);
  });

  it('η χρεωκοπία ρίχνει την τιμή και βγάζει τη μετοχή από το χρηματιστήριο', () => {
    let seen = 0;
    for (let seed = 1; seed < 40 && seen < 2; seed++) {
      const s = game(seed);
      for (let d = 0; d < 25; d++) {
        const m = new MarketCache();
        startDay(s, 0);
        const bust = s.events.find((e) => e.kind === 'bust' && e.day === s.day && e.real);
        const prices = m.prices(s);
        s.cash += s.quota;
        endDay(s, prices);
        if (bust) {
          expect(prices(bust.stock, s.len) / prices(bust.stock, 0)).toBeLessThan(0.3);
          expect(s.listed).not.toContain(bust.stock);
          expect(s.gone).toContain(bust.stock);
          seen++;
          break;
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('μετά από μετακόμιση στη Wall Street έρχεται διεθνής εταιρεία την επόμενη μέρα', () => {
    const s = game(3);
    s.venue = 1;
    s.cash = 50000;
    s.coins = 50;
    expect(applyAction(s, 'u0', { t: 'move', pay: 'coins' }, () => 1)).toBeNull();
    startDay(s, 0);
    const e = s.events.find((x) => x.kind === 'ipo' && x.day === s.day + 1);
    expect(e && STOCKS[e.stock].era).toBe('global');
  });

  it('δεν γίνονται συναλλαγές σε μετοχή εκτός χρηματιστηρίου', () => {
    const s = game(3);
    const out = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !s.listed.includes(i))!;
    startDay(s, 0);
    expect(applyAction(s, 'u0', { t: 'open', stock: out, side: 1, amount: 100, tick: 5 }, () => 10)).toBe('stock');
  });

  it('παλιές αποθηκευμένες παρτίδες κρατούν και τις 8 μετοχές', () => {
    const s = game(3) as unknown as Record<string, unknown>;
    delete s.listed;
    delete s.events;
    s.opens = (s.opens as number[]).slice(0, 8);
    const m = migrateState(JSON.parse(JSON.stringify(s)));
    expect(m.listed).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(m.opens.length).toBe(STOCKS.length);
    expect(m.events).toEqual([]);
  });
});

describe('κατάλογος', () => {
  it('κάθε εταιρεία έχει δικούς της τίτλους ειδήσεων και μοναδικό σύμβολο', async () => {
    const { SPECIFIC } = await import('./headlines');
    expect(SPECIFIC.length).toBe(STOCKS.length);
    expect(new Set(STOCKS.map((s) => s.ticker)).size).toBe(STOCKS.length);
  });
});
