import { describe, expect, it } from 'vitest';
import { HOST_STALE_MS, nextHost, type RoomView } from './room';
import { DEFAULT_CONFIG } from '../sim/engine';

const look = { suit: 0, skin: 0, hair: 0, hairColor: 0, hat: 0, tie: 0, glasses: 0 };
function view(hostOnline: boolean, hb: number | undefined, status: 'lobby' | 'playing' = 'playing'): RoomView {
  return {
    code: 'ABCD', loaded: true,
    meta: { host: 'h', status, createdAt: 0, config: DEFAULT_CONFIG, hb },
    players: {
      h: { name: 'H', look, joinedAt: 1, online: hostOnline },
      a: { name: 'A', look, joinedAt: 2, online: true },
      b: { name: 'B', look, joinedAt: 3, online: true },
    },
  };
}

describe('αλλαγή host', () => {
  it('ο host μένει όσο είναι συνδεδεμένος και στέλνει παλμό', () => {
    expect(nextHost(view(true, 10_000), 12_000)).toBeNull();
  });
  it('αν φύγει, αναλαμβάνει ο επόμενος κατά σειρά εισόδου', () => {
    expect(nextHost(view(false, 10_000), 11_000)).toBe('a');
  });
  it('αν «κολλήσει» (χωρίς παλμό) στη διάρκεια της παρτίδας, αναλαμβάνει άλλος', () => {
    expect(nextHost(view(true, 10_000), 10_000 + HOST_STALE_MS + 1)).toBe('a');
  });
  it('στο lobby δεν μετράει ο παλμός', () => {
    expect(nextHost(view(true, 10_000, 'lobby'), 99_999)).toBeNull();
  });
});
