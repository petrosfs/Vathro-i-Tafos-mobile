// Υφές που ζωγραφίζονται σε canvas: ο μεγάλος πίνακας, οθόνες, ταμπέλες, ουρανοξύστες.
import * as THREE from 'three';

const SCALE = new WeakMap<CanvasRenderingContext2D, number>();

/** Πόσο «πυκνές» θα είναι οι υφές (ανάλογα με την ανάλυση): 1 ή 2. */
let textureScale = 1;
export function setTextureScale(s: number) {
  textureScale = s;
}

/** Υφή από canvas. Το w×h είναι το «λογικό» μέγεθος· σε υψηλή ανάλυση το canvas είναι διπλάσιο. */
export function canvasTexture(w: number, h: number, scale = textureScale): { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  SCALE.set(ctx, scale);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, ctx, canvas };
}

export const FONT = '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';

export const UP = '#3DDC84';
export const DOWN = '#FF5C5C';

export interface BoardRow {
  ticker: string;
  price: string;
  change: number;
  changeText: string;
  color: string;
  spark: number[];
}

export interface BoardData {
  title: string;
  clock: string;
  urgent: boolean;
  rows: BoardRow[];
  /** 0..1+ πρόοδος προς τον στόχο. */
  progress: number;
  progressText: string;
  headline: string;
  headlineColor: string;
}

