// Φόρμα ρυθμίσεων παρτίδας (solo και host).
import { esc, h } from '../app';
import { money, t } from '../i18n';
import type { EndRule, GameConfig } from '../sim/engine';
import type { Difficulty } from '../sim/market';

const LENS = [360, 600];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const DAYS = [7, 10, 15, 0];
const CASH = [5000, 10000, 25000];
const ENDS: EndRule[] = ['quota', 'bankrupt'];

const KEY = 'vathro.config.v1';

export function loadConfig(): GameConfig {
  // Μόνο στην ανάπτυξη: πολύ σύντομες μέρες για δοκιμές (?daylen=40).
  const dev = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('daylen')) : 0;
  if (dev > 0) {
    const end = new URLSearchParams(location.search).get('end') === 'bankrupt' ? 'bankrupt' : 'quota';
    return { dayLen: dev, difficulty: 'easy', podiumDays: 2, startCash: 10000, endRule: end };
  }
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      dayLen: LENS.includes(c.dayLen) ? c.dayLen : 600,
      difficulty: DIFFS.includes(c.difficulty) ? c.difficulty : 'normal',
      podiumDays: DAYS.includes(c.podiumDays) ? c.podiumDays : 10,
      startCash: CASH.includes(c.startCash) ? c.startCash : 10000,
      endRule: ENDS.includes(c.endRule) ? c.endRule : 'quota',
    };
  } catch {
    return { dayLen: 600, difficulty: 'normal', podiumDays: 10, startCash: 10000, endRule: 'quota' };
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
  return t('setup.summary', { len: c.dayLen / 120, diff: t(`diff.${c.difficulty}`), days: daysLabel(c.podiumDays), cash: money(c.startCash), end: t(`endRule.${c.endRule ?? 'quota'}`) });
}

/** Επιστρέφει το στοιχείο της φόρμας· κάθε αλλαγή καλεί το onChange. */
export function configForm(initial: GameConfig, onChange: (c: GameConfig) => void): HTMLElement {
  const c = { ...initial };
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
      <p class="muted small end-hint"></p>
    </div>`);
  const hint = () => {
    el.querySelector('.end-hint')!.textContent = t(c.endRule === 'bankrupt' ? 'endRule.hint.bankrupt' : 'endRule.hint.quota');
  };
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
