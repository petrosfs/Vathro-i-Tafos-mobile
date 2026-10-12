// Σελίδα «Πώς παίζεται».
import { esc, go, h, type Screen } from '../app';
import { getLang, money, t, tr } from '../i18n';
import { DECOR_USD } from '../sim/engine';
import { ITEMS } from '../sim/items';
import { STOCKS } from '../sim/stocks';
import { OFFICE } from '../sim/office';
import { loadProgress } from '../game/progress';
import { unlockText } from '../ui/unlockText';

const BODY = {
  el: `
    <p>Εσύ και έως 9 φίλοι ανοίγετε ένα hedge fund στη Wall Street με ελάχιστα λεφτά. Έχετε <b>ένα κοινό ταμείο</b>: το κέρδος του ενός σώζει την ομάδα, η ζημιά του άλλου τη βουλιάζει.</p>
    <h3>Η μέρα</h3>
    <ul>
      <li>Κάθε μέρα κρατάει 3 ή 5 λεπτά. Χτυπάει το καμπανάκι και η αγορά ανοίγει.</li>
      <li>Στο <b>τερματικό</b> διαλέγεις μετοχή και ποσό από το κοινό ταμείο και πατάς <b>Αγορά</b>. Όταν ανέβει, την <b>κλείνεις</b> και το κέρδος γυρίζει στο ταμείο.</li>
      <li>Με την «Άδεια ανοιχτών πωλήσεων» μπορείς να ανοίξεις και <b>short</b>: κερδίζεις όταν η τιμή πέφτει.</li>
      <li>Κάθε συναλλαγή έχει προμήθεια 0,5%. Στο τέλος της μέρας όλες οι θέσεις κλείνουν αυτόματα.</li>
    </ul>
    <h3>Ο στόχος</h3>
    <ul>
      <li>Κάθε μέρα έχει <b>στόχο κέρδους</b>, που μεγαλώνει από μέρα σε μέρα (και με τον αριθμό των παικτών).</li>
      <li>Ο στόχος είναι <b>πάντα εφικτός</b>: κάθε μέρα η αγορά δίνει τουλάχιστον μία ευκαιρία (μόνο με αγορές, ως 2 συναλλαγές) αρκετή για 3× τον στόχο στο Εύκολο, 2× στο Κανονικό, 1,5× στο Δύσκολο. Άλλοτε την προαναγγέλλει μια είδηση, άλλοτε φαίνεται μόνο στο γράφημα ως σταθερή άνοδος. Το να τη βρεις είναι δική σας δουλειά.</li>
      <li>Νομίσματα για το κατάστημα: <b>1</b> κάθε μέρα, <b>2</b> αν πιάσετε τον στόχο, <b>3</b> με τον κουμπαρά 🐷. Όταν πιάνετε τον στόχο παίρνετε και έξτρα: +1 για κάθε 25% πάνω από τον στόχο (ως +5), +1 με το χρυσό καμπανάκι και +1 για κάθε επίπεδο χώρου.</li>
      <li>Αν αποτύχετε, το fund κλείνει: <b>στον τάφο</b>. Αν αντέξετε όλες τις μέρες: <b>στο βάθρο</b>, με τους καλύτερους traders στα σκαλοπάτια.</li>
      <li>Με τη ρύθμιση «Μόνο με χρεωκοπία», ο χαμένος στόχος σημαίνει απλώς λιγότερα νομίσματα· το fund κλείνει μόνο αν το ταμείο πέσει κάτω από ένα όριο του αρχικού κεφαλαίου (0–15%, προεπιλογή 10%, το ρυθμίζει ο host).</li>
    </ul>
    <h3>Το κλείσιμο της αγοράς</h3>
    <p>Στο καμπανάκι του τέλους η κάμερα πάει μακριά και βλέπετε την ομάδα: αν η μέρα πήγε καλά, πάρτι (κομφετί, σαμπάνιες, και με πολύ καλή μέρα κόσμος και χορεύτριες)· αν βγήκε ζημιά, καβγάς (χαρτοπόλεμος, κούπες, ξύλο, πιστολίδι). Όσο μεγαλύτερος ο χώρος και το ταμείο, τόσο πιο μεγάλο το γλέντι ή ο χαμός.</p>
    <h3>Ειδήσεις</h3>
    <ul>
      <li>Οι ειδήσεις εμφανίζονται στον πίνακα και στην οθόνη <b>λίγο πριν</b> κινηθεί η τιμή. Γρήγορα δάχτυλα κερδίζουν.</li>
      <li>Οι περισσότερες είναι μικρές· μερικές μεγάλες. Υπάρχουν ειδήσεις για μία εταιρεία, για έναν <b>κλάδο</b> (π.χ. ενέργεια, φάρμακα: κινούνται όλες οι μετοχές του) και για όλη την αγορά.</li>
      <li>Οι <b>ΦΗΜΕΣ</b> γράφουν πόσο αξιόπιστη είναι η πηγή (30%, 50% ή 80%): τόσο συχνά βγαίνουν αληθινές, αλλιώς η τιμή πάει ανάποδα.</li>
      <li><b>Αποτελέσματα</b> εταιρειών: είναι γνωστό από το πρωί ποια εταιρεία ανακοινώνει και πότε (📅 στο τερματικό). Λίγο πριν, οι <b>αναλυτές</b> δίνουν πρόβλεψη, σωστή 7 στις 10.</li>
      <li>Κάποιες μέρες έρχεται <b>κραχ</b> (πέφτουν όλες μαζί και μετά ανακάμπτουν σχεδόν πλήρως) και, εξίσου συχνά, <b>ράλι</b> (ανεβαίνουν όλες μαζί).</li>
      <li>Οι τιμές έχουν και <b>τάσεις</b> που κρατάνε αρκετή ώρα: όποιος διαβάζει το γράφημα κερδίζει.</li>
    </ul>
    <h3>Κατάστημα</h3>
    <p>Ανάμεσα στις μέρες ξοδεύετε τα νομίσματα. Τα <b>αναλώσιμα</b> μπαίνουν στην τσέπη όποιου τα αγοράζει (ως 4) και χρησιμοποιούνται μέσα στη μέρα. Τα <b>προνόμια</b> ισχύουν για όλη την ομάδα ως το τέλος.</p>
    <h3>Πορτοφόλι και bonus</h3>
    <ul>
      <li>Όταν η ομάδα πιάνει τον στόχο, ο καθένας παίρνει <b>bonus</b>: ένα ποσοστό (2, 3 ή 5%, από το setup) από τα κέρδη που έβγαλε εκείνη τη μέρα. Βγαίνει από το κοινό ταμείο και μπαίνει στο <b>προσωπικό του πορτοφόλι</b>.</li>
      <li>Το ποσοστό ανεβαίνει με το upgrade «Bonus pool» (+1% για όλους) και κατά +1% για όποιον πιάσει μόνος του τον στόχο μιας μέρας, ως 10%.</li>
      <li><b>Οθόνες</b>: μία στο γκαράζ και στην πολυκατοικία, δύο από τη Wall Street. Από το κατάστημα αγοράζεις έξτρα (ως 6), με τιμή που ανεβαίνει κάθε φορά· κάθε έξτρα οθόνη είναι ένα ακόμα γράφημα στο τερματικό σου.</li>
      <li><b>Μόστρα</b>: χρυσό και διαμαντένιο ρολόι στον καρπό σου, και όπλο που πυροβολεί λεφτά (R ή 💸, και στα πάρτι).</li>
      <li>Με το πορτοφόλι στολίζεις το δικό σου γραφείο και προσλαμβάνεις τον «σκλάβο» σου. Τα πράγματα για όλους τα πληρώνει η ομάδα με νομίσματα.</li>
    </ul>
    <h3>Ο χώρος σας</h3>
    <ul>
      <li>Ξεκινάτε σε ένα <b>γκαράζ σπιτιού</b>. Όταν το ταμείο φτάσει 2×, 4× και 8× το αρχικό κεφάλαιο, μπορείτε να μετακομίσετε σε γραφείο πολυκατοικίας, σε όροφο στη Wall Street και τέλος στο ρετιρέ.</li>
      <li>Η μετακόμιση πληρώνεται ή με νομίσματα ή με μετρητά από το κοινό ταμείο.</li>
      <li>Κάθε επίπεδο δίνει +1 νόμισμα κάθε μέρα που πιάνετε τον στόχο και ειδήσεις 2″ νωρίτερα· αν το έχει ενεργό το setup, και +1% στο bonus όλων.</li>
    </ul>
    <h3>Bots</h3>
    <ul>
      <li>Στο setup μπορείς να βάλεις <b>bots</b> στην ομάδα: παίζουν μόνα τους από το κοινό ταμείο, μετράνε στον στόχο και παίρνουν bonus σαν παίκτες.</li>
      <li>Στο κατάστημα προσλαμβάνεις κι άλλα. Το <b>bot ομάδας</b> πληρώνεται με νομίσματα και ό,τι βγάζει μένει στην ομάδα. Ο <b>«σκλάβος»</b> πληρώνεται από το πορτοφόλι σου, παίζει με κεφάλαιο του fund, και το κέρδος ή η ζημιά του πάει στο πορτοφόλι σου.</li>
      <li>Τέσσερα επίπεδα: Ασκούμενος, Junior, Senior, Λύκος. Όσο ακριβότερο, τόσο πιο εύστοχο και με μεγαλύτερες θέσεις. Ο Ασκούμενος χάνει συχνά.</li>
      <li>Κάθε bot πιάνει ένα γραφείο (ως 10 συνολικά). Τα bots που προσλαμβάνονται δεν ανεβάζουν τον στόχο και δεν μπαίνουν στο βάθρο.</li>
    </ul>
    <h3>Η Επιτροπή Κεφαλαιαγοράς</h3>
    <ul>
      <li>Στη Δύσκολη πάντα, στην Κανονική όταν το ταμείο φτάσει 3× το αρχικό κεφάλαιο (στην Εύκολη ποτέ).</li>
      <li>Οι <b>υποψίες</b> ανεβαίνουν με εσωτερικές πληροφορίες, φήμες, ρεπορτάζ και με κέρδη πολύ πάνω από τον στόχο, και πέφτουν λίγο κάθε μέρα.</li>
      <li>Μια μέρα μπορεί να έρθει <b>έρευνα</b>: στο τέλος της μέρας πληρώνετε πρόστιμο από τα κέρδη. Ο «Δικηγόρος του fund» κόβει στο μισό υποψίες, πρόστιμο και πιθανότητα σύλληψης.</li>
      <li><b>Σύλληψη</b> (τέλος, στη φυλακή): αν τη μέρα της έρευνας χρησιμοποιήσετε εσωτερική πληροφορία, φήμη, ρεπορτάζ ή «απόσπαση πληροφορίας»· με πιθανότητα ίση με τις υποψίες μείον 50% σε κάθε έρευνα· και πάντα αν οι υποψίες φτάσουν 100%.</li>
    </ul>`,
  en: `
    <p>You and up to 9 friends open a Wall Street hedge fund with almost no money. You share <b>one balance</b>: one player’s profit saves the team, another’s loss sinks it.</p>
    <h3>The day</h3>
    <ul>
      <li>Each day lasts 3 or 5 minutes. The bell rings and the market opens.</li>
      <li>At the <b>terminal</b> pick a stock and an amount from the shared balance and press <b>Buy</b>. When it rises, <b>close</b> it and the profit returns to the balance.</li>
      <li>With the “Short-selling licence” you can also open a <b>short</b>: you win when the price falls.</li>
      <li>Every trade has a 0.5% fee. At the end of the day all positions close automatically.</li>
    </ul>
    <h3>The quota</h3>
    <ul>
      <li>Every day has a <b>profit quota</b> that grows day by day (and with the number of players).</li>
      <li>The quota is <b>always reachable</b>: every day the market offers at least one opportunity (buying only, up to 2 trades) worth 3× the quota on Easy, 2× on Normal, 1.5× on Hard. Sometimes a headline announces it, sometimes it only shows on the chart as a steady climb. Finding it is up to you.</li>
      <li>Coins for the shop: <b>1</b> every day, <b>2</b> if you hit the quota, <b>3</b> with the piggy bank 🐷. When you hit the quota you also get extras: +1 for every 25% above the quota (up to +5), +1 with the golden bell and +1 for each premises level.</li>
      <li>Miss it and the fund closes: <b>into the grave</b>. Survive every day: <b>onto the podium</b>, with the best traders on the steps.</li>
      <li>With the “Only when bankrupt” setting, a missed quota just means fewer coins; the fund closes only if the balance drops below a threshold of the starting capital (0–15%, 10% by default, set by the host).</li>
    </ul>
    <h3>The closing bell</h3>
    <p>At the closing bell the camera pulls back and you watch the team: a good day means a party (confetti, champagne, and on a great day a crowd and dancers); a loss means a fight (paper balls, mugs, fists, a shootout). The bigger the premises and the balance, the bigger the party or the mayhem.</p>
    <h3>News</h3>
    <ul>
      <li>Headlines appear on the board and on screen <b>just before</b> the price moves. Fast fingers win.</li>
      <li>Most are small, a few are big. There is news about one company, about a <b>sector</b> (e.g. energy, pharma: all its stocks move) and about the whole market.</li>
      <li><b>RUMORS</b> state how reliable the source is (30%, 50% or 80%): that is how often they come true; otherwise the price goes the other way.</li>
      <li>Company <b>earnings</b>: from the morning everyone knows which company reports and when (📅 in the terminal). Shortly before, <b>analysts</b> give a forecast, right 7 times out of 10.</li>
      <li>Some days bring a <b>crash</b> (everything drops together, then almost fully recovers) and, just as often, a <b>rally</b> (everything rises together).</li>
      <li>Prices also have <b>trends</b> that last a while: chart readers win.</li>
    </ul>
    <h3>Shop</h3>
    <p>Between days you spend coins. <b>Consumables</b> go into the buyer’s pocket (up to 4) and are used during the day. <b>Perks</b> apply to the whole team until the end.</p>
    <h3>Wallet and bonus</h3>
    <ul>
      <li>When the team hits the quota, everyone gets a <b>bonus</b>: a percentage (2, 3 or 5%, from the setup) of the profit they made that day. It is paid from the shared balance into their <b>personal wallet</b>.</li>
      <li>The rate grows with the “Bonus pool” upgrade (+1% for everyone) and by +1% for anyone who hits a day’s quota single-handedly, up to 10%.</li>
      <li><b>Screens</b>: one in the garage and the apartment office, two from Wall Street up. Buy extra ones in the shop (up to 6), each pricier than the last; every extra screen is one more chart in your terminal.</li>
      <li><b>Show-off</b>: a gold and a diamond watch on your wrist, and a money gun (R or 💸, at parties too).</li>
      <li>With your wallet you decorate your own desk and hire your minion. Things for everyone are paid by the team with coins.</li>
    </ul>
    <h3>Your premises</h3>
    <ul>
      <li>You start in a <b>home garage</b>. When the balance reaches 2×, 4× and 8× the starting capital you can move to an apartment-block office, a Wall Street floor and finally the penthouse.</li>
      <li>Moving is paid either with coins or with cash from the shared balance.</li>
      <li>Every level gives +1 coin for each day you hit the quota and headlines 2″ earlier; if enabled in the setup, also +1% on everyone’s bonus.</li>
    </ul>
    <h3>Bots</h3>
    <ul>
      <li>In the setup you can add <b>bots</b> to the team: they trade on their own from the shared balance, count towards the quota and get a bonus like players.</li>
      <li>In the shop you can hire more. A <b>team bot</b> is paid with coins and everything it makes stays with the team. Your <b>minion</b> is paid from your wallet, trades with the fund’s capital, and its profit or loss goes to your wallet.</li>
      <li>Four levels: Intern, Junior, Senior, Wolf. The pricier, the more accurate and the bigger its positions. The Intern often loses.</li>
      <li>Every bot takes a desk (up to 10 in total). Hired bots do not raise the quota and do not make the podium.</li>
    </ul>
    <h3>The Securities Commission</h3>
    <ul>
      <li>Always on Hard; on Normal once the balance reaches 3× the starting capital (never on Easy).</li>
      <li><b>Suspicion</b> rises with insider tips, rumours, scoops and profits far above the quota, and falls a little every day.</li>
      <li>Some day an <b>investigation</b> may come: at day end you pay a fine on the profit. The “Fund lawyer” halves suspicion, fines and the chance of arrest.</li>
      <li><b>Arrest</b> (game over, jail): if you use an insider tip, rumour, scoop or pillow-talk intel on an investigation day; with a chance equal to suspicion minus 50% on every investigation; and always if suspicion hits 100%.</li>
    </ul>`,
};

