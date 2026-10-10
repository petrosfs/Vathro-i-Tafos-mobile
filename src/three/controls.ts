// Κίνηση σε πρώτο πρόσωπο: πληκτρολόγιο και ποντίκι στον υπολογιστή, joystick και σύρσιμο στο κινητό.
import * as THREE from 'three';
import { ROOM, type Box2 } from './office';

const RADIUS = 0.3;
const SPEED = 3.4;
const EYE = 1.6;

export class FirstPerson {
  pos = new THREE.Vector3();
  yaw = Math.PI;
  pitch = -0.1;
  enabled = true;
  moving = false;
  private keys = new Set<string>();
  private joy = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
  private look = { id: -1, x: 0, y: 0 };
  private joyEl: HTMLElement;
  private knobEl: HTMLElement;
  private offs: (() => void)[] = [];
  onInteract: () => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private sensitivity: () => number) {
    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joy';
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'joy-knob';
    this.joyEl.append(this.knobEl);
    this.joyEl.hidden = true;
    canvas.parentElement!.append(this.joyEl);
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, ev: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(ev, fn as EventListener, opts);
      this.offs.push(() => t.removeEventListener(ev, fn as EventListener));
    };
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.enabled) this.onInteract();
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
    on(canvas, 'click', () => {
      if (this.enabled && !isCoarse() && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
    on(document, 'mousemove', (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas || !this.enabled) return;
      this.turn(e.movementX, e.movementY, 0.0024);
    });
    on(canvas, 'touchstart', (e: TouchEvent) => {
      if (!this.enabled) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth * 0.45 && this.joy.id < 0) {
          this.joy = { x: 0, y: 0, id: t.identifier, ox: t.clientX, oy: t.clientY };
          this.joyEl.hidden = false;
          this.joyEl.style.left = `${t.clientX}px`;
          this.joyEl.style.top = `${t.clientY}px`;
          this.knobEl.style.transform = 'translate(-50%, -50%)';
        } else if (this.look.id < 0) {
          this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    on(canvas, 'touchmove', (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox;
          let dy = t.clientY - this.joy.oy;
          const len = Math.hypot(dx, dy);
          const max = 50;
          if (len > max) {
            dx = (dx / len) * max;
            dy = (dy / len) * max;
          }
          this.joy.x = dx / max;
          this.joy.y = dy / max;
          this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (t.identifier === this.look.id) {
          this.turn(t.clientX - this.look.x, t.clientY - this.look.y, 0.006);
          this.look.x = t.clientX;
          this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joy.id) {
          this.joy = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
          this.joyEl.hidden = true;
        }
        if (t.identifier === this.look.id) this.look.id = -1;
      }
    };
    on(canvas, 'touchend', end);
    on(canvas, 'touchcancel', end);
  }

  private turn(dx: number, dy: number, k: number) {
    const s = k * this.sensitivity();
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.3, Math.min(1.2, this.pitch - dy * s));
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.keys.clear();
      this.joy = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
      this.joyEl.hidden = true;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    }
  }

  update(dt: number, colliders: Box2[]) {
    let fx = 0;
    let fz = 0;
    if (this.enabled) {
      const k = this.keys;
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.joy.y;
      const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.joy.x;
      // κατεύθυνση ματιού: (−sin yaw, −cos yaw)
      const sx = -Math.sin(this.yaw);
      const sz = -Math.cos(this.yaw);
      fx = sx * f + -sz * r;
      fz = sz * f + sx * r;
      const len = Math.hypot(fx, fz);
      if (len > 1) {
        fx /= len;
        fz /= len;
      }
    }
    this.moving = Math.hypot(fx, fz) > 0.05;
    const run = this.keys.has('ShiftLeft') ? 1.6 : 1;
    this.pos.x += fx * SPEED * run * dt;
    this.pos.z += fz * SPEED * run * dt;
    collide(this.pos, colliders);
  }

  apply(camera: THREE.PerspectiveCamera) {
    camera.position.set(this.pos.x, EYE, this.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** Το avatar κοιτάει προς την κατεύθυνση του ματιού (το μοντέλο «κοιτάει» προς +z). */
  get bodyRy() {
    return this.yaw + Math.PI;
  }

  dispose() {
    this.offs.forEach((f) => f());
    this.joyEl.remove();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }
}

export function collide(p: THREE.Vector3, colliders: Box2[]) {
  p.x = Math.max(ROOM.minX + RADIUS, Math.min(ROOM.maxX - RADIUS, p.x));
  p.z = Math.max(ROOM.minZ + 0.9 + RADIUS, Math.min(ROOM.maxZ - RADIUS, p.z));
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(b.maxX, p.x));
    const cz = Math.max(b.minZ, Math.min(b.maxZ, p.z));
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < RADIUS * RADIUS) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * RADIUS;
        p.z = cz + (dz / d) * RADIUS;
      } else {
        // μέσα στο κουτί: βγαίνει από την κοντινότερη πλευρά
        const opts = [
          [p.x - b.minX, -1, 0], [b.maxX - p.x, 1, 0], [p.z - b.minZ, 0, -1], [b.maxZ - p.z, 0, 1],
        ] as const;
        const [, ox, oz] = [...opts].sort((a, c) => a[0] - c[0])[0];
        if (ox) p.x = ox < 0 ? b.minX - RADIUS : b.maxX + RADIUS;
        if (oz) p.z = oz < 0 ? b.minZ - RADIUS : b.maxZ + RADIUS;
      }
    }
  }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

const isCoarse = () => matchMedia('(pointer: coarse)').matches;
