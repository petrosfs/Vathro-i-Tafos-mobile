// Το όνομα και η εμφάνιση του παίκτη, αποθηκευμένα στη συσκευή.
import type { Look } from './sim/engine';

export const SUITS = ['#23314F', '#3A3A3F', '#6B2E2E', '#2E5B47', '#C9C3B5', '#5B3B78', '#1F1F22', '#9B6A2F'];
export const SKINS = ['#F2D3B8', '#E3B48F', '#C98E62', '#A86C45', '#7A4A2C', '#4E301C'];
export const HAIR_COLORS = ['#1E1A17', '#5A3B22', '#A8743E', '#E2C27A', '#B9B9B9', '#C2412D'];
export const TIES = ['#B22B2B', '#2B5DB2', '#D9A521', '#2E8B57', '#7E3FB2', '#E07A9B', '#111111', '#F2F2F2'];
export const HAIR_STYLES = 5;
export const HATS = 5;
export const GLASSES = 3;

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
  };
}

/** Περιορίζει μια εμφάνιση που ήρθε από το δίκτυο σε έγκυρες τιμές. */
export function sanitizeLook(l: Partial<Look> | undefined): Look {
  const c = (v: unknown, n: number) => {
    const x = Math.floor(Number(v));
    return Number.isFinite(x) && x >= 0 && x < n ? x : 0;
  };
  return {
    suit: c(l?.suit, SUITS.length), skin: c(l?.skin, SKINS.length), hair: c(l?.hair, HAIR_STYLES),
    hairColor: c(l?.hairColor, HAIR_COLORS.length), hat: c(l?.hat, HATS), tie: c(l?.tie, TIES.length),
    glasses: c(l?.glasses, GLASSES),
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
