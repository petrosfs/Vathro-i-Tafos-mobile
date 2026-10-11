// Αποθήκευση και συνέχεια παρτίδας: μετατροπή κατάστασης από παλιότερες εκδόσεις και ταίριασμα παικτών
// όταν μια αποθηκευμένη παρτίδα συνεχίζει σε νέο δωμάτιο.
import {
  createGame, DEFAULT_CONFIG, MAX_PLAYERS, newPlayer, newStats, quotaFor, rollOffers, SCHEMA, type GameState, type Look, type PlayerState,
} from './engine';

/**
 * Συμπληρώνει ό,τι λείπει από μια κατάσταση παλιότερης έκδοσης με τις προεπιλογές της τωρινής.
 * Έτσι ένα update δεν «σπάει» μια αποθηκευμένη ή εν εξελίξει παρτίδα.
 */
export function migrateState(raw: unknown): GameState {
  const r = (raw ?? {}) as Partial<GameState>;
  const base = createGame(Number(r.seed) || 1, { ...createDefaults().config, ...(r.config ?? {}) }, []);
  const s = { ...base, ...r } as GameState;
  s.config = { ...DEFAULT_CONFIG, ...(r.config ?? {}) };
  // πίνακες/αντικείμενα που ίσως λείπουν ή ήρθαν άδεια
  for (const k of ['opens', 'perks', 'positions', 'effects', 'tips', 'scoops', 'order', 'offers', 'history', 'log', 'unlocked', 'office'] as const) {
    if (!Array.isArray(s[k])) (s as unknown as Record<string, unknown>)[k] = Array.isArray(base[k]) ? [...(base[k] as unknown[])] : [];
  }
  if (!s.opens.length) s.opens = base.opens;
  // παλιότερες εκδόσεις: όλες οι 8 μετοχές στο χρηματιστήριο από την αρχή, χωρίς γεγονότα
  if (!Array.isArray(r.listed)) {
    s.listed = [0, 1, 2, 3, 4, 5, 6, 7];
    s.nextIpo = (Number(r.day) || 1) + 2;
  }
  for (const k of ['events', 'gone', 'honey'] as const) if (!Array.isArray(s[k])) s[k] = [];
  if (!s.born || typeof s.born !== 'object') s.born = {};
  if (!s.slot || typeof s.slot !== 'object') s.slot = base.slot;
  else s.slot = { pot: Number(s.slot.pot) || 0, spins: Number(s.slot.spins) || 0, log: Array.isArray(s.slot.log) ? s.slot.log : [] };
  s.opens = base.opens.map((v, i) => (Number.isFinite(s.opens[i]) ? s.opens[i] : v));
  s.players = { ...(r.players ?? {}) };
  for (const [uid, p] of Object.entries(s.players)) {
    const fresh = newPlayer(p?.name ?? '?', p?.look ?? base.players[uid]?.look ?? defaultLook());
    s.players[uid] = {
      ...fresh, ...p,
      inv: Array.isArray(p?.inv) ? p.inv : [],
      decor: Array.isArray(p?.decor) ? p.decor : [],
      stats: { ...newStats(), ...(p?.stats ?? {}) },
    } as PlayerState;
  }
  s.order = s.order.filter((u) => s.players[u]);
  if (!s.offers.length && s.phase === 'shop') s.offers = rollOffers(s);
  s.schema = SCHEMA;
  return s;
}

function createDefaults() {
  return createGame(1, DEFAULT_CONFIG, []);
}

function defaultLook(): Look {
  return { suit: 0, skin: 0, hair: 0, hairColor: 0, hat: 0, tie: 0, glasses: 0 };
}

export interface Joiner {
  uid: string;
  name: string;
  look: Look;
}

const norm = (s: string) => s.trim().toLocaleLowerCase();

/**
 * Συνέχεια αποθηκευμένης παρτίδας με όσους μπήκαν στο νέο δωμάτιο. Κάθε παίκτης βρίσκει τη θέση του
 * πρώτα με τον λογαριασμό της συσκευής του και μετά με το όνομα· οι νέοι ξεκινούν με άδεια τσέπη, και όσοι
 * δεν ήρθαν αφαιρούνται. Η παρτίδα συνεχίζει από το κατάστημα πριν από την επόμενη μέρα.
 */
export function resumeState(saved: GameState, joiners: Joiner[], unlocked: string[] = []): GameState {
  const s = migrateState(structuredClone(saved));
  const free = new Set(s.order.filter((u) => !s.players[u]?.bot));
  const match = new Map<string, string>();
  for (const j of joiners) if (free.has(j.uid)) {
    match.set(j.uid, j.uid);
    free.delete(j.uid);
  }
  for (const j of joiners) {
    if (match.has(j.uid)) continue;
    const old = [...free].find((u) => norm(s.players[u].name) === norm(j.name));
    if (old) {
      match.set(j.uid, old);
      free.delete(old);
    }
  }
  const players: Record<string, PlayerState> = {};
  const order: string[] = [];
  const rename = new Map<string, string>();
  for (const j of joiners.slice(0, MAX_PLAYERS)) {
    const old = match.get(j.uid);
    const p = old ? { ...s.players[old] } : newPlayer(j.name, j.look);
    p.name = j.name;
    p.look = j.look;
    p.ready = false;
    p.lev = false;
    players[j.uid] = p;
    order.push(j.uid);
    if (old) rename.set(old, j.uid);
  }
  // τα bots μένουν (όσα χωράνε)· ο «σκλάβος» μένει μόνο αν ήρθε το αφεντικό του
  for (const u of s.order) {
    const b = s.players[u];
    if (!b?.bot || order.length >= MAX_PLAYERS) continue;
    const owner = b.bot.owner ? rename.get(b.bot.owner) : undefined;
    if (b.bot.kind === 'slave' && !owner) continue;
    players[u] = { ...b, bot: { ...b.bot, last: -1, ...(owner ? { owner } : {}) } };
    order.push(u);
    rename.set(u, u);
  }
  s.players = players;
  s.order = order;
  s.log = s.log.filter((l) => rename.has(l.who)).map((l) => ({ ...l, who: rename.get(l.who)! }));
  s.positions = [];
  s.tips = [];
  s.scoops = [];
  s.effects = [];
  s.unlocked = [...new Set([...s.unlocked, ...unlocked])] as GameState['unlocked'];
  if (s.phase !== 'ended') {
    s.phase = 'shop';
    s.len = s.config.dayLen;
    s.coffee = 0;
  }
  s.quota = quotaFor(s);
  s.rev = 0;
  return s;
}
