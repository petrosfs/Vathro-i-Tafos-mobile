import { describe, expect, it } from 'vitest';
import { advance, createGame, dayOpportunity, DEFAULT_CONFIG, endDay, OPPORTUNITY, startDay, } from './engine';
import type { Difficulty } from './market';
import { MarketCache } from './marketCache';
import { computeDay } from './market';

const look = { suit: 0, skin: 0, hair: 0, hairColor: 0, hat: 0, tie: 0, glasses: 0 };

describe('ο στόχος είναι πάντα εφικτός', () => {
  it('κάθε μέρα δίνει ευκαιρία ≥ Χ × στόχος μόνο με αγορές', () => {
    let boosted = 0;
    for (const diff of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (let seed = 1; seed <= 25; seed++) {
        const s = createGame(seed * 104729, { ...DEFAULT_CONFIG, difficulty: diff, bots: 0 }, [{ uid: 'u', name: 'u', look }]);
        const m = new MarketCache();
        for (let d = 1; d <= 10; d++) {
          startDay(s, 0);
          const need = (OPPORTUNITY[diff] * s.quota) / s.dayStartEquity;
          expect(dayOpportunity(s)).toBeGreaterThanOrEqual(need);
          if (s.boosts?.length) boosted++;
          advance(s, s.len, m.prices(s));
          s.cash = s.dayStartEquity + s.quota;
          endDay(s, m.prices(s));
          if (s.phase === 'ended') break;
        }
      }
    }
    expect(boosted).toBeGreaterThan(0);
  });

  it('η ευκαιρία μπαίνει στις τιμές και (όταν έχει είδηση) στις ειδήσεις', () => {
    const s = createGame(5, { ...DEFAULT_CONFIG }, [{ uid: 'u', name: 'u', look }]);
    startDay(s, 0);
    const stock = s.listed[0];
    const base = () => computeDay({ seed: s.seed, day: s.day, opens: s.opens, baseLen: s.config.dayLen, len: s.len, effects: [], difficulty: 'normal', ctx: { listed: s.listed, events: s.events, boosts: s.boosts } });
    const a = base()[stock];
    s.boosts = [{ stock, start: 50, dur: 40, mag: 0.3, news: false, spec: false, text: 0 }];
    const b = base()[stock];
    expect(Math.log(b[90] / b[50]) - Math.log(a[90] / a[50])).toBeCloseTo(0.3, 1);
  });
});
