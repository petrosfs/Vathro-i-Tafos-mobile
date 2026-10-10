// Ψευδοτυχαίοι αριθμοί χωρίς κατάσταση: ίδια είσοδος δίνει πάντα ίδιο αποτέλεσμα, σε κάθε συσκευή.
// Έτσι όλοι οι παίκτες υπολογίζουν τις ίδιες τιμές χωρίς να τις στέλνει κανείς από το δίκτυο.

/** Ανακατεύει έως 5 ακέραιους σε έναν 32-bit (murmur3 finalizer). */
export function hash(a: number, b = 0, c = 0, d = 0, e = 0): number {
  let h = 0x9e3779b9 ^ Math.imul(a | 0, 0x85ebca6b);
  for (const v of [b, c, d, e]) {
    h = Math.imul(h ^ (v | 0), 0xcc9e2d51);
    h = (h << 15) | (h >>> 17);
    h = Math.imul(h, 0x1b873593) ^ 0xe6546b64;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Ομοιόμορφος στο (0, 1). */
export function uniform(a: number, b = 0, c = 0, d = 0, e = 0): number {
  return (hash(a, b, c, d, e) + 0.5) / 4294967296;
}

/** Τυπική κανονική κατανομή (Box–Muller). */
export function normal(a: number, b = 0, c = 0, d = 0): number {
  const u1 = uniform(a, b, c, d, 1);
  const u2 = uniform(a, b, c, d, 2);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Γεννήτρια με κατάσταση (mulberry32), για σειρές επιλογών όπως οι προσφορές του καταστήματος. */
export function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
