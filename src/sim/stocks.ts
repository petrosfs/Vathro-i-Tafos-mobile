// Φανταστικές εταιρείες. Κάθε ομοιότητα με πραγματικές είναι συμπτωματική.

export interface Tr {
  el: string;
  en: string;
}

export interface StockDef {
  ticker: string;
  name: Tr;
  /** Τιμή αναφοράς: η αγορά τείνει αργά να επιστρέφει κοντά της. */
  base: number;
  /** Μεταβλητότητα ανά tick (μισό δευτερόλεπτο), σε λογαριθμική κλίμακα. */
  vol: number;
  color: string;
  /** Πόσο ακολουθεί τις γενικές κινήσεις της αγοράς (0..1). */
  beta: number;
  /** Κλάδος: οι ειδήσεις του κλάδου κινούν όλες τις μετοχές του. */
  sector: SectorId;
  /** Τοπική (γκαράζ, πολυκατοικία) ή διεθνής (Wall Street, ρετιρέ). */
  era: 'local' | 'global';
}

export type SectorId = 'food' | 'tech' | 'finance' | 'transport' | 'energy' | 'pharma' | 'gambling' | 'industry';
export const SECTORS: { id: SectorId; name: Tr }[] = [
  { id: 'food', name: { el: 'Τρόφιμα & ποτά', en: 'Food & drink' } },
  { id: 'tech', name: { el: 'Τεχνολογία', en: 'Tech' } },
  { id: 'finance', name: { el: 'Τράπεζες & crypto', en: 'Banks & crypto' } },
  { id: 'transport', name: { el: 'Μεταφορές', en: 'Transport' } },
  { id: 'energy', name: { el: 'Ενέργεια', en: 'Energy' } },
  { id: 'pharma', name: { el: 'Φάρμακα', en: 'Pharma' } },
  { id: 'gambling', name: { el: 'Τζόγος', en: 'Gambling' } },
  { id: 'industry', name: { el: 'Βιομηχανία', en: 'Industry' } },
];

