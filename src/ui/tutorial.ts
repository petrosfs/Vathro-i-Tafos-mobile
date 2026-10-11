// Οδηγός πρώτης μέρας: μικρή κάρτα με βήματα που προχωρούν μόνα τους όταν κάνεις αυτό που λένε.
// Κάθε παίκτης αποφασίζει αν τον θέλει· η επιλογή μένει στη συσκευή του.
import { esc, h } from '../app';
import { t } from '../i18n';
import type { GameState } from '../sim/engine';

const KEY = 'vathro.tutorial.v1';

type Step = 'shop' | 'go' | 'buy' | 'news' | 'close' | 'goal';
const STEPS: Step[] = ['shop', 'go', 'buy', 'news', 'close', 'goal'];

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* δεν πειράζει */
  }
}

export interface TutorialHooks {
  /** Πρώτο πρόσωπο/τρίτο πρόσωπο (περπάτημα) ή σταθερή κάμερα. */
  walking: () => boolean;
}

export class Tutorial {
  readonly el: HTMLElement;
  private step: Step | 'ask' | null = null;
  private asked = false;

  constructor(private uid: string, private hooks: TutorialHooks) {
    this.el = h('<div class="tut" hidden></div>');
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tut]');
      if (!b) return;
      const a = b.dataset.tut;
      if (a === 'yes') this.go('shop');
      else if (a === 'skip' || a === 'stop' || a === 'done') this.finish();
      else if (a === 'next') this.next();
    });
  }

  /** Ξεκινά από την αρχή (από το μενού). */
  restart(s: GameState | null) {
    this.go(s?.phase === 'trading' ? 'go' : 'shop');
  }

  /** Κάθε νέα κατάσταση: ρωτάει την πρώτη μέρα, και προχωρά τα βήματα. */
  onState(s: GameState, prev: GameState | null) {
    if (!this.asked) {
      this.asked = true;
      if (!tutorialSeen() && s.day === 1 && s.phase !== 'ended' && !s.players[this.uid]?.bot) {
        this.step = 'ask';
        this.render();
      }
    }
    if (s.phase === 'ended' && this.step) {
      // τέλος παρτίδας: ο οδηγός κλείνει (αν δεν απάντησε, θα ξαναρωτηθεί σε επόμενη)
      if (this.step === 'ask') {
        this.step = null;
        this.el.hidden = true;
      } else this.finish();
      return;
    }
    if (!this.step || this.step === 'ask') return;
    if (prev && prev.phase === 'trading' && s.phase === 'shop') {
      // τέλος της μέρας: ο οδηγός κλείνει με το τελευταίο μήνυμα
      if (this.step !== 'goal') this.go('goal');
      return;
    }
    if (this.step === 'shop' && s.phase === 'trading') this.go('go');
    const mine = (k: string) => s.log.some((l) => l.who === this.uid && l.kind === k && (!prev || l.n > prev.logN));
    if (this.step === 'buy' && mine('open')) this.go('news');
    if (this.step === 'close' && (mine('close') || mine('stop'))) this.go('goal');
  }

  /** Άνοιξε πάνελ. */
  onPanel(kind: string | null) {
    if (this.step === 'go' && kind === 'terminal') this.go('buy');
  }

  private next() {
    if (!this.step || this.step === 'ask') return;
    const i = STEPS.indexOf(this.step);
    if (i >= STEPS.length - 1) this.finish();
    else this.go(STEPS[i + 1]);
  }

  private go(step: Step) {
    this.step = step;
    this.render();
  }

  private finish() {
    this.step = null;
    markSeen();
    this.el.hidden = true;
  }

  private render() {
    const st = this.step;
    if (!st) return;
    this.el.hidden = false;
    if (st === 'ask') {
      this.el.innerHTML = `
        <b>${esc(t('tut.askTitle'))}</b>
        <p>${esc(t('tut.askText'))}</p>
        <div class="tut-btns">
          <button class="btn small ghost" data-tut="skip">${esc(t('tut.skip'))}</button>
          <button class="btn small primary" data-tut="yes">${esc(t('tut.yes'))}</button>
        </div>`;
      return;
    }
    const text = st === 'go' ? t(this.hooks.walking() ? 'tut.walk' : 'tut.open') : t(`tut.${st}` as Parameters<typeof t>[0]);
    const i = STEPS.indexOf(st);
    // τα βήματα που περιμένουν κάποια ενέργεια δεν έχουν «Επόμενο»
    const manual = st === 'news' || st === 'goal' || st === 'close';
    const last = st === 'goal';
    this.el.innerHTML = `
      <p>${esc(text)}</p>
      <div class="tut-btns">
        <span class="tut-step">${i + 1}/${STEPS.length}</span>
        ${last ? '' : `<button class="btn small ghost" data-tut="stop">${esc(t('tut.stop'))}</button>`}
        ${manual ? `<button class="btn small primary" data-tut="${last ? 'done' : 'next'}">${esc(t(last ? 'tut.done' : 'tut.next'))}</button>` : ''}
      </div>`;
  }
}
