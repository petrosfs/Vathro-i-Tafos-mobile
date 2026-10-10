import type { RoomPlayer } from './room';

/** Παίκτες με σειρά εισόδου. */
export function sortedPlayers(players: Record<string, RoomPlayer>): [string, RoomPlayer][] {
  return Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt || a[0].localeCompare(b[0]));
}
