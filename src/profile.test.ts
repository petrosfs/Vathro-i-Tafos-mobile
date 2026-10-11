import { describe, expect, it } from 'vitest';
import { ACC_COLORS, FACES, randomLook, sanitizeLook } from './profile';

describe('εμφάνιση', () => {
  it('παλιά προφίλ: κανονικό σώμα, αβγό, αρχικά χρώματα αξεσουάρ', () => {
    const l = sanitizeLook({ suit: 1 });
    expect(l.build).toBe(50);
    expect(l.face).toBe(0);
    expect(l.hatColor).toBe(-1);
    expect(l.glassColor).toBe(-1);
  });
  it('άκυρες τιμές από το δίκτυο', () => {
    const l = sanitizeLook({ build: 400, face: 9, hatColor: ACC_COLORS.length, glassColor: -5 } as never);
    expect(l.build).toBe(0);
    expect(l.face).toBe(0);
    expect(l.hatColor).toBe(-1);
    expect(l.glassColor).toBe(-1);
    expect(sanitizeLook({ build: 100, face: FACES - 1, hatColor: 3 }).build).toBe(100);
  });
  it('τυχαία εμφάνιση μέσα στα όρια', () => {
    for (let i = 0; i < 50; i++) {
      const l = randomLook();
      expect(sanitizeLook(l)).toEqual(l);
    }
  });
});
