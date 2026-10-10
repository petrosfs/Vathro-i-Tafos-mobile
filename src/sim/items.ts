import type { Tr } from './stocks';

// Αντικείμενα καταστήματος. Τα «αναλώσιμα» τα κρατάει όποιος τα αγοράζει (ως 4) και τα χρησιμοποιεί
// στη διάρκεια της μέρας· τα «προνόμια» ισχύουν για όλη την ομάδα μέχρι το τέλος της παρτίδας.

export type ConsumableId = 'tip' | 'pump' | 'dump' | 'halt' | 'coffee' | 'lev' | 'loan' | 'scoop';
export type PerkId = 'short' | 'fees' | 'stop' | 'interest' | 'piggy' | 'radar' | 'wire' | 'parachute' | 'mentor';
export type ItemId = ConsumableId | PerkId;

export interface ItemDef {
  id: ItemId;
  kind: 'consumable' | 'perk';
  price: number;
  /** Χρειάζεται να διαλέξεις μετοχή. */
  needsStock: boolean;
  /** Βάρος στην κλήρωση των προσφορών. */
  weight: number;
  name: Tr;
  desc: Tr;
  /** Σύμβολο για την κάρτα του αντικειμένου (απλό κείμενο, χωρίς εικόνες). */
  glyph: string;
}

