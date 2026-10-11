// Προσωπικές ρυθμίσεις, αποθηκευμένες στη συσκευή.
export interface PersonalSettings {
  lang: 'auto' | 'el' | 'en';
  view: 'first' | 'third' | 'overview';
  quality: 'low' | 'high';
  /** Ανάλυση εικόνας: auto ή συγκεκριμένο επίπεδο. */
  resolution: Resolution;
  sound: boolean;
  sensitivity: number;
  reduceMotion: boolean;
}

export type Resolution = 'auto' | 'low' | 'medium' | 'high' | 'ultra';
export const RESOLUTIONS: Resolution[] = ['auto', 'low', 'medium', 'high', 'ultra'];

/** Πόσα pixel της οθόνης ζωγραφίζει το παιχνίδι ανά pixel σελίδας. */
export function pixelRatioFor(r: Resolution): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  switch (r) {
    case 'low':
      return 0.75;
    case 'medium':
      return 1;
    case 'high':
      return Math.min(dpr, 1.6);
    case 'ultra':
      return Math.min(dpr, 2.5);
    default:
      return Math.min(dpr, isTouch() ? 1.6 : 2);
  }
}

const KEY = 'vathro.settings.v1';

export const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const DEFAULTS = (): PersonalSettings => ({
  lang: 'auto',
  view: isTouch() ? 'overview' : 'first',
  quality: isTouch() ? 'low' : 'high',
  resolution: 'auto',
  sound: true,
  sensitivity: 1,
  reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

let cache: PersonalSettings | null = null;

export function loadSettings(): PersonalSettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS(), ...JSON.parse(raw) } : DEFAULTS();
  } catch {
    cache = DEFAULTS();
  }
  return cache!;
}

export function saveSettings(s: PersonalSettings) {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ιδιωτική περιήγηση κ.λπ.: απλώς δεν αποθηκεύεται */
  }
}
