// Σελίδα «Πώς παίζεται».
import { esc, go, h, type Screen } from '../app';
import { getLang, t, tr } from '../i18n';
import { ITEMS } from '../sim/items';
import { STOCKS } from '../sim/stocks';

const BODY = {
  el: `
    <p>Εσύ και έως 5 φίλοι ανοίγετε ένα hedge fund στη Wall Street με ελάχιστα λεφτά. Έχετε <b>ένα κοινό ταμείο</b>: το κέρδος του ενός σώζει την ομάδα, η ζημιά του άλλου τη βουλιάζει.</p>
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
    <p>You and up to 5 friends open a Wall Street hedge fund with almost no money. You share <b>one balance</b>: one player’s profit saves the team, another’s loss sinks it.</p>
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

export function rulesScreen(back: Screen): Screen {
  return (root) => {
    root.className = 'page';
    const el = h(`
      <main class="narrow rules">
        <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('home.rules'))}</h1></header>
        ${BODY[getLang()]}
        <div class="rule-items">${ITEMS.map((i) => `<div class="offer ${i.kind}"><div class="offer-top"><span class="glyph">${i.glyph}</span><span class="tag">${esc(t(i.kind === 'perk' ? 'shop.perk' : 'shop.consumable'))}</span><span class="tag">🪙 ${i.price}</span></div><b>${esc(tr(i.name))}</b><p>${esc(tr(i.desc))}</p></div>`).join('')}</div>
        <h3>${getLang() === 'el' ? 'Οι μετοχές' : 'The stocks'}</h3>
        <ul class="stock-list">${STOCKS.map((s) => `<li><b style="color:${s.color}">${s.ticker}</b> ${esc(tr(s.name))}</li>`).join('')}</ul>
        <p class="muted small">${getLang() === 'el' ? 'Όλες οι εταιρείες και οι ειδήσεις είναι φανταστικές.' : 'All companies and headlines are fictional.'}</p>
      </main>`);
    root.append(el);
    el.querySelector('[data-back]')!.addEventListener('click', () => go(back));
  };
}
