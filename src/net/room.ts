import {
  get, onDisconnect, onValue, ref, remove, runTransaction, serverTimestamp, set, update,
  type DatabaseReference, type Unsubscribe,
} from 'firebase/database';
import type { GameConfig, Look } from '../sim/engine';
import { connect, type Net } from './firebase';
import { sortedPlayers } from './players';

export { sortedPlayers };

import { CODE_RE, MAX_ROOM_PLAYERS, normalizeCode, randomCode } from './code';

export { CODE_RE, MAX_ROOM_PLAYERS, normalizeCode, randomCode };

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface RoomMeta {
  host: string;
  status: RoomStatus;
  createdAt: number;
  config: GameConfig;
}

export interface RoomPlayer {
  name: string;
  look: Look;
  joinedAt: number;
  online: boolean;
  inLobby?: boolean;
}

export interface RoomView {
  code: string;
  loaded: boolean;
  meta: RoomMeta | null;
  players: Record<string, RoomPlayer>;
}

export type RoomError = 'not-found' | 'started' | 'full' | 'bad-code' | 'network';

/** Ποιος γίνεται host αν ο τωρινός είναι εκτός: ο πρώτος συνδεδεμένος κατά σειρά εισόδου. */
export function nextHost(view: RoomView): string | null {
  const host = view.meta?.host;
  if (!host) return null;
  if (view.players[host]?.online) return null;
  const first = sortedPlayers(view.players).find(([, p]) => p.online);
  return first ? first[0] : null;
}

export class Room {
  private unsubs: Unsubscribe[] = [];
  private presenceRef: DatabaseReference;
  private listeners: ((v: RoomView) => void)[] = [];
  private got = { meta: false, players: false };
  view: RoomView;

  private constructor(readonly net: Net, readonly code: string) {
    this.view = { code, loaded: false, meta: null, players: {} };
    this.presenceRef = ref(net.db, `rooms/${code}/players/${net.uid}/online`);
  }

  get uid() {
    return this.net.uid;
  }

  get isHost() {
    return this.view.meta?.host === this.net.uid;
  }

  path(p: string) {
    return ref(this.net.db, p ? `rooms/${this.code}/${p}` : `rooms/${this.code}`);
  }

  listen(cb: (v: RoomView) => void): () => void {
    this.listeners.push(cb);
    if (this.view.loaded) cb(this.view);
    return () => (this.listeners = this.listeners.filter((l) => l !== cb));
  }

