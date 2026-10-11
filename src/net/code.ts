// Κωδικοί δωματίων (χωρίς εξάρτηση από το Firebase, για να φορτώνει γρήγορα η αρχική).
export const MAX_ROOM_PLAYERS = 10;
/** Χωρίς χαρακτήρες που μπερδεύονται (0/O, 1/I). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

export function randomCode(rnd: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)];
  return c;
}

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
