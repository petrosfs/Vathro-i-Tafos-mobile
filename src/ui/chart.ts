// Γράφημα τιμής μετοχής σε canvas, με την «εσωτερική πληροφορία» ως διακεκομμένη γραμμή.

export interface ChartMarker {
  tick: number;
  price: number;
  side: 1 | -1;
}

export interface ChartData {
  series: ArrayLike<number>;
  /** Ως ποιο tick είναι γνωστή η τιμή (το «τώρα»). */
  now: number;
  len: number;
  future?: { from: number; to: number } | null;
  markers?: ChartMarker[];
  news?: { tick: number; dir: 1 | -1 }[];
  halts?: { from: number; to: number }[];
  color: string;
}

const UP = '#3DDC84';
const DOWN = '#FF5C5C';

export function drawChart(canvas: HTMLCanvasElement, d: ChartData) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || 300;
  const ch = canvas.clientHeight || 160;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const now = Math.max(0, Math.min(d.len, Math.floor(d.now)));
  // κλάσμα ανάμεσα στο τρέχον και το επόμενο tick: η γραμμή προχωρά ομαλά
  const frac = now < d.len ? Math.max(0, Math.min(1, d.now - now)) : 0;
  const headT = now + frac;
  const headV = frac > 0 ? d.series[now] + (d.series[now + 1] - d.series[now]) * frac : d.series[now];
  const futTo = d.future ? Math.min(d.len, d.future.to) : now;
  const end = Math.max(now, futTo);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= end; i++) {
    const v = d.series[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  lo = Math.min(lo, headV);
  hi = Math.max(hi, headV);
  const pad = (hi - lo) * 0.12 || hi * 0.02 || 1;
  lo -= pad;
  hi += pad;
  const L = 6;
  const R = 52;
  const T = 8;
  const B = 18;
  const W = cw - L - R;
  const H = ch - T - B;
  // Ζουμ στο κομμάτι της μέρας που έχει περάσει, ώστε να φαίνονται οι κινήσεις από την αρχή.
  const span = Math.min(d.len, Math.max(120, Math.ceil(headT * 1.15) + 10, futTo + 10));
  const x = (t: number) => L + (t / span) * W;
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * H;
  // πλέγμα
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    const yy = y(v);
    ctx.beginPath();
    ctx.moveTo(L, yy);
    ctx.lineTo(L + W, yy);
    ctx.stroke();
    ctx.fillText(v.toFixed(2), L + W + 6, yy);
  }
  // αναστολές
  for (const hz of d.halts ?? []) {
    ctx.fillStyle = 'rgba(120,160,255,0.12)';
    ctx.fillRect(x(hz.from), T, x(hz.to) - x(hz.from), H);
  }
  // ειδήσεις
  for (const n of d.news ?? []) {
    if (n.tick > now) continue;
    ctx.strokeStyle = n.dir > 0 ? 'rgba(61,220,132,0.5)' : 'rgba(255,92,92,0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x(n.tick), T);
    ctx.lineTo(x(n.tick), T + H);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // γραμμή τιμής
  const first = d.series[0];
  const last = headV;
  const col = last >= first ? UP : DOWN;
  const grad = ctx.createLinearGradient(0, T, 0, T + H);
  grad.addColorStop(0, col + '44');
  grad.addColorStop(1, col + '00');
  ctx.beginPath();
  for (let i = 0; i <= now; i++) {
    if (i) ctx.lineTo(x(i), y(d.series[i]));
    else ctx.moveTo(x(i), y(d.series[i]));
  }
  ctx.lineTo(x(headT), y(headV));
  ctx.lineTo(x(headT), T + H);
  ctx.lineTo(x(0), T + H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= now; i++) {
    if (i) ctx.lineTo(x(i), y(d.series[i]));
    else ctx.moveTo(x(i), y(d.series[i]));
  }
  ctx.lineTo(x(headT), y(headV));
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  // μέλλον από την εσωτερική πληροφορία
  if (d.future && futTo > now) {
    ctx.beginPath();
    ctx.moveTo(x(headT), y(headV));
    for (let i = now + 1; i <= futTo; i++) ctx.lineTo(x(i), y(d.series[i]));
    ctx.strokeStyle = '#F5C542';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // θέσεις
  for (const m of d.markers ?? []) {
    if (m.tick > now) continue;
    const mx = x(m.tick);
    const my = y(m.price);
    ctx.fillStyle = m.side > 0 ? UP : DOWN;
    ctx.beginPath();
    if (m.side > 0) {
      ctx.moveTo(mx, my - 2);
      ctx.lineTo(mx - 5, my + 7);
      ctx.lineTo(mx + 5, my + 7);
    } else {
      ctx.moveTo(mx, my + 2);
      ctx.lineTo(mx - 5, my - 7);
      ctx.lineTo(mx + 5, my - 7);
    }
    ctx.fill();
    ctx.strokeStyle = (m.side > 0 ? UP : DOWN) + '66';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(x(headT), my);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // τρέχουσα τιμή
  const ly = y(last);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x(headT), ly, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(L + W + 2, ly - 9, R - 4, 18);
  ctx.fillStyle = '#05080F';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText(last.toFixed(2), L + W + 6, ly);
  // χρονικός άξονας
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let m = 120; m < span; m += 120) ctx.fillText(`${m / 120}′`, x(m), ch - 4);
  void d.color;
}

/** Μικρό γράφημα για τη λίστα μετοχών. */
export function drawSpark(canvas: HTMLCanvasElement, series: ArrayLike<number>, now: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || 60;
  const ch = canvas.clientHeight || 22;
  if (canvas.width !== Math.round(cw * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const n = Math.max(1, Math.floor(now));
  const step = Math.max(1, Math.floor(n / 40));
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= n; i += step) {
    lo = Math.min(lo, series[i]);
    hi = Math.max(hi, series[i]);
  }
  lo = Math.min(lo, series[n]);
  hi = Math.max(hi, series[n]);
  const span = hi - lo || 1;
  ctx.strokeStyle = series[n] >= series[0] ? UP : DOWN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= n; i += step) {
    const xx = (i / n) * (cw - 2) + 1;
    const yy = ch - 2 - ((series[i] - lo) / span) * (ch - 4);
    if (first) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
    first = false;
  }
  ctx.lineTo(cw - 1, ch - 2 - ((series[n] - lo) / span) * (ch - 4));
  ctx.stroke();
}
