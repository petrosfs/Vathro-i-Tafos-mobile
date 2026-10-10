// Προσωπικές ρυθμίσεις, αποθηκευμένες στη συσκευή.
export interface PersonalSettings {
  lang: 'auto' | 'el' | 'en';
  view: 'first' | 'overview';
  quality: 'low' | 'high';
  sound: boolean;
  sensitivity: number;
  reduceMotion: boolean;
}

const KEY = 'vathro.settings.v1';

export const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const DEFAULTS = (): PersonalSettings => ({
  lang: 'auto',
  view: isTouch() ? 'overview' : 'first',
  quality: isTouch() ? 'low' : 'high',
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
