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
  {
    up: [{ el: 'Το γύρο-πορτοφόλι δέχεται πληρωμές σε τζατζίκι', en: 'The gyro wallet now takes tzatziki' }],
    down: [{ el: 'Βλάβη στα ψηστιέρια πληρωμών', en: 'Payment rotisseries break down' }],
  },
  {
    up: [{ el: 'Ο μπακλαβάς κόβει τη χοληστερίνη, λέει έρευνα', en: 'Study: baklava lowers cholesterol' }],
    down: [{ el: 'Το σιρόπι κόλλησε στα μηχανήματα', en: 'Syrup jams the lab machines' }],
  },
  {
    up: [{ el: 'Wi-Fi σε κάθε καφενείο της χώρας', en: 'Wi-Fi in every kafeneio in the land' }],
    down: [{ el: 'Οι θαμώνες αρνούνται τα smartphones', en: 'Regulars refuse smartphones' }],
  },
  {
    up: [{ el: 'Το τζατζίκι κινεί πρώτο λεωφορείο', en: 'Tzatziki powers its first bus' }],
    down: [{ el: 'Έλλειψη σκόρδου σε όλη την Ευρώπη', en: 'Garlic shortage across Europe' }],
  },
  {
    up: [{ el: 'Πρώτο εστιατόριο στη Σελήνη γεμάτο', en: 'First restaurant on the Moon fully booked' }],
    down: [{ el: 'Τα μπιφτέκια αιωρούνται μακριά', en: 'Burgers float off into space' }],
  },
  {
    up: [{ el: 'Η φρυγανιέρα λύνει εξίσωση αιώνων', en: 'Toaster solves century-old equation' }],
    down: [{ el: 'Η φρυγανιέρα έκαψε το εργαστήριο', en: 'Toaster burns down the lab' }],
  },
  {
    up: [{ el: 'Τα λάμα αποδεικνύονται άψογοι πιλότοι', en: 'Llamas prove flawless pilots' }],
    down: [{ el: 'Λάμα έφτυσε τον πύργο ελέγχου', en: 'Llama spits at the control tower' }],
  },
  {
    up: [{ el: 'Η νέα εφαρμογή γέλιου σαρώνει', en: 'New laughter app goes viral' }],
    down: [{ el: 'Το αστείο της χρονιάς δεν έπιασε', en: 'Joke of the year falls flat' }],
  },
  {
    up: [{ el: 'Τα σύννεφα της Nimbus δεν βρέχουν ποτέ', en: 'Nimbus clouds never rain' }],
    down: [{ el: 'Καταιγίδα στο data center', en: 'Storm hits the data center' }],
  },
  {
    up: [{ el: 'Το ρομπότ-μπαρίστα κερδίζει διαγωνισμό', en: 'Robo-barista wins a championship' }],
    down: [{ el: 'Το ρομπότ σερβίρει λάδι αντί για καφέ', en: 'Robot serves oil instead of coffee' }],
  },
  {
    up: [{ el: 'Ο κόσμος κοιμάται καλύτερα, πουλάει περισσότερο', en: 'The world sleeps better, buys more' }],
    down: [{ el: 'Το έξυπνο μαξιλάρι ροχαλίζει', en: 'Smart pillow starts snoring' }],
  },
  {
    up: [{ el: 'Η OctoBank ανοίγει 8 χέρια-ATM', en: 'OctoBank opens 8-armed ATMs' }],
    down: [{ el: 'Το χταπόδι έχασε το PIN', en: 'The octopus lost the PIN' }],
  },
  {
    up: [{ el: 'Βρέθηκε χρυσάφι στον Άρη', en: 'Gold found on Mars' }],
    down: [{ el: 'Αμμοθύελλα θάβει τα ορυχεία', en: 'Dust storm buries the mines' }],
  },
  {
    up: [{ el: 'Όλοι σκάνε φουσκάκια από άγχος', en: 'Everyone pops bubble wrap from stress' }],
    down: [{ el: 'Νέο υλικό συσκευασίας χωρίς φούσκες', en: 'New packaging without bubbles' }],
  },
  {
    up: [{ el: 'Πίτσα σε 4 λεπτά από τη Ρώμη', en: 'Pizza from Rome in 4 minutes' }],
    down: [{ el: 'Η πίτσα έφτασε πριν την παραγγελία', en: 'Pizza arrives before it was ordered' }],
  },
  {
    up: [{ el: 'Ο Γέτι παραδίδει και στα Ιμαλάια', en: 'Yeti now delivers to the Himalayas' }],
    down: [{ el: 'Ο Γέτι πήρε άδεια ασθενείας', en: 'The Yeti takes sick leave' }],
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

// Γεγονότα χρηματιστηρίου: νέες εισαγωγές και χρεωκοπίες.
export const IPO_HINT_HOT: Tr[] = [
  { el: 'Ουρές επενδυτών για την αυριανή εισαγωγή της {c}', en: 'Investors queue for tomorrow’s {c} IPO' },
  { el: 'Η {c} μπαίνει αύριο στο χρηματιστήριο: «θα πετάξει»', en: '{c} lists tomorrow: "it will fly"' },
];
export const IPO_HINT_COLD: Tr[] = [
  { el: 'Χλιαρό ενδιαφέρον για την αυριανή εισαγωγή της {c}', en: 'Lukewarm interest in tomorrow’s {c} IPO' },
  { el: 'Η {c} μπαίνει αύριο στο χρηματιστήριο χωρίς φανφάρες', en: '{c} lists tomorrow without fanfare' },
];
export const IPO_DAY: Tr[] = [
  { el: 'Πρώτη μέρα στο χρηματιστήριο για την {c}', en: 'First trading day for {c}' },
];
export const BUST_HINT: Tr[] = [
  { el: 'Η {c} δεν πλήρωσε τους μισθούς του μήνα', en: '{c} misses this month’s payroll' },
  { el: 'Ανησυχία για τα χρέη της {c}', en: 'Worries grow over {c}’s debts' },
];
export const BUST: Tr[] = [
  { el: 'Η {c} κηρύσσει πτώχευση! Βγαίνει από το χρηματιστήριο', en: '{c} files for bankruptcy! Delisting at the close' },
];
export const BUST_FALSE: Tr[] = [
  { el: 'Η {c} βρήκε χρηματοδότηση: «όλα καλά»', en: '{c} secures funding: "all good"' },
];
