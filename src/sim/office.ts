// Το γραφείο: διακοσμητικά για το γραφείο του κάθε παίκτη και αναβαθμίσεις για όλη την ομάδα.
// Τα διακοσμητικά τα πληρώνει ο καθένας από το πορτοφόλι του, τις αναβαθμίσεις η ομάδα με νομίσματα.
// Ισχύουν μέχρι το τέλος της παρτίδας. Κάποια ξεκλειδώνουν μόνιμα (στη συσκευή) όταν πετύχετε κάτι,
// και από τότε εμφανίζονται στο κατάστημα κάθε παρτίδας.
import type { Tr } from './stocks';

export type DecorId = 'lamp' | 'cactus' | 'bonsai' | 'trophy' | 'lava' | 'frame' | 'globe' | 'bull' | 'goldfish' | 'duck';
export type UpgradeId = 'espresso' | 'screens' | 'goldbell' | 'aquarium' | 'sofa' | 'neon' | 'kourabie' | 'tiger' | 'bonuspool' | 'lawyer' | 'doll' | 'slot';
export type OfficeId = DecorId | UpgradeId;

/** Πότε ξεκλειδώνει κάτι: φτάνοντας σε μέρα, ανεβαίνοντας στο βάθρο, ή με κέρδος σε μία παρτίδα. */
export type Unlock = { kind: 'day'; n: number } | { kind: 'podium' } | { kind: 'profit'; n: number } | null;

export interface OfficeDef {
  id: OfficeId;
  kind: 'decor' | 'upgrade';
  price: number;
  glyph: string;
  unlock: Unlock;
  name: Tr;
  desc: Tr;
}

