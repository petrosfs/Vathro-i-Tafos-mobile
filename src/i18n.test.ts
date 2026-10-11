import { describe, expect, it } from 'vitest';
import { DICTS, money, pct, resolveLang, signed } from './i18n';

describe('μεταφράσεις', () => {
  it('ίδια κλειδιά και μη κενά κείμενα στις δύο γλώσσες', () => {
    const el = Object.keys(DICTS.el).sort();
    expect(Object.keys(DICTS.en).sort()).toEqual(el);
    for (const lang of ['el', 'en'] as const) {
      for (const k of el) {
        const e = DICTS[lang][k as keyof typeof DICTS.el];
        const s = typeof e === 'function' ? e({ n: 1, d: 1, s: 1, code: 'ABCD', name: 'x', who: 'x', stock: 'X', amt: '$1', pnl: '+$1', item: 'i', p: '1', q: '1', c: 1, t: 'X', url: 'u', names: 'a', len: 5, diff: 'x', days: 'x', cash: '$1', v: '1.0.0' }) : e;
        expect(s.length, `${lang}:${k}`).toBeGreaterThan(0);
        expect(s, `${lang}:${k}`).not.toContain('undefined');
      }
    }
  });

  it('επιλογή γλώσσας από τη συσκευή', () => {
    expect(resolveLang('auto', ['el-GR', 'en'])).toBe('el');
    expect(resolveLang('auto', ['en-US'])).toBe('en');
    expect(resolveLang('en', ['el-GR'])).toBe('en');
  });

  it('μορφή χρημάτων', () => {
    expect(money(12345)).toBe('$12.345');
    expect(signed(-40)).toBe('−$40');
    expect(pct(0.034)).toBe('+3,4%');
  });
});
