// Απλός «δρομολογητής» οθονών: κάθε οθόνη ζωγραφίζει στο #app και επιστρέφει συνάρτηση καθαρισμού.
export type Cleanup = () => void;
export type Screen = (root: HTMLElement) => Cleanup | void;

let current: Cleanup | void;

export function go(screen: Screen) {
  const root = document.querySelector<HTMLElement>('#app')!;
  if (current) current();
  root.innerHTML = '';
  root.className = '';
  current = screen(root);
  window.scrollTo(0, 0);
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** Δημιουργεί στοιχείο από HTML. */
export function h<T extends HTMLElement = HTMLElement>(html: string): T {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild as T;
}

let toastBox: HTMLElement | null = null;
/** Σύντομο μήνυμα στο κάτω μέρος. */
export function toast(text: string, kind: 'info' | 'error' | 'good' = 'info', ms = 2600) {
  if (!toastBox || !document.body.contains(toastBox)) {
    toastBox = h('<div class="toasts" aria-live="polite"></div>');
    document.body.append(toastBox);
  }
  const el = h(`<div class="toast ${kind}">${esc(text)}</div>`);
  toastBox.append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}
