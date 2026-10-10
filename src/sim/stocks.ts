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
}

export const STOCKS: StockDef[] = [
  { ticker: 'SVLK', name: { el: 'Σουβλάκι Holdings', en: 'Souvlaki Holdings' }, base: 42, vol: 0.0036, color: '#E07A3F', beta: 0.6 },
  { ticker: 'FRPE', name: { el: 'Φραπέ Industries', en: 'Frappé Industries' }, base: 18, vol: 0.0030, color: '#B08560', beta: 0.5 },
  { ticker: 'FETA', name: { el: 'Φέτα & Υιοί', en: 'Feta & Sons' }, base: 65, vol: 0.0022, color: '#E8E2C8', beta: 0.4 },
  { ticker: 'TAVL', name: { el: 'Τάβλι Interactive', en: 'Tavli Interactive' }, base: 27, vol: 0.0050, color: '#6FA8DC', beta: 0.8 },
  { ticker: 'YAYA', name: { el: 'Crypto-Γιαγιά', en: 'Crypto Granny' }, base: 9, vol: 0.0072, color: '#C27BE0', beta: 1.0 },
  { ticker: 'KTEL', name: { el: 'ΚΤΕΛ Αεροδιαστημική', en: 'KTEL Aerospace' }, base: 120, vol: 0.0040, color: '#5CC08A', beta: 0.9 },
  { ticker: 'PSAR', name: { el: 'Ψαράδικο Logistics', en: 'Fishmonger Logistics' }, base: 33, vol: 0.0034, color: '#4FB3BF', beta: 0.6 },
  { ticker: 'KOUL', name: { el: 'Κουλούρι Cloud', en: 'Koulouri Cloud' }, base: 74, vol: 0.0046, color: '#E5C35A', beta: 0.9 },
];

export const STOCK_COUNT = STOCKS.length;
