import {
  limitToLast, onChildAdded, onValue, push, query, set, update, type Unsubscribe,
} from 'firebase/database';
import type { Action, GameState } from '../sim/engine';
import { migrateState } from '../sim/save';
import { HostRunner, type HostError } from '../game/host';
import type { ChatMsg, Pose, Transport } from './transport';
import type { Room } from './room';

/** Πόσο συχνά γράφει ο host την κατάσταση (ms). */
const FLUSH_MS = 150;
/** Πόσο συχνά στέλνει κάθε παίκτης τη θέση του (ms). */
const POSE_MS = 100;

/** Λιγότερα δεκαδικά στο δίκτυο: ίδια ακρίβεια για το παιχνίδι, μικρότερα μηνύματα. */
const compact = (_k: string, v: unknown) =>
  typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(7)) : v;

interface Wire {
  s: GameState;
  e?: Record<string, HostError>;
}

/** Online: η κατάσταση, οι κινήσεις, οι θέσεις και το chat περνούν από το Firebase. */
export class OnlineTransport implements Transport {
  readonly online = true;
  private unsubs: Unsubscribe[] = [];
  private stateCbs: ((s: GameState, e: Record<string, HostError>) => void)[] = [];
  private poseCbs: ((p: Record<string, Pose>) => void)[] = [];
  private chatCbs: ((m: ChatMsg[]) => void)[] = [];
  private presenceCbs: (() => void)[] = [];
  private last: Wire | null = null;
  private host: HostRunner | null = null;
  private actionUnsubs = new Map<string, Unsubscribe>();
  private seen = new Set<string>();
  private poseTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPose: Pose | null = null;
  private lastPoseAt = 0;
  private chat: ChatMsg[] = [];
  private stopRoom: () => void;
  private closed = false;

  private pulse: ReturnType<typeof setInterval>;

  constructor(private room: Room) {
    // κάθε 2″: ο host στέλνει «παλμό», οι άλλοι ελέγχουν αν πρέπει να αναλάβουν
    this.pulse = setInterval(() => {
      if (this.host && this.room.isHost) this.room.heartbeat();
      else this.room.checkHost();
    }, 2000);
    this.unsubs.push(
      onValue(room.path('state'), (snap) => {
        const v = snap.val();
        if (typeof v !== 'string') return;
        try {
          const w = JSON.parse(v) as Wire;
          w.s = migrateState(w.s);
          // Ο host έχει ήδη την κατάσταση· αγνοεί την ηχώ του.
          if (this.host && this.last && w.s.rev <= this.last.s.rev) return;
          this.last = w;
          for (const cb of this.stateCbs) cb(w.s, w.e ?? {});
        } catch {
          /* χαλασμένο μήνυμα: αγνοείται */
        }
      }),
    );
    this.unsubs.push(
      onValue(room.path('poses'), (snap) => {
        const v = (snap.val() ?? {}) as Record<string, Pose>;
        for (const cb of this.poseCbs) cb(v);
      }),
    );
    this.unsubs.push(
      onValue(query(room.path('chat'), limitToLast(40)), (snap) => {
        const out: ChatMsg[] = [];
        snap.forEach((c) => {
          out.push({ id: c.key!, ...(c.val() as Omit<ChatMsg, 'id'>) });
        });
        this.chat = out;
        for (const cb of this.chatCbs) cb(out);
      }),
    );
    this.stopRoom = room.listen(() => {
      this.syncHost();
      for (const cb of this.presenceCbs) cb();
    });
  }

  get uid() {
    return this.room.uid;
  }

  now() {
    return this.room.net.now();
  }

  isConnected(uid: string) {
    return !!this.room.view.players[uid]?.online;
  }

  hostUid() {
    return this.room.view.meta?.host ?? null;
  }

