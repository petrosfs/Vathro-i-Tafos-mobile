import { tr } from '../i18n';
import type { GameState } from '../sim/engine';
import {
  BUST, BUST_FALSE, BUST_HINT, CRASH, GENERIC_DOWN, GENERIC_UP, IPO_DAY, IPO_HINT_COLD, IPO_HINT_HOT, MARKET_DOWN, MARKET_UP,
  RUMOR_PREFIX, SPECIFIC,
} from '../sim/headlines';
import { RADAR_TICKS, SCOOP_COUNT, WIRE_TICKS } from '../sim/items';
import { dayNews, type NewsEvent } from '../sim/market';
import { SCREENS_TICKS } from '../sim/office';
import { dayCtx, VENUE_NEWS_TICKS } from '../sim/engine';
import { STOCKS } from '../sim/stocks';

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
  }
  let s = tr(t ?? GENERIC_UP[0]);
  if (n.stock >= 0) s = s.replace('{c}', tr(STOCKS[n.stock].name));
  return (n.rumor ? tr(RUMOR_PREFIX) : '') + s;
}

const cache = { key: '', news: [] as NewsEvent[] };
export function newsOf(s: GameState): NewsEvent[] {
  const key = `${s.seed}|${s.day}|${s.config.dayLen}|${(s.listed ?? []).join(',')}|${JSON.stringify(s.events ?? [])}`;
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
