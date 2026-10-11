// Σύνοψη στο τέλος: βάθρο ή τάφος, στατιστικά, διακρίσεις, γράφημα ταμείου.
import { esc, h } from '../app';
import { money, signed, t } from '../i18n';
import { ranking, type GameState } from '../sim/engine';
import { PLAYER_COLORS } from '../three/avatar';

export interface EndActions {
  again?: () => void;
  lobby?: () => void;
  home: () => void;
  waitHost?: boolean;
}

export function endScreen(s: GameState, myUid: string, acts: EndActions): HTMLElement {
  const podium = s.result === 'podium';
  const last = s.history.at(-1);
  const rank = ranking(s);
  const best = s.history.reduce((a, r) => (r.profit > a ? r.profit : a), -Infinity);
  const color = (u: string) => PLAYER_COLORS[Math.max(0, s.order.indexOf(u)) % PLAYER_COLORS.length];
  const awards: string[] = [];
  if (rank.length > 1) {
    const by = (f: (u: string) => number) => [...rank].sort((a, b) => f(b) - f(a))[0];
    const P = (u: string) => s.players[u].stats;
    const add = (key: Parameters<typeof t>[0], uid: string | undefined, ok: boolean) => {
      if (uid && ok) awards.push(`<div class="award"><small>${esc(t(key))}</small><b style="color:${color(uid)}">${esc(s.players[uid].name)}</b></div>`);
    };
    add('award.wolf', by((u) => P(u).pnl), true);
    const yolo = by((u) => P(u).liquidations);
    add('award.yolo', yolo, !!yolo && P(yolo).liquidations > 0);
    add('award.busy', by((u) => P(u).trades), true);
    const gad = by((u) => P(u).items);
    add('award.gadget', gad, !!gad && P(gad).items > 0);
    const careful = by((u) => (P(u).trades ? -Math.abs(P(u).worst) : -Infinity));
    add('award.careful', careful, !!careful && P(careful).trades > 0);
  }
  const rows = rank.map((u, i) => {
    const p = s.players[u];
    return `<tr class="${u === myUid ? 'me' : ''}">
      <td>${i + 1}</td>
      <td><span class="dot" style="background:${color(u)}"></span>${esc(p.name)}</td>
      <td class="${p.stats.pnl >= 0 ? 'up' : 'down'}">${signed(p.stats.pnl)}</td>
      <td>${p.stats.trades}</td>
      <td>${signed(p.stats.best)}</td>
      <td>${p.stats.items}</td>
      <td class="wallet">${money(p.wallet ?? 0)}</td>
    </tr>`;
  }).join('');
  const el = h(`
    <div class="end ${podium ? 'podium' : 'grave'}">
      <div class="end-card">
        <h1>${esc(podium ? t('end.podium') : t('end.grave'))}</h1>
        <p class="lead">${esc(podium ? t('end.podiumSub', { d: s.history.length }) : (last?.bankrupt ? t('end.bankruptSub', { d: last.day, c: money(last.equity) }) : t('end.graveSub', { d: last?.day ?? 1, p: signed(last?.profit ?? 0), q: money(last?.quota ?? 0) })))}</p>
        <div class="shop-stats">
          <div><small>${esc(t('end.days'))}</small><b>${s.history.filter((r) => r.passed || r.saved).length}</b></div>
          <div><small>${esc(t('end.final'))}</small><b>${money(s.cash)}</b></div>
          <div><small>${esc(t('end.bestDay'))}</small><b>${Number.isFinite(best) ? signed(best) : '—'}</b></div>
        </div>
        ${awards.length ? `<div class="awards">${awards.join('')}</div>` : ''}
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>${esc(t('end.player'))}</th><th>${esc(t('end.pnl'))}</th><th>${esc(t('end.trades'))}</th><th>${esc(t('end.bestTrade'))}</th><th>${esc(t('end.items'))}</th><th>${esc(t('hud.wallet'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <h3>${esc(t('end.chart'))}</h3>
        <canvas class="eq-chart"></canvas>
        ${acts.waitHost ? `<p class="muted">${esc(t('end.waitHost'))}</p>` : ''}
        <div class="end-btns">
          ${acts.again ? `<button class="btn primary" data-again>${esc(t('end.again'))}</button>` : ''}
          ${acts.lobby ? `<button class="btn primary" data-lobby>${esc(t('end.lobby'))}</button>` : ''}
          <button class="btn ghost" data-home>${esc(t('end.home'))}</button>
        </div>
      </div>
    </div>`);
  el.querySelector('[data-again]')?.addEventListener('click', () => acts.again?.());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => acts.lobby?.());
  el.querySelector('[data-home]')!.addEventListener('click', acts.home);
  requestAnimationFrame(() => drawEquity(el.querySelector('canvas')!, [s.config.startCash, ...s.history.map((r) => r.equity)], s.history.map((r) => r.quota)));
  return el;
}

function drawEquity(c: HTMLCanvasElement, eq: number[], quotas: number[]) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth || 300;
  const hh = c.clientHeight || 140;
  c.width = w * dpr;
  c.height = hh * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const max = Math.max(...eq) * 1.1;
  const L = 8;
  const R = 8;
  const T = 10;
  const B = 18;
  const x = (i: number) => L + (i / Math.max(1, eq.length - 1)) * (w - L - R);
  const y = (v: number) => T + (1 - v / max) * (hh - T - B);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(L, y(0));
  ctx.lineTo(w - R, y(0));
  ctx.stroke();
  // ο στόχος κάθε μέρας πάνω από το ταμείο της προηγούμενης
  ctx.strokeStyle = 'rgba(245,197,66,0.6)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  quotas.forEach((q, i) => {
    const v = eq[i] + q;
    if (i) ctx.lineTo(x(i + 1), y(v));
    else ctx.moveTo(x(i + 1), y(v));
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#3DDC84';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  eq.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.stroke();
  ctx.fillStyle = '#3DDC84';
  eq.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(v), 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  eq.forEach((_, i) => ctx.fillText(String(i), x(i), hh - 4));
}
