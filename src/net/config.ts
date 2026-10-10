// Ρυθμίσεις του Firebase project. Δεν είναι μυστικά: είναι αναγνωριστικά που φαίνονται σε κάθε
// web εφαρμογή. Την ασφάλεια την κάνουν οι κανόνες της βάσης (database.rules.json).
export const FIREBASE_CONFIG: Record<string, string> | null = {
  apiKey: 'AIzaSyBC6luGohChyy3-ek8rf3is_4Hhh2C_TFc',
  authDomain: 'vathro-i-tafos.firebaseapp.com',
  databaseURL: 'https://vathro-i-tafos-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'vathro-i-tafos',
  storageBucket: 'vathro-i-tafos.firebasestorage.app',
  messagingSenderId: '437439172468',
  appId: '1:437439172468:web:a856b63ffbd1071461a621',
};

/** Τοπικός emulator για δοκιμές: ?emu=1 στη διεύθυνση ή VITE_FB_EMULATOR στο build. */
export function emulatorHost(): string | null {
  const q = new URLSearchParams(location.search).get('emu');
  if (q) return q === '1' ? '127.0.0.1' : q;
  return (import.meta.env.VITE_FB_EMULATOR as string | undefined) || null;
}

export function firebaseConfig(): Record<string, string> | null {
  const emu = emulatorHost();
  if (emu) return { apiKey: 'demo-key', projectId: 'demo-vathro', databaseURL: `http://${emu}:9000?ns=demo-vathro` };
  return FIREBASE_CONFIG;
}

export const isConfigured = () => firebaseConfig() !== null;