/** Ο μεγάλος πίνακας τιμών στον τοίχο. */
export function drawBoard(ctx: CanvasRenderingContext2D, d: BoardData) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  ctx.fillStyle = '#05080F';
  ctx.fillRect(0, 0, W, H);
  // επικεφαλίδα
  ctx.fillStyle = '#0E1626';
  ctx.fillRect(0, 0, W, 64);
  ctx.font = `700 34px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F5C542';
  ctx.textAlign = 'left';
  ctx.fillText(d.title, 24, 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = d.urgent ? DOWN : '#E8EEF8';
  ctx.font = `700 38px ${MONO}`;
  ctx.fillText(d.clock, W - 24, 34);
  // σειρές μετοχών σε 2 στήλες
  const top = 76;
  const rowH = (H - top - 120) / 4;
  d.rows.forEach((r, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const x = 20 + col * (W / 2);
    const y = top + row * rowH;
    const w = W / 2 - 40;
    ctx.fillStyle = row % 2 ? '#0A101C' : '#0C1322';
    ctx.fillRect(x - 8, y, w + 16, rowH - 6);
    ctx.fillStyle = r.color;
    ctx.fillRect(x - 8, y, 6, rowH - 6);
    ctx.textAlign = 'left';
    ctx.font = `800 30px ${MONO}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(r.ticker, x + 8, y + rowH / 2 - 3);
    ctx.textAlign = 'right';
    ctx.font = `700 30px ${MONO}`;
    ctx.fillText(r.price, x + w * 0.62, y + rowH / 2 - 3);
    ctx.fillStyle = r.change >= 0 ? UP : DOWN;
    ctx.font = `700 26px ${MONO}`;
    ctx.fillText(r.changeText, x + w, y + rowH / 2 - 3);
    // μικρό γράφημα
    if (r.spark.length > 1) {
      const sx = x + w * 0.2;
      const sw = w * 0.2;
      const lo = Math.min(...r.spark);
      const hi = Math.max(...r.spark);
      const span = hi - lo || 1;
      ctx.strokeStyle = r.change >= 0 ? UP : DOWN;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      r.spark.forEach((v, k) => {
        const px = sx + (k / (r.spark.length - 1)) * sw;
        const py = y + rowH - 14 - ((v - lo) / span) * (rowH - 30);
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
  });
  // στόχος
  const py = H - 108;
  ctx.fillStyle = '#0E1626';
  ctx.fillRect(0, py, W, 52);
  const pw = W - 48;
  ctx.fillStyle = '#1B2840';
  ctx.fillRect(24, py + 14, pw, 24);
  const p = Math.max(0, Math.min(1, d.progress));
  ctx.fillStyle = d.progress >= 1 ? UP : '#F5C542';
  ctx.fillRect(24, py + 14, pw * p, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(d.progressText, W / 2, py + 27);
  // τίτλος ειδήσεων
  ctx.fillStyle = '#111A2D';
  ctx.fillRect(0, H - 56, W, 56);
  ctx.fillStyle = d.headlineColor;
  ctx.textAlign = 'left';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(fit(ctx, d.headline, W - 40), 20, H - 27);
}

function fit(ctx: CanvasRenderingContext2D, s: string, w: number) {
  if (ctx.measureText(s).width <= w) return s;
  let k = s.length;
  while (k > 4 && ctx.measureText(s.slice(0, k) + '…').width > w) k--;
  return s.slice(0, k) + '…';
}

/** Μικρή οθόνη γραφείου: μια μετοχή με το γράφημά της. */
export function drawMonitor(ctx: CanvasRenderingContext2D, ticker: string, color: string, series: number[], label: string) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  ctx.fillStyle = '#071019';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 6);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#E8EEF8';
  ctx.font = `800 22px ${MONO}`;
  ctx.fillText(ticker, 10, 12);
  ctx.textAlign = 'right';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = '#8FA3BF';
  ctx.fillText(label, W - 10, 15);
  if (series.length > 1) {
    const lo = Math.min(...series);
    const hi = Math.max(...series);
    const span = hi - lo || 1;
    const up = series[series.length - 1] >= series[0];
    ctx.strokeStyle = up ? UP : DOWN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    series.forEach((v, k) => {
      const x = 8 + (k / (series.length - 1)) * (W - 16);
      const y = H - 10 - ((v - lo) / span) * (H - 56);
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  } else {
    ctx.fillStyle = '#304060';
    ctx.font = `600 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('· · ·', W / 2, H / 2);
  }
}

/** Ουρανοξύστες στο σούρουπο για τα παράθυρα. */
export function drawSkyline(ctx: CanvasRenderingContext2D, seed: number) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1B1A3A');
  g.addColorStop(0.55, '#7A3E62');
  g.addColorStop(1, '#F29A5B');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let layer = 0; layer < 2; layer++) {
    let x = -10;
    while (x < W) {
      const w = 30 + rnd() * 70;
      const h = H * (0.25 + rnd() * (layer ? 0.55 : 0.35));
      ctx.fillStyle = layer ? '#141428' : '#2B2445';
      ctx.fillRect(x, H - h, w, h);
      if (layer) {
        for (let wy = H - h + 8; wy < H - 6; wy += 12) {
          for (let wx = x + 5; wx < x + w - 6; wx += 10) {
            if (rnd() < 0.35) {
              ctx.fillStyle = rnd() < 0.8 ? '#F7D774' : '#9FD8FF';
              ctx.fillRect(wx, wy, 5, 6);
            }
          }
        }
      }
      x += w + 2 + rnd() * 10;
    }
  }
}

/** Ταμπέλα με κείμενο (π.χ. για το μηχάνημα του καταστήματος). */
export function drawSign(ctx: CanvasRenderingContext2D, title: string, sub: string, bg: string, fg: string) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.floor(H * 0.32)}px ${FONT}`;
  ctx.fillText(title, W / 2, H * 0.4, W - 20);
  ctx.font = `600 ${Math.floor(H * 0.16)}px ${FONT}`;
  ctx.fillText(sub, W / 2, H * 0.75, W - 20);
}

/** Ετικέτα ονόματος πάνω από το avatar. */
export function nameTagTexture(name: string, color: string): THREE.CanvasTexture {
  const { tex, ctx, canvas } = canvasTexture(256, 64, 2);
  ctx.font = `700 30px ${FONT}`;
  const w = Math.min(248, ctx.measureText(name).width + 32);
  ctx.fillStyle = 'rgba(8,12,22,0.78)';
  roundRect(ctx, (256 - w) / 2, 6, w, 52, 26);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect((256 - w) / 2 + 16, 50, w - 32, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 30, 230);
  void canvas;
  return tex;
}

export function bubbleTexture(text: string): THREE.CanvasTexture {
  const { tex, ctx } = canvasTexture(128, 128, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(64, 58, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(52, 104);
  ctx.lineTo(64, 126);
  ctx.lineTo(76, 104);
  ctx.fill();
  ctx.font = `64px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111';
  ctx.fillText(text, 64, 62);
  return tex;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Χαλί με λεπτές γραμμές. */
export function drawCarpet(ctx: CanvasRenderingContext2D) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  ctx.fillStyle = '#2C3442';
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = '#323B4B';
  ctx.lineWidth = 2;
  for (let i = 0; i <= W; i += W / 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, W);
    ctx.moveTo(0, i);
    ctx.lineTo(W, i);
    ctx.stroke();
  }
}

/** Ταφόπλακα με όνομα. */
export function drawTombstone(ctx: CanvasRenderingContext2D, name: string) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  ctx.fillStyle = '#8E949C';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3B3F46';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText('R.I.P.', W / 2, H * 0.3);
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(name, W / 2, H * 0.58, W - 16);
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('$0', W / 2, H * 0.8);
}

/** Οθόνη ειδήσεων στον τοίχο (αναβάθμιση γραφείου). */
export function drawNewsScreen(ctx: CanvasRenderingContext2D, headline: string) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0B1A33');
  g.addColorStop(1, '#13284D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#C62828';
  ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 30px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('● LIVE  NEWS', 20, 29);
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = '#F5C542';
  const words = (headline || '…').split(' ');
  let line = '';
  let y = 110;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 40 && line) {
      ctx.fillText(line, 20, y);
      line = w;
      y += 42;
      if (y > H - 30) break;
    } else line = test;
  }
  if (y <= H - 30) ctx.fillText(line, 20, y);
}

/** Νέον ταμπέλα με το όνομα του fund. */
export function drawNeon(ctx: CanvasRenderingContext2D, text: string) {
  const W = ctx.canvas.width / (SCALE.get(ctx) ?? 1);
  const H = ctx.canvas.height / (SCALE.get(ctx) ?? 1);
  ctx.clearRect(0, 0, W, H);
  ctx.font = `900 54px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#FF4FD8';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#FFC6F3';
  ctx.fillText(text.toUpperCase(), W / 2, H / 2, W - 20);
  ctx.shadowBlur = 8;
  ctx.fillText(text.toUpperCase(), W / 2, H / 2, W - 20);
  ctx.shadowBlur = 0;
}
