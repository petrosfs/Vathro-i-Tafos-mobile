// Chat της ομάδας και γρήγορα emotes πάνω από το avatar.
import { esc, h } from '../app';
import { t } from '../i18n';
import type { ChatMsg } from '../net/transport';
import { decodeSay } from './say';

export const EMOTES = ['🚀', '📉', '🤑', '😱', '💀', '👍', '🔔', '🙏'];

export class ChatPanel {
  readonly el: HTMLElement;
  private list: HTMLElement;
  private msgs: ChatMsg[] = [];
  seen = 0;

  constructor(private myUid: string, onSend: (text: string) => void, onEmote: (e: string) => void, onClose: () => void) {
    this.el = h(`
      <section class="panel chat" aria-label="${esc(t('chat.title'))}">
        <header class="panel-head">
          <h2>${esc(t('chat.title'))}</h2>
          <button class="icon-btn" data-close aria-label="${esc(t('close'))}">✕</button>
        </header>
        <div class="emotes">${EMOTES.map((e) => `<button class="emote" data-e="${e}">${e}</button>`).join('')}</div>
        <div class="panel-body chat-list"></div>
        <form class="chat-form">
          <input name="m" maxlength="140" autocomplete="off" placeholder="${esc(t('chat.ph'))}" />
          <button class="btn primary">${esc(t('chat.send'))}</button>
        </form>
      </section>`);
    this.list = this.el.querySelector('.chat-list')!;
    this.el.querySelector('[data-close]')!.addEventListener('click', onClose);
    this.el.querySelector('.emotes')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-e]');
      if (b) onEmote(b.dataset.e!);
    });
    const form = this.el.querySelector<HTMLFormElement>('form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.elements.namedItem('m') as HTMLInputElement;
      const v = input.value.trim();
      if (v) onSend(v);
      input.value = '';
    });
    this.render();
  }

  set(msgs: ChatMsg[]) {
    this.msgs = msgs;
    this.render();
  }

  get unread() {
    return Math.max(0, this.msgs.length - this.seen);
  }

  markRead() {
    this.seen = this.msgs.length;
  }

  private render() {
    this.list.innerHTML = this.msgs.length
      ? this.msgs.map((m) => `<div class="msg ${m.uid === this.myUid ? 'mine' : ''}"><b>${esc(m.name)}</b> ${esc(decodeSay(m.text).text)}</div>`).join('')
      : `<p class="muted">${esc(t('chat.empty'))}</p>`;
    this.list.scrollTop = this.list.scrollHeight;
  }

  focus() {
    this.el.querySelector<HTMLInputElement>('input')!.focus();
  }
}
