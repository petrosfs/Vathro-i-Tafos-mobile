// Μόνιμη πρόοδος στη συσκευή: ρεκόρ που ξεκλειδώνουν αντικείμενα γραφείου για όλες τις επόμενες παρτίδες.
import type { GameState } from '../sim/engine';
import { emptyProgress, unlockedBy, type OfficeId, type Progress } from '../sim/office';

const KEY = 'vathro.progress.v1';

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (p) return { ...emptyProgress(), ...p, unlocked: Array.isArray(p.unlocked) ? p.unlocked : [] };
  } catch {
    /* τίποτα */
  }
  return emptyProgress();
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* δεν πειράζει */
  }
}

/** Ενημέρωση από μια παρτίδα σε εξέλιξη· επιστρέφει όσα ξεκλείδωσαν μόλις τώρα. */
export function recordProgress(s: GameState): OfficeId[] {
  const p = loadProgress();
  const before = new Set(p.unlocked);
  p.bestDay = Math.max(p.bestDay, s.day);
  p.bestProfit = Math.max(p.bestProfit, Math.round(s.cash - s.config.startCash));
  if (s.result === 'podium' && !p.countedPodium?.includes(s.seed)) {
    p.podiums++;
    p.countedPodium = [...(p.countedPodium ?? []), s.seed].slice(-20);
  }
  p.unlocked = [...new Set([...p.unlocked, ...unlockedBy(p)])];
  save(p);
  return p.unlocked.filter((id) => !before.has(id));
}
