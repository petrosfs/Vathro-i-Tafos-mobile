<h1 align="center">Ή στο βάθρο ή στον τάφο · Podium or Grave</h1>

<p align="center">
  <b>Wall Street edition</b><br>
  Co-op παιχνίδι συναλλαγών σε 3D γραφείο · A co-op trading game in a 3D office<br>
  1–10 παίκτες online ή solo · 1–10 players online or solo
</p>

<p align="center">
  <a href="https://petrosfs.github.io/Vathro-i-Tafos-mobile/"><b>▶ Παίξε τώρα · Play now</b></a>
  &nbsp;·&nbsp;
  <a href="#ελληνικά">Ελληνικά</a> · <a href="#english">English</a>
</p>

<p align="center">
  <a href="https://github.com/petrosfs/Vathro-i-Tafos-mobile/actions/workflows/deploy.yml"><img src="https://github.com/petrosfs/Vathro-i-Tafos-mobile/actions/workflows/deploy.yml/badge.svg" alt="Deploy status"></a>
</p>

<p align="center">
  <img src="docs/screenshots/home.png" width="180" alt="Αρχική · Home">
  <img src="docs/screenshots/game.png" width="180" alt="Το γραφείο · The office">
  <img src="docs/screenshots/terminal.png" width="180" alt="Τερματικό · Terminal">
  <img src="docs/screenshots/shop.png" width="180" alt="Κατάστημα · Shop">
</p>

---

## Ελληνικά

### Τι είναι

Εσύ και έως 9 φίλοι ανοίγετε ένα hedge fund στη Wall Street σχεδόν άφραγκοι. Έχετε **ένα κοινό ταμείο**:
το κέρδος του ενός σώζει την ομάδα, η ζημιά του άλλου τη βουλιάζει. Κάθε μέρα κρατάει λίγα λεπτά και έχει
**στόχο κέρδους** που μεγαλώνει. Αν τον πιάσετε, ψωνίζετε από το κατάστημα αντικείμενα που χειραγωγούν την
αγορά. Αν αποτύχετε, το fund κλείνει: **στον τάφο**. Αν αντέξετε όλες τις μέρες: **στο βάθρο**.

