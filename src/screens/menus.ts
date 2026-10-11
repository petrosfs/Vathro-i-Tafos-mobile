// Οθόνες εκτός παρτίδας: αρχική, χαρακτήρας, ρυθμίσεις, solo.
import { checkForUpdate, esc, go, h, type Screen } from '../app';
import { getLang, money, resolveLang, setLang, t } from '../i18n';
import { loadSettings, RESOLUTIONS, saveSettings, type PersonalSettings } from '../settings';
import {
  BEARDS, BROWS, cleanName, EYES, GLASSES, HAIR_COLORS, MOUTHS, HAIR_STYLES, HATS, loadProfile, randomLook, saveProfile, SKINS, SUITS, TIES,
} from '../profile';
import type { GameState, Look } from '../sim/engine';
import { deleteSave, loadSaves } from '../game/saves';
import { loadProgress } from '../game/progress';
import { resumeState } from '../sim/save';
import { createGame } from '../sim/engine';
import { randomSeed } from '../sim/rng';
import { AvatarPreview } from '../ui/avatarPreview';
import { configForm, loadConfig } from '../ui/configForm';
import { LocalTransport } from '../game/localTransport';
import { gameScreen } from './game';
import { onlineScreen, lastRoom } from './online';
import { rulesScreen } from './rules';
import { APP_VERSION } from '../version';

export const homeScreen: Screen = (root) => {
  root.className = 'page home';
  const p = loadProfile();
  const last = lastRoom();
  const el = h(`
    <main class="home-main">
      <div class="logo">
        <div class="logo-mark">🏆<span>⚰️</span></div>
        <h1>${esc(t('title'))}</h1>
        <p class="sub">${esc(t('subtitle'))}</p>
      </div>
      <p class="tagline">${esc(t('tagline'))}</p>
      <div class="preview home-preview"></div>
      <div class="menu-btns">
        <button class="btn primary big" data-go="solo">${esc(t('home.solo'))}</button>
        <button class="btn primary big" data-go="online">${esc(t('home.online'))}</button>
        <button class="btn ghost big roles-soon" disabled aria-disabled="true" title="${esc(t('home.rolesDesc'))}">
          🎭 ${esc(t('home.roles'))} <span class="loading-dots"><i></i><i></i><i></i></span>
          <small>${esc(t('home.rolesDesc'))}</small>
        </button>
        ${last ? `<button class="btn ghost" data-go="last">${esc(t('home.continue', { code: last }))}</button>` : ''}
        ${loadSaves().length ? `<button class="btn ghost" data-go="saves">💾 ${esc(t('home.saves'))}</button>` : ''}
        <div class="row">
          <button class="btn ghost" data-go="profile">👤 ${esc(t('home.profile'))}</button>
          <button class="btn ghost" data-go="settings">⚙ ${esc(t('home.settings'))}</button>
        </div>
        <button class="btn link" data-go="rules">${esc(t('home.rules'))}</button>
      </div>
      <p class="version">v${APP_VERSION}</p>
    </main>`);
  root.append(el);
  checkForUpdate(el);
  const preview = new AvatarPreview(el.querySelector('.home-preview')!);
  preview.set(p.look);
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
    if (!b) return;
    const k = b.dataset.go;
    if (k === 'solo') go(soloScreen);
    else if (k === 'online') go(onlineScreen());
    else if (k === 'last' && last) go(onlineScreen(last, true));
    else if (k === 'saves') go(savesScreen);
    else if (k === 'profile') go(profileScreen(homeScreen));
    else if (k === 'settings') go(settingsScreen);
    else if (k === 'rules') go(rulesScreen(homeScreen));
  });
  return () => preview.dispose();
};

/** Ξεκινά solo παρτίδα (νέα ή συνέχεια). */
function startSolo(state: GameState) {
  const tr = new LocalTransport(state);
  go(gameScreen({
    transport: tr,
    leave: () => go(homeScreen),
    endActions: () => ({ again: () => go(soloScreen), home: () => go(homeScreen) }),
  }));
  tr.start();
  if (import.meta.env.DEV) (window as unknown as { __solo: LocalTransport }).__solo = tr;
}

