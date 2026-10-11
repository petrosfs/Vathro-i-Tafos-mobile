// Τηλεόραση με δελτίο ειδήσεων δίπλα στον μεγάλο πίνακα (από το γραφείο στην πολυκατοικία και πάνω):
// στούντιο με παρουσιαστή που «μιλάει», κάτω τρίτο με την είδηση και κυλιόμενη μπάρα με ειδήσεις και τιμές.
import * as THREE from 'three';
import { canvasTexture, FONT, type BoardData } from './textures';

const W = 512;
const H = 288;

export class NewsTv {
  readonly group = new THREE.Group();
  private c = canvasTexture(W, H, 1.5);
  private headline = '';
  private color = '#F5C542';
  private history: string[] = [];
  private prices = '';
  private changedAt = -1e9;
  private lastDraw = 0;
  private tickerX = 0;
  private breaking: string;
  private live: string;

  constructor(labels: { breaking: string; live: string; brand: string }) {
    this.breaking = labels.breaking;
    this.live = labels.live;
    this.brand = labels.brand;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.12, 1.24, 0.08), new THREE.MeshLambertMaterial({ color: '#15171C' }));
    this.group.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.125), new THREE.MeshBasicMaterial({ map: this.c.tex, toneMapped: false }));
    screen.position.z = 0.041;
    this.group.add(screen);
    // βάση στον τοίχο
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: '#2A2D33' }));
    mount.position.z = -0.07;
    this.group.add(mount);
    // μικρό λαμπάκι λειτουργίας
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshBasicMaterial({ color: '#3DDC84' }));
    led.position.set(0.98, -0.585, 0.042);
    this.group.add(led);
    this.draw(0);
  }

  private brand: string;

  setData(d: BoardData) {
    const hl = d.headline?.trim() ?? '';
    if (hl && hl !== this.headline) {
      this.headline = hl;
      this.color = d.headlineColor || '#F5C542';
      this.changedAt = performance.now();
      this.history.unshift(hl);
      if (this.history.length > 6) this.history.length = 6;
    }
    this.prices = d.rows.map((r) => `${r.ticker} ${r.price} ${r.changeText}`).join('   ·   ');
  }

  update(now: number) {
    if (!this.group.visible || now - this.lastDraw < 66) return;
    const dt = Math.min(0.2, (now - this.lastDraw) / 1000);
    this.lastDraw = now;
    this.tickerX += dt * 70;
    this.draw(now);
  }

  private draw(now: number) {
    const ctx = this.c.ctx;
    // στούντιο
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0B2A5B');
    g.addColorStop(1, '#173F82');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // φόντο: πόλη και διαγράμματα
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#9CC4FF';
    for (let i = 0; i < 14; i++) {
      const bh = 40 + ((i * 53) % 90);
      ctx.fillRect(i * 38, 190 - bh, 28, bh);
    }
    ctx.strokeStyle = '#7CE38B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= 260; x += 20) ctx.lineTo(x, 120 - Math.sin(x / 30 + now / 1500) * 18 - x / 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // παρουσιαστής πίσω από γραφείο
    this.anchor(ctx, 380, now);
    ctx.fillStyle = '#0A1B3A';
    ctx.fillRect(250, 186, 262, 26);
    ctx.fillStyle = '#C9A54A';
    ctx.fillRect(250, 184, 262, 3);
    // λογότυπο και LIVE
    ctx.fillStyle = '#C62828';
    ctx.fillRect(14, 14, 150, 34);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 20px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(this.brand, 24, 32);
    const blink = Math.floor(now / 600) % 2 === 0;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(172, 14, 70, 34);
    ctx.fillStyle = blink ? '#FF3B3B' : '#7A1E1E';
    ctx.beginPath();
    ctx.arc(188, 31, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(this.live, 199, 32);
    // κάτω τρίτο: η είδηση
    const fresh = now - this.changedAt < 6000;
    ctx.fillStyle = fresh && blink ? '#C62828' : '#8E1B1B';
    ctx.fillRect(0, 200, 130, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 15px ${FONT}`;
    ctx.fillText(this.breaking, 10, 214);
    ctx.fillStyle = 'rgba(245,245,245,0.96)';
    ctx.fillRect(0, 226, W, 34);
    ctx.fillStyle = '#10131A';
    ctx.font = `700 19px ${FONT}`;
    let text = this.headline || '…';
    while (ctx.measureText(text).width > W - 20 && text.length > 4) text = text.slice(0, -2);
    if (text !== (this.headline || '…')) text = text.trimEnd() + '…';
    ctx.fillText(text, 10, 244);
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 226, 5, 34);
    // κυλιόμενη μπάρα
    ctx.fillStyle = '#0B0F18';
    ctx.fillRect(0, 260, W, 28);
    ctx.font = `600 15px ${FONT}`;
    const items = [...this.history.slice(1), this.prices].filter(Boolean).join('   ●   ') || this.prices || ' ';
    const tw = Math.max(1, ctx.measureText(items + '   ●   ').width);
    const off = this.tickerX % tw;
    ctx.fillStyle = '#F5C542';
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 260, W, 28);
    ctx.clip();
    for (let x = -off; x < W; x += tw) ctx.fillText(items, x + 8, 275);
    ctx.restore();
    this.c.tex.needsUpdate = true;
  }

  /** Ο παρουσιαστής: κοστούμι, γραβάτα, χτένισμα και στόμα που ανοιγοκλείνει όταν διαβάζει είδηση. */
  private anchor(ctx: CanvasRenderingContext2D, x: number, now: number) {
    const talking = now - this.changedAt < 5000;
    const bob = Math.sin(now / 400) * 1.5;
    // σώμα
    ctx.fillStyle = '#1F2A44';
    ctx.beginPath();
    ctx.moveTo(x - 62, 190);
    ctx.quadraticCurveTo(x - 58, 128 + bob, x, 124 + bob);
    ctx.quadraticCurveTo(x + 58, 128 + bob, x + 62, 190);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - 14, 126 + bob);
    ctx.lineTo(x + 14, 126 + bob);
    ctx.lineTo(x, 160 + bob);
    ctx.fill();
    ctx.fillStyle = '#B3202B';
    ctx.beginPath();
    ctx.moveTo(x - 5, 130 + bob);
    ctx.lineTo(x + 5, 130 + bob);
    ctx.lineTo(x + 7, 165 + bob);
    ctx.lineTo(x, 172 + bob);
    ctx.lineTo(x - 7, 165 + bob);
    ctx.fill();
    // κεφάλι
    const hy = 92 + bob;
    ctx.fillStyle = '#E8B48F';
    ctx.beginPath();
    ctx.ellipse(x, hy, 30, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3A2414';
    ctx.beginPath();
    ctx.ellipse(x - 2, hy - 22, 32, 18, -0.1, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 32, hy - 24, 12, 22);
    // μάτια (ανοιγοκλείνουν)
    const blink = now % 3800 < 140;
    ctx.fillStyle = '#111';
    for (const s of [-1, 1]) {
      if (blink) ctx.fillRect(x + s * 11 - 4, hy - 4, 8, 2);
      else {
        ctx.beginPath();
        ctx.arc(x + s * 11, hy - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(x + s * 11 - 7, hy - 14, 14, 3.5);
    }
    // στόμα
    const open = talking ? Math.abs(Math.sin(now / 90)) * 7 : 0;
    ctx.fillStyle = '#6A2A22';
    ctx.beginPath();
    ctx.ellipse(x, hy + 16, 9, 2 + open, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