  static async create(name: string, look: Look, config: GameConfig): Promise<Room> {
    const net = await connect();
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = randomCode();
      const meta: RoomMeta = { host: net.uid, status: 'lobby', createdAt: Date.now(), config };
      const res = await runTransaction(ref(net.db, `rooms/${code}/meta`), (cur) => (cur === null ? meta : undefined));
      if (res.committed) {
        const room = new Room(net, code);
        await room.enter(name, look);
        return room;
      }
    }
    throw new Error('network');
  }

  static async join(codeIn: string, name: string, look: Look): Promise<Room> {
    const code = normalizeCode(codeIn);
    if (!CODE_RE.test(code)) throw new Error('bad-code' satisfies RoomError);
    const net = await connect();
    const [metaSnap, playersSnap] = await Promise.all([
      get(ref(net.db, `rooms/${code}/meta`)),
      get(ref(net.db, `rooms/${code}/players`)),
    ]);
    if (!metaSnap.exists()) throw new Error('not-found' satisfies RoomError);
    const meta = metaSnap.val() as RoomMeta;
    const players = (playersSnap.val() ?? {}) as Record<string, RoomPlayer>;
    const already = !!players[net.uid];
    if (!already && meta.status !== 'lobby') throw new Error('started' satisfies RoomError);
    if (!already && Object.keys(players).length >= MAX_ROOM_PLAYERS) throw new Error('full' satisfies RoomError);
    const room = new Room(net, code);
    await room.enter(name, look, already);
    return room;
  }

  private async enter(name: string, look: Look, rejoin = false) {
    const me = ref(this.net.db, `rooms/${this.code}/players/${this.net.uid}`);
    if (rejoin) await update(me, { online: true });
    else await set(me, { name, look, joinedAt: serverTimestamp(), online: true, inLobby: true });
    this.unsubs.push(
      onValue(ref(this.net.db, '.info/connected'), (snap) => {
        if (snap.val() !== true) return;
        onDisconnect(this.presenceRef).set(false).then(() => set(this.presenceRef, true)).catch(() => {});
      }),
    );
    this.unsubs.push(
      onValue(this.path('meta'), (snap) => {
        this.got.meta = true;
        this.view = { ...this.view, loaded: this.got.meta && this.got.players, meta: snap.val() };
        this.changed();
      }),
    );
    this.unsubs.push(
      onValue(this.path('players'), (snap) => {
        this.got.players = true;
        this.view = { ...this.view, loaded: this.got.meta && this.got.players, players: snap.val() ?? {} };
        this.changed();
      }),
    );
  }

  private changed() {
    if (!this.view.loaded) return;
    // Αν ο host λείπει και είμαι ο επόμενος, αναλαμβάνω (οι κανόνες της βάσης το επιτρέπουν μόνο τότε).
    if (nextHost(this.view) === this.net.uid) {
      update(this.path('meta'), { host: this.net.uid }).catch(() => {});
    }
    for (const l of this.listeners) l(this.view);
  }

  async setConfig(config: GameConfig) {
    if (this.isHost) await update(this.path('meta'), { config });
  }

  async setProfile(name: string, look: Look) {
    await update(this.path(`players/${this.net.uid}`), { name, look }).catch(() => {});
  }

  async setInLobby(inLobby: boolean) {
    await update(this.path(`players/${this.net.uid}`), { inLobby }).catch(() => {});
  }

  /** Οι παίκτες που θα μπουν στην παρτίδα: συνδεδεμένοι και στο lobby, με σειρά εισόδου. */
  lineup(): [string, RoomPlayer][] {
    return sortedPlayers(this.view.players).filter(([, p]) => p.online && p.inLobby !== false);
  }

  /** Ο host ξεκινά την παρτίδα γράφοντας την πρώτη κατάσταση. */
  async start(stateJson: string) {
    await update(ref(this.net.db, `rooms/${this.code}`), {
      state: stateJson, actions: null, poses: null, 'meta/status': 'playing',
    });
  }

  /** Πίσω στο lobby για νέα παρτίδα με τους ίδιους φίλους. */
  async backToLobby() {
    if (!this.isHost) return;
    await update(ref(this.net.db, `rooms/${this.code}`), { state: null, actions: null, 'meta/status': 'lobby' });
  }

  async kick(uid: string) {
    if (!this.isHost || uid === this.net.uid) return;
    await remove(this.path(`players/${uid}`));
  }

  /** Έξοδος. Στο lobby φεύγει εντελώς· σε παρτίδα μένει ως εκτός σύνδεσης. */
  async leave() {
    this.close();
    await onDisconnect(this.presenceRef).cancel().catch(() => {});
    const onlineOthers = sortedPlayers(this.view.players).filter(([id, p]) => p.online && id !== this.net.uid);
    if (this.view.meta?.status === 'lobby') {
      if (this.isHost && onlineOthers.length === 0) {
        await remove(ref(this.net.db, `rooms/${this.code}`)).catch(() => {});
        return;
      }
      await remove(this.path(`players/${this.net.uid}`)).catch(() => {});
    } else if (onlineOthers.length === 0 && this.isHost) {
      await remove(ref(this.net.db, `rooms/${this.code}`)).catch(() => {});
    } else await set(this.presenceRef, false).catch(() => {});
  }

  close() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeners = [];
  }
}
