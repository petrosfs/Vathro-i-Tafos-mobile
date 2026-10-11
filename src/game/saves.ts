// Αποθηκευμένες παρτίδες στη συσκευή. Κάθε παίκτης κρατά αντίγραφο, ώστε όποιος κι αν γίνει host την
// επόμενη φορά να μπορεί να συνεχίσει. Αποθηκεύεται η κατάσταση στο κατάστημα, πριν από κάθε μέρα.
import type { GameState } from '../sim/engine';
import { migrateState } from '../sim/save';
import { APP_VERSION } from '../version';

export interface SaveRec {
  id: string;
  savedAt: number;
  v: string;
  online: boolean;
  names: string[];
  day: number;
  cash: number;
  state: GameState;
}

const KEY = 'vathro.saves.v1';
const MAX = 6;

export function loadSaves(): SaveRec[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r) => r && r.state)
      .map((r) => ({ ...r, state: migrateState(r.state) }) as SaveRec)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function store(list: SaveRec[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* γεμάτος χώρος ή ιδιωτική περιήγηση: απλώς δεν αποθηκεύεται */
  }
}

export const saveId = (s: GameState) => String(s.seed);

/** Αποθήκευση (ή ενημέρωση) της παρτίδας. Μόνο στο κατάστημα, όπου δεν υπάρχουν ανοιχτές θέσεις. */
export function putSave(s: GameState, online: boolean) {
  if (s.phase !== 'shop') return;
  const id = saveId(s);
  const rec: SaveRec = {
    id, savedAt: Date.now(), v: APP_VERSION, online,
    names: s.order.filter((u) => !s.players[u]?.bot).map((u) => s.players[u]?.name ?? '?'), day: s.day, cash: s.cash, state: structuredClone(s),
  };
  store([rec, ...loadSaves().filter((r) => r.id !== id)]);
}

export function deleteSave(id: string) {
  store(loadSaves().filter((r) => r.id !== id));
}
