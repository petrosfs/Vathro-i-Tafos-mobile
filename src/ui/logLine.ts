import { esc } from '../app';
import { money, signed, t, tr } from '../i18n';
import type { LogEntry } from '../sim/engine';
import { ITEM } from '../sim/items';
import { OFFICE_DEF } from '../sim/office';
import { STOCKS } from '../sim/stocks';
import { BOT_TIERS } from '../sim/bots';
import { VENUE_NAMES } from '../ui/venueText';
import type { GameController } from '../game/controller';

/** Μια γραμμή της καταγραφής σε HTML. */
export function logLine(g: GameController, l: LogEntry): string {
  const who = l.who === g.uid ? `<b class="me">${esc(t('you'))}</b>` : `<b>${esc(g.name(l.who))}</b>`;
  const stock = l.stock !== undefined && l.stock >= 0 ? `<b>${STOCKS[l.stock].ticker}</b>` : '';
  const pnl = l.pnl !== undefined ? `<span class="${l.pnl >= 0 ? 'up' : 'down'}">${signed(l.pnl)}</span>` : '';
  const item = l.item ? esc(tr(ITEM[l.item].name)) : l.office ? esc(tr(OFFICE_DEF[l.office].name)) : '';
  const amt = l.amount !== undefined ? money(l.amount) : '';
  const bot = l.tier !== undefined ? esc(`${tr(BOT_TIERS[l.tier]?.name ?? BOT_TIERS[0].name)}`) : '';
  const v = { who, stock, pnl, item, amt, bot };
  switch (l.kind) {
    case 'open': return l.side === -1 ? t('log.short', v) : t('log.open', v);
    case 'close': return t('log.close', v);
    case 'liq': return t('log.liq', v);
    case 'stop': return t('log.stop', v);
    case 'eod': return t('log.eod', v);
    case 'item': return stock ? t('log.itemOn', v) : t('log.item', v);
    case 'buy': return l.office ? t('log.buyOffice', v) : t('log.buy', v);
    case 'hire': return l.bk === 'slave' ? t('log.hireSlave', v) : t('log.hireTeam', v);
    case 'fire': return t('log.fire', v);
    case 'move': return t('log.move', { ...v, venue: esc(tr(VENUE_NAMES[l.tier ?? 0])) });
  }
}