**[▶ Παίξε στο petrosfs.github.io/Vathro-i-Tafos-mobile](https://petrosfs.github.io/Vathro-i-Tafos-mobile/)**,
από κινητό ή υπολογιστή, χωρίς εγκατάσταση και χωρίς λογαριασμό.

### Χαρακτηριστικά

- **3D γραφείο** με γραφεία, οθόνες, μεγάλο πίνακα τιμών και μηχάνημα καταστήματος. Τρεις κάμερες, από τις
  ρυθμίσεις: **πρώτο πρόσωπο**, **τρίτο πρόσωπο** (περπατάς με WASD/ποντίκι ή joystick στο κινητό, E για
  τερματικό, Esc για μενού) ή **σταθερή από ψηλά**.
- **8 φανταστικές μετοχές** με δική τους «προσωπικότητα», τάσεις μέσα στη μέρα, **ειδήσεις** που βγαίνουν
  λίγο πριν κινηθεί η τιμή, **φήμες** που μπορεί να βγουν ανάποδα, και **κραχ**.
- **17 αντικείμενα**: εσωτερική πληροφορία, φήμη στα social, πανικός στο φόρουμ, αναστολή διαπραγμάτευσης,
  μόχλευση ×3, δάνειο-εξπρές, καφές για παράταση, άδεια για short, stop-loss, χρυσό αλεξίπτωτο κ.ά.
- **Online με φίλους** από οπουδήποτε στον κόσμο, με κωδικό δωματίου ή σύνδεσμο πρόσκλησης. Chat και emotes
  πάνω από τα avatars.
- **Χαρακτήρας** με κοστούμι, γραβάτα, μαλλιά, καπέλο και γυαλιά.
- **Τελική σκηνή**: βάθρο με τους καλύτερους traders και κομφετί, ή ταφόπλακες. Σύνοψη με διακρίσεις,
  στατιστικά και γράφημα του ταμείου.
- **Ελληνικά και αγγλικά** (αυτόματα από τη γλώσσα της συσκευής), σελίδα κανόνων.

<p align="center"><img src="docs/screenshots/desktop.png" width="720" alt="Το παιχνίδι σε υπολογιστή"></p>

### Πώς είναι φτιαγμένο

| Κομμάτι | Επιλογή |
| --- | --- |
| Γλώσσα και build | TypeScript + Vite, χωρίς UI framework |
| 3D | Three.js, low-poly μοντέλα από απλά σχήματα, υφές ζωγραφισμένες σε canvas (κανένα αρχείο εικόνας) |
| Αγορά | Ντετερμινιστική προσομοίωση (`src/sim`): όλες οι συσκευές υπολογίζουν τις ίδιες τιμές από το ίδιο seed |
| Online | Ένας παίκτης είναι ο host και τρέχει τη μηχανή· οι κινήσεις και η κατάσταση περνούν από **Firebase Realtime Database** |
| Φιλοξενία | **GitHub Pages**, με αυτόματο test, build και deploy μέσω GitHub Actions· μηδενικό κόστος |

**Δίκαιο για όλους, όπου κι αν είναι.** Οι τιμές δεν ταξιδεύουν στο δίκτυο: κάθε συσκευή τις υπολογίζει μόνη
της. Κάθε κίνηση εκτελείται στην τιμή της στιγμής που πατήθηκε το κουμπί, με ανοχή ως 3 δευτερόλεπτα
καθυστέρησης δικτύου. Έτσι ένας παίκτης από την Αμερική παίζει επί ίσοις όροις.

**Χωρίς server.** Αν φύγει ο host, αναλαμβάνει αυτόματα ο επόμενος παίκτης και η μέρα συνεχίζει από την
αποθηκευμένη κατάσταση. Όποιος κάνει ανανέωση στη σελίδα, ξαναμπαίνει στο δωμάτιο.

**Ελαφρύ.** Η αρχική φορτώνει χωρίς το Firebase, που κατεβαίνει μόνο όταν πας online. Στα κινητά η
προεπιλογή είναι σταθερή κάμερα και ελαφριά γραφικά.

**Ποιότητα.**
- **28 τεστ** (Vitest), με προσομοιώσεις χιλιάδων τυχαίων κινήσεων που ελέγχουν ότι το ταμείο δεν γίνεται
  ποτέ αρνητικό και ότι δεν χάνεται θέση.
- Κατά την ανάπτυξη, **δοκιμές σε πραγματικό browser** (Playwright) με τοπικό Firebase emulator: παρτίδες
  10 παικτών, αλλαγή host στη μέση της μέρας, επανασύνδεση μετά από ανανέωση, επιστροφή στο δωμάτιο.

### Δομή του κώδικα

```
src/
  sim/      αγορά, ειδήσεις, αντικείμενα, κανόνες (καθαρές συναρτήσεις)
  game/     host, «εικόνα» της παρτίδας στη συσκευή, solo
  net/      Firebase, δωμάτια, συγχρονισμός
  three/    3D γραφείο, avatars, κάμερες, βάθρο και τάφοι
  ui/       τερματικό, κατάστημα, chat, γραφήματα, σύνοψη
  screens/  αρχική, χαρακτήρας, ρυθμίσεις, online, lobby, παρτίδα, κανόνες
  i18n.ts   ελληνικά και αγγλικά
```

### Τοπική εκτέλεση

```bash
npm install
npm run dev     # τοπικός server
npm test        # τεστ
npm run build   # build στον φάκελο dist
```

Για δικό σου online: φτιάξε project στο Firebase με **Anonymous Authentication** και **Realtime Database**,
επικόλλησε τους κανόνες από το `database.rules.json` και βάλε τα στοιχεία της web εφαρμογής στο
`src/net/config.ts`.

<p align="center">
  <img src="docs/screenshots/podium.png" width="460" alt="Βάθρο">
  <img src="docs/screenshots/grave.png" width="180" alt="Τάφος">
</p>

---

## English

### What it is

You and up to 9 friends open a Wall Street hedge fund with almost no money. You share **one balance**: one
player's profit saves the team, another's loss sinks it. Each day lasts a few minutes and has a growing
**profit quota**. Hit it and you buy items that manipulate the market. Miss it and the fund closes: **into the
grave**. Survive every day: **onto the podium**.

**[▶ Play at petrosfs.github.io/Vathro-i-Tafos-mobile](https://petrosfs.github.io/Vathro-i-Tafos-mobile/)**, on a
phone or a computer, with no install and no account.

### Features

- **3D office** with desks, monitors, a big price board and a shop machine. Three cameras in settings:
  **first person**, **third person** (walk with WASD/mouse or a joystick on phones, E for the terminal, Esc for
  the menu) or a **fixed overhead view**.
- **8 fictional stocks** with their own personalities, intraday trends, **headlines** that land just before
  the price moves, **rumors** that may go the other way, and **crashes**.
- **17 items**: insider tip, social media hype, forum panic, trading halt, ×3 leverage, express loan, coffee
  for extra time, short-selling licence, stop-loss, golden parachute and more.
- **Online with friends** from anywhere in the world, via a room code or an invite link. Chat and emotes over
  the avatars.
- **Character** with suit, tie, hair, hat and glasses.
- **Final scene**: a podium with the best traders and confetti, or tombstones. Summary with awards, stats and
  a balance chart.
- **Greek and English** (automatic from the device language), rules page.

### How it is built

| Part | Choice |
| --- | --- |
| Language and build | TypeScript + Vite, no UI framework |
| 3D | Three.js, low-poly models from simple shapes, textures painted on canvas (no image files) |
| Market | Deterministic simulation (`src/sim`): every device computes the same prices from the same seed |
| Online | One player is the host and runs the engine; moves and state go through **Firebase Realtime Database** |
| Hosting | **GitHub Pages**, with automatic test, build and deploy via GitHub Actions; zero cost |

**Fair wherever you are.** Prices never travel over the network: each device computes them itself. Every trade
executes at the price of the moment the button was pressed, tolerating up to 3 seconds of network delay, so a
player in the US plays on equal terms.

**No server.** If the host leaves, the next player takes over automatically and the day continues from the
saved state. Anyone who refreshes the page rejoins the room.

**Lightweight.** The home screen loads without Firebase, which downloads only when you go online. Phones
default to the fixed camera and light graphics.

**Quality.**
- **28 tests** (Vitest), with simulations of thousands of random moves checking that the balance never goes
  negative and no position is lost.
- During development, **real-browser tests** (Playwright) against a local Firebase emulator: 10-player games, a
  host change mid-day, rejoining after a refresh, returning to the room.

### Running locally

```bash
npm install
npm run dev     # local server
npm test        # tests
npm run build   # build into dist
```

For your own online setup: create a Firebase project with **Anonymous Authentication** and **Realtime
Database**, paste the rules from `database.rules.json`, and put your web app's settings in `src/net/config.ts`.

---

<p align="center"><sub>Όλες οι εταιρείες και οι ειδήσεις του παιχνιδιού είναι φανταστικές · All companies and headlines in the game are fictional.</sub></p>
