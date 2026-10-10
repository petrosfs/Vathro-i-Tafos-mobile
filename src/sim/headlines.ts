import type { Tr } from './stocks';

// Τίτλοι ειδήσεων. Το {c} γίνεται όνομα εταιρείας.

export const GENERIC_UP: Tr[] = [
  { el: '{c}: κέρδη πολύ πάνω από τις εκτιμήσεις', en: '{c} smashes earnings estimates' },
  { el: '{c}: εξαγορά ανταγωνιστή με μετρητά', en: '{c} buys out a rival in cash' },
  { el: 'Αναλυτές αναβαθμίζουν την {c} σε «αγορά»', en: 'Analysts upgrade {c} to "buy"' },
  { el: '{c}: συμφωνία-μαμούθ με αλυσίδα του εξωτερικού', en: '{c} signs a mammoth deal abroad' },
  { el: '{c}: ρεκόρ πωλήσεων το τρίμηνο', en: '{c} posts record quarterly sales' },
  { el: 'Επενδυτικό ταμείο αγοράζει μεγάλο πακέτο της {c}', en: 'Big fund takes a large stake in {c}' },
];

export const GENERIC_DOWN: Tr[] = [
  { el: '{c}: έρευνα της Επιτροπής Κεφαλαιαγοράς', en: '{c} under regulator investigation' },
  { el: '{c}: απεργία στις αποθήκες', en: 'Warehouse strike hits {c}' },
  { el: 'Η {c} χάνει τον μεγαλύτερο πελάτη της', en: '{c} loses its biggest client' },
  { el: 'Αναλυτές υποβαθμίζουν την {c} σε «πώληση»', en: 'Analysts downgrade {c} to "sell"' },
  { el: '{c}: ο CEO παραιτείται ξαφνικά', en: '{c} CEO resigns out of nowhere' },
  { el: '{c}: «λάθος» στα λογιστικά βιβλία', en: '{c} finds an "error" in its books' },
];

