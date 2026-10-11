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

/**
 * Αν έχει βγει νέα έκδοση (το version.json του site διαφέρει από αυτήν που τρέχει), δείχνει
 * διακριτικό μήνυμα με κουμπί ανανέωσης. Δεν κάνει τίποτα στην ανάπτυξη ή χωρίς δίκτυο.
 */
export function checkForUpdate(container: HTMLElement) {
  if (import.meta.env.DEV) return;
  fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { v?: string } | null) => {
      if (!j?.v || j.v === __APP_VERSION__ || !container.isConnected) return;
      const lang = document.documentElement.lang === 'en';
      const bar = h(`<div class="update-bar">${esc(lang ? `New version ${j.v} available.` : `Νέα έκδοση ${j.v} διαθέσιμη.`)} <button class="btn small primary">${lang ? 'Update' : 'Ενημέρωση'}</button></div>`);
      bar.querySelector('button')!.addEventListener('click', () => location.reload());
      container.prepend(bar);
    })
    .catch(() => {});
}
