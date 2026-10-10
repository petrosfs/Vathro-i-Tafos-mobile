import type { Action, GameState } from '../sim/engine';
import type { ChatMsg, Pose, Transport } from '../net/transport';
import { HostRunner, type HostError } from './host';

export const SOLO_UID = 'me';

/** Solo: ο host τρέχει στην ίδια συσκευή, χωρίς δίκτυο. */
export class LocalTransport implements Transport {
  readonly uid = SOLO_UID;
  readonly online = false;
  private stateCbs: ((s: GameState, e: Record<string, HostError>) => void)[] = [];
  private chatCbs: ((m: ChatMsg[]) => void)[] = [];
  private chat: ChatMsg[] = [];
  private last: { s: GameState; e: Record<string, HostError> } | null = null;
  readonly host: HostRunner;

  constructor(state: GameState) {
    this.host = new HostRunner(state, {
      now: () => this.now(),
      isConnected: (u) => u === this.uid,
      publish: (s, _keys, e) => {
        this.last = { s: structuredClone(s), e: { ...e } };
        for (const cb of this.stateCbs) cb(this.last.s, this.last.e);
      },
    });
  }

  start() {
    this.host.start();
  }

  now() {
    return Date.now();
  }

  isConnected(uid: string) {
    return uid === this.uid;
  }

  send(a: Action) {
    this.host.receive(this.uid, structuredClone(a));
  }

  onState(cb: (s: GameState, e: Record<string, HostError>) => void) {
    this.stateCbs.push(cb);
    if (this.last) cb(this.last.s, this.last.e);
  }

  sendPose(_p: Pose) {}

  onPoses(_cb: (poses: Record<string, Pose>) => void) {}

  sendChat(text: string) {
    this.chat.push({ id: String(this.chat.length), uid: this.uid, name: '', text, at: this.now() });
    for (const cb of this.chatCbs) cb(this.chat);
  }

  onChat(cb: (m: ChatMsg[]) => void) {
    this.chatCbs.push(cb);
  }

  onPresence(_cb: () => void) {}

  hostUid() {
    return this.uid;
  }

  close() {
    this.host.stop();
  }
}