/** Ειδικοί τίτλοι ανά μετοχή, με την ίδια σειρά με το STOCKS. */
export const SPECIFIC: { up: Tr[]; down: Tr[] }[] = [
  {
    up: [
      { el: 'Η Σουβλάκι ανοίγει 500 καταστήματα στο Τόκιο', en: 'Souvlaki opens 500 stores in Tokyo' },
      { el: 'Το τζατζίκι ανακηρύσσεται υπερτροφή', en: 'Tzatziki declared a superfood' },
    ],
    down: [
      { el: 'Πανελλήνια έλλειψη πίτας', en: 'Nationwide pita shortage' },
      { el: 'Νέα μόδα: η χορτοφαγία σαρώνει', en: 'New craze: everyone goes vegetarian' },
    ],
  },
  {
    up: [
      { el: 'Καύσωνας 45 βαθμών για δύο εβδομάδες', en: 'Two-week heatwave at 45°C' },
      { el: 'Ο φραπές μπαίνει στα πρωινά της Ιταλίας', en: 'Frappé conquers Italian breakfasts' },
    ],
    down: [
      { el: 'Έρευνα: ο φραπές «δεν είναι καφές»', en: 'Study: frappé "is not coffee"' },
      { el: 'Χιόνια τον Ιούλιο', en: 'Snow in July' },
    ],
  },
  {
    up: [
      { el: 'Η φέτα κατοχυρώνεται και στο διάστημα', en: 'Feta gets protected status in space' },
      { el: 'Ρεκόρ εξαγωγών φέτας', en: 'Feta exports hit a record' },
    ],
    down: [
      { el: 'Λιγότερα πρόβατα, λιγότερο γάλα', en: 'Fewer sheep, less milk' },
      { el: 'Γείτονες πουλάνε «φέτα» από αγελαδινό', en: 'Neighbours sell cow-milk "feta"' },
    ],
  },
  {
    up: [
      { el: 'Το τάβλι γίνεται ολυμπιακό άθλημα', en: 'Tavli becomes an Olympic sport' },
      { el: 'Το νέο τους παιχνίδι στο Νο1 παγκοσμίως', en: 'Their new game hits No.1 worldwide' },
    ],
    down: [
      { el: 'Bug: τα ζάρια φέρνουν πάντα εξάρες', en: 'Bug: the dice always roll double sixes' },
      { el: 'Τα καφενεία κλείνουν νωρίς', en: 'Cafés close early' },
    ],
  },
  {
    up: [
      { el: 'Γνωστός influencer: «η γιαγιά στο φεγγάρι»', en: 'Famous influencer: "Granny to the moon"' },
      { el: 'Η γιαγιά δέχεται πληρωμές σε κουλουράκια', en: 'Granny now accepts payment in cookies' },
    ],
    down: [
      { el: 'Η γιαγιά ξέχασε τον κωδικό του πορτοφολιού', en: 'Granny forgot her wallet password' },
      { el: 'Χάκερς στο πλεκτό της γιαγιάς', en: 'Hackers breach Granny’s knitting' },
    ],
  },
  {
    up: [
      { el: 'Το ΚΤΕΛ προσγειώνεται στον Άρη', en: 'KTEL bus lands on Mars' },
      { el: 'Σύμβαση με διαστημική υπηρεσία', en: 'Contract signed with a space agency' },
    ],
    down: [
      { el: 'Το λεωφορείο-πύραυλος έμεινε από βενζίνη', en: 'The rocket bus ran out of fuel' },
      { el: 'Καθυστέρηση εκτόξευσης «λόγω κίνησης»', en: 'Launch delayed "due to traffic"' },
    ],
  },
  {
    up: [
      { el: 'Τεράστιο κοπάδι σαρδέλες στο Αιγαίο', en: 'Huge sardine shoal in the Aegean' },
      { el: 'Παράδοση ψαριού με drone σε 10 λεπτά', en: 'Fish delivered by drone in 10 minutes' },
    ],
    down: [
      { el: 'Τα ψυγεία χάλασαν σε όλη τη χώρα', en: 'Fridges fail nationwide' },
      { el: 'Μποφόρ 10: δεν βγαίνουν καΐκια', en: 'Force-10 winds keep boats ashore' },
    ],
  },
  {
    up: [
      { el: 'Κουλούρι Cloud: 1 δισ. χρήστες', en: 'Koulouri Cloud hits 1 billion users' },
      { el: 'Το σουσάμι αποδεικνύεται ημιαγωγός', en: 'Sesame turns out to be a semiconductor' },
    ],
    down: [
      { el: 'Μπλακ άουτ στο data center των κουλουριών', en: 'Blackout at the koulouri data center' },
      { el: 'Ψίχουλα παντού: πρόστιμο από τον δήμο', en: 'Crumbs everywhere: city issues a fine' },
    ],
  },
];

export const MARKET_UP: Tr[] = [
  { el: 'Η Κεντρική Τράπεζα μειώνει τα επιτόκια', en: 'Central bank cuts interest rates' },
  { el: 'Αισιοδοξία: η ανεργία στο χαμηλότερο επίπεδο', en: 'Optimism: unemployment at record low' },
];

export const MARKET_DOWN: Tr[] = [
  { el: 'Πληθωρισμός-ρεκόρ: ανησυχία στις αγορές', en: 'Record inflation spooks markets' },
  { el: 'Ακριβαίνει το χρήμα: αυξάνονται τα επιτόκια', en: 'Money gets pricier: rates go up' },
];

export const CRASH: Tr[] = [
  { el: 'ΚΡΑΧ: πανικός στο χρηματιστήριο', en: 'CRASH: panic on the trading floor' },
  { el: 'ΚΡΑΧ: η μεγάλη τράπεζα κατέρρευσε', en: 'CRASH: the big bank has collapsed' },
];

export const RUMOR_PREFIX: Tr = { el: 'ΦΗΜΗ: ', en: 'RUMOR: ' };
