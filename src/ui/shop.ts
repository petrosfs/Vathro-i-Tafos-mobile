// Το κατάστημα ανάμεσα στις μέρες: αποτέλεσμα της μέρας, προσφορές, τσέπη, προνόμια, «έτοιμος».
import { esc, h } from '../app';
import { money, signed, t, tr } from '../i18n';
import { rerollCost } from '../sim/engine';
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
      else btn = `<button class="btn small" data-act="${d.kind}" data-id="${id}" ${s.coins >= d.price && !full ? '' : 'disabled'}>🪙 ${d.price}</button>`;
      return `<div class="ocard ${open ? '' : 'locked'} ${owned ? 'mine' : ''}" title="${esc(tr(d.desc))}">
        <span class="glyph">${d.glyph}</span>
        <span class="oname"><b>${esc(tr(d.name))}</b><small>${esc(tr(d.desc))}</small></span>
        ${btn}
      </div>`;
    };
    const decor = OFFICE.filter((o) => o.kind === 'decor').map((o) => card(o.id)).join('');
    const ups = OFFICE.filter((o) => o.kind === 'upgrade').map((o) => card(o.id)).join('');
    return `
      <h3>${esc(t('office.mine', { n: me?.decor.length ?? 0, max: MAX_DECOR }))}</h3>
      <div class="ocards">${decor}</div>
      <h3>${esc(t('office.team'))}</h3>
      <div class="ocards">${ups}</div>
      <p class="muted small">${esc(t('office.note'))}</p>`;
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
      result = `<div class="result ${last.passed && !last.saved ? 'pass' : 'saved'}">
        <b>${esc(msg)}</b>
        <span>${esc(t('shop.profit', { p: signed(last.profit), q: money(last.quota) }))}</span>
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
      </div>
      <div class="offers">${offers}</div>
      <button class="btn ghost" data-act="reroll" ${s.coins >= cost ? '' : 'disabled'}>↻ ${esc(t('shop.reroll', { c: `🪙 ${cost}` }))}</button>
      <h3>${esc(t('shop.inv'))}</h3><div class="pills">${inv}</div>
      <h3>${esc(t('shop.perks'))}</h3><div class="pills">${perks}</div>
      ${this.officeHtml()}`;
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
