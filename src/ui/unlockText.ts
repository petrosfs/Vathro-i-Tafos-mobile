import { money, t } from '../i18n';
import type { Unlock } from '../sim/office';

/** Πώς ξεκλειδώνει ένα αντικείμενο, σε απλά λόγια. */
export function unlockText(u: Unlock): string {
  if (!u) return '';
  if (u.kind === 'day') return t('unlock.day', { n: u.n });
  if (u.kind === 'podium') return t('unlock.podium');
  return t('unlock.profit', { p: money(u.n) });
}