  /** Αν έγινα host (στην αρχή ή επειδή έφυγε ο προηγούμενος), ξεκινάω τη μηχανή. */
  private syncHost() {
    if (this.closed) return;
    const amHost = this.room.isHost && this.room.view.meta?.status === 'playing';
    if (amHost && !this.host && this.last) {
      const host = new HostRunner(structuredClone(this.last.s), {
        now: () => this.now(),
        isConnected: (u) => this.isConnected(u),
        publish: (s, keys, e) => {
          if (!this.room.isHost) return;
          const w: Wire = { s, e };
          this.last = structuredClone(w);
          const patch: Record<string, unknown> = { state: JSON.stringify(w, compact) };
          for (const k of keys) patch[`actions/${k}`] = null;
          update(this.room.path(''), patch).catch(() => {});
          for (const cb of this.stateCbs) cb(this.last.s, this.last.e ?? {});
        },
      }, FLUSH_MS);
      this.host = host;
      host.start();
    } else if (!amHost && this.host) {
      this.host.stop();
      this.host = null;
    }
    if (this.host) {
      for (const uid of this.host.state.order) {
        if (this.actionUnsubs.has(uid)) continue;
        this.actionUnsubs.set(uid, onChildAdded(this.room.path(`actions/${uid}`), (snap) => {
          const key = `${uid}/${snap.key}`;
          if (this.seen.has(key) || !this.host) return;
          this.seen.add(key);
          const a = snap.val() as Action;
          if (a && typeof a === 'object') this.host.receive(uid, a, key);
        }));
      }
    } else if (this.actionUnsubs.size) {
      this.actionUnsubs.forEach((u) => u());
      this.actionUnsubs.clear();
    }
  }

  /** Ο host μπορεί να ξεκινήσει τη μέρα χωρίς να περιμένει όλους. */
  forceStart() {
    this.host?.forceStart();
  }

  get isHost() {
    return !!this.host;
  }

  send(a: Action) {
    push(this.room.path(`actions/${this.uid}`), a).catch(() => {});
  }

  onState(cb: (s: GameState, e: Record<string, HostError>) => void) {
    this.stateCbs.push(cb);
    if (this.last) cb(this.last.s, this.last.e ?? {});
    // Η κατάσταση μπορεί να ήρθε πριν από το meta: ξαναελέγχουμε αν πρέπει να γίνουμε host.
    queueMicrotask(() => this.syncHost());
  }

  sendPose(p: Pose) {
    this.pendingPose = p;
    const wait = POSE_MS - (Date.now() - this.lastPoseAt);
    if (wait <= 0) this.flushPose();
    else if (!this.poseTimer) this.poseTimer = setTimeout(() => this.flushPose(), wait);
  }

  private flushPose() {
    this.poseTimer = null;
    if (!this.pendingPose || this.closed) return;
    this.lastPoseAt = Date.now();
    const p = this.pendingPose;
    this.pendingPose = null;
    const r = (x: number) => Math.round(x * 100) / 100;
    const out: Pose = { x: r(p.x), z: r(p.z), ry: r(p.ry), a: p.a };
    if (p.e) {
      out.e = p.e;
      out.et = p.et;
    }
    set(this.room.path(`poses/${this.uid}`), out).catch(() => {});
  }

  onPoses(cb: (p: Record<string, Pose>) => void) {
    this.poseCbs.push(cb);
  }

  sendChat(text: string) {
    const name = this.room.view.players[this.uid]?.name ?? '?';
    push(this.room.path('chat'), { uid: this.uid, name, text: text.slice(0, 140), at: this.now() }).catch(() => {});
  }

  onChat(cb: (m: ChatMsg[]) => void) {
    this.chatCbs.push(cb);
    if (this.chat.length) cb(this.chat);
  }

  onPresence(cb: () => void) {
    this.presenceCbs.push(cb);
  }

  close() {
    this.closed = true;
    clearInterval(this.pulse);
    this.host?.stop();
    this.host = null;
    this.unsubs.forEach((u) => u());
    this.actionUnsubs.forEach((u) => u());
    this.actionUnsubs.clear();
    this.stopRoom();
    if (this.poseTimer) clearTimeout(this.poseTimer);
  }
}
