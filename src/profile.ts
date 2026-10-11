// Το όνομα και η εμφάνιση του παίκτη, αποθηκευμένα στη συσκευή.
import type { Look } from './sim/engine';

export const SUITS = ['#23314F', '#3A3A3F', '#6B2E2E', '#2E5B47', '#C9C3B5', '#5B3B78', '#1F1F22', '#9B6A2F'];
export const SKINS = ['#F2D3B8', '#E3B48F', '#C98E62', '#A86C45', '#7A4A2C', '#4E301C'];
export const HAIR_COLORS = ['#1E1A17', '#5A3B22', '#A8743E', '#E2C27A', '#B9B9B9', '#C2412D'];
export const TIES = ['#B22B2B', '#2B5DB2', '#D9A521', '#2E8B57', '#7E3FB2', '#E07A9B', '#111111', '#F2F2F2'];
export const HAIR_STYLES = 6;
export const HATS = 5;
export const GLASSES = 4;
export const BEARDS = 5;
export const EYES = 4;
export const MOUTHS = 5;
export const BROWS = 4;
export const FACES = 3;
/** Χρώματα για καπέλα και σκελετούς γυαλιών. */
export const ACC_COLORS = ['#141414', '#F2F2F2', '#C43A3A', '#E07A9B', '#7E3FB2', '#2B5DB2', '#2E8B57', '#E8B923', '#B9BEC6', '#7A3B1E'];

export interface Profile {
  name: string;
  look: Look;
}

const KEY = 'vathro.profile.v1';

export function randomLook(rnd: () => number = Math.random): Look {
  const pick = (n: number) => Math.floor(rnd() * n);
  return {
    suit: pick(SUITS.length), skin: pick(SKINS.length), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS.length),
    hat: rnd() < 0.6 ? 0 : 1 + pick(HATS - 1), tie: pick(TIES.length), glasses: rnd() < 0.6 ? 0 : 1 + pick(GLASSES - 1),
    eyes: pick(EYES), mouth: pick(MOUTHS), brows: pick(BROWS), beard: rnd() < 0.55 ? 0 : 1 + pick(BEARDS - 1),
    face: pick(FACES), build: 25 + Math.round(rnd() * 50), hatColor: -1, glassColor: -1,
  };
}

/** Περιορίζει μια εμφάνιση που ήρθε από το δίκτυο σε έγκυρες τιμές. */
export function sanitizeLook(l: Partial<Look> | undefined): Look {
  const c = (v: unknown, n: number) => {
    const x = Math.floor(Number(v));
    return Number.isFinite(x) && x >= 0 && x < n ? x : 0;
  };
  const col = (v: unknown) => {
    const x = Math.floor(Number(v));
    return Number.isFinite(x) && x >= 0 && x < ACC_COLORS.length ? x : -1;
  };
  return {
    suit: c(l?.suit, SUITS.length), skin: c(l?.skin, SKINS.length), hair: c(l?.hair, HAIR_STYLES),
    hairColor: c(l?.hairColor, HAIR_COLORS.length), hat: c(l?.hat, HATS), tie: c(l?.tie, TIES.length),
    glasses: c(l?.glasses, GLASSES), eyes: c(l?.eyes, EYES), mouth: c(l?.mouth, MOUTHS), brows: c(l?.brows, BROWS), beard: c(l?.beard, BEARDS),
    face: c(l?.face, FACES), build: l?.build === undefined ? 50 : c(l.build, 101),
    hatColor: col(l?.hatColor), glassColor: col(l?.glassColor),
  };
}

export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 16);

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { name: cleanName(String(p.name ?? '')), look: sanitizeLook(p.look) };
    }
  } catch {
    /* τίποτα αποθηκευμένο */
  }
  const p = { name: '', look: randomLook() };
  saveProfile(p);
  return p;
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* δεν πειράζει */
  }
}
