// Φόρμα ρυθμίσεων παρτίδας (solo και host).
import { esc, h } from '../app';
import { money, t, tr } from '../i18n';
import {
  BANKRUPT_PCT_DEFAULT, BANKRUPT_PCT_MAX, bankruptPct, bonusBase, BONUS_PCTS, MAX_PLAYERS, type EndRule, type GameConfig,
} from '../sim/engine';
import { BOT_TIERS, clampTier } from '../sim/bots';
import type { Difficulty } from '../sim/market';

const LENS = [360, 600];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const DAYS = [7, 10, 15, 0];
const CASH = [5000, 10000, 25000];
const ENDS: EndRule[] = ['quota', 'bankrupt'];

const KEY = 'vathro.config.v1';
const TIERS = BOT_TIERS.map((_, i) => i);

const botCount = (n: unknown) => Math.max(0, Math.min(MAX_PLAYERS - 1, Math.round(Number(n) || 0)));

export function loadConfig(): GameConfig {
  // Μόνο στην ανάπτυξη: πολύ σύντομες μέρες για δοκιμές (?daylen=40).
  const dev = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('daylen')) : 0;
  if (dev > 0) {
    const end = new URLSearchParams(location.search).get('end') === 'bankrupt' ? 'bankrupt' : 'quota';
    const q = new URLSearchParams(location.search);
    return {
      dayLen: dev, difficulty: (q.get('diff') as Difficulty) || 'easy', podiumDays: 2, startCash: 10000, endRule: end,
      bankruptPct: BANKRUPT_PCT_DEFAULT, bonusPct: 3, venueBonus: 1, bots: botCount(q.get('bots')), botTier: clampTier(q.get('tier') ?? 1),
    };
  }
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      dayLen: LENS.includes(c.dayLen) ? c.dayLen : 600,
      difficulty: DIFFS.includes(c.difficulty) ? c.difficulty : 'normal',
      podiumDays: DAYS.includes(c.podiumDays) ? c.podiumDays : 10,
      startCash: CASH.includes(c.startCash) ? c.startCash : 10000,
      endRule: ENDS.includes(c.endRule) ? c.endRule : 'quota',
      bankruptPct: bankruptPct(c),
      bonusPct: bonusBase(c),
      venueBonus: c.venueBonus === 0 ? 0 : 1,
      bots: botCount(c.bots),
      botTier: clampTier(c.botTier ?? 1),
    };
  } catch {
    return {
      dayLen: 600, difficulty: 'normal', podiumDays: 10, startCash: 10000, endRule: 'quota', bankruptPct: BANKRUPT_PCT_DEFAULT,
      bonusPct: 3, bots: 0, botTier: 1, venueBonus: 1,
    };
  }
}

export function saveConfig(c: GameConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* δεν πειράζει */
  }
}

export const daysLabel = (n: number) => (n ? t('setup.daysN', { n }) : t('setup.endless'));

export function configSummary(c: GameConfig): string {
  const end = c.endRule === 'bankrupt' ? `${t('endRule.bankrupt')} (${bankruptPct(c)}%)` : t('endRule.quota');
  const base = t('setup.summary', { len: c.dayLen / 120, diff: t(`diff.${c.difficulty}`), days: daysLabel(c.podiumDays), cash: money(c.startCash), end });
  const bots = botCount(c.bots) ? t('setup.summaryBots', { n: botCount(c.bots), tier: tr(BOT_TIERS[clampTier(c.botTier ?? 1)].name) }) : '';
  return `${base} · bonus ${bonusBase(c)}%${bots}`;
}