export const OFFICE: OfficeDef[] = [
  { id: 'lamp', kind: 'decor', price: 1, glyph: '💡', unlock: null,
    name: { el: 'Λάμπα γραφείου', en: 'Desk lamp' }, desc: { el: 'Πράσινη λάμπα τραπεζίτη.', en: 'A green banker’s lamp.' } },
  { id: 'duck', kind: 'decor', price: 1, glyph: '🦆', unlock: null,
    name: { el: 'Παπάκι', en: 'Rubber duck' }, desc: { el: 'Για debugging και για ψυχολογική υποστήριξη.', en: 'For debugging and emotional support.' } },
  { id: 'frame', kind: 'decor', price: 1, glyph: '🖼', unlock: null,
    name: { el: 'Κορνίζα', en: 'Photo frame' }, desc: { el: 'Μια φωτογραφία από διακοπές που δεν πήγες ακόμα.', en: 'A photo from a holiday you haven’t taken yet.' } },
  { id: 'cactus', kind: 'decor', price: 1, glyph: '🌵', unlock: null,
    name: { el: 'Κάκτος', en: 'Cactus' }, desc: { el: 'Αντέχει χωρίς νερό, όπως κι εσύ χωρίς ύπνο.', en: 'Survives without water, like you without sleep.' } },
  { id: 'bonsai', kind: 'decor', price: 2, glyph: '🌳', unlock: { kind: 'day', n: 3 },
    name: { el: 'Μπονσάι', en: 'Bonsai' }, desc: { el: 'Ηρεμία ανάμεσα στα κραχ.', en: 'Calm between crashes.' } },
  { id: 'globe', kind: 'decor', price: 2, glyph: '🌍', unlock: { kind: 'day', n: 5 },
    name: { el: 'Υδρόγειος', en: 'Globe' }, desc: { el: 'Για να δείχνεις πού θα ανοίξει γραφείο το fund.', en: 'To point at where the fund opens next.' } },
  { id: 'lava', kind: 'decor', price: 2, glyph: '🫧', unlock: { kind: 'day', n: 7 },
    name: { el: 'Λάμπα λάβας', en: 'Lava lamp' }, desc: { el: 'Ρετρό, ροζ, υπνωτική.', en: 'Retro, pink, hypnotic.' } },
  { id: 'bull', kind: 'decor', price: 3, glyph: '🐂', unlock: { kind: 'profit', n: 50000 },
    name: { el: 'Χάλκινος ταύρος', en: 'Bronze bull' }, desc: { el: 'Για όσους έβγαλαν $50.000 σε μία παρτίδα.', en: 'For those who made $50,000 in one game.' } },
  { id: 'goldfish', kind: 'decor', price: 2, glyph: '🐠', unlock: { kind: 'day', n: 10 },
    name: { el: 'Χρυσόψαρο', en: 'Goldfish' }, desc: { el: 'Θυμάται τις τιμές για 3 δευτερόλεπτα.', en: 'Remembers prices for 3 seconds.' } },
  { id: 'trophy', kind: 'decor', price: 3, glyph: '🏆', unlock: { kind: 'podium' },
    name: { el: 'Κύπελλο', en: 'Trophy' }, desc: { el: 'Μόνο για όσους ανέβηκαν στο βάθρο.', en: 'Only for those who made the podium.' } },
  { id: 'espresso', kind: 'upgrade', price: 5, glyph: '☕', unlock: null,
    name: { el: 'Επαγγελματική καφετιέρα', en: 'Pro espresso machine' }, desc: { el: 'Κάθε μέρα κρατάει 30 δευτερόλεπτα περισσότερο.', en: 'Every day lasts 30 seconds longer.' } },
  { id: 'bonuspool', kind: 'upgrade', price: 6, glyph: '💰', unlock: null,
    name: { el: 'Bonus pool', en: 'Bonus pool' }, desc: { el: '+1% στο bonus όλων.', en: '+1% on everyone’s bonus.' } },
  { id: 'doll', kind: 'upgrade', price: 3, glyph: '🎈', unlock: null,
    name: { el: 'Φουσκωτή κούκλα', en: 'Inflatable doll' },
    desc: { el: 'Η πιο πιστή υπάλληλος του fund: δεν παραπονιέται, δεν ζητάει bonus, δεν μιλάει στην Επιτροπή.', en: 'The fund’s most loyal employee: never complains, never asks for a bonus, never talks to the Commission.' } },
  { id: 'slot', kind: 'upgrade', price: 3, glyph: '🎰', unlock: null,
    name: { el: 'Κουλοχέρης', en: 'Slot machine' },
    desc: { el: 'Ο καθένας τζογάρει τα δικά του. Ό,τι χάνεται μένει μέσα, μέχρι κάποιος να φέρει 7️⃣7️⃣7️⃣ και να τα πάρει όλα.', en: 'Everyone gambles their own money. Losses stay inside until someone hits 7️⃣7️⃣7️⃣ and takes it all.' } },
  { id: 'lawyer', kind: 'upgrade', price: 5, glyph: '⚖', unlock: null,
    name: { el: 'Δικηγόρος του fund', en: 'Fund lawyer' },
    desc: { el: 'Μισές υποψίες και μισό πρόστιμο από την Επιτροπή Κεφαλαιαγοράς.', en: 'Half the suspicion and half the fine from the Securities Commission.' } },
  { id: 'sofa', kind: 'upgrade', price: 2, glyph: '🛋', unlock: null,
    name: { el: 'Καναπές', en: 'Sofa' }, desc: { el: 'Για τα διαλείμματα. Καθαρά διακοσμητικό.', en: 'For breaks. Purely decorative.' } },
  { id: 'screens', kind: 'upgrade', price: 5, glyph: '🖥', unlock: { kind: 'day', n: 4 },
    name: { el: 'Οθόνες ειδήσεων', en: 'News screens' }, desc: { el: 'Βλέπετε κάθε είδηση 5 δευτερόλεπτα νωρίτερα.', en: 'You see every headline 5 seconds earlier.' } },
  { id: 'goldbell', kind: 'upgrade', price: 5, glyph: '🔔', unlock: { kind: 'day', n: 6 },
    name: { el: 'Χρυσό καμπανάκι', en: 'Golden bell' }, desc: { el: '+1 νόμισμα σε κάθε μέρα που πιάνετε τον στόχο.', en: '+1 coin for every day you hit the quota.' } },
  { id: 'neon', kind: 'upgrade', price: 2, glyph: '✨', unlock: { kind: 'day', n: 8 },
    name: { el: 'Νέον ταμπέλα', en: 'Neon sign' }, desc: { el: 'Το όνομα του fund να λάμπει στον τοίχο.', en: 'The fund’s name glowing on the wall.' } },
  { id: 'aquarium', kind: 'upgrade', price: 4, glyph: '🐟', unlock: { kind: 'podium' },
    name: { el: 'Ενυδρείο', en: 'Aquarium' }, desc: { el: 'Μεγάλο ενυδρείο για το γραφείο των νικητών.', en: 'A big aquarium for a winning office.' } },
  { id: 'kourabie', kind: 'upgrade', price: 7, glyph: '❄', unlock: { kind: 'day', n: 5 },
    name: { el: 'Κουραμπιεδόσκονη', en: 'Kourabies sugar dust' },
    desc: { el: 'Πιο δραστική από τον καφέ: κάθε μέρα κρατάει 1 λεπτό περισσότερο και όλοι περπατάνε πιο γρήγορα.', en: 'Stronger than coffee: every day lasts 1 minute longer and everyone walks faster.' } },
  { id: 'tiger', kind: 'upgrade', price: 8, glyph: '🐯', unlock: { kind: 'podium' },
    name: { el: 'Τίγρης', en: 'Tiger' },
    desc: { el: 'Το κατοικίδιο του fund τριγυρνάει ελεύθερο στο γραφείο. Μόνο για όσους ανέβηκαν στο βάθρο.', en: 'The fund’s pet roams the office freely. Only for those who made the podium.' } },
];