export const savesScreen: Screen = (root) => {
  root.className = 'page';
  const el = h(`
    <main class="narrow">
      <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('saves.title'))}</h1></header>
      <div class="saves"></div>
      <p class="muted small">${esc(t('saves.note'))}</p>
    </main>`);
  root.append(el);
  const render = () => {
    const list = loadSaves();
    const df = new Intl.DateTimeFormat(getLang() === 'el' ? 'el-GR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
    el.querySelector('.saves')!.innerHTML = list.length
      ? list.map((r) => `
        <div class="save-card">
          <div class="save-top"><span class="tag">${esc(r.online ? t('saves.typeOnline') : t('saves.typeSolo'))}</span><b>${esc(r.names.join(', '))}</b></div>
          <p class="muted small">${esc(t('saves.meta', { d: r.day, cash: money(r.cash), date: df.format(r.savedAt) }))}</p>
          <div class="row">
            <button class="btn primary" data-solo="${r.id}">${esc(t('saves.solo'))}</button>
            <button class="btn primary" data-online="${r.id}">${esc(t('saves.online'))}</button>
            <button class="btn ghost" data-del="${r.id}" aria-label="${esc(t('saves.delete'))}">🗑</button>
          </div>
        </div>`).join('')
      : `<p class="muted">${esc(t('saves.empty'))}</p>`;
  };
  render();
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-back')) return go(homeScreen);
    const rec = loadSaves().find((r) => r.id === (b.dataset.solo ?? b.dataset.online ?? b.dataset.del));
    if (!rec) return;
    if (b.dataset.del) {
      if (confirm(t('saves.confirmDelete'))) {
        deleteSave(rec.id);
        render();
      }
    } else if (b.dataset.solo) {
      const p = loadProfile();
      startSolo(resumeState(rec.state, [{ uid: 'me', name: p.name || t('you'), look: p.look }], loadProgress().unlocked));
    } else go(onlineScreen('', false, rec));
  });
};

export const soloScreen: Screen = (root) => {
  root.className = 'page';
  let cfg = loadConfig();
  const el = h(`
    <main class="narrow">
      <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('setup.title'))}</h1></header>
      <div class="form-slot"></div>
      <button class="btn primary big wide" data-start>${esc(t('setup.start'))}</button>
    </main>`);
  root.append(el);
  el.querySelector('.form-slot')!.append(configForm(cfg, (c) => (cfg = c)));
  el.querySelector('[data-back]')!.addEventListener('click', () => go(homeScreen));
  el.querySelector('[data-start]')!.addEventListener('click', () => {
    const p = loadProfile();
    startSolo(createGame(randomSeed(), cfg, [{ uid: 'me', name: p.name || t('you'), look: p.look }], loadProgress().unlocked));
  });
};

export function profileScreen(back: Screen, after?: () => void): Screen {
  return (root) => {
    root.className = 'page';
    const p = loadProfile();
    const look: Look = { ...p.look };
    const swatches = (k: keyof Look, colors: string[]) =>
      `<div class="swatches" data-k="${k}">${colors.map((c, i) => `<button type="button" data-v="${i}" style="--c:${c}" aria-label="${i + 1}"></button>`).join('')}</div>`;
    const options = (k: keyof Look, n: number, prefix: string) =>
      `<div class="seg wrap" data-k="${k}">${Array.from({ length: n }, (_, i) => `<button type="button" data-v="${i}">${esc(t(`${prefix}.${i}` as Parameters<typeof t>[0]))}</button>`).join('')}</div>`;
    const el = h(`
      <main class="narrow profile">
        <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('profile.title'))}</h1></header>
        <div class="profile-top">
          <div class="preview big-preview"></div>
          <label class="field"><span>${esc(t('profile.name'))}</span><input name="name" maxlength="16" placeholder="${esc(t('profile.namePh'))}" value="${esc(p.name)}" /></label>
        </div>
        <nav class="ptabs" role="tablist">
          <button type="button" data-tab="clothes" class="sel">👔 ${esc(t('profile.tab.clothes'))}</button>
          <button type="button" data-tab="hair">💇 ${esc(t('profile.tab.hair'))}</button>
          <button type="button" data-tab="face">🙂 ${esc(t('profile.tab.face'))}</button>
          <button type="button" data-tab="extras">🕶 ${esc(t('profile.tab.extras'))}</button>
        </nav>
        <section class="ptab" data-pane="clothes">
          <h3>${esc(t('profile.suit'))}</h3>${swatches('suit', SUITS)}
          <h3>${esc(t('profile.tie'))}</h3>${swatches('tie', TIES)}
          <h3>${esc(t('profile.skin'))}</h3>${swatches('skin', SKINS)}
        </section>
        <section class="ptab" data-pane="hair" hidden>
          <h3>${esc(t('profile.hair'))}</h3>${options('hair', HAIR_STYLES, 'hair')}
          <h3>${esc(t('profile.hairColor'))}</h3>${swatches('hairColor', HAIR_COLORS)}
          <h3>${esc(t('profile.beard'))}</h3>${options('beard', BEARDS, 'beard')}
        </section>
        <section class="ptab" data-pane="face" hidden>
          <h3>${esc(t('profile.eyes'))}</h3>${options('eyes', EYES, 'eyes')}
          <h3>${esc(t('profile.mouth'))}</h3>${options('mouth', MOUTHS, 'mouth')}
          <h3>${esc(t('profile.brows'))}</h3>${options('brows', BROWS, 'brows')}
        </section>
        <section class="ptab" data-pane="extras" hidden>
          <h3>${esc(t('profile.hat'))}</h3>${options('hat', HATS, 'hat')}
          <h3>${esc(t('profile.glasses'))}</h3>${options('glasses', GLASSES, 'glasses')}
        </section>
        <div class="row">
          <button class="btn ghost" data-random>🎲 ${esc(t('profile.random'))}</button>
          <button class="btn primary" data-save>${esc(t('profile.save'))}</button>
        </div>
      </main>`);
    root.append(el);
    const preview = new AvatarPreview(el.querySelector('.big-preview')!);
    const sync = () => {
      el.querySelectorAll<HTMLElement>('[data-k]').forEach((box) => {
        const k = box.dataset.k as keyof Look;
        box.querySelectorAll<HTMLElement>('[data-v]').forEach((b) => b.classList.toggle('sel', Number(b.dataset.v) === look[k]));
      });
      preview.set(look);
    };
    sync();
    // καρτέλες: μία κατηγορία τη φορά, χωρίς κύλιση· στο πρόσωπο η κάμερα κάνει ζουμ
    el.querySelector('.ptabs')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (!b) return;
      const tab = b.dataset.tab!;
      el.querySelectorAll<HTMLElement>('[data-tab]').forEach((x) => x.classList.toggle('sel', x === b));
      el.querySelectorAll<HTMLElement>('[data-pane]').forEach((x) => (x.hidden = x.dataset.pane !== tab));
      preview.focusFace(tab === 'face' || tab === 'hair' || tab === 'extras');
    });
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
      const box = b?.closest<HTMLElement>('[data-k]');
      if (b && box) {
        look[box.dataset.k as keyof Look] = Number(b.dataset.v);
        sync();
      }
    });
    const nameInput = el.querySelector<HTMLInputElement>('input[name=name]')!;
    const save = () => saveProfile({ name: cleanName(nameInput.value), look });
    el.querySelector('[data-random]')!.addEventListener('click', () => {
      Object.assign(look, randomLook());
      sync();
      preview.cheer();
    });
    el.querySelector('[data-save]')!.addEventListener('click', () => {
      save();
      if (after) after();
      else go(back);
    });
    el.querySelector('[data-back]')!.addEventListener('click', () => {
      save();
      go(back);
    });
    return () => preview.dispose();
  };
}

