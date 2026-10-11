// Το κατάστημα ανάμεσα στις μέρες: αποτέλεσμα της μέρας, προσφορές, τσέπη, προνόμια, «έτοιμος».
import { esc, h } from '../app';
import { money, signed, t, tr } from '../i18n';
import {
  bonusRate, decorPrice, MAX_PLAYERS, MAX_SCREENS, screenPrice, screensOf, VENUE_NEWS_TICKS, MAX_VENUE, rerollCost, SEC_NORMAL_MUL, slavePrice, venueCash, venueUnlockAt, VENUES,
} from '../sim/engine';
import { VENUE_DESC, VENUE_NAMES } from './venueText';
import { MAX_LISTED, STOCKS } from '../sim/stocks';
import { BOT_TIERS, MAX_TEAM_BOTS } from '../sim/bots';
import { ITEM } from '../sim/items';
import { available, MAX_DECOR, OFFICE, OFFICE_DEF, type DecorId, type OfficeId, type UpgradeId } from '../sim/office';
import { unlockText } from './unlockText';
import type { GameController } from '../game/controller';
import { sfx } from '../audio';

export class ShopPanel {
  readonly el: HTMLElement;
  private lastRev = -1;
  private lastBody = '';
  private lastFoot = '';

  constructor(private g: GameController, onClose: () => void, private onForce: (() => void) | null) {
    this.el = h(`
      <section class="panel shop" aria-label="${esc(t('shop.title'))}">
        <header class="panel-head">
          <h2>${esc(t('shop.title'))}</h2>
          <button class="icon-btn" data-close aria-label="${esc(t('close'))}">✕</button>
        </header>
        <div class="panel-body"></div>
        <footer class="panel-foot"></footer>
      </section>`);
    this.el.querySelector('[data-close]')!.addEventListener('click', onClose);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!b || b.hasAttribute('disabled')) return;
      const act = b.dataset.act;
      const me = this.g.me();
      if (act === 'buy') {
        this.g.send({ t: 'buy', offer: Number(b.dataset.i) });
        sfx.coin();
      } else if (act === 'reroll') {
        this.g.send({ t: 'reroll' });
        sfx.click();
      } else if (act === 'ready') {
        this.g.send({ t: 'ready', v: !me?.ready });
        sfx.click();
      } else if (act === 'force') this.onForce?.();
      else if (act === 'decor') {
        this.g.send({ t: 'decor', id: b.dataset.id as DecorId });
        sfx.coin();
      } else if (act === 'upgrade') {
        this.g.send({ t: 'upgrade', id: b.dataset.id as UpgradeId });
        sfx.coin();
      } else if (act === 'hire') {
        this.g.send({ t: 'hire', tier: Number(b.dataset.tier), kind: b.dataset.kind === 'slave' ? 'slave' : 'team' });
        sfx.coin();
      } else if (act === 'screen') {
        this.g.send({ t: 'screen' });
        sfx.coin();
      } else if (act === 'move') {
        const pay = b.dataset.pay === 'cash' ? 'cash' : 'coins';
        const s = this.g.s;
        if (pay === 'cash' && s && !confirm(t('venue.confirmCash', { c: money(venueCash(s, (s.venue ?? 0) + 1)) }))) return;
        this.g.send({ t: 'move', pay });
        sfx.coin();
      } else if (act === 'fire') {
        const uid = b.dataset.uid!;
        if (!confirm(t('bots.fireConfirm', { name: this.g.name(uid) }))) return;
        this.g.send({ t: 'fire', uid });
        sfx.click();
      }
      b.setAttribute('disabled', '');
    });
  }

  /** Γραφείο: διακοσμητικά για το δικό σου γραφείο και αναβαθμίσεις για όλη την ομάδα. */
  private officeHtml(): string {
    const s = this.g.s!;
    const me = this.g.me();
    const card = (id: OfficeId) => {
      const d = OFFICE_DEF[id];
      const open = available(id, s.unlocked);
      const owned = d.kind === 'decor' ? !!me?.decor.includes(id as DecorId) : s.office.includes(id as UpgradeId);
      const full = d.kind === 'decor' && (me?.decor.length ?? 0) >= MAX_DECOR;
      let btn: string;
      if (!open) btn = `<span class="lock">🔒 ${esc(unlockText(d.unlock))}</span>`;
      else if (owned) btn = `<span class="owned">✓ ${esc(t('office.owned'))}</span>`;
      else if (d.kind === 'decor') {
        const cost = decorPrice(s, id as DecorId);
        btn = `<button class="btn small" data-act="decor" data-id="${id}" ${(me?.wallet ?? 0) >= cost && !full ? '' : 'disabled'}>${money(cost)}</button>`;
      } else btn = `<button class="btn small" data-act="upgrade" data-id="${id}" ${s.coins >= d.price ? '' : 'disabled'}>🪙 ${d.price}</button>`;
      return `<div class="ocard ${open ? '' : 'locked'} ${owned ? 'mine' : ''}" title="${esc(tr(d.desc))}">
        <span class="glyph">${d.glyph}</span>
        <span class="oname"><b>${esc(tr(d.name))}</b><small>${esc(tr(d.desc))}</small></span>
        ${btn}
      </div>`;
    };
    const scr = me ? screensOf(s, me) : 1;
    const scrPrice = me ? screenPrice(s, me) : null;
    const screenCard = me && !me.bot ? `<div class="ocard ${scrPrice === null ? 'mine' : ''}">
        <span class="glyph">🖥</span>
        <span class="oname"><b>${esc(t('office.screen'))}</b><small>${esc(t('office.screenDesc', { n: scr, max: MAX_SCREENS }))}</small></span>
        ${scrPrice === null ? `<span class="owned">✓ ${esc(t('office.screenMax'))}</span>` : `<button class="btn small" data-act="screen" ${(me.wallet ?? 0) >= scrPrice ? '' : 'disabled'}>${money(scrPrice)}</button>`}
      </div>` : '';
    const decor = screenCard + OFFICE.filter((o) => o.kind === 'decor').map((o) => card(o.id)).join('');
    const ups = OFFICE.filter((o) => o.kind === 'upgrade').map((o) => card(o.id)).join('');
    return `
      <h3>${esc(t('office.mine', { n: me?.decor.length ?? 0, max: MAX_DECOR }))}</h3>
      <div class="ocards">${decor}</div>
      <h3>${esc(t('office.team'))}</h3>
      <div class="ocards">${ups}</div>
      <p class="muted small">${esc(t('office.wallet'))} ${esc(t('office.note'))}</p>`;
  }

  /** Προσλήψεις: bots για την ομάδα (νομίσματα) και ο προσωπικός «σκλάβος» (πορτοφόλι). */
  private botsHtml(): string {
    const s = this.g.s!;
    const me = this.g.me();
    const uid = this.g.uid;
    const deskFree = s.order.length < MAX_PLAYERS;
    const team = s.order.filter((u) => s.players[u]?.bot?.kind === 'team');
    const slave = s.order.find((u) => s.players[u]?.bot?.kind === 'slave' && s.players[u].bot!.owner === uid);
    const tierCard = (i: number, kind: 'team' | 'slave') => {
      const d = BOT_TIERS[i];
      const price = kind === 'team' ? `🪙 ${d.coins}` : money(slavePrice(s, i));
      const can = deskFree && (kind === 'team' ? s.coins >= d.coins && team.length < MAX_TEAM_BOTS : !slave && (me?.wallet ?? 0) >= slavePrice(s, i));
      return `<div class="ocard bot-card">
        <span class="glyph">${d.glyph}</span>
        <span class="oname"><b>${esc(tr(d.name))}</b><small>${esc(t('bots.tierDesc', { acc: Math.round(d.acc * 100), scan: d.scan }))}</small></span>
        <button class="btn small" data-act="hire" data-kind="${kind}" data-tier="${i}" ${can && !me?.bot ? '' : 'disabled'}>${price}</button>
      </div>`;
    };
    const hiredRow = (u: string) => {
      const b = s.players[u];
      return `<div class="ocard mine bot-card">
        <span class="glyph">${BOT_TIERS[b.bot!.tier].glyph}</span>
        <span class="oname"><b>${esc(b.name)}</b><small>${esc(tr(BOT_TIERS[b.bot!.tier].name))} · ${signed(b.stats.pnl)}</small></span>
        <button class="btn small ghost" data-act="fire" data-uid="${esc(u)}">${esc(t('bots.fire'))}</button>
      </div>`;
    };
    const tiers = (k: 'team' | 'slave') => BOT_TIERS.map((_, i) => tierCard(i, k)).join('');
    return `
      <h3>${esc(t('bots.title'))}</h3>
      ${deskFree ? '' : `<p class="muted small">${esc(t('bots.noDesk'))}</p>`}
      <h4>${esc(t('bots.team'))} <small class="muted">${esc(t('bots.teamCount', { n: team.length, max: MAX_TEAM_BOTS }))}</small></h4>
      <p class="muted small">${esc(t('bots.teamDesc'))}</p>
      <div class="ocards">${team.map(hiredRow).join('')}${team.length < MAX_TEAM_BOTS ? tiers('team') : ''}</div>
      <h4>${esc(t('bots.slave'))}</h4>
      <p class="muted small">${esc(t('bots.slaveDesc'))}</p>
      <div class="ocards">${slave ? hiredRow(slave) : tiers('slave')}</div>`;
  }

  /** Ο χώρος του fund και η μετακόμιση στον επόμενο. */
  private venueHtml(): string {
    const s = this.g.s!;
    const v = s.venue ?? 0;
    const cur = `<div class="ocard mine venue-card"><span class="glyph">${VENUES[v].glyph}</span>
      <span class="oname"><b>${esc(tr(VENUE_NAMES[v]))}</b><small>${esc(tr(VENUE_DESC[v]))}${v ? ` · ${esc(t('venue.bonus', { n: v, s: (v * VENUE_NEWS_TICKS) / 2, p: s.config.venueBonus === 0 ? 0 : v }))}` : ''}</small></span></div>`;
    if (v >= MAX_VENUE) return `<h3>${esc(t('venue.title'))}</h3><div class="ocards">${cur}</div><p class="muted small">${esc(t('venue.top'))}</p>`;
    const n = v + 1;
    const at = venueUnlockAt(s, n);
    const open = s.cash >= at;
    const cash = venueCash(s, n);
    const prog = Math.max(0, Math.min(1, s.cash / at));
    return `<h3>${esc(t('venue.title'))}</h3>
      <div class="ocards">${cur}
        <div class="ocard venue-card ${open ? '' : 'locked'}"><span class="glyph">${VENUES[n].glyph}</span>
          <span class="oname"><b>${esc(t('venue.next', { name: tr(VENUE_NAMES[n]) }))}</b><small>${esc(tr(VENUE_DESC[n]))}</small>
          ${open ? `<small class="up">${esc(t('venue.ready'))}</small>` : `<small>${esc(t('venue.needs', { c: money(at) }))}</small><div class="bar"><i style="width:${(prog * 100).toFixed(1)}%"></i></div>`}</span>
        </div>
      </div>
      ${open ? `<div class="foot-btns venue-btns">
        <button class="btn small" data-act="move" data-pay="coins" ${s.coins >= VENUES[n].coins ? '' : 'disabled'}>${esc(t('venue.payCoins', { c: VENUES[n].coins }))}</button>
        <button class="btn small" data-act="move" data-pay="cash" ${s.cash >= cash ? '' : 'disabled'}>${esc(t('venue.payCash', { c: money(cash) }))}</button>
      </div>` : ''}`;
  }

  /** Τι αλλάζει σήμερα στο χρηματιστήριο. */
  private marketHtml(): string {
    const s = this.g.s!;
    const ipos = (s.events ?? []).filter((e) => e.kind === 'ipo' && e.day === s.day && !s.listed.includes(e.stock));
    return `<p class="muted small">${esc(t('mkt.count', { n: s.listed.length, max: MAX_LISTED }))}</p>
      ${ipos.map((e) => `<div class="result pass"><b>${esc(t('mkt.ipoToday', { name: `${STOCKS[e.stock].ticker} · ${tr(STOCKS[e.stock].name)}` }))}</b></div>`).join('')}`;
  }

  /** Οι υποψίες της Επιτροπής Κεφαλαιαγοράς (όχι στην Εύκολη). */
  private secHtml(): string {
    const s = this.g.s!;
    if (s.config.difficulty === 'easy') return '';
    const off = s.config.difficulty === 'normal' && s.cash < s.config.startCash * SEC_NORMAL_MUL;
    const h = Math.round(s.heat ?? 0);
    return `<div class="sec-box">
      <div class="sec-row"><b>${esc(t('sec.heat', { h }))}</b><div class="bar heat"><i style="width:${h}%"></i></div></div>
      <p class="muted small">${esc(t('sec.heatHint'))}${off ? ` ${esc(t('sec.normalOff', { c: money(s.config.startCash * SEC_NORMAL_MUL) }))}` : ''}</p>
    </div>`;
  }

  update(force = false) {
    const s = this.g.s;
    if (!s || (!force && s.rev === this.lastRev)) return;
    this.lastRev = s.rev;
    const me = this.g.me();
    const last = s.history.at(-1);
    let result = `<p class="lead">${esc(t('shop.firstDay'))}</p>`;
    if (last) {
      const v = { d: last.day, c: last.coins };
      const rescued = last.saved && s.config.endRule === 'bankrupt';
      const msg = rescued ? t('shop.rescued', v) : last.saved ? t('shop.saved', v) : last.passed ? t('shop.pass', v) : t('shop.missed', v);
      const mine = last.bonus?.[this.g.uid];
      const rate = me ? bonusRate(s, me) : 0;
      const stars = (last.stars ?? []).map((u) => (u === this.g.uid ? t('you') : this.g.name(u)));
      const extra = [
        me && !me.bot ? (mine ? t('shop.bonus', { b: money(mine), p: rate }) : t('shop.noBonus', { p: rate })) : '',
        stars.length ? t('shop.star', { names: stars.join(', ') }) : '',
        last.sec ? (last.fine ? t('shop.fine', { f: money(last.fine) }) : t('shop.secClean')) : '',
        ...(last.busts ?? []).map((i) => t('mkt.bust', { name: tr(STOCKS[i].name) })),
      ].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('');
      result = `<div class="result ${last.passed && !last.saved ? 'pass' : 'saved'}">
        <b>${esc(msg)}</b>
        <span>${esc(t('shop.profit', { p: signed(last.profit), q: money(last.quota) }))}</span>
        ${extra}
      </div>`;
    }
    const offers = s.offers.map((id, i) => {
      if (!id) return `<div class="offer sold"><span>${esc(t('shop.sold'))}</span></div>`;
      const d = ITEM[id];
      const afford = s.coins >= d.price;
      const full = d.kind === 'consumable' && (me?.inv.length ?? 0) >= 4;
      return `<div class="offer ${d.kind}">
        <div class="offer-top"><span class="glyph">${d.glyph}</span><span class="tag">${esc(t(d.kind === 'perk' ? 'shop.perk' : 'shop.consumable'))}</span></div>
        <b>${esc(tr(d.name))}</b>
        <p>${esc(tr(d.desc))}</p>
        <button class="btn buy-btn" data-act="buy" data-i="${i}" ${afford && !full ? '' : 'disabled'}>${esc(t('shop.buy'))} · 🪙 ${d.price}</button>
      </div>`;
    }).join('');
    const inv = (me?.inv ?? []).map((id) => `<span class="pill" title="${esc(tr(ITEM[id].desc))}">${ITEM[id].glyph} ${esc(tr(ITEM[id].name))}</span>`).join('') || '<span class="muted">—</span>';
    const perks = s.perks.map((id) => `<span class="pill perk" title="${esc(tr(ITEM[id].desc))}">${ITEM[id].glyph} ${esc(tr(ITEM[id].name))}</span>`).join('') ||
      `<span class="muted">${esc(t('shop.noPerks'))}</span>`;
    const here = s.order.filter((u) => this.g.t.isConnected(u) && s.players[u]);
    const waiting = here.filter((u) => !s.players[u].ready).map((u) => s.players[u].name);
    const cost = rerollCost(s);
    const body = `
      ${result}
      <div class="shop-stats">
        <div><small>${esc(t('shop.next', { d: s.day }))}</small><b>${money(s.quota)}</b></div>
        <div><small>${esc(t('hud.cash'))}</small><b>${money(s.cash)}</b></div>
        <div><small>${esc(t('hud.coins'))}</small><b class="coins">🪙 ${s.coins}</b></div>
        <div><small>${esc(t('shop.wallet'))} · ${me ? bonusRate(s, me) : 0}%</small><b class="wallet">${money(me?.wallet ?? 0)}</b></div>
      </div>
      ${this.marketHtml()}
      ${this.secHtml()}
      <div class="offers">${offers}</div>
      <button class="btn ghost" data-act="reroll" ${s.coins >= cost ? '' : 'disabled'}>↻ ${esc(t('shop.reroll', { c: `🪙 ${cost}` }))}</button>
      <h3>${esc(t('shop.inv'))}</h3><div class="pills">${inv}</div>
      <h3>${esc(t('shop.perks'))}</h3><div class="pills">${perks}</div>
      ${this.venueHtml()}
      ${this.officeHtml()}
      ${this.botsHtml()}`;
    // Ξαναζωγραφίζουμε μόνο ό,τι άλλαξε, για να μη «χάνονται» πατήματα σε κουμπιά που ξαναφτιάχνονται.
    if (body !== this.lastBody) {
      this.lastBody = body;
      this.el.querySelector('.panel-body')!.innerHTML = body;
    }
    const showForce = this.onForce && this.g.t.hostUid() === this.g.uid && waiting.length > 0 && me?.ready;
    const foot = `
      ${this.g.t.online && waiting.length ? `<p class="muted small">${esc(t('shop.waiting', { names: waiting.join(', ') }))}</p>` : ''}
      <div class="foot-btns">
        ${showForce ? `<button class="btn ghost" data-act="force">${esc(t('shop.force'))}</button>` : ''}
        <button class="btn ${me?.ready ? 'ghost' : 'primary'}" data-act="ready">${esc(me?.ready ? t('shop.unready') : t('shop.ready'))}</button>
      </div>`;
    if (foot !== this.lastFoot) {
      this.lastFoot = foot;
      this.el.querySelector('.panel-foot')!.innerHTML = foot;
    }
  }
}
