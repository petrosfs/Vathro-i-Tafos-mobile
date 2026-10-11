// Σελίδα «Πώς παίζεται».
import { esc, go, h, type Screen } from '../app';
import { getLang, t, tr } from '../i18n';
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
      <li>Αν τον πιάσετε, παίρνετε νομίσματα για το κατάστημα, περισσότερα όσο τον ξεπερνάτε.</li>
      <li>Αν αποτύχετε, το fund κλείνει: <b>στον τάφο</b>. Αν αντέξετε όλες τις μέρες: <b>στο βάθρο</b>, με τους καλύτερους traders στα σκαλοπάτια.</li>
      <li>Με τη ρύθμιση «Μόνο με χρεωκοπία», ο χαμένος στόχος σημαίνει απλώς μηδέν νομίσματα· το fund κλείνει μόνο αν το ταμείο πέσει κάτω από το 10% του αρχικού κεφαλαίου.</li>
    </ul>
    <h3>Ειδήσεις</h3>
    <ul>
      <li>Οι ειδήσεις εμφανίζονται στον πίνακα και στην οθόνη <b>λίγο πριν</b> κινηθεί η τιμή. Γρήγορα δάχτυλα κερδίζουν.</li>
      <li>Ό,τι γράφει <b>ΦΗΜΗ</b> μπορεί να βγει και ανάποδα.</li>
      <li>Κάποιες μέρες έρχεται <b>κραχ</b>: πέφτουν όλες μαζί και μετά ανακάμπτουν λίγο.</li>
    </ul>
    <h3>Κατάστημα</h3>
    <p>Ανάμεσα στις μέρες ξοδεύετε τα νομίσματα. Τα <b>αναλώσιμα</b> μπαίνουν στην τσέπη όποιου τα αγοράζει (ως 4) και χρησιμοποιούνται μέσα στη μέρα. Τα <b>προνόμια</b> ισχύουν για όλη την ομάδα ως το τέλος.</p>`,
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
      <li>Hit it and you earn coins for the shop, more the further you beat it.</li>
      <li>Miss it and the fund closes: <b>into the grave</b>. Survive every day: <b>onto the podium</b>, with the best traders on the steps.</li>
      <li>With the “Only when bankrupt” setting, a missed quota just means zero coins; the fund closes only if the balance drops below 10% of the starting capital.</li>
    </ul>
    <h3>News</h3>
    <ul>
      <li>Headlines appear on the board and on screen <b>just before</b> the price moves. Fast fingers win.</li>
      <li>Anything marked <b>RUMOR</b> may turn out the other way.</li>
      <li>Some days bring a <b>crash</b>: everything drops together, then recovers a little.</li>
    </ul>
    <h3>Shop</h3>
    <p>Between days you spend coins. <b>Consumables</b> go into the buyer’s pocket (up to 4) and are used during the day. <b>Perks</b> apply to the whole team until the end.</p>`,
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
    <ul class="stock-list">${STOCKS.map((s) => `<li><b style="color:${s.color}">${s.ticker}</b> ${esc(tr(s.name))}</li>`).join('')}</ul>
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
      <li><b>Υπολογιστής:</b> κλικ στη σκηνή για να κοιτάς με το ποντίκι, <b>WASD</b> ή βελάκια για περπάτημα (Shift για τρέξιμο), <b>E</b> ανοίγει/κλείνει το τερματικό ή το κατάστημα, <b>Esc</b> μενού, <b>Enter</b> chat, <b>T</b> τερματικό με τη σταθερή κάμερα.</li>
      <li><b>Κινητό:</b> joystick αριστερά, σύρσιμο δεξιά για να κοιτάς, κουμπιά κάτω.</li>
      <li>Την κάμερα (πρώτο πρόσωπο, τρίτο πρόσωπο, από ψηλά) και την ανάλυση τις αλλάζεις από το μενού.</li>
    </ul>`,
  en: `
    <h3>Controls</h3>
    <ul>
      <li><b>Computer:</b> click the scene to look with the mouse, <b>WASD</b> or arrows to walk (Shift to run), <b>E</b> opens/closes the terminal or shop, <b>Esc</b> menu, <b>Enter</b> chat, <b>T</b> terminal with the fixed camera.</li>
      <li><b>Phone:</b> joystick on the left, drag on the right to look, buttons at the bottom.</li>
      <li>Change the camera (first person, third person, overhead) and the resolution from the menu.</li>
    </ul>`,
};

/** Γραφείο, ξεκλειδώματα και αποθήκευση. */
function officeRulesHtml(): string {
  const el = getLang() === 'el';
  const progress = loadProgress();
  const card = (o: (typeof OFFICE)[number]) => {
    const locked = !!o.unlock && !progress.unlocked.includes(o.id);
    return `<div class="ocard ${locked ? 'locked' : ''}"><span class="glyph">${o.glyph}</span><span class="oname"><b>${esc(tr(o.name))}</b><small>${esc(tr(o.desc))}</small></span><span class="lock">${o.unlock ? `${locked ? '🔒' : '🔓'} ${esc(unlockText(o.unlock))}` : ''} · 🪙 ${o.price}</span></div>`;
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
