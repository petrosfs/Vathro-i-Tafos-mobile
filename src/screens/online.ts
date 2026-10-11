// Online: δημιουργία/είσοδος σε δωμάτιο, lobby, και μετάβαση στην παρτίδα.
import { esc, go, h, toast, type Screen } from '../app';
import { t } from '../i18n';
import { cleanName, loadProfile, saveProfile } from '../profile';
import { createGame, type GameState } from '../sim/engine';
import { randomSeed } from '../sim/rng';
import { isConfigured } from '../net/config';
import { CODE_RE, MAX_ROOM_PLAYERS, normalizeCode } from '../net/code';
import type { Room, RoomError } from '../net/room';
import type { OnlineTransport } from '../net/onlineTransport';
import { sortedPlayers } from '../net/players';

// Το Firebase φορτώνεται μόνο όταν χρειαστεί (online), για να ανοίγει γρήγορα η αρχική.
const net = () => import('../net/room');
let Transport: typeof OnlineTransport | null = null;
import { configForm, configSummary, loadConfig } from '../ui/configForm';
import type { SaveRec } from '../game/saves';
import { resumeState } from '../sim/save';
import { loadProgress } from '../game/progress';
import { APP_VERSION } from '../version';
import { checkForUpdate } from '../app';
import { PLAYER_COLORS } from '../three/avatar';
import { gameScreen } from './game';
import { homeScreen, profileScreen } from './menus';

const LAST_KEY = 'vathro.lastRoom.v1';

export function lastRoom(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null');
    if (v && Date.now() - v.at < 6 * 3600_000 && CODE_RE.test(v.code)) return v.code;
  } catch {
    /* τίποτα */
  }
  return null;
}

function rememberRoom(code: string | null) {
  try {
    if (code) localStorage.setItem(LAST_KEY, JSON.stringify({ code, at: Date.now() }));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* δεν πειράζει */
  }
}

/** Ο κωδικός στη διεύθυνση, ώστε ένα refresh να σε ξαναβάζει στο δωμάτιο. */
function setRoomParam(code: string | null) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('room', code);
  else u.searchParams.delete('room');
  history.replaceState(null, '', u);
}

export function inviteUrl(code: string) {
  return `${location.origin}${import.meta.env.BASE_URL}?room=${code}`;
}

/** Αποθηκευμένες παρτίδες που συνεχίζουν σε δωμάτιο που μόλις φτιάξαμε (ανά κωδικό). */
const pendingResume = new Map<string, SaveRec>();

export function onlineScreen(code = '', auto = false, resume: SaveRec | null = null): Screen {
  return (root) => {
    root.className = 'page';
    const p = loadProfile();
    if (!isConfigured()) {
      root.append(h(`<main class="narrow"><header class="page-head"><button class="icon-btn" data-back>←</button><h1>${esc(t('online.title'))}</h1></header><p>${esc(t('online.notConfigured'))}</p></main>`));
      root.querySelector('[data-back]')!.addEventListener('click', () => go(homeScreen));
      return;
    }
    const el = h(`
      <main class="narrow">
        <header class="page-head"><button class="icon-btn" data-back aria-label="${esc(t('back'))}">←</button><h1>${esc(t('online.title'))}</h1></header>
        <label class="field"><span>${esc(t('profile.name'))}</span><input name="name" maxlength="16" placeholder="${esc(t('profile.namePh'))}" value="${esc(p.name)}" /></label>
        ${resume ? `<p class="lead">${esc(t('resume.online', { d: resume.day, names: resume.names.join(', ') }))}</p>` : ''}
        <button class="btn primary big wide" data-create>${esc(resume ? t('resume.create') : t('online.create'))}</button>
        <p class="divider" ${resume ? 'hidden' : ''}><span>${esc(t('online.or'))}</span></p>
        <form class="join" ${resume ? 'hidden' : ''}>
          <input name="code" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="${esc(t('online.code'))}" value="${esc(normalizeCode(code))}" />
          <button class="btn primary">${esc(t('online.join'))}</button>
        </form>
        <p class="status muted" aria-live="polite"></p>
      </main>`);
    root.append(el);
    const nameInput = el.querySelector<HTMLInputElement>('input[name=name]')!;
    const codeInput = el.querySelector<HTMLInputElement>('input[name=code]')!;
    const status = el.querySelector<HTMLElement>('.status')!;
    let busy = false;
    const name = () => {
      const n = cleanName(nameInput.value);
      if (!n) {
        nameInput.focus();
        nameInput.classList.add('err');
        return null;
      }
      saveProfile({ ...loadProfile(), name: n });
      return n;
    };
    const run = async (fn: (n: string) => Promise<Room>) => {
      if (busy) return;
      const n = name();
      if (!n) return;
      busy = true;
      status.textContent = t('online.connecting');
      try {
        const room = await fn(n);
        Transport ??= (await import('../net/onlineTransport')).OnlineTransport;
        enterRoom(room);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.startsWith('version:')) {
          status.innerHTML = `${esc(t('online.err.version', { v: msg.slice(8), mine: APP_VERSION }))} <button class="btn small" data-reload>↻</button>`;
          status.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
        } else {
          const code = msg as RoomError;
          status.textContent = t(`online.err.${['not-found', 'started', 'full', 'bad-code'].includes(code) ? code : 'network'}` as Parameters<typeof t>[0]);
        }
        busy = false;
      }
    };
    el.querySelector('[data-back]')!.addEventListener('click', () => go(homeScreen));
    el.querySelector('[data-create]')!.addEventListener('click', () => run(async (n) => {
      const { Room } = await net();
      if (!resume) return Room.create(n, loadProfile().look, loadConfig());
      const room = await Room.create(n, loadProfile().look, resume.state.config, { day: resume.day, names: resume.names });
      pendingResume.set(room.code, resume);
      return room;
    }));
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      run(async (n) => (await net()).Room.join(codeInput.value, n, loadProfile().look));
    });
    codeInput.addEventListener('input', () => (codeInput.value = normalizeCode(codeInput.value)));
    if (auto && code && p.name) run(async (n) => (await net()).Room.join(code, n, loadProfile().look));
  };
}