/** Επιστρέφει το στοιχείο της φόρμας· κάθε αλλαγή καλεί το onChange. */
export function configForm(initial: GameConfig, onChange: (c: GameConfig) => void): HTMLElement {
  const c = { ...initial, venueBonus: initial.venueBonus === 0 ? 0 : 1 };
  const seg = (k: keyof GameConfig, vals: (number | string)[], label: (v: never) => string) =>
    `<div class="seg" data-k="${k}">${vals.map((v) => `<button type="button" data-v="${v}" class="${c[k] === v ? 'sel' : ''}">${esc(label(v as never))}</button>`).join('')}</div>`;
  const el = h(`
    <div class="config">
      <h3>${esc(t('setup.dayLen'))}</h3>
      ${seg('dayLen', LENS, (v: number) => t('setup.min', { n: v / 120 }))}
      <h3>${esc(t('setup.difficulty'))}</h3>
      ${seg('difficulty', DIFFS, (v: string) => t(`diff.${v}` as Parameters<typeof t>[0]))}
      <h3>${esc(t('setup.days'))}</h3>
      ${seg('podiumDays', DAYS, (v: number) => daysLabel(v))}
      <h3>${esc(t('setup.cash'))}</h3>
      ${seg('startCash', CASH, (v: number) => money(v))}
      <h3>${esc(t('setup.endRule'))}</h3>
      ${seg('endRule', ENDS, (v: string) => t(`endRule.${v}` as Parameters<typeof t>[0]))}
      <div class="pct-row" hidden>
        <label for="bk-pct">${esc(t('setup.bankruptPct'))}</label>
        <input id="bk-pct" type="range" min="0" max="${BANKRUPT_PCT_MAX}" step="1" value="${bankruptPct(c)}" />
        <b class="pct-val"></b>
      </div>
      <p class="muted small end-hint"></p>
      <h3>${esc(t('setup.bonusPct'))}</h3>
      ${seg('bonusPct', BONUS_PCTS, (v: number) => `${v}%`)}
      <p class="muted small bonus-hint"></p>
      <h3>${esc(t('setup.venueBonus'))}</h3>
      ${seg('venueBonus', [1, 0], (v: number) => t(v ? 'on' : 'off'))}
      <p class="muted small">${esc(t('setup.venueBonusHint'))}</p>
      <h3>${esc(t('setup.bots'))}</h3>
      <div class="pct-row">
        <input id="bots-n" type="range" min="0" max="${MAX_PLAYERS - 1}" step="1" value="${botCount(c.bots)}" aria-label="${esc(t('setup.bots'))}" />
        <b class="bots-val"></b>
      </div>
      <div class="bot-tier" hidden>
        <h3>${esc(t('setup.botTier'))}</h3>
        ${seg('botTier', TIERS, (v: number) => `${BOT_TIERS[v].glyph} ${tr(BOT_TIERS[v].name)}`)}
      </div>
      <p class="muted small">${esc(t('setup.botsHint'))}</p>
    </div>`);
  const range = el.querySelector<HTMLInputElement>('#bk-pct')!;
  const bots = el.querySelector<HTMLInputElement>('#bots-n')!;
  const hint = () => {
    el.querySelector('.bonus-hint')!.textContent = t('setup.bonusHint', { p: bonusBase(c) });
    const n = botCount(c.bots);
    el.querySelector('.bots-val')!.textContent = n ? String(n) : '0';
    (el.querySelector('.bot-tier') as HTMLElement).hidden = n === 0;
    const pct = bankruptPct(c);
    (el.querySelector('.pct-row') as HTMLElement).hidden = c.endRule !== 'bankrupt';
    el.querySelector('.pct-val')!.textContent = `${pct}%`;
    el.querySelector('.end-hint')!.textContent = c.endRule === 'bankrupt'
      ? t(pct === 0 ? 'endRule.hint.bankrupt0' : 'endRule.hint.bankrupt', { p: pct })
      : t('endRule.hint.quota');
  };
  bots.addEventListener('input', () => {
    c.bots = Number(bots.value);
    hint();
    saveConfig(c);
    onChange({ ...c });
  });
  range.addEventListener('input', () => {
    c.bankruptPct = Number(range.value);
    hint();
    saveConfig(c);
    onChange({ ...c });
  });
  hint();
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
    const box = b?.closest<HTMLElement>('[data-k]');
    if (!b || !box) return;
    const k = box.dataset.k as keyof GameConfig;
    const raw = b.dataset.v!;
    (c as Record<string, unknown>)[k] = k === 'difficulty' || k === 'endRule' ? raw : Number(raw);
    hint();
    box.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
    saveConfig(c);
    onChange({ ...c });
  });
  return el;
}