/** Το περιεχόμενο των κανόνων (στη σελίδα και στο μενού μέσα στο παιχνίδι). */
export function rulesHtml(): string {
  const el = getLang() === 'el';
  return `
    ${BODY[getLang()]}
    ${CONTROLS[getLang()]}
    <h3>${el ? 'Τα αντικείμενα της παρτίδας' : 'Game items'}</h3>
    <div class="rule-items">${ITEMS.map((i) => `<div class="offer ${i.kind}"><div class="offer-top"><span class="glyph">${i.glyph}</span><span class="tag">${esc(t(i.kind === 'perk' ? 'shop.perk' : 'shop.consumable'))}</span><span class="tag">🪙 ${i.price}</span></div><b>${esc(tr(i.name))}</b><p>${esc(tr(i.desc))}</p></div>`).join('')}</div>
    ${officeRulesHtml()}
    <h3>${el ? 'Οι μετοχές' : 'The stocks'}</h3>
    <p>${el ? 'Ξεκινάτε με 5 από τις 8 πρώτες τοπικές. Κάθε 2–3 μέρες και σε κάθε μετακόμιση μπαίνει νέα εταιρεία (ως 12 μαζί): τοπική ως την πολυκατοικία, διεθνής από τη Wall Street και πάνω. Την προηγούμενη μέρα βγαίνει είδηση που «μυρίζει» αν θα έχει πυρετό (πολύ μεγάλες κινήσεις) — δεν πέφτει πάντα μέσα. Κάποιες εταιρείες χρεωκοπούν: πρώτα έρχεται ανησυχητική είδηση και την επόμενη μέρα η μετοχή μπορεί να καταρρεύσει και να βγει από το χρηματιστήριο, ή να ήταν ψεύτικος συναγερμός. Οι νέες μετοχές είναι νευρικές και ηρεμούν με τον καιρό.' : 'You start with 5 of the first 8 local companies. Every 2–3 days and on every move a new company lists (up to 12 at once): local up to the apartment office, international from Wall Street up. The day before, a headline hints whether it will have IPO fever (huge swings) — not always right. Some companies go bankrupt: first a worrying headline, then the next day the stock may collapse and be delisted, or it was a false alarm. New stocks are jumpy and calm down over time.'}</p>
    <h4>${el ? 'Τοπικές' : 'Local'}</h4>
    <ul class="stock-list">${STOCKS.filter((s) => s.era === 'local').map((s) => `<li><b style="color:${s.color}">${s.ticker}</b> ${esc(tr(s.name))}</li>`).join('')}</ul>
    <h4>${el ? 'Διεθνείς' : 'International'}</h4>
    <ul class="stock-list">${STOCKS.filter((s) => s.era === 'global').map((s) => `<li><b style="color:${s.color}">${s.ticker}</b> ${esc(tr(s.name))}</li>`).join('')}</ul>
    <p class="muted small">${el ? 'Όλες οι εταιρείες και οι ειδήσεις είναι φανταστικές.' : 'All companies and headlines are fictional.'}</p>`;
}

