import { openStore, type Store } from '../storage/save';
import { makeRng, randomSeed, type Rng } from '../engine/rng';
import { clear } from './dom';
import { setSoundEnabled, unlockAudio } from '../game/audio';
import { refreshDaily } from '../game/progress';
import { itemById } from '../game/shop';

export type Screen = { el: HTMLElement; onBack?: () => void; onKey?: (e: KeyboardEvent) => boolean; destroy?: () => void; title?: string };

/** The app shell: owns the save data, the session RNG and screen switching. */
export class App {
  store: Store;
  rng: Rng;
  seen = new Set<string>();
  root: HTMLElement;
  current: Screen | null = null;
  debug: boolean;

  constructor(root: HTMLElement) {
    this.root = root;
    this.store = openStore();
    this.rng = makeRng(randomSeed());
    this.debug = /[?&]bot=1/.test(location.search);
    refreshDaily(this.store.data);
    this.applySettings();
    // first gesture unlocks audio (iOS needs this)
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('keydown', (e) => {
      if (this.current?.onKey && this.current.onKey(e)) return;
      if (e.key === 'Escape' && this.current?.onBack) {
        e.preventDefault();
        this.current.onBack();
      }
    });
    // Android back button: stay in the game and go "back" a screen instead of leaving
    try {
      history.replaceState({ camp: 0 }, '');
      history.pushState({ camp: 1 }, '');
      window.addEventListener('popstate', () => {
        history.pushState({ camp: 1 }, '');
        this.current?.onBack?.();
      });
    } catch {
      /* ignore */
    }
  }

  get data() {
    return this.store.data;
  }

  save() {
    this.store.save();
  }

  show(screen: Screen) {
    this.current?.destroy?.();
    this.current = screen;
    clear(this.root);
    this.root.appendChild(screen.el);
    window.scrollTo(0, 0);
    if (screen.title) document.title = `${screen.title} · 6 Nights at Camp`;
    // move focus to the screen heading for screen readers / keyboards
    const hd = screen.el.querySelector<HTMLElement>('h1, h2');
    if (hd) {
      hd.setAttribute('tabindex', '-1');
      hd.focus({ preventScroll: true });
    }
  }

  applySettings() {
    const st = this.data.settings;
    const html = document.documentElement;
    const reduce = st.motion === 'reduce' || (st.motion === 'auto' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    html.classList.toggle('reduce-motion', !!reduce);
    html.dataset.text = st.textSize;
    html.dataset.spook = st.spook;
    const lantern = itemById(this.data.equipped.lantern ?? 'lantern-gold')?.id ?? 'lantern-gold';
    html.dataset.lantern = lantern.replace('lantern-', '');
    setSoundEnabled(st.sound);
  }

  decor(): string[] {
    return this.data.owned.filter((id) => id.startsWith('decor-') && this.data.equipped[id] !== 'off');
  }
}
