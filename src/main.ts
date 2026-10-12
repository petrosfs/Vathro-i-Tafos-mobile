import './style.css';
import { go } from './app';
import { resolveLang, setLang } from './i18n';
import { loadSettings } from './settings';
import { loadProfile } from './profile';
import { homeScreen } from './screens/menus';
import { onlineScreen } from './screens/online';
import { CODE_RE, normalizeCode } from './net/code';
import { loadCharacterModels } from './three/modelRig';
import { loadDancerModel } from './three/dancer';

setLang(resolveLang(loadSettings().lang));

// οι χαρακτήρες (3D μοντέλα) φορτώνονται πριν από την πρώτη οθόνη· αν αργήσουν ή αποτύχουν, παίζουμε με τους απλούς
const app = document.getElementById('app');
if (app) app.innerHTML = '<div class="boot">…</div>';
const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), 12000));
// οι χορεύτριες των πάρτι φορτώνονται στο παρασκήνιο (δεν χρειάζονται στην αρχή)
Promise.race([loadCharacterModels(import.meta.env.BASE_URL), timeout]).finally(() => {
  void loadDancerModel(import.meta.env.BASE_URL);
  const room = normalizeCode(new URLSearchParams(location.search).get('room') ?? '');
  if (CODE_RE.test(room)) go(onlineScreen(room, !!loadProfile().name));
  else go(homeScreen);
});