export function rulesScreen(back: Screen): Screen {
  return (root) => {
    root.className = 'page';
    const el = h(`
      <main class="narrow rules">
        <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('home.rules'))}</h1></header>
        ${rulesHtml()}
      </main>`);
    root.append(el);
    el.querySelector('[data-back]')!.addEventListener('click', () => go(back));
  };
}

const CONTROLS = {
  el: `
    <h3>Χειρισμός</h3>
    <ul>
      <li><b>Υπολογιστής:</b> κλικ στη σκηνή για να κοιτάς με το ποντίκι (στο τρίτο πρόσωπο: κράτα πατημένο το δεξί κλικ ή τη ροδέλα και σύρε), <b>WASD</b> ή βελάκια για περπάτημα (Shift για τρέξιμο), <b>Space</b> άλμα, <b>E</b> ανοίγει/κλείνει το τερματικό ή το κατάστημα, <b>Q</b> ανοίγει/κλείνει το κατάστημα από οπουδήποτε, <b>Esc</b> μενού, <b>T</b> ή <b>Enter</b> φώναξε (έτοιμες φράσεις ή δικό σου κείμενο: ο χαρακτήρας το φωνάζει, με συννεφάκι πάνω του), <b>F</b> κωλοδάχτυλο στον συνάδελφο που κοιτάς, <b>R</b> όπλο με λεφτά, <b>E</b> τερματικό με την κάμερα από ψηλά. Η κάμερα από ψηλά είναι ελεύθερη: σύρσιμο για μετακίνηση, ροδέλα για ζουμ, δεξί κλικ και σύρσιμο για περιστροφή.</li>
      <li><b>Κινητό:</b> με την κάμερα από ψηλά, ένα δάχτυλο μετακινεί, τσίμπημα για ζουμ, δύο δάχτυλα για περιστροφή. Στο πρώτο/τρίτο πρόσωπο: joystick αριστερά, σύρσιμο δεξιά για να κοιτάς, κουμπί <b>Jump</b> δεξιά για άλμα, κουμπιά κάτω (🗣 φώναξε, 🖕 κωλοδάχτυλο). Μέσα στο τερματικό τα ίδια κουμπιά είναι πάνω δεξιά.</li>
      <li>Την κάμερα (πρώτο πρόσωπο, τρίτο πρόσωπο, από ψηλά) την αλλάζεις με το κουμπί 📷 πάνω δεξιά (ή <b>C</b>) ή από το μενού· την ανάλυση από το μενού.</li>
    </ul>`,
  en: `
    <h3>Controls</h3>
    <ul>
      <li><b>Computer:</b> click the scene to look with the mouse (in third person: hold the right mouse button or the wheel and drag), <b>WASD</b> or arrows to walk (Shift to run), <b>Space</b> jump, <b>E</b> opens/closes the terminal or shop, <b>Q</b> opens/closes the shop from anywhere, <b>Esc</b> menu, <b>T</b> or <b>Enter</b> shout (ready phrases or your own text: your character shouts it, with a bubble overhead), <b>F</b> middle finger to the colleague you are looking at, <b>R</b> money gun, <b>E</b> terminal with the camera from above. The camera from above is free: drag to move, wheel to zoom, right-click and drag to rotate.</li>
      <li><b>Phone:</b> with the camera from above, one finger moves, pinch to zoom, two fingers to rotate. In first/third person: joystick on the left, drag on the right to look, a <b>Jump</b> button on the right, buttons at the bottom (🗣 shout, 🖕 middle finger). Inside the terminal the same buttons are at the top right.</li>
      <li>Switch the camera (first person, third person, overhead) with the 📷 button at the top right (or <b>C</b>) or from the menu; the resolution from the menu.</li>
    </ul>`,
};

