// Κουβέντα στο παιχνίδι: έτοιμες φράσεις (ακούγονται με συνθετική φωνή) ή ελεύθερο κείμενο,
// σε συννεφάκι πάνω από τον χαρακτήρα. Ανοίγει με T ή με το 🗣, χωρίς να κλείνει το τερματικό.
import { esc, h } from '../app';
import { getLang, t, tr } from '../i18n';
import type { Tr } from '../sim/stocks';
import { loadSettings } from '../settings';

export const PHRASES: Tr[] = [
  { el: 'Αγοράστε τώρα!', en: 'Buy now!' },
  { el: 'Πουλήστε, πουλήστε!', en: 'Sell, sell!' },
  { el: 'Στο φεγγάρι! 🚀', en: 'To the moon! 🚀' },
  { el: 'Βουτάει!', en: 'It’s tanking!' },
  { el: 'Ποιος αγόρασε αυτό;', en: 'Who bought this?' },
  { el: 'Διαβάσατε την είδηση;', en: 'Did you read the news?' },
  { el: 'Μπράβο ρε!', en: 'Nice one!' },
  { el: 'Είμαστε πλούσιοι!', en: 'We’re rich!' },
  { el: 'Πιάσαμε τον στόχο!', en: 'We hit the quota!' },
  { el: 'Κλείστε τις θέσεις!', en: 'Close your positions!' },
  { el: 'Ησυχία, σκέφτομαι!', en: 'Quiet, I’m thinking!' },
  { el: 'Η Επιτροπή μάς κοιτάει…', en: 'The Commission is watching…' },
  { el: 'Πάω για καφέ ☕', en: 'Coffee break ☕' },
  { el: 'Βοήθεια!', en: 'Help!' },
];

const PREFIX = '#q';

/** Τι λέει ένα μήνυμα chat (οι έτοιμες φράσεις στη γλώσσα του καθενός). */
export function decodeSay(text: string): { text: string; preset: number | null } {
  if (text.startsWith(PREFIX)) {
    const n = Number(text.slice(PREFIX.length));
    if (Number.isInteger(n) && PHRASES[n]) return { text: tr(PHRASES[n]), preset: n };
  }
  return { text, preset: null };
}

export const encodePreset = (n: number) => `${PREFIX}${n}`;

/** Συνθετική φωνή της συσκευής (διαφορετικό ύψος για κάθε παίκτη). */
export function speak(text: string, uid: string) {
  try {
    if (!loadSettings().sound || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    const lang = getLang() === 'el' ? 'el-GR' : 'en-US';
    u.lang = lang;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith(lang.slice(0, 2)));
    let hsh = 0;
    for (const c of uid) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    if (voices.length) u.voice = voices[hsh % voices.length];
    u.pitch = 0.75 + (hsh % 7) * 0.1;
    u.rate = 1.08;
    speechSynthesis.speak(u);
  } catch {
    /* χωρίς φωνή */
  }
}

export class SayBar {
  readonly el: HTMLElement;
  private input: HTMLInputElement;
  open = false;

  constructor(private send: (text: string) => void, private onToggle: (open: boolean) => void) {
    this.el = h(`
      <div class="say-bar" hidden>
        <div class="say-phrases">${PHRASES.map((p, i) => `<button type="button" data-q="${i}">${esc(tr(p))}</button>`).join('')}</div>
        <form class="say-form">
          <input name="m" maxlength="140" autocomplete="off" placeholder="${esc(t('say.ph'))}" />
          <button class="btn primary">${esc(t('chat.send'))}</button>
          <button type="button" class="icon-btn" data-x aria-label="${esc(t('close'))}">✕</button>
        </form>
      </div>`);
    this.input = this.el.querySelector('input')!;
    this.el.querySelector('.say-phrases')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-q]');
      if (!b) return;
      this.send(encodePreset(Number(b.dataset.q)));
      this.toggle(false);
    });
    this.el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = this.input.value.trim();
      if (v) this.send(v);
      this.input.value = '';
      this.toggle(false);
    });
    this.el.querySelector('[data-x]')!.addEventListener('click', () => this.toggle(false));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.toggle(false);
      }
    });
  }

  toggle(open = !this.open) {
    this.open = open;
    this.el.hidden = !open;
    if (open && !matchMedia('(pointer: coarse)').matches) setTimeout(() => this.input.focus(), 0);
    if (!open) this.input.blur();
    this.onToggle(open);
  }
}
