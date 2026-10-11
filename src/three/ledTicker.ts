// Κυλιόμενη μπάρα τιμών (LED) πάνω από τα παράθυρα, όπως στα γραφεία της Wall Street.
import * as THREE from 'three';
import { canvasTexture, MONO, type BoardRow } from './textures';

export class LedTicker {
  readonly group = new THREE.Group();
  private c = canvasTexture(2048, 64, 1);
  private key = '';

  constructor(length: number) {
    this.c.tex.wrapS = THREE.RepeatWrapping;
    this.c.tex.repeat.set(length / 12, 1);
    const back = new THREE.Mesh(new THREE.BoxGeometry(length, 0.3, 0.06), new THREE.MeshLambertMaterial({ color: '#111318' }));
    this.group.add(back);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(length - 0.1, 0.22), new THREE.MeshBasicMaterial({ map: this.c.tex, toneMapped: false }));
    led.position.z = 0.031;
    this.group.add(led);
    this.draw([]);
  }

  setRows(rows: BoardRow[]) {
    const key = rows.map((r) => `${r.ticker}${r.price}${r.changeText}`).join('|');
    if (key === this.key) return;
    this.key = key;
    this.draw(rows);
  }

  private draw(rows: BoardRow[]) {
    const ctx = this.c.ctx;
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, 2048, 64);
    ctx.font = `800 40px ${MONO}`;
    ctx.textBaseline = 'middle';
    let x = 20;
    const list = rows.length ? rows : [];
    for (let k = 0; x < 2048 && list.length; k++) {
      const r = list[k % list.length];
      ctx.fillStyle = '#E8EEF8';
      ctx.fillText(r.ticker, x, 34);
      x += ctx.measureText(r.ticker).width + 14;
      ctx.fillStyle = r.change >= 0 ? '#3DDC84' : '#FF5C5C';
      const t = `${r.change >= 0 ? '▲' : '▼'}${r.changeText.replace(/^[+−-]/, '')}`;
      ctx.fillText(t, x, 34);
      x += ctx.measureText(t).width + 60;
    }
    this.c.tex.needsUpdate = true;
  }

  update(dt: number) {
    if (this.group.visible) this.c.tex.offset.x += dt * 0.05;
  }
}