/** Γραφείο, ξεκλειδώματα και αποθήκευση. */
function officeRulesHtml(): string {
  const el = getLang() === 'el';
  const progress = loadProgress();
  const card = (o: (typeof OFFICE)[number]) => {
    const locked = !!o.unlock && !progress.unlocked.includes(o.id);
    return `<div class="ocard ${locked ? 'locked' : ''}"><span class="glyph">${o.glyph}</span><span class="oname"><b>${esc(tr(o.name))}</b><small>${esc(tr(o.desc))}</small></span><span class="lock">${o.unlock ? `${locked ? '🔒' : '🔓'} ${esc(unlockText(o.unlock))}` : ''} · ${o.kind === 'decor' ? money(o.price * DECOR_USD) : `🪙 ${o.price}`}</span></div>`;
  };
  return `
    <h3>${el ? 'Το γραφείο' : 'The office'}</h3>
    <p>${el
      ? 'Στο κατάστημα αγοράζεις και πράγματα για το <b>δικό σου γραφείο</b> (ως 4) ή για <b>όλο το γραφείο</b>. Κρατάνε ως το τέλος της παρτίδας. Όσα έχουν λουκέτο ξεκλειδώνουν <b>μόνιμα</b> όταν πετύχεις τον στόχο τους· από τότε εμφανίζονται σε κάθε παρτίδα σου, και online σε όλη την ομάδα.'
      : 'In the shop you can also buy things for <b>your own desk</b> (up to 4) or for the <b>whole office</b>. They last until the end of the game. Locked ones unlock <b>permanently</b> when you reach their goal; from then on they appear in every game you play, and online for the whole team.'}</p>
    <div class="ocards">${OFFICE.map(card).join('')}</div>
    <h3>${el ? 'Αποθήκευση' : 'Saving'}</h3>
    <p>${el
      ? 'Η παρτίδα αποθηκεύεται αυτόματα πριν από κάθε μέρα, σε όλους τους παίκτες. Για να συνεχίσετε άλλη μέρα: «Συνέχεια παρτίδας» στην αρχική, και ο καθένας μπαίνει από τη συσκευή του ή με το ίδιο όνομα. Αν βγείτε στη μέση μιας μέρας, συνεχίζετε από την αρχή της.'
      : 'The game saves itself before every day, on every player’s device. To continue another day: “Continue a game” on the home screen, and everyone joins from their own device or with the same name. If you leave mid-day, you continue from the start of that day.'}</p>`;
}