/** Ακολουθεί το δωμάτιο: lobby όταν περιμένουμε, παρτίδα όταν παίζουμε. */
export function enterRoom(room: Room) {
  rememberRoom(room.code);
  setRoomParam(room.code);
  let mode: 'lobby' | 'game' | null = null;
  room.listen((v) => {
    if (!v.loaded) return;
    if (!v.meta || !v.players[room.uid]) {
      // το δωμάτιο σβήστηκε ή μας αφαίρεσαν
      room.close();
      rememberRoom(null);
      setRoomParam(null);
      go(homeScreen);
      return;
    }
    const want = v.meta.status === 'playing' ? 'game' : 'lobby';
    if (want === mode) return;
    mode = want;
    if (want === 'lobby') {
      room.setInLobby(true);
      go(lobbyScreen(room));
    } else go(onlineGame(room));
  });
}

async function leaveRoom(room: Room) {
  rememberRoom(null);
  setRoomParam(null);
  await room.leave();
  go(homeScreen);
}

function onlineGame(room: Room): Screen {
  const tr = new Transport!(room);
  return gameScreen({
    transport: tr,
    forceStart: () => tr.forceStart(),
    leave: () => leaveRoom(room),
    endActions: () => (room.isHost
      ? { lobby: () => room.backToLobby(), home: () => leaveRoom(room) }
      : { waitHost: true, home: () => leaveRoom(room) }),
  });
}

/** Αλλάζει το περιεχόμενο μόνο αν διαφέρει, ώστε να μη χάνονται πατήματα σε κουμπιά. */
function setHtml(el: Element, html: string) {
  if ((el as HTMLElement).dataset.html !== html) {
    (el as HTMLElement).dataset.html = html;
    el.innerHTML = html;
  }
}

