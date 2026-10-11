import { tr } from '../i18n';
import type { GameState } from '../sim/engine';
import {
  ANALYST_DOWN, ANALYST_UP, BUST, BUST_FALSE, BUST_HINT, CRASH, EARN_BAD, EARN_GOOD, GENERIC_DOWN, GENERIC_UP, IPO_DAY,
  IPO_HINT_COLD, IPO_HINT_HOT, MARKET_DOWN, MARKET_UP, RALLY, RUMOR_PREFIX, RUMOR_REL, SECTOR_NEWS, SPECIFIC,
} from '../sim/headlines';
import { RADAR_TICKS, SCOOP_COUNT, WIRE_TICKS } from '../sim/items';
import { dayNews, type NewsEvent } from '../sim/market';
import { SCREENS_TICKS } from '../sim/office';
import { dayCtx, VENUE_NEWS_TICKS } from '../sim/engine';
import { SECTORS, STOCKS } from '../sim/stocks';
import { t as tt } from '../i18n';

export function headline(n: NewsEvent): string {
  let t;
  switch (n.kind) {
    case 'up': t = GENERIC_UP[n.text]; break;
    case 'down': t = GENERIC_DOWN[n.text]; break;
    case 'spec-up': t = SPECIFIC[n.stock].up[n.text]; break;
    case 'spec-down': t = SPECIFIC[n.stock].down[n.text]; break;
    case 'mkt-up': t = MARKET_UP[n.text]; break;
    case 'mkt-down': t = MARKET_DOWN[n.text]; break;
    case 'crash': t = CRASH[n.text]; break;
    case 'ipo-hot': t = IPO_HINT_HOT[n.text]; break;
    case 'ipo-cold': t = IPO_HINT_COLD[n.text]; break;
    case 'ipo': t = IPO_DAY[n.text]; break;
    case 'bust-hint': t = BUST_HINT[n.text]; break;
    case 'bust': t = BUST[n.text]; break;
    case 'bust-false': t = BUST_FALSE[n.text]; break;
    case 'sec-up': t = SECTOR_NEWS[n.sector ?? 0]?.up[n.text]; break;
    case 'sec-down': t = SECTOR_NEWS[n.sector ?? 0]?.down[n.text]; break;
    case 'earn-good': t = EARN_GOOD[n.text]; break;
    case 'earn-bad': t = EARN_BAD[n.text]; break;
    case 'analyst-up': t = ANALYST_UP[n.text]; break;
    case 'analyst-down': t = ANALYST_DOWN[n.text]; break;
    case 'rally': t = RALLY[n.text]; break;
  }
  let s = tr(t ?? GENERIC_UP[0]);
  if (n.stock >= 0) s = s.replace('{c}', tr(STOCKS[n.stock].name));
  const prefix = n.rumor ? (n.rel ? tr(RUMOR_REL).replace('{p}', String(n.rel)) : tr(RUMOR_PREFIX)) : '';
  return prefix + s;
}

/** Η «ετικέτα» μιας είδησης: σύμβολο μετοχής, κλάδος ή «Αγορά». */
export function newsTag(n: NewsEvent): string {
  if (n.stock >= 0) return STOCKS[n.stock]?.ticker ?? '';
  if (n.sector !== undefined) return tr(SECTORS[n.sector]?.name ?? SECTORS[0].name);
  return tt('news.market');
}

/** Προγραμματισμένα αποτελέσματα που δεν έχουν βγει ακόμα (γνωστά σε όλους από το πρωί). */
export function scheduledNews(s: GameState, tick: number): NewsEvent[] {
  return newsOf(s).filter((n) => n.sched && n.tick > tick);
}

const cache = { key: '', news: [] as NewsEvent[] };
export function newsOf(s: GameState): NewsEvent[] {
  const key = `${s.seed}|${s.day}|${s.config.dayLen}|${(s.listed ?? []).join(',')}|${JSON.stringify(s.events ?? [])}|${JSON.stringify(s.boosts ?? [])}`;
  if (cache.key !== key) {
    cache.key = key;
    cache.news = dayNews(s.seed, s.day, s.config.dayLen, dayCtx(s));
  }
  return cache.news;
}

/** Πότε βλέπει η ομάδα μια είδηση (νωρίτερα με τη συνδρομή στο πρακτορείο). */
export const shownAt = (s: GameState, n: NewsEvent) =>
  n.tick - (s.perks.includes('wire') ? WIRE_TICKS : 0) - (s.office?.includes('screens') ? SCREENS_TICKS : 0) -
  (s.venue ?? 0) * VENUE_NEWS_TICKS;

export function visibleNews(s: GameState, tick: number): NewsEvent[] {
  return newsOf(s).filter((n) => shownAt(s, n) <= tick);
}

/** Ειδήσεις που αποκάλυψε το «αποκλειστικό ρεπορτάζ» και δεν έχουν βγει ακόμα. */
export function scoopedNews(s: GameState, tick: number): NewsEvent[] {
  const news = newsOf(s);
  const out = new Map<number, NewsEvent>();
  for (const sc of s.scoops) {
    news.filter((n) => n.tick > sc.from).slice(0, SCOOP_COUNT).forEach((n) => out.set(n.id, n));
  }
  return [...out.values()].filter((n) => shownAt(s, n) > tick).sort((a, b) => a.tick - b.tick);
}

/** Ειδήσεις που αποκάλυψε η «απόσπαση πληροφορίας» και δεν έχουν βγει ακόμα. */
export function honeyNews(s: GameState, tick: number): NewsEvent[] {
  const stocks = new Set((s.honey ?? []).map((h) => h.stock));
  if (!stocks.size) return [];
  return newsOf(s).filter((n) => stocks.has(n.stock) && shownAt(s, n) > tick);
}

/** Δευτερόλεπτα ως το κραχ, αν το ραντάρ το έχει πιάσει. */
export function crashIn(s: GameState, tick: number): number | null {
  if (!s.perks.includes('radar')) return null;
  const c = newsOf(s).find((n) => n.crash);
  if (!c || tick < c.tick - RADAR_TICKS || tick >= c.tick) return null;
  return Math.ceil((c.tick - tick) / 2);
}
