// Ο κουλοχέρης του γραφείου: ντουλάπι με τρία καρούλια, μοχλό, φωτεινή ταμπέλα και οθόνη με το καζάνι.
import * as THREE from 'three';
import { mat } from './avatar';
import { canvasTexture } from './textures';
import { SLOT_SYMBOLS } from '../sim/slot';

const box = (color: string | THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), typeof color === 'string' ? mat(color) : color);
  b.position.set(x, y, z);
  b.castShadow = true;
  return b;
};

export class SlotMachine {
  readonly group = new THREE.Group();
  private reels = canvasTexture(256, 96);
  private pot = canvasTexture(256, 64);
  private lever: THREE.Group;
  private lights: THREE.MeshBasicMaterial;
  private shown = [4, 4, 4];
  private spin: { t0: number; to: number[]; jackpot: boolean } | null = null;
  private potText = '';
  private flash = 0;

  constructor() {
    const g = this.group;
    const red = '#B3202B';
    const gold = '#E8B923';
    // ντουλάπι
    g.add(box(red, 0.78, 1.0, 0.62, 0, 0.5, 0));
    g.add(box('#7A121B', 0.82, 0.06, 0.66, 0, 1.02, 0));
    const top = box(red, 0.78, 0.62, 0.5, 0, 1.36, -0.06);
    g.add(top);
    g.add(box(gold, 0.8, 0.04, 0.52, 0, 1.68, -0.06));
    // καρούλια πίσω από τζάμι
    const reel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.24), new THREE.MeshBasicMaterial({ map: this.reels.tex }));
    reel.position.set(0, 1.4, 0.195);
    g.add(reel);
    g.add(box(gold, 0.66, 0.03, 0.03, 0, 1.535, 0.2));
    g.add(box(gold, 0.66, 0.03, 0.03, 0, 1.265, 0.2));
    // οθόνη με το καζάνι
    const pot = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshBasicMaterial({ map: this.pot.tex }));
    pot.position.set(0, 1.16, 0.195);
    g.add(pot);
    // ράφι με κουμπιά και θήκη για τα κέρδη
    const shelf = box('#2A2A2A', 0.78, 0.05, 0.2, 0, 0.98, 0.38);
    shelf.rotation.x = -0.25;
    g.add(shelf);
    for (const [x, c] of [[-0.22, '#3DDC84'], [0, '#F5C542'], [0.22, '#E23B3B']] as [number, string][]) {
      g.add(box(new THREE.MeshBasicMaterial({ color: c }), 0.12, 0.04, 0.08, x, 1.02, 0.38));
    }
    g.add(box('#111', 0.5, 0.18, 0.08, 0, 0.32, 0.31));
    g.add(box(gold, 0.54, 0.03, 0.1, 0, 0.42, 0.32));
    // φωτεινή ταμπέλα JACKPOT
    const sign = canvasTexture(256, 64);
    const c = sign.ctx;
    c.fillStyle = '#1A0B2E';
    c.fillRect(0, 0, 256, 64);
    c.font = '900 40px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#FFD84D';
    c.shadowColor = '#FF4FD8';
    c.shadowBlur = 12;
    c.fillText('JACKPOT', 128, 34);
    sign.tex.needsUpdate = true;
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.19), new THREE.MeshBasicMaterial({ map: sign.tex }));
    signMesh.position.set(0, 1.84, -0.02);
    g.add(signMesh);
    g.add(box('#1A0B2E', 0.8, 0.22, 0.06, 0, 1.84, -0.06));
    // λαμπάκια γύρω από την ταμπέλα
    this.lights = new THREE.MeshBasicMaterial({ color: '#FFE27A' });
    const bulb = new THREE.SphereGeometry(0.022, 8, 6);
    for (let i = 0; i < 9; i++) {
      for (const y of [1.735, 1.945]) {
        const b = new THREE.Mesh(bulb, this.lights);
        b.position.set(-0.36 + i * 0.09, y, 0.0);
        g.add(b);
      }
    }
    // μοχλός στο πλάι
    this.lever = new THREE.Group();
    this.lever.position.set(0.45, 1.1, 0);
    this.lever.add(box('#999', 0.06, 0.1, 0.1, 0, 0, 0));
    const stick = box('#C9C9C9', 0.03, 0.42, 0.03, 0.03, 0.21, 0);
    this.lever.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), mat('#E23B3B'));
    knob.position.set(0.03, 0.44, 0);
    this.lever.add(knob);
    g.add(this.lever);
    this.drawReels(this.shown);
    this.setPot('');
  }

  private drawReels(sym: number[], blur = false) {
    const c = this.reels.ctx;
    c.fillStyle = '#FFF8E7';
    c.fillRect(0, 0, 256, 96);
    c.font = '54px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      c.globalAlpha = blur ? 0.55 : 1;
      const k = sym[i] ?? 0;
      c.fillText(k < SLOT_SYMBOLS.length ? SLOT_SYMBOLS[k] : '❔', 43 + i * 85, 52);
      c.globalAlpha = 1;
      if (i) {
        c.fillStyle = '#C9B98F';
        c.fillRect(i * 85, 0, 3, 96);
        c.fillStyle = '#FFF8E7';
      }
    }
    this.reels.tex.needsUpdate = true;
  }

  setPot(text: string) {
    if (text === this.potText) return;
    this.potText = text;
    const c = this.pot.ctx;
    c.fillStyle = '#0B0B0B';
    c.fillRect(0, 0, 256, 64);
    c.font = '700 30px ui-monospace, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#FF5A3C';
    c.fillText(text, 128, 34);
    this.pot.tex.needsUpdate = true;
  }

  /** Τραβάει τον μοχλό και τα καρούλια σταματούν ένα-ένα στο αποτέλεσμα. */
  play(to: number[], jackpot: boolean) {
    this.spin = { t0: performance.now(), to, jackpot };
  }

  /** Χωρίς animation (π.χ. όταν μπαίνεις σε παρτίδα που ήδη έχει τραβήγματα). */
  show(to: number[]) {
    this.shown = [...to];
    this.drawReels(this.shown);
  }

  update(now: number) {
    // λαμπάκια που αναβοσβήνουν (γρήγορα μετά από τζάκποτ)
    const fast = now < this.flash;
    const on = Math.floor(now / (fast ? 90 : 600)) % 2 === 0;
    this.lights.color.set(fast ? (on ? '#FF4FD8' : '#FFE27A') : on ? '#FFE27A' : '#B89A3A');
    if (!this.spin) return;
    const t = (now - this.spin.t0) / 1000;
    this.lever.rotation.x = t < 0.25 ? (t / 0.25) * 0.9 : Math.max(0, 0.9 - (t - 0.25) * 3);
    const stops = [0.8, 1.15, 1.5];
    const sym = [0, 1, 2].map((i) => (t < stops[i] ? Math.floor(now / 70 + i * 2) % SLOT_SYMBOLS.length : this.spin!.to[i]));
    this.drawReels(sym, t < stops[2]);
    if (t >= stops[2]) {
      if (this.spin.jackpot) this.flash = now + 5000;
      this.shown = [...this.spin.to];
      this.spin = null;
      this.lever.rotation.x = 0;
    }
  }
}
