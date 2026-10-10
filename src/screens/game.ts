// Η οθόνη της παρτίδας: 3D γραφείο, HUD, τερματικό, κατάστημα, chat, μενού, τελική σύνοψη.
import { esc, h, toast, type Screen } from '../app';
import { money, pct, price, signed, t, tr } from '../i18n';
import { loadSettings, saveSettings } from '../settings';
import { sfx } from '../audio';
import { ranking, type GameState } from '../sim/engine';
import { STOCKS } from '../sim/stocks';
import { ITEM } from '../sim/items';
import { GameController } from '../game/controller';
import { crashIn, headline, shownAt, visibleNews } from '../game/news';
import type { Transport } from '../net/transport';
import { World } from '../three/world';
import type { BoardData } from '../three/textures';
import { Terminal } from '../ui/terminal';
import { ShopPanel } from '../ui/shop';
import { ChatPanel } from '../ui/chat';
import { endScreen, type EndActions } from '../ui/endScreen';
import { sanitizeLook } from '../profile';

export interface GameScreenOpts {
  transport: Transport;
  /** Μόνο για τον host online: ξεκινά τη μέρα χωρίς να περιμένει όλους. */
  forceStart?: () => void;
  /** Έξοδος από την παρτίδα (μετά από επιβεβαίωση). */
  leave: () => void;
  endActions: (s: GameState) => EndActions;
}

type PanelKind = 'terminal' | 'shop' | 'chat' | 'menu';

