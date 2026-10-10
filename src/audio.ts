// Ήχοι συντεθειμένοι επί τόπου με Web Audio (χωρίς αρχεία).
import { loadSettings } from './settings';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!loadSettings().sound) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0, slide = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  /** Το καμπανάκι της αγοράς. */
  bell() {
    for (let i = 0; i < 3; i++) {
      tone(880, 0.9, 'triangle', 0.18, i * 0.28);
      tone(1320, 0.7, 'sine', 0.06, i * 0.28);
    }
  },
  click() {
    tone(660, 0.06, 'square', 0.05);
  },
  buy() {
    tone(520, 0.08, 'triangle', 0.12);
    tone(780, 0.1, 'triangle', 0.1, 0.07);
  },
  profit() {
    tone(988, 0.08, 'square', 0.07);
    tone(1319, 0.25, 'square', 0.07, 0.08);
  },
  loss() {
    tone(220, 0.35, 'sawtooth', 0.08, 0, -120);
  },
  news() {
    tone(1200, 0.05, 'square', 0.05);
    tone(1500, 0.05, 'square', 0.05, 0.08);
  },
  alarm() {
    for (let i = 0; i < 4; i++) tone(700, 0.12, 'square', 0.08, i * 0.2, 300);
  },
  tick() {
    tone(1000, 0.03, 'sine', 0.05);
  },
  item() {
    tone(400, 0.25, 'sine', 0.12, 0, 600);
  },
  coin() {
    tone(1568, 0.06, 'square', 0.05);
    tone(2093, 0.12, 'square', 0.05, 0.06);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, i * 0.15));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.07, i * 0.3));
  },
};