export const ITEMS: ItemDef[] = [
  {
    id: 'tip', kind: 'consumable', price: 3, needsStock: true, weight: 10, glyph: '👁',
    name: { el: 'Εσωτερική πληροφορία', en: 'Insider tip' },
    desc: { el: 'Δείχνει σε όλη την ομάδα την πορεία μιας μετοχής για τα επόμενα 20 δευτερόλεπτα.', en: 'Shows the whole team where one stock goes over the next 20 seconds.' },
  },
  {
    id: 'pump', kind: 'consumable', price: 4, needsStock: true, weight: 8, glyph: '🚀',
    name: { el: 'Φήμη στα social', en: 'Social media hype' },
    desc: { el: 'Η μετοχή ανεβαίνει περίπου 18% μέσα σε 10 δευτερόλεπτα.', en: 'The stock rises about 18% over 10 seconds.' },
  },
  {
    id: 'dump', kind: 'consumable', price: 4, needsStock: true, weight: 6, glyph: '📉',
    name: { el: 'Πανικός στο φόρουμ', en: 'Forum panic' },
    desc: { el: 'Η μετοχή πέφτει περίπου 16% μέσα σε 10 δευτερόλεπτα. Ιδανικό με ανοιχτή πώληση.', en: 'The stock drops about 16% over 10 seconds. Great with a short.' },
  },
  {
    id: 'halt', kind: 'consumable', price: 2, needsStock: true, weight: 7, glyph: '⏸',
    name: { el: 'Αναστολή διαπραγμάτευσης', en: 'Trading halt' },
    desc: { el: 'Η τιμή της μετοχής παγώνει για 20 δευτερόλεπτα.', en: 'The stock price freezes for 20 seconds.' },
  },
  {
    id: 'coffee', kind: 'consumable', price: 3, needsStock: false, weight: 7, glyph: '☕',
    name: { el: 'Διπλός εσπρέσο', en: 'Double espresso' },
    desc: { el: '+30 δευτερόλεπτα στη μέρα (ως +90 ανά μέρα).', en: '+30 seconds to the day (up to +90 per day).' },
  },
  {
    id: 'lev', kind: 'consumable', price: 3, needsStock: false, weight: 8, glyph: '×3',
    name: { el: 'Μόχλευση ×3', en: 'Leverage ×3' },
    desc: { el: 'Η επόμενη θέση σου έχει τριπλάσιο κέρδος ή ζημιά. Αν χάσει όλο το κεφάλαιό της, κλείνει.', en: 'Your next position gains or loses three times as much. If it loses all its margin, it closes.' },
  },
  {
    id: 'loan', kind: 'consumable', price: 2, needsStock: false, weight: 5, glyph: '🏦',
    name: { el: 'Δάνειο-εξπρές', en: 'Express loan' },
    desc: { el: 'Παίρνεις +50% του ταμείου σε μετρητά. Στο τέλος της μέρας επιστρέφεις το ποσό +15%.', en: 'Get +50% of the balance in cash. At day end you repay it +15%.' },
  },
  {
    id: 'scoop', kind: 'consumable', price: 3, needsStock: false, weight: 6, glyph: '📰',
    name: { el: 'Αποκλειστικό ρεπορτάζ', en: 'Exclusive scoop' },
    desc: { el: 'Δείχνει στην ομάδα τις 3 επόμενες ειδήσεις και πότε θα βγουν.', en: 'Shows the team the next 3 headlines and when they hit.' },
  },
  {
    id: 'short', kind: 'perk', price: 5, needsStock: false, weight: 6, glyph: '⇅',
    name: { el: 'Άδεια ανοιχτών πωλήσεων', en: 'Short-selling licence' },
    desc: { el: 'Η ομάδα μπορεί να ποντάρει και σε πτώση (short).', en: 'The team can bet on prices falling (short).' },
  },
  {
    id: 'fees', kind: 'perk', price: 4, needsStock: false, weight: 5, glyph: '%',
    name: { el: 'Φίλος χρηματιστής', en: 'Broker buddy' },
    desc: { el: 'Η προμήθεια πέφτει από 0,5% σε 0,1% ανά συναλλαγή.', en: 'Fees drop from 0.5% to 0.1% per trade.' },
  },
  {
    id: 'stop', kind: 'perk', price: 4, needsStock: false, weight: 5, glyph: '⛑',
    name: { el: 'Αυτόματο stop-loss', en: 'Automatic stop-loss' },
    desc: { el: 'Κάθε θέση κλείνει μόνη της αν χάσει 8%.', en: 'Each position closes itself if it loses 8%.' },
  },
  {
    id: 'interest', kind: 'perk', price: 5, needsStock: false, weight: 4, glyph: '∿',
    name: { el: 'Τόκος καταθέσεων', en: 'Savings interest' },
    desc: { el: 'Στο τέλος κάθε μέρας +3% στο ταμείο.', en: '+3% on the balance at the end of each day.' },
  },
  {
    id: 'piggy', kind: 'perk', price: 4, needsStock: false, weight: 5, glyph: '🐷',
    name: { el: 'Κουμπαράς', en: 'Piggy bank' },
    desc: { el: '+2 νομίσματα κάθε μέρα που περνάτε.', en: '+2 coins for every day you pass.' },
  },
  {
    id: 'radar', kind: 'perk', price: 3, needsStock: false, weight: 4, glyph: '⚠',
    name: { el: 'Ραντάρ κραχ', en: 'Crash radar' },
    desc: { el: 'Προειδοποίηση 15 δευτερόλεπτα πριν από κάθε κραχ.', en: 'A warning 15 seconds before every crash.' },
  },
  {
    id: 'wire', kind: 'perk', price: 4, needsStock: false, weight: 4, glyph: '📡',
    name: { el: 'Συνδρομή σε πρακτορείο', en: 'Newswire subscription' },
    desc: { el: 'Βλέπετε κάθε είδηση 10 δευτερόλεπτα πριν από τους άλλους.', en: 'You see every headline 10 seconds before everyone else.' },
  },
  {
    id: 'parachute', kind: 'perk', price: 6, needsStock: false, weight: 3, glyph: '🪂',
    name: { el: 'Χρυσό αλεξίπτωτο', en: 'Golden parachute' },
    desc: { el: 'Αν αποτύχετε στον στόχο, επιβιώνετε μία φορά. Μετά χάνεται.', en: 'If you miss a quota, you survive once. Then it is gone.' },
  },
  {
    id: 'mentor', kind: 'perk', price: 5, needsStock: false, weight: 3, glyph: '🎓',
    name: { el: 'Μέντορας από τη Wall Street', en: 'Wall Street mentor' },
    desc: { el: 'Όλοι οι επόμενοι στόχοι είναι 10% χαμηλότεροι.', en: 'All future quotas are 10% lower.' },
  },
];

export const ITEM: Record<ItemId, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemId, ItemDef>;

export const INVENTORY_SLOTS = 4;
export const SHOP_OFFERS = 5;
export const COFFEE_TICKS = 60;
export const COFFEE_MAX = 180;
export const TIP_TICKS = 40;
export const SCOOP_COUNT = 3;
export const RADAR_TICKS = 30;
export const WIRE_TICKS = 20;
export const STOP_LOSS = 0.08;
export const LOAN_SHARE = 0.5;
export const LOAN_COST = 0.15;
export const INTEREST = 0.03;
