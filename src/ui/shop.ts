// Το κατάστημα ανάμεσα στις μέρες: αποτέλεσμα της μέρας, προσφορές, τσέπη, προνόμια, «έτοιμος».
import { esc, h } from '../app';
import { money, signed, t, tr } from '../i18n';
import { rerollCost } from '../sim/engine';
import { ITEM } from '../sim/items';
import type { GameController } from '../game/controller';
import { sfx } from '../audio';

export class ShopPanel {
  readonly el: HTMLElement;
  private lastRev = -1;

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
      b.setAttribute('disabled', '');
    });
  }

  update(force = false) {
    const s = this.g.s;
    if (!s || (!force && s.rev === this.lastRev)) return;
    this.lastRev = s.rev;
    const me = this.g.me();
    const last = s.history.at(-1);
    let result = `<p class="lead">${esc(t('shop.firstDay'))}</p>`;
    if (last) {
      result = `<div class="result ${last.saved ? 'saved' : 'pass'}">
        <b>${esc(last.saved ? t('shop.saved', { d: last.day, c: last.coins }) : t('shop.pass', { d: last.day, c: last.coins }))}</b>
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
    this.el.querySelector('.panel-body')!.innerHTML = `
      ${result}
      <div class="shop-stats">
        <div><small>${esc(t('shop.next', { d: s.day }))}</small><b>${money(s.quota)}</b></div>
        <div><small>${esc(t('hud.cash'))}</small><b>${money(s.cash)}</b></div>
        <div><small>${esc(t('hud.coins'))}</small><b class="coins">🪙 ${s.coins}</b></div>
      </div>
      <div class="offers">${offers}</div>
      <button class="btn ghost" data-act="reroll" ${s.coins >= cost ? '' : 'disabled'}>↻ ${esc(t('shop.reroll', { c: `🪙 ${cost}` }))}</button>
      <h3>${esc(t('shop.inv'))}</h3><div class="pills">${inv}</div>
      <h3>${esc(t('shop.perks'))}</h3><div class="pills">${perks}</div>`;
    const showForce = this.onForce && this.g.t.hostUid() === this.g.uid && waiting.length > 0 && me?.ready;
    this.el.querySelector('.panel-foot')!.innerHTML = `
      ${this.g.t.online && waiting.length ? `<p class="muted small">${esc(t('shop.waiting', { names: waiting.join(', ') }))}</p>` : ''}
      <div class="foot-btns">
        ${showForce ? `<button class="btn ghost" data-act="force">${esc(t('shop.force'))}</button>` : ''}
        <button class="btn ${me?.ready ? 'ghost' : 'primary'}" data-act="ready">${esc(me?.ready ? t('shop.unready') : t('shop.ready'))}</button>
      </div>`;
  }
}
