// Πάνελ κουλοχέρη: καζάνι, καρούλια, πονταρίσματα από το πορτοφόλι, πίνακας πληρωμών, τελευταία τραβήγματα.
import { esc, h, toast } from '../app';
import { money, t } from '../i18n';
import type { GameController } from '../game/controller';
import { sfx } from '../audio';
import { SEVEN, SLOT_SYMBOLS, SLOT_TRIPLE, SLOT_TWO_CHERRY, SLOT_TWO_SEVEN, slotBets, type SlotSpin } from '../sim/slot';

const SPIN_MS = 1500;

export class SlotPanel {
  readonly el: HTMLElement;
  private seen = -1;
  private init = false;
  private spinningUntil = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFoot = '';
  private lastBody = '';

  constructor(private g: GameController, onClose: () => void) {
    this.el = h(`
      <section class="panel slot-panel" aria-label="${esc(t('slot.title'))}">
        <header class="panel-head">
          <h2>🎰 ${esc(t('slot.title'))}</h2>
          <button class="icon-btn" data-close aria-label="${esc(t('close'))}">✕</button>
        </header>
        <div class="panel-body">
          <div class="slot-pot"><small>${esc(t('slot.pot'))}</small><b></b></div>
          <div class="slot-reels"><span>7️⃣</span><span>7️⃣</span><span>7️⃣</span></div>
          <p class="slot-msg"></p>
          <div class="slot-dyn"></div>
        </div>
        <footer class="panel-foot"><div class="foot-btns slot-bets"></div></footer>
      </section>`);
    this.el.querySelector('[data-close]')!.addEventListener('click', onClose);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bet]');
      if (!b || b.hasAttribute('disabled') || performance.now() < this.spinningUntil) return;
      // τα καρούλια γυρίζουν από τώρα· το αποτέλεσμα έρχεται από τον host
      this.spinningUntil = performance.now() + SPIN_MS;
      this.startReels();
      this.g.send({ t: 'spin', bet: Number(b.dataset.bet) });
      sfx.coin();
      this.update(true);
      setTimeout(() => this.update(true), SPIN_MS + 2600);
    });
  }

  private reelsEl() {
    return [...this.el.querySelectorAll<HTMLElement>('.slot-reels span')];
  }

  private startReels() {
    if (this.timer) return;
    let k = 0;
    this.timer = setInterval(() => {
      k++;
      this.reelsEl().forEach((sp, i) => (sp.textContent = SLOT_SYMBOLS[(k + i * 2) % SLOT_SYMBOLS.length]));
    }, 70);
    this.el.querySelector('.slot-reels')!.classList.add('spinning');
  }

  private stopReels(r: SlotSpin) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.el.querySelector('.slot-reels')!.classList.remove('spinning');
    this.reelsEl().forEach((sp, i) => (sp.textContent = SLOT_SYMBOLS[r.reels[i]] ?? '❔'));
  }

  private show(r: SlotSpin, mine: boolean) {
    this.stopReels(r);
    const msg = this.el.querySelector<HTMLElement>('.slot-msg')!;
    msg.className = 'slot-msg' + (r.jackpot ? ' jackpot' : r.win > r.bet ? ' up' : r.win > 0 ? '' : ' down');
    msg.textContent = r.jackpot
      ? mine ? t('slot.jackpotMe', { amt: money(r.win) }) : t('slot.jackpot', { name: this.g.name(r.who), amt: money(r.win) })
      : r.win > 0
        ? t('slot.win', { amt: money(r.win) })
        : t('slot.lose');
    if (mine) {
      if (r.jackpot) sfx.win();
      else if (r.win > r.bet) sfx.profit();
      else if (r.win <= 0) sfx.loss();
    }
  }

  /** Καλείται σε κάθε αλλαγή κατάστασης. */
  update(force = false) {
    const s = this.g.s;
    if (!s) return;
    const slot = s.slot;
    const me = this.g.me();
    const log = slot?.log ?? [];
    const last = log[log.length - 1];
    if (!this.init) {
      this.init = true;
      this.seen = last?.n ?? -1;
      if (last) this.stopReels(last);
    } else if (last && last.n > this.seen) {
      this.seen = last.n;
      // να προλάβουν να γυρίσουν τα καρούλια πριν δείξουμε το αποτέλεσμα
      const wait = Math.max(0, this.spinningUntil - performance.now()) || 600;
      if (!this.timer) this.startReels();
      setTimeout(() => this.show(last, last.who === this.g.uid), wait);
      this.spinningUntil = Math.max(this.spinningUntil, performance.now() + wait);
      setTimeout(() => this.update(true), wait + 20);
    }
    // αν ο host απέρριψε το τράβηγμα, μη γυρίζουν για πάντα
    if (this.timer && performance.now() > this.spinningUntil + 2500) {
      clearInterval(this.timer);
      this.timer = null;
      this.el.querySelector('.slot-reels')!.classList.remove('spinning');
    }
    this.el.querySelector('.slot-pot b')!.textContent = money(slot?.pot ?? 0);
    const bets = slotBets(s.config.startCash);
    const wallet = me?.wallet ?? 0;
    const busy = performance.now() < this.spinningUntil;
    const foot = bets
      .map((b, i) => `<button class="btn ${i === 1 ? 'primary' : ''}" data-bet="${i}" ${wallet < b || busy || s.phase === 'ended' ? 'disabled' : ''}>${esc(money(b))}</button>`)
      .join('');
    if (force || foot !== this.lastFoot) {
      this.lastFoot = foot;
      this.el.querySelector('.slot-bets')!.innerHTML = foot;
    }
    const pay = (sym: string, x: string) => `<li><span>${sym}</span><b>${esc(x)}</b></li>`;
    const body = `
      <p class="slot-wallet">${esc(t('hud.wallet'))}: <b>${esc(money(wallet))}</b></p>
      <h3>${esc(t('slot.pays'))}</h3>
      <ul class="slot-pays">
        ${pay(SLOT_SYMBOLS[SEVEN].repeat(3), t('slot.all'))}
        ${[3, 2, 1, 0].map((k) => pay(SLOT_SYMBOLS[k].repeat(3), `×${SLOT_TRIPLE[k]}`)).join('')}
        ${pay(SLOT_SYMBOLS[SEVEN].repeat(2), `×${SLOT_TWO_SEVEN}`)}
        ${pay(SLOT_SYMBOLS[0].repeat(2), `×${SLOT_TWO_CHERRY}`)}
      </ul>
      <p class="muted small">${esc(t('slot.note'))}</p>
      ${log.length ? `<h3>${esc(t('slot.recent'))}</h3><ul class="slot-log">${[...log].reverse().filter((r) => r.n <= this.seen && (r.n < this.seen || !busy)).map((r) =>
        `<li><span>${esc(r.who === this.g.uid ? t('you') : this.g.name(r.who))}</span><span>${r.reels.map((k) => SLOT_SYMBOLS[k]).join('')}</span><b class="${r.win > r.bet ? 'up' : r.win === r.bet ? '' : 'down'}">${r.win > r.bet ? '+' + esc(money(r.win - r.bet)) : r.win === r.bet ? '±' + esc(money(0)) : '−' + esc(money(r.bet - r.win))}</b></li>`).join('')}</ul>` : ''}`;
    if (force || body !== this.lastBody) {
      this.lastBody = body;
      this.el.querySelector('.slot-dyn')!.innerHTML = body;
    }
  }

  /** Μήνυμα σε όλους όταν κάποιος άλλος πάρει το τζάκποτ. */
  static announce(g: GameController, fresh: SlotSpin[]) {
    for (const r of fresh) {
      if (r.jackpot && r.who !== g.uid) toast(t('slot.jackpot', { name: g.name(r.who), amt: money(r.win) }), 'good', 6000);
    }
  }
}