export function lobbyScreen(room: Room): Screen {
  return (root) => {
    root.className = 'page';
    const el = h(`
      <main class="narrow lobby">
        <header class="page-head"><button class="icon-btn" data-leave aria-label="${esc(t('lobby.leave'))}">←</button><h1>${esc(t('lobby.title', { code: room.code }))}</h1></header>
        <div class="code-big">${room.code}</div>
        <div class="resume-box"></div>
        <button class="btn ghost wide" data-share>🔗 ${esc(t('lobby.share'))}</button>
        <h3 class="players-h"></h3>
        <ul class="players"></ul>
        <button class="btn ghost" data-profile>👤 ${esc(t('home.profile'))}</button>
        <h3>${esc(t('lobby.settings'))}</h3>
        <div class="cfg"></div>
        <div class="lobby-foot"></div>
      </main>`);
    root.append(el);
    checkForUpdate(el);
    let cfgForHost: HTMLElement | null = null;
    let starting = false;
    const render = () => {
      const v = room.view;
      if (!v.meta) return;
      const players = sortedPlayers(v.players);
      el.querySelector('.players-h')!.textContent = t('lobby.players', { n: players.length });
      setHtml(el.querySelector('.players')!, players.map(([uid, p], i) => `
        <li class="${p.online ? '' : 'off'}">
          <span class="dot" style="background:${PLAYER_COLORS[i % PLAYER_COLORS.length]}"></span>
          <b>${esc(p.name)}</b>
          ${uid === room.uid ? `<small>(${esc(t('you'))})</small>` : ''}
          ${uid === v.meta!.host ? `<span class="tag">${esc(t('host'))}</span>` : ''}
          ${p.online ? '' : `<small class="muted">${esc(t('offline'))}</small>`}
          ${room.isHost && uid !== room.uid ? `<button class="link" data-kick="${esc(uid)}">${esc(t('lobby.kick'))}</button>` : ''}
        </li>`).join(''));
      const cfg = el.querySelector('.cfg')!;
      // συνέχεια αποθηκευμένης παρτίδας: ποιοι έπαιζαν και ποιοι ήρθαν
      const rs = v.meta.resume;
      const joinedNames = new Set(players.map(([, p]) => p.name.trim().toLocaleLowerCase()));
      setHtml(el.querySelector('.resume-box')!, rs
        ? `<div class="result saved"><b>${esc(t('resume.banner', { d: rs.day }))}</b><span>${rs.names.map((n) => `${joinedNames.has(n.trim().toLocaleLowerCase()) ? '✓' : '·'} ${esc(n)}`).join(' &nbsp; ')}</span><span>${esc(t('resume.match'))}</span></div>`
        : '');
      if (rs) {
        cfgForHost = null;
        setHtml(cfg as HTMLElement, `<p class="muted">${esc(configSummary(v.meta.config))}</p>`);
      } else if (room.isHost) {
        if (!cfgForHost) {
          cfg.innerHTML = '';
          delete (cfg as HTMLElement).dataset.html;
          cfgForHost = configForm(v.meta.config, (c) => room.setConfig(c));
          cfg.append(cfgForHost);
        }
      } else {
        cfgForHost = null;
        setHtml(cfg as HTMLElement, `<p class="muted">${esc(configSummary(v.meta.config))}</p>`);
      }
      setHtml(el.querySelector('.lobby-foot')!, room.isHost
        ? `<button class="btn primary big wide" data-start ${room.lineup().length ? '' : 'disabled'}>${esc(t('lobby.start'))}</button>`
        : `<p class="muted center">${esc(t('lobby.waitHost'))}</p>`);
    };
    const stop = room.listen(render);
    el.addEventListener('click', async (e) => {
      const tgt = e.target as HTMLElement;
      const kick = tgt.closest<HTMLElement>('[data-kick]');
      if (kick) return room.kick(kick.dataset.kick!);
      if (tgt.closest('[data-leave]')) return leaveRoom(room);
      if (tgt.closest('[data-profile]')) {
        return go(profileScreen(lobbyScreen(room), () => {
          const p = loadProfile();
          room.setProfile(p.name || '?', p.look);
          go(lobbyScreen(room));
        }));
      }
      if (tgt.closest('[data-share]')) {
        const url = inviteUrl(room.code);
        const text = t('lobby.invite', { url });
        try {
          if (navigator.share) await navigator.share({ title: t('title'), text, url });
          else {
            await navigator.clipboard.writeText(url);
            toast(t('lobby.copied'), 'good');
          }
        } catch {
          /* ακύρωση κοινοποίησης */
        }
        return;
      }
      if (tgt.closest('[data-start]') && !starting) {
        starting = true;
        const lineup = room.lineup().slice(0, MAX_ROOM_PLAYERS);
        const joiners = lineup.map(([uid, p]) => ({ uid, name: p.name, look: p.look }));
        const saved = pendingResume.get(room.code);
        const state: GameState = saved && room.view.meta?.resume
          ? resumeState(saved.state, joiners, loadProgress().unlocked)
          : createGame(randomSeed(), room.view.meta!.config, joiners, loadProgress().unlocked);
        pendingResume.delete(room.code);
        await room.start(JSON.stringify({ s: state, e: {} })).catch(() => {
          starting = false;
          toast(t('online.err.network'), 'error');
        });
      }
    });
    return stop;
  };
}
