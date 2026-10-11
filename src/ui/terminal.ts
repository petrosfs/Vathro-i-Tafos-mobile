// Το τερματικό συναλλαγών: μετοχές, γράφημα, αγορά/short, θέσεις, αντικείμενα, ειδήσεις, ομάδα.
import { esc, h } from '../app';
import { money, pct, price, signed, t, tr } from '../i18n';
import { ITEM, TIP_TICKS } from '../sim/items';
import { EFFECT_LEN } from '../sim/market';
import { STOCKS } from '../sim/stocks';
import type { GameController } from '../game/controller';
import { crashIn, headline, scoopedNews, shownAt, visibleNews } from '../game/news';
import { drawChart, drawSpark } from './chart';
import { logLine } from './logLine';
import { sfx } from '../audio';

const FRACTIONS = [0.1, 0.25, 0.5, 1];

export class Terminal {
  readonly el: HTMLElement;
  selected = 0;
  private frac = 0.25;
  private tiles = new Map<number, HTMLElement>();
  private tilesKey = '';
  private chart: HTMLCanvasElement;
  private lastRev = -1;
  private posKey = '';
  private lastTrading = false;

  constructor(private g: GameController, onClose: () => void) {
    this.el = h(`
      <section class="panel terminal" aria-label="${esc(t('term.title'))}">
        <header class="panel-head">
          <h2>${esc(t('term.title'))}</h2>
          <button class="icon-btn" data-close aria-label="${esc(t('close'))}">✕</button>
        </header>
        <div class="panel-body">
          <div class="tiles"></div>
          <div class="chart-box">
            <div class="chart-title"><b class="ct-name"></b><span class="ct-price"></span></div>
            <canvas class="chart"></canvas>
            <div class="chart-legend" hidden>┄ ${esc(t('term.future'))}</div>
          </div>
          <div class="trade">
            <div class="amount-row">
              <span class="muted">${esc(t('term.amount'))}</span>
              <div class="chips"></div>
              <b class="amount-val"></b>
            </div>
            <div class="trade-btns">
              <button class="btn buy" data-buy>${esc(t('term.buy'))}</button>
              <button class="btn short" data-short>${esc(t('term.short'))}</button>
            </div>
            <div class="lev-note" hidden>${esc(t('term.lev'))}</div>
          </div>
          <h3>${esc(t('term.items'))}</h3>
          <div class="items"></div>
          <h3 class="pos-h"><span>${esc(t('term.positions'))}</span><button class="link" data-closeall>${esc(t('term.closeAll'))}</button></h3>
          <div class="positions"></div>
          <h3>${esc(t('term.news'))}</h3>
          <div class="news"></div>
          <h3>${esc(t('term.feed'))}</h3>
          <div class="feed"></div>
        </div>
      </section>`);
    this.el.querySelector('.tiles')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-stock]');
      if (!b) return;
      this.selected = Number(b.dataset.stock);
      sfx.click();
      this.update(true);
    });
    const chips = this.el.querySelector('.chips')!;
    FRACTIONS.forEach((f) => {
      const c = h(`<button class="chip">${f === 1 ? '100%' : `${Math.round(f * 100)}%`}</button>`);
      c.addEventListener('click', () => {
        this.frac = f;
        this.update(true);
      });
      chips.append(c);
    });
    this.chart = this.el.querySelector('canvas.chart')!;
    this.el.querySelector('[data-close]')!.addEventListener('click', onClose);
    this.el.querySelector('[data-buy]')!.addEventListener('click', () => this.open(1));
    this.el.querySelector('[data-short]')!.addEventListener('click', () => this.open(-1));
    this.el.querySelector('[data-closeall]')!.addEventListener('click', () => {
      this.g.send({ t: 'closeAll', tick: this.g.tick() });
      sfx.click();
    });
    this.el.querySelector('.positions')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pos]');
      if (!b) return;
      this.g.send({ t: 'close', id: Number(b.dataset.pos), tick: this.g.tick() });
      b.setAttribute('disabled', '');
      sfx.click();
    });
    this.el.querySelector('.items')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (!b) return;
      this.g.send({ t: 'use', slot: Number(b.dataset.slot), stock: this.selected, tick: this.g.tick() });
      b.setAttribute('disabled', '');
      sfx.item();
    });
  }

  private amount(): number {
    const s = this.g.s;
    if (!s) return 0;
    return Math.max(0, Math.floor(s.cash * this.frac));
  }

  private open(side: 1 | -1) {
    const amount = this.amount();
    if (amount < 1) return;
    this.g.send({ t: 'open', stock: this.selected, side, amount: this.frac === 1 ? amount + 1e6 : amount, tick: this.g.tick() });
    sfx.buy();
  }

  /** Το γράφημα, με την τελευταία τιμή να «κυλάει» ομαλά ανάμεσα στα ticks. */
  drawLive() {
    const g = this.g;
    const s = g.s;
    if (!s) return;
    const series = g.series();
    const sel = this.selected;
    const tf = s.phase === 'trading' ? Math.max(0, Math.min(s.len, g.tickF())) : s.len;
    const tick = Math.floor(tf);
    const tip = s.tips.filter((x) => x.stock === sel && tick < x.from + TIP_TICKS).at(-1);
    drawChart(this.chart, {
      series: series[sel], now: tf, len: s.len, color: STOCKS[sel].color,
      future: tip ? { from: tick, to: tip.from + TIP_TICKS } : null,
      markers: s.positions.filter((q) => q.stock === sel && q.owner === g.uid).map((q) => ({ tick: q.tick, price: q.entry, side: q.side })),
      news: visibleNews(s, tick).filter((n) => n.stock === sel || n.stock === -1).map((n) => ({ tick: Math.max(0, shownAt(s, n)), dir: n.dir })),
      halts: s.effects.filter((e) => e.kind === 'halt' && e.stock === sel).map((e) => ({ from: e.start, to: e.start + EFFECT_LEN.halt })),
    });
  }

  /** Οι μετοχές του χρηματιστηρίου αλλάζουν με τις εισαγωγές και τις χρεωκοπίες. */
  private syncTiles(listed: number[]) {
    const key = listed.join(',');
    if (key === this.tilesKey) return;
    this.tilesKey = key;
    const box = this.el.querySelector('.tiles')!;
    box.innerHTML = '';
    this.tiles.clear();
    for (const i of listed) {
      const st = STOCKS[i];
      const tile = h(`<button class="tile" data-stock="${i}" style="--c:${st.color}"><b>${st.ticker}</b><span class="tp"></span><span class="tc"></span><canvas class="spark"></canvas></button>`);
      box.append(tile);
      this.tiles.set(i, tile);
    }
    if (!listed.includes(this.selected)) this.selected = listed[0] ?? 0;
  }

  /** Ανανέωση. full=true όταν άλλαξε κάτι εκτός από τον χρόνο. */
  update(full = false) {
    const g = this.g;
    const s = g.s;
    if (!s) return;
    const tick = g.tick();
    const series = g.series();
    const trading = s.phase === 'trading' && g.tickF() >= 0 && g.tickF() < s.len;
    // μετοχές
    this.syncTiles(s.listed ?? []);
    (s.listed ?? []).forEach((i) => {
      const tile = this.tiles.get(i)!;
      const p = series[i][tick];
      const ch = p / series[i][0] - 1;
      tile.classList.toggle('sel', i === this.selected);
      tile.querySelector('.tp')!.textContent = price(p);
      const tc = tile.querySelector<HTMLElement>('.tc')!;
      tc.textContent = pct(ch);
      tc.className = `tc ${ch >= 0 ? 'up' : 'down'}`;
      drawSpark(tile.querySelector('canvas')!, series[i], tick);
    });
    // γράφημα
    const sel = this.selected;
    const st = STOCKS[sel];
    const p = series[sel][tick];
    const tip = s.tips.filter((x) => x.stock === sel && tick < x.from + TIP_TICKS).at(-1);
    this.el.querySelector('.ct-name')!.textContent = `${st.ticker} · ${tr(st.name)}`;
    const ch = p / series[sel][0] - 1;
    const ctp = this.el.querySelector<HTMLElement>('.ct-price')!;
    ctp.textContent = `${price(p)}  ${pct(ch)}`;
    ctp.className = `ct-price ${ch >= 0 ? 'up' : 'down'}`;
    (this.el.querySelector('.chart-legend') as HTMLElement).hidden = !tip;
    this.drawLive();
    // ποσό και κουμπιά
    const amt = this.amount();
    this.el.querySelector('.amount-val')!.textContent = money(amt);
    this.el.querySelectorAll<HTMLButtonElement>('.chip').forEach((c, i) => c.classList.toggle('sel', FRACTIONS[i] === this.frac));
    const canShort = s.perks.includes('short');
    const shortBtn = this.el.querySelector<HTMLButtonElement>('[data-short]')!;
    shortBtn.disabled = !trading || !canShort || amt < 1;
    shortBtn.title = canShort ? '' : t('term.shortLocked');
    shortBtn.textContent = canShort ? t('term.short') : `🔒 ${t('term.short')}`;
    this.el.querySelector<HTMLButtonElement>('[data-buy]')!.disabled = !trading || amt < 1;
    const me = g.me();
    (this.el.querySelector('.lev-note') as HTMLElement).hidden = !me?.lev;
    // θέσεις
    const mine = g.myPositions();
    const posBox = this.el.querySelector('.positions')!;
    const key = `${trading}|${mine.map((q) => q.id).join(',')}`;
    if (key !== this.posKey) {
      this.posKey = key;
      posBox.innerHTML = mine.length
        ? mine.map((q) => `<div class="pos" data-id="${q.id}">
            <span class="pos-t" style="--c:${STOCKS[q.stock].color}">${STOCKS[q.stock].ticker}</span>
            <span class="pos-side ${q.side > 0 ? 'up' : 'down'}">${q.side > 0 ? 'LONG' : 'SHORT'}${q.lev > 1 ? ` ×${q.lev}` : ''}</span>
            <span class="pos-m muted">${money(q.margin)} · ${esc(t('term.entry', { p: price(q.entry) }))}</span>
            <span class="pos-pnl"></span>
            <button class="btn small" data-pos="${q.id}" ${trading ? '' : 'disabled'}>${esc(t('term.close'))}</button>
          </div>`).join('')
        : `<p class="muted">${esc(t('term.none'))}</p>`;
    }
    for (const q of mine) {
      const el = posBox.querySelector<HTMLElement>(`.pos[data-id="${q.id}"] .pos-pnl`);
      if (!el) continue;
      const pnl = g.posPnl(q);
      el.className = `pos-pnl ${pnl >= 0 ? 'up' : 'down'}`;
      el.innerHTML = `${signed(pnl)} <small>${pct(pnl / q.margin)}</small>`;
    }
    (this.el.querySelector('[data-closeall]') as HTMLElement).hidden = mine.length < 2;
    if (!full && s.rev === this.lastRev && trading === this.lastTrading) return this.updateNews(tick);
    this.lastRev = s.rev;
    this.lastTrading = trading;
    // αντικείμενα
    const itemsBox = this.el.querySelector('.items')!;
    const inv = me?.inv ?? [];
    itemsBox.innerHTML = inv.length
      ? inv.map((id, i) => {
          const d = ITEM[id];
          const label = d.needsStock ? t('term.useOn', { t: st.ticker }) : t('term.use');
          return `<div class="item-row" title="${esc(tr(d.desc))}">
            <span class="glyph">${d.glyph}</span>
            <span class="item-name"><b>${esc(tr(d.name))}</b><small class="muted">${esc(tr(d.desc))}</small></span>
            <button class="btn small" data-slot="${i}" ${trading ? '' : 'disabled'}>${esc(label)}</button>
          </div>`;
        }).join('')
      : `<p class="muted">${esc(t('term.noItems'))}</p>`;
    // ομάδα
    const feed = this.el.querySelector('.feed')!;
    feed.innerHTML = s.log.filter((l) => l.day === s.day && l.kind !== 'buy').slice(-8).reverse()
      .map((l) => `<div class="feed-line">${logLine(g, l)}</div>`).join('') || `<p class="muted">—</p>`;
    this.updateNews(tick);
  }

  private updateNews(tick: number) {
    const s = this.g.s!;
    const box = this.el.querySelector('.news')!;
    const crash = crashIn(s, tick);
    const upcoming = scoopedNews(s, tick);
    const seen = visibleNews(s, tick).slice(-6).reverse();
    const parts: string[] = [];
    if (crash !== null) parts.push(`<div class="news-line warn">⚠ ${esc(t('news.crash', { s: crash }))}</div>`);
    for (const n of upcoming) {
      parts.push(`<div class="news-line future">📰 <b>${esc(t('news.scoop', { s: Math.max(0, Math.ceil((shownAt(s, n) - tick) / 2)) }))}</b> ${esc(headline(n))}</div>`);
    }
    for (const n of seen) {
      const cls = n.crash ? 'down' : n.rumor ? 'rumor' : n.dir > 0 ? 'up' : 'down';
      const tag = n.stock >= 0 ? STOCKS[n.stock].ticker : t('news.market');
      parts.push(`<div class="news-line ${cls}"><b>${esc(tag)}</b> ${esc(headline(n))}</div>`);
    }
    box.innerHTML = parts.join('') || `<p class="muted">${esc(t('term.noNews'))}</p>`;
  }
}