const clock = (ticks: number) => {
  const sec = Math.max(0, Math.ceil(ticks / 2));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

export function gameScreen(opts: GameScreenOpts): Screen {
  return (root) => {
    const settings = loadSettings();
    const tr0 = opts.transport;
    const g = new GameController(tr0);
    root.className = 'game-root';
    const el = h(`
      <div class="game">
        <div class="stage"></div>
        <div class="hud">
          <div class="hud-top">
            <div class="hud-cell hud-day"><small></small><b></b></div>
            <div class="hud-cell hud-clock"><small>⏱</small><b></b></div>
            <div class="hud-cell hud-quota"><small></small><div class="bar"><i></i><em></em></div></div>
            <div class="hud-cell hud-cash"><small>${esc(t('hud.cash'))}</small><b></b></div>
            <div class="hud-cell hud-coins"><small>${esc(t('hud.coins'))}</small><b></b></div>
          </div>
          <div class="headline" hidden></div>
          <div class="warn-banner" hidden></div>
          <div class="center-msg" hidden></div>
          <button class="interact" hidden></button>
          <p class="fp-hint" hidden></p>
          <nav class="hud-bottom">
            <button class="hud-btn" data-ui="terminal">📈 <span>${esc(t('hud.terminal'))}</span></button>
            <button class="hud-btn" data-ui="shop">🛒 <span>${esc(t('hud.shop'))}</span></button>
            <button class="hud-btn" data-ui="chat">💬 <span>${esc(t('hud.chat'))}</span><i class="badge" hidden></i></button>
            <button class="hud-btn" data-ui="menu" aria-label="${esc(t('hud.menu'))}">☰</button>
          </nav>
        </div>
        <div class="panels"></div>
      </div>`);
    root.append(el);
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;

    const world = new World($('.stage'), {
      view: settings.view, quality: settings.quality, reduceMotion: settings.reduceMotion,
      sensitivity: () => loadSettings().sensitivity, shopTitle: t('shop.title').toUpperCase(), shopSub: '🪙 → 📈',
    });
    world.myUid = g.uid;
    world.start();

    let panel: PanelKind | null = null;
    const terminal = new Terminal(g, () => closePanel());
    const shop = new ShopPanel(g, () => closePanel(), opts.forceStart ? () => opts.forceStart!() : null);
    const chat = new ChatPanel(g.uid, (txt) => tr0.sendChat(txt), (e) => emote(e), () => closePanel());
    const menu = buildMenu();

    function openPanel(k: PanelKind, desk: number | null = null) {
      if (k === 'shop' && g.s?.phase !== 'shop') return;
      closePanel(false);
      panel = k;
      const p = k === 'terminal' ? terminal.el : k === 'shop' ? shop.el : k === 'chat' ? chat.el : menu;
      $('.panels').append(p);
      el.classList.add('panel-open', `open-${k}`);
      world.setUiOpen(true, k === 'terminal' ? (desk ?? g.desk(g.uid)) : null);
      if (k === 'terminal') terminal.update(true);
      if (k === 'shop') shop.update(true);
      if (k === 'chat') {
        chat.markRead();
        updateBadge();
        if (!matchMedia('(pointer: coarse)').matches) chat.focus();
      }
      sfx.click();
    }

    function closePanel(sound = true) {
      if (!panel) return;
      $('.panels').innerHTML = '';
      el.classList.remove('panel-open', `open-${panel}`);
      panel = null;
      world.setUiOpen(false);
      if (sound) sfx.click();
    }

    el.querySelector('.hud-bottom')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ui]');
      if (!b) return;
      const k = b.dataset.ui as PanelKind;
      if (panel === k) closePanel();
      else openPanel(k);
    });

    const interactBtn = $<HTMLButtonElement>('.interact');
    function interact() {
      const it = world.nearInteractable();
      if (!it || panel) return;
      if (it.kind === 'shop') {
        if (g.s?.phase === 'shop') openPanel('shop');
        else toast(t('hud.closed'));
      } else openPanel('terminal', it.index);
    }
    world.onInteract = interact;
    interactBtn.addEventListener('click', interact);

    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (e.key === 'Escape' && panel) {
        closePanel();
        e.preventDefault();
      } else if (!typing && !panel && e.key === 'Enter') {
        openPanel('chat');
        e.preventDefault();
      } else if (!typing && (e.key === 't' || e.key === 'T') && world.view === 'overview') {
        if (panel === 'terminal') closePanel();
        else openPanel('terminal');
      }
    };
    window.addEventListener('keydown', onKey);

    function emote(e: string) {
      const now = tr0.now();
      world.emoteMine(e, now);
      world.celebrate(1500);
      pendingEmote = { e, et: now };
      sendPose(true);
    }

    // ---- θέση μου στους άλλους ----
    let pendingEmote: { e: string; et: number } | null = null;
    let lastPoseKey = '';
    function sendPose(force = false) {
      const p = world.myPose();
      const key = `${p.x.toFixed(2)}|${p.z.toFixed(2)}|${p.ry.toFixed(2)}|${p.a}`;
      if (!force && key === lastPoseKey) return;
      lastPoseKey = key;
      tr0.sendPose(pendingEmote ? { ...p, ...pendingEmote } : p);
    }
    tr0.onPoses((poses) => world.setPoses(poses, tr0.now()));

    // ---- chat ----
    tr0.onChat((msgs) => {
      const before = chat.unread;
      chat.set(msgs);
      if (panel === 'chat') chat.markRead();
      updateBadge();
      if (chat.unread > before && panel !== 'chat') {
        const m = msgs.at(-1);
        if (m && m.uid !== g.uid) toast(`${m.name}: ${m.text}`);
      }
    });
    function updateBadge() {
      const b = $('.badge');
      b.hidden = chat.unread === 0;
      b.textContent = String(chat.unread);
    }

    // ---- αλλαγές κατάστασης ----
    let lastErr = 0;
    let lastLogN = -1;
    let ended = false;
    let playersKey = '';
    g.onChange((s, prev) => {
      const pk = s.order.map((u) => `${u}:${s.players[u]?.name}:${JSON.stringify(s.players[u]?.look)}`).join('|');
      if (pk !== playersKey) {
        playersKey = pk;
        world.setPlayers(s.order.filter((u) => s.players[u]).map((u, i) => ({
          uid: u, name: s.players[u].name, look: sanitizeLook(s.players[u].look), desk: i,
        })));
      }
      const err = g.errors[g.uid];
      if (err && err.n !== lastErr) {
        if (lastErr !== 0 || !prev) toast(t(`err.${err.c}` as Parameters<typeof t>[0]), 'error');
        lastErr = err.n;
      }
      if (lastLogN >= 0) {
        for (const l of s.log) {
          if (l.n <= lastLogN || l.who !== g.uid) continue;
          if (l.kind === 'close' || l.kind === 'eod') (l.pnl ?? 0) >= 0 ? sfx.profit() : sfx.loss();
          if (l.kind === 'liq') {
            sfx.loss();
            toast(`💥 ${STOCKS[l.stock!].ticker}: ${signed(l.pnl ?? 0)}`, 'error');
          }
          if (l.kind === 'stop') {
            sfx.loss();
            toast(`⛑ ${STOCKS[l.stock!].ticker}: ${signed(l.pnl ?? 0)}`);
          }
        }
        for (const l of s.log) {
          if (l.n > lastLogN && l.who !== g.uid && l.kind === 'item' && l.item && ['pump', 'dump', 'halt', 'coffee', 'tip', 'scoop'].includes(l.item)) {
            toast(`${ITEM[l.item].glyph} ${g.name(l.who)}: ${tr(ITEM[l.item].name)}${l.stock !== undefined ? ` · ${STOCKS[l.stock].ticker}` : ''}`);
          }
        }
      }
      lastLogN = s.logN;
      if (prev && prev.phase !== s.phase) {
        if (s.phase === 'trading') {
          if (panel === 'shop') closePanel(false);
          bellRung = false;
          alarmed = false;
          shownNews.clear();
        } else if (s.phase === 'shop') {
          const r = s.history.at(-1);
          if (r) {
            sfx.bell();
            setTimeout(() => (r.saved ? sfx.loss() : sfx.win()), 900);
            world.celebrate(3000);
          }
          if (panel !== 'chat') openPanel('shop');
        }
      }
      if (s.phase === 'ended' && !ended) {
        ended = true;
        closePanel(false);
        sfx.bell();
        setTimeout(() => (s.result === 'podium' ? sfx.win() : sfx.lose()), 800);
        world.showEnding(s.result ?? 'grave', ranking(s));
        el.classList.add('ending');
        setTimeout(() => {
          if (!g.s) return;
          el.append(endScreen(g.s, g.uid, opts.endActions(g.s)));
        }, 4200);
      }
      if (!prev && s.phase === 'shop') openPanel('shop');
      world.setShopOpen(s.phase === 'shop');
      if (panel === 'shop') shop.update();
      if (panel === 'terminal') terminal.update(true);
      refreshHud();
    });

    // ---- παρουσία και host ----
    let lastHost = tr0.hostUid();
    const online = new Map<string, boolean>();
    tr0.onPresence(() => {
      const s = g.s;
      if (!s) return;
      for (const u of s.order) {
        const now = tr0.isConnected(u);
        const was = online.get(u);
        if (was !== undefined && was !== now && u !== g.uid) toast(t(now ? 'presence.back' : 'presence.left', { name: g.name(u) }));
        online.set(u, now);
      }
      const host = tr0.hostUid();
      if (host && lastHost && host !== lastHost && tr0.online) toast(t('host.changed', { name: host === g.uid ? t('you') : g.name(host) }));
      lastHost = host;
      if (panel === 'shop') shop.update(true);
    });

    // ---- ρολόι: HUD, πίνακας, οθόνες, ειδήσεις ----
    let bellRung = false;
    let alarmed = false;
    const shownNews = new Set<number>();
    let headlineTimer: ReturnType<typeof setTimeout> | null = null;
    let lastBoard = 0;
    let lastMon = 0;
    let lastPoseSent = 0;

    function refreshHud() {
      const s = g.s;
      if (!s) return;
      const tickF = g.tickF();
      const trading = s.phase === 'trading';
      $('.hud-day small').textContent = s.config.podiumDays ? t('hud.dayOf', { d: s.day, n: s.config.podiumDays }) : t('hud.day', { d: s.day });
      $('.hud-day b').textContent = s.phase === 'shop' ? t('hud.shop') : trading && tickF < 0 ? '🔔' : trading ? '📈' : '';
      const clockEl = $('.hud-clock b');
      const remain = s.len - tickF;
      clockEl.textContent = trading ? (tickF < 0 ? clock(s.len) : clock(remain)) : '—';
      clockEl.classList.toggle('urgent', trading && tickF >= 0 && remain <= 20);
      const profit = g.dayProfit();
      const prog = trading ? profit / s.quota : 0;
      $('.hud-quota small').textContent = `${t('hud.quota')} ${money(s.quota)}`;
      const bar = $('.hud-quota i');
      bar.style.width = `${Math.max(0, Math.min(100, prog * 100))}%`;
      bar.classList.toggle('done', prog >= 1);
      $('.hud-quota em').textContent = trading ? signed(profit) : '';
      $('.hud-quota em').className = profit >= 0 ? 'up' : 'down';
      $('.hud-cash b').textContent = money(g.equity());
      $('.hud-coins b').textContent = `🪙 ${s.coins}`;
      // κουμπιά
      const fpMode = world.view === 'first';
      const near = world.nearInteractable();
      const termBtn = el.querySelector<HTMLElement>('[data-ui="terminal"]')!;
      termBtn.hidden = s.phase === 'ended' || (fpMode && panel !== 'terminal');
      el.querySelector<HTMLElement>('[data-ui="shop"]')!.hidden = s.phase !== 'shop';
      el.querySelector<HTMLElement>('[data-ui="chat"]')!.hidden = !tr0.online;
      interactBtn.hidden = !fpMode || !!panel || !near || s.phase === 'ended' || (near.kind === 'shop' && s.phase !== 'shop');
      if (!interactBtn.hidden && near) {
        const label = near.kind === 'shop' ? t('hud.interactShop') : t('hud.interactDesk');
        interactBtn.textContent = matchMedia('(pointer: coarse)').matches ? label : `E · ${label}`;
      }
      const hint = $('.fp-hint');
      hint.hidden = !fpMode || !!panel || s.phase === 'ended' || !!near;
      hint.textContent = matchMedia('(pointer: coarse)').matches ? t('hud.walkHint') : t('hud.fpHint');
      // αντίστροφη μέτρηση
      const center = $('.center-msg');
      if (trading && tickF < 0) {
        center.hidden = false;
        center.textContent = t('hud.bell', { s: Math.ceil(-tickF / 2) });
      } else if (trading && remain <= 20 && remain > 0) {
        center.hidden = false;
        center.textContent = t('hud.lastSeconds');
        center.classList.add('small');
      } else {
        center.hidden = true;
        center.classList.remove('small');
      }
      // ήχοι χρόνου
      if (trading && tickF >= 0 && !bellRung) {
        bellRung = true;
        if (tickF < 4) sfx.bell();
      }
      if (trading && remain <= 20 && remain > 0 && !alarmed) {
        alarmed = true;
        sfx.alarm();
      }
      // ραντάρ κραχ
      const warn = $('.warn-banner');
      const crash = trading ? crashIn(s, g.tick()) : null;
      warn.hidden = crash === null;
      if (crash !== null) warn.textContent = `⚠ ${t('news.crash', { s: crash })}`;
      // ειδήσεις
      if (trading && tickF >= 0) {
        const tick = g.tick();
        for (const n of visibleNews(s, tick)) {
          if (shownNews.has(n.id)) continue;
          shownNews.add(n.id);
          if (tick - shownAt(s, n) > 8) continue;
          showHeadline(n.stock >= 0 ? STOCKS[n.stock].ticker : t('news.market'), headline(n), n.crash ? 'crash' : n.rumor ? 'rumor' : n.dir > 0 ? 'up' : 'down');
        }
      }
    }

    function showHeadline(tag: string, text: string, kind: string) {
      const hl = $('.headline');
      hl.className = `headline ${kind}`;
      hl.innerHTML = `<b>${esc(tag)}</b> ${esc(text)}`;
      hl.hidden = false;
      sfx.news();
      if (headlineTimer) clearTimeout(headlineTimer);
      headlineTimer = setTimeout(() => (hl.hidden = true), 6000);
    }

    function boardData(): BoardData {
      const s = g.s!;
      const tick = g.tick();
      const series = g.series();
      const trading = s.phase === 'trading';
      const tickF = g.tickF();
      const news = trading ? visibleNews(s, tick).at(-1) : undefined;
      const profit = g.dayProfit();
      const last = s.history.at(-1);
      return {
        title: `${t('title').toUpperCase()} · ${s.config.podiumDays ? t('hud.dayOf', { d: s.day, n: s.config.podiumDays }) : t('hud.day', { d: s.day })}`,
        clock: trading ? (tickF < 0 ? `-${Math.ceil(-tickF / 2)}` : clock(s.len - tickF)) : '--:--',
        urgent: trading && s.len - tickF <= 20,
        rows: STOCKS.map((st, i) => {
          const p = series[i][tick];
          const ch = p / series[i][0] - 1;
          const spark: number[] = [];
          const step = Math.max(1, Math.floor(tick / 30));
          for (let k = 0; k <= tick; k += step) spark.push(series[i][k]);
          if (spark.length) spark.push(p);
          return { ticker: st.ticker, price: price(p), change: ch, changeText: pct(ch), color: st.color, spark };
        }),
        progress: trading ? profit / s.quota : last ? last.profit / last.quota : 0,
        progressText: trading
          ? `${t('hud.profit')} ${signed(profit)} / ${t('hud.quota')} ${money(s.quota)}`
          : `${t('shop.next', { d: s.day })}: ${money(s.quota)}`,
        headline: news ? `${news.stock >= 0 ? STOCKS[news.stock].ticker + ' · ' : ''}${headline(news)}` : trading ? '' : `🛒 ${t('shop.title')}`,
        headlineColor: news ? (news.rumor ? '#C792EA' : news.dir > 0 ? '#3DDC84' : '#FF5C5C') : '#F5C542',
      };
    }

    function monitors(now: number) {
      const s = g.s!;
      const series = g.series();
      const tick = g.tick();
      for (let i = 0; i < world.office.monitors.length; i++) {
        const uid = s.order[i];
        if (!uid) {
          world.setMonitor(i, '—', '#304060', [], '');
          continue;
        }
        const k = uid === g.uid ? terminal.selected : (i * 3 + Math.floor(now / 8000)) % STOCKS.length;
        const st = STOCKS[k];
        const step = Math.max(1, Math.floor(tick / 40));
        const pts: number[] = [];
        for (let j = 0; j <= tick; j += step) pts.push(series[k][j]);
        pts.push(series[k][tick]);
        world.setMonitor(i, st.ticker, st.color, pts, s.players[uid]?.name ?? '');
      }
    }

    const timer = setInterval(() => {
      if (!g.s) return;
      refreshHud();
      if (panel === 'terminal') terminal.update();
      const now = Date.now();
      if (now - lastBoard > 480) {
        lastBoard = now;
        world.setBoard(boardData());
      }
      if (now - lastMon > 1000) {
        lastMon = now;
        monitors(now);
      }
      if (now - lastPoseSent > 150) {
        lastPoseSent = now;
        sendPose();
        if (pendingEmote && tr0.now() - pendingEmote.et > 3000) pendingEmote = null;
      }
    }, 250);

    // ---- μενού ----
    function buildMenu(): HTMLElement {
      const m = h(`
        <section class="panel menu" aria-label="${esc(t('menu.title'))}">
          <header class="panel-head"><h2>${esc(t('menu.title'))}</h2><button class="icon-btn" data-close aria-label="${esc(t('close'))}">✕</button></header>
          <div class="panel-body">
            <h3>${esc(t('settings.view'))}</h3>
            <div class="seg" data-k="view">
              <button data-v="first">${esc(t('view.first'))}</button>
              <button data-v="overview">${esc(t('view.overview'))}</button>
            </div>
            <h3>${esc(t('settings.sound'))}</h3>
            <div class="seg" data-k="sound">
              <button data-v="1">${esc(t('on'))}</button>
              <button data-v="0">${esc(t('off'))}</button>
            </div>
            <button class="btn primary wide" data-resume>${esc(t('menu.resume'))}</button>
            <button class="btn danger wide" data-leave>${esc(t('menu.leave'))}</button>
          </div>
        </section>`);
      const sync = () => {
        const st = loadSettings();
        m.querySelectorAll<HTMLElement>('[data-k="view"] button').forEach((b) => b.classList.toggle('sel', b.dataset.v === st.view));
        m.querySelectorAll<HTMLElement>('[data-k="sound"] button').forEach((b) => b.classList.toggle('sel', b.dataset.v === (st.sound ? '1' : '0')));
      };
      sync();
      m.querySelector('[data-close]')!.addEventListener('click', () => closePanel());
      m.querySelector('[data-resume]')!.addEventListener('click', () => closePanel());
      m.querySelector('[data-k="view"]')!.addEventListener('click', (e) => {
        const v = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v as 'first' | 'overview' | undefined;
        if (!v) return;
        saveSettings({ ...loadSettings(), view: v });
        world.setView(v);
        sync();
      });
      m.querySelector('[data-k="sound"]')!.addEventListener('click', (e) => {
        const v = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v;
        if (!v) return;
        saveSettings({ ...loadSettings(), sound: v === '1' });
        sync();
      });
      m.querySelector('[data-leave]')!.addEventListener('click', () => {
        if (confirm(tr0.online ? t('menu.leaveConfirm') : t('menu.leaveSolo'))) opts.leave();
      });
      return m;
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      if (headlineTimer) clearTimeout(headlineTimer);
      world.dispose();
      tr0.close();
    };
  };
}
