import type { Action, GameState } from '../sim/engine';
import type { HostError } from '../game/host';

/** Θέση και κίνηση ενός avatar στο γραφείο. */
export interface Pose {
  x: number;
  z: number;
  /** Γωνία προς τα πού κοιτάει. */
  ry: number;
  /** 0 = στέκεται, 1 = περπατάει, 2 = κάθεται στο γραφείο. */
  a: number;
  /** Emote και πότε στάλθηκε (ρολόι server). */
  e?: string;
  et?: number;
}

export interface ChatMsg {
  id: string;
  uid: string;
  name: string;
  text: string;
  at: number;
}

/**
 * Ό,τι χρειάζεται μια παρτίδα από το «δίκτυο». Στο solo όλα μένουν στη συσκευή,
 * online περνούν από το Firebase.
 */
export interface Transport {
  readonly uid: string;
  readonly online: boolean;
  /** Ρολόι κοινό για όλους (του server). */
  now(): number;
  isConnected(uid: string): boolean;
  send(a: Action): void;
  onState(cb: (s: GameState, errors: Record<string, HostError>) => void): void;
  sendPose(p: Pose): void;
  onPoses(cb: (poses: Record<string, Pose>) => void): void;
  sendChat(text: string): void;
  onChat(cb: (msgs: ChatMsg[]) => void): void;
  /** Αλλαγή στη σύνδεση των παικτών ή στον host. */
  onPresence(cb: () => void): void;
  hostUid(): string | null;
  close(): void;
}
