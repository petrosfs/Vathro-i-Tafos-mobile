import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, onValue, ref, type Database } from 'firebase/database';
import { emulatorHost, firebaseConfig } from './config';

export { isConfigured } from './config';

export interface Net {
  db: Database;
  uid: string;
  /** Ρολόι του server: Date.now() + διαφορά. */
  now(): number;
}

let ready: Promise<Net> | null = null;

/** Σύνδεση με ανώνυμο λογαριασμό (ο παίκτης δεν φτιάχνει λογαριασμό). */
export function connect(): Promise<Net> {
  const cfg = firebaseConfig();
  if (!cfg) return Promise.reject(new Error('not-configured'));
  if (!ready) {
    ready = (async () => {
      const app = initializeApp(cfg);
      const auth = getAuth(app);
      const db = getDatabase(app);
      const emu = emulatorHost();
      if (emu) {
        connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
        connectDatabaseEmulator(db, emu, 9000);
      }
      const cred = await signInAnonymously(auth);
      let offset = 0;
      onValue(ref(db, '.info/serverTimeOffset'), (snap) => (offset = Number(snap.val()) || 0));
      return { db, uid: cred.user.uid, now: () => Date.now() + offset };
    })();
    ready.catch(() => (ready = null));
  }
  return ready;
}