export const settingsScreen: Screen = (root) => {
  root.className = 'page';
  const s = loadSettings();
  const seg = (k: keyof PersonalSettings, vals: [string, string][]) =>
    `<div class="seg wrap" data-k="${k}">${vals.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(s[k]) === v ? 'sel' : ''}">${esc(l)}</button>`).join('')}</div>`;
  const el = h(`
    <main class="narrow">
      <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('settings.title'))}</h1></header>
      <h3>${esc(t('settings.lang'))}</h3>${seg('lang', [['auto', t('settings.lang.auto')], ['el', 'Ελληνικά'], ['en', 'English']])}
      <h3>${esc(t('settings.view'))}</h3>${seg('view', [['first', t('view.first')], ['third', t('view.third')], ['overview', t('view.overview')]])}
      <h3>${esc(t('settings.quality'))}</h3>${seg('quality', [['low', t('quality.low')], ['high', t('quality.high')]])}
      <h3>${esc(t('settings.resolution'))}</h3>${seg('resolution', RESOLUTIONS.map((r) => [r, t(`res.${r}` as Parameters<typeof t>[0])]))}
      <h3>${esc(t('settings.sound'))}</h3>${seg('sound', [['true', t('on')], ['false', t('off')]])}
      <h3>${esc(t('settings.motion'))}</h3>${seg('reduceMotion', [['true', t('on')], ['false', t('off')]])}
      <h3>${esc(t('settings.sensitivity'))}</h3>
      <input type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}" data-sens />
    </main>`);
  root.append(el);
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
    const box = b?.closest<HTMLElement>('[data-k]');
    if (!b || !box) return;
    const k = box.dataset.k as keyof PersonalSettings;
    const raw = b.dataset.v!;
    const v = raw === 'true' ? true : raw === 'false' ? false : raw;
    const next = { ...loadSettings(), [k]: v } as PersonalSettings;
    saveSettings(next);
    if (k === 'lang') {
      const before = getLang();
      setLang(resolveLang(next.lang));
      if (getLang() !== before) return go(settingsScreen);
    }
    box.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
  });
  el.querySelector<HTMLInputElement>('[data-sens]')!.addEventListener('input', (e) => {
    saveSettings({ ...loadSettings(), sensitivity: Number((e.target as HTMLInputElement).value) });
  });
  el.querySelector('[data-back]')!.addEventListener('click', () => go(homeScreen));
};