export const OFFICE_DEF: Record<OfficeId, OfficeDef> = Object.fromEntries(OFFICE.map((o) => [o.id, o])) as Record<OfficeId, OfficeDef>;

export const MAX_DECOR = 4;
/** Ticks που κερδίζει η καφετιέρα (30″) και οι οθόνες ειδήσεων (5″). */
export const ESPRESSO_TICKS = 60;
export const SCREENS_TICKS = 10;
/** Η κουραμπιεδόσκονη: +1 λεπτό τη μέρα. */
export const KOURABIE_TICKS = 120;

/** Μόνιμη πρόοδος στη συσκευή: τι έχει πετύχει ο παίκτης σε όλες του τις παρτίδες. */
export interface Progress {
  bestDay: number;
  podiums: number;
  bestProfit: number;
  unlocked: OfficeId[];
  /** Ποιες παρτίδες έχουν ήδη μετρήσει ως βάθρο (για να μη μετρηθούν δύο φορές). */
  countedPodium?: number[];
}

export function emptyProgress(): Progress {
  return { bestDay: 0, podiums: 0, bestProfit: 0, unlocked: [] };
}

export function meets(u: Unlock, p: Progress): boolean {
  if (!u) return true;
  if (u.kind === 'day') return p.bestDay >= u.n;
  if (u.kind === 'podium') return p.podiums > 0;
  return p.bestProfit >= u.n;
}

/** Τι ξεκλειδώνει με αυτή την πρόοδο (όσα δεν θέλουν ξεκλείδωμα δεν μετράνε). */
export function unlockedBy(p: Progress): OfficeId[] {
  return OFFICE.filter((o) => o.unlock && meets(o.unlock, p)).map((o) => o.id);
}

/** Διαθέσιμο στο κατάστημα μιας παρτίδας με αυτά τα ξεκλειδώματα. */
export const available = (id: OfficeId, unlocked: readonly string[]) => !OFFICE_DEF[id].unlock || unlocked.includes(id);