export const STOCKS: StockDef[] = [
  { ticker: 'SVLK', name: { el: 'Σουβλάκι Holdings', en: 'Souvlaki Holdings' }, base: 42, vol: 0.0036, color: '#E07A3F', beta: 0.6, sector: 'food', era: 'local' },
  { ticker: 'FRPE', name: { el: 'Φραπέ Industries', en: 'Frappé Industries' }, base: 18, vol: 0.0030, color: '#B08560', beta: 0.5, sector: 'food', era: 'local' },
  { ticker: 'FETA', name: { el: 'Φέτα & Υιοί', en: 'Feta & Sons' }, base: 65, vol: 0.0022, color: '#E8E2C8', beta: 0.4, sector: 'food', era: 'local' },
  { ticker: 'TAVL', name: { el: 'Τάβλι Interactive', en: 'Tavli Interactive' }, base: 27, vol: 0.0050, color: '#6FA8DC', beta: 0.8, sector: 'tech', era: 'local' },
  { ticker: 'YAYA', name: { el: 'Crypto-Γιαγιά', en: 'Crypto Granny' }, base: 9, vol: 0.0072, color: '#C27BE0', beta: 1.0, sector: 'finance', era: 'local' },
  { ticker: 'KTEL', name: { el: 'ΚΤΕΛ Αεροδιαστημική', en: 'KTEL Aerospace' }, base: 120, vol: 0.0040, color: '#5CC08A', beta: 0.9, sector: 'transport', era: 'local' },
  { ticker: 'PSAR', name: { el: 'Ψαράδικο Logistics', en: 'Fishmonger Logistics' }, base: 33, vol: 0.0034, color: '#4FB3BF', beta: 0.6, sector: 'transport', era: 'local' },
  { ticker: 'KOUL', name: { el: 'Κουλούρι Cloud', en: 'Koulouri Cloud' }, base: 74, vol: 0.0046, color: '#E5C35A', beta: 0.9, sector: 'tech', era: 'local' },

  // νέες τοπικές εισαγωγές
  { ticker: 'GYRO', name: { el: 'Γύρος Fintech', en: 'Gyros Fintech' }, base: 22, vol: 0.0048, color: '#D9822B', beta: 0.7, sector: 'finance', era: 'local' },
  { ticker: 'BAKL', name: { el: 'Μπακλαβάς Biotech', en: 'Baklava Biotech' }, base: 14, vol: 0.0060, color: '#C9A227', beta: 0.6, sector: 'pharma', era: 'local' },
  { ticker: 'KAFE', name: { el: 'Καφενείο Networks', en: 'Kafeneio Networks' }, base: 31, vol: 0.0038, color: '#8D6E63', beta: 0.7, sector: 'tech', era: 'local' },
  { ticker: 'TZAT', name: { el: 'Τζατζίκι Energy', en: 'Tzatziki Energy' }, base: 48, vol: 0.0042, color: '#9CCC65', beta: 0.8, sector: 'energy', era: 'local' },
  // διεθνείς (όλες φανταστικές)
  { ticker: 'MOON', name: { el: 'Moonburger Inc.', en: 'Moonburger Inc.' }, base: 88, vol: 0.0040, color: '#FFB74D', beta: 0.9, sector: 'food', era: 'global' },
  { ticker: 'TOST', name: { el: 'Quantum Toaster', en: 'Quantum Toaster' }, base: 140, vol: 0.0052, color: '#FF8A65', beta: 1.0, sector: 'tech', era: 'global' },
  { ticker: 'LAMA', name: { el: 'Llama Airlines', en: 'Llama Airlines' }, base: 36, vol: 0.0044, color: '#4DB6AC', beta: 0.9, sector: 'transport', era: 'global' },
  { ticker: 'GIGL', name: { el: 'Gigglesoft', en: 'Gigglesoft' }, base: 210, vol: 0.0034, color: '#7986CB', beta: 0.8, sector: 'tech', era: 'global' },
  { ticker: 'NIMB', name: { el: 'Nimbus Cloudworks', en: 'Nimbus Cloudworks' }, base: 95, vol: 0.0046, color: '#90CAF9', beta: 1.0, sector: 'tech', era: 'global' },
  { ticker: 'RBRT', name: { el: 'Robo-Barista', en: 'Robo-Barista' }, base: 27, vol: 0.0058, color: '#A1887F', beta: 0.9, sector: 'tech', era: 'global' },
  { ticker: 'SNOZ', name: { el: 'SnoozeTech', en: 'SnoozeTech' }, base: 19, vol: 0.0064, color: '#B39DDB', beta: 1.0, sector: 'tech', era: 'global' },
  { ticker: 'OCTB', name: { el: 'OctoBank', en: 'OctoBank' }, base: 160, vol: 0.0028, color: '#4FC3F7', beta: 0.7, sector: 'finance', era: 'global' },
  { ticker: 'REDP', name: { el: 'Red Planet Mining', en: 'Red Planet Mining' }, base: 58, vol: 0.0062, color: '#E57373', beta: 1.0, sector: 'energy', era: 'global' },
  { ticker: 'BUBL', name: { el: 'Bubble Wrap Holdings', en: 'Bubble Wrap Holdings' }, base: 12, vol: 0.0070, color: '#F48FB1', beta: 1.0, sector: 'industry', era: 'global' },
  { ticker: 'HYPZ', name: { el: 'Hyperloop Pizza', en: 'Hyperloop Pizza' }, base: 44, vol: 0.0050, color: '#FFD54F', beta: 0.9, sector: 'food', era: 'global' },
  { ticker: 'YETI', name: { el: 'Yeti Logistics', en: 'Yeti Logistics' }, base: 72, vol: 0.0036, color: '#E0E0E0', beta: 0.7, sector: 'transport', era: 'global' },
  // προσθήκες (στο τέλος, για να μην αλλάζουν οι αριθμοί των παλιών σε αποθηκευμένες παρτίδες)
  { ticker: 'VRNK', name: { el: 'Βερνίκια Βαφής Α.Ε.', en: 'Varnish Paints S.A.' }, base: 16, vol: 0.0044, color: '#B5835A', beta: 0.6, sector: 'industry', era: 'local' },
  { ticker: 'ZARI', name: { el: 'Ζαριά Bet', en: 'Zaria Bet' }, base: 24, vol: 0.0066, color: '#43A047', beta: 0.8, sector: 'gambling', era: 'local' },
  { ticker: 'AIGP', name: { el: 'Πετρέλαια Αιγαίου', en: 'Aegean Petroleum' }, base: 52, vol: 0.0040, color: '#37474F', beta: 0.9, sector: 'energy', era: 'local' },
  { ticker: 'KPTN', name: { el: 'Ναυτιλιακή Καπετάν Γιώργης', en: 'Captain George Shipping' }, base: 38, vol: 0.0038, color: '#1E88E5', beta: 0.8, sector: 'transport', era: 'local' },
  { ticker: 'IASO', name: { el: 'Φαρμακευτική Ιασώ', en: 'Iaso Pharmaceuticals' }, base: 61, vol: 0.0036, color: '#26A69A', beta: 0.5, sector: 'pharma', era: 'local' },
  { ticker: 'FRAS', name: { el: 'FARIAS Tequila', en: 'FARIAS Tequila' }, base: 47, vol: 0.0054, color: '#C0CA33', beta: 0.8, sector: 'food', era: 'global' },
  { ticker: 'PILL', name: { el: 'PillPal Pharma', en: 'PillPal Pharma' }, base: 118, vol: 0.0042, color: '#80DEEA', beta: 0.6, sector: 'pharma', era: 'global' },
  { ticker: 'LUCK', name: { el: 'Lucky 777 Casinos', en: 'Lucky 777 Casinos' }, base: 33, vol: 0.0062, color: '#FFCA28', beta: 0.9, sector: 'gambling', era: 'global' },
  { ticker: 'BOOM', name: { el: 'Boomstick Defense', en: 'Boomstick Defense' }, base: 175, vol: 0.0034, color: '#8D6E63', beta: 0.5, sector: 'industry', era: 'global' },
  { ticker: 'BLKG', name: { el: 'Black Gold Petroleum', en: 'Black Gold Petroleum' }, base: 82, vol: 0.0040, color: '#212121', beta: 1.0, sector: 'energy', era: 'global' },
];

/** Όλες οι εταιρείες που μπορεί να εμφανιστούν σε μια παρτίδα (όχι όλες μαζί). */
export const STOCK_COUNT = STOCKS.length;
/** Πόσες μετοχές στην αρχή και πόσες το πολύ στο χρηματιστήριο. */
export const START_LISTED = 5;
export const MAX_LISTED = 12;
