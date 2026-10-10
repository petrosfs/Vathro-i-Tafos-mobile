import './style.css';
import { go } from './app';
import { resolveLang, setLang } from './i18n';
import { loadSettings } from './settings';
import { loadProfile } from './profile';
import { homeScreen } from './screens/menus';
import { onlineScreen } from './screens/online';
import { CODE_RE, normalizeCode } from './net/code';

setLang(resolveLang(loadSettings().lang));

const room = normalizeCode(new URLSearchParams(location.search).get('room') ?? '');
if (CODE_RE.test(room)) go(onlineScreen(room, !!loadProfile().name));
else go(homeScreen);
