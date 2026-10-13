/**
 * Custom on-screen number pad. Inputs are never real <input>s on the question screen, so the phone's
 * keyboard never opens and can't cover the question. A physical keyboard also works (laptops).
 */
import { h } from './dom';
import { play } from '../game/audio';

export interface PadTarget {
  id: string;
  colon?: boolean;
  decimal?: boolean;
  maxLen: number;
  get(): string;
  set(v: string): void;
  focus(): void;
  blur(): void;
  /** after typing a full value (e.g. column digit) move on automatically */
  autoAdvance?: boolean;
}

export class PadController {
  targets: PadTarget[] = [];
  active: PadTarget | null = null;
  onSubmit: () => void = () => {};
  onChange: () => void = () => {};
  padEl: HTMLElement | null = null;
  enabled = true;

  register(t: PadTarget) {
    this.targets.push(t);
  }

  clearTargets() {
    this.targets = [];
    this.active = null;
    this.refreshKeys();
  }

  activate(t: PadTarget | null) {
    if (this.active && this.active !== t) this.active.blur();
    this.active = t;
    t?.focus();
    this.refreshKeys();
  }

  activateFirst() {
    const empty = this.targets.find((t) => t.get() === '');
    this.activate(empty ?? this.targets[0] ?? null);
  }

  next(dir = 1): boolean {
    if (!this.targets.length) return false;
    const i = this.active ? this.targets.indexOf(this.active) : -1;
    const j = i + dir;
    if (j < 0 || j >= this.targets.length) return false;
    this.activate(this.targets[j]);
    return true;
  }

  press(key: string) {
    if (!this.enabled) return;
    const t = this.active;
    if (key === 'enter') {
      this.onSubmit();
      return;
    }
    if (!t) return;
    const v = t.get();
    if (key === 'back') {
      t.set(v.slice(0, -1));
    } else if (key === ':' && t.colon) {
      if (!v.includes(':') && v.length > 0) t.set(v + ':');
    } else if (key === '.' && (t.decimal || t.colon)) {
      if (t.colon) {
        if (!v.includes(':') && v.length > 0) t.set(v + ':');
      } else if (!v.includes('.')) t.set((v || '0') + '.');
    } else if (/^\d$/.test(key)) {
      if (v.length < t.maxLen) t.set(v + key);
      else if (t.maxLen === 1) t.set(key);
      if (t.autoAdvance && t.get().length >= t.maxLen) this.next(1);
    } else return;
    play('tap');
    this.onChange();
  }

  refreshKeys() {
    if (!this.padEl) return;
    const t = this.active;
    const extra = this.padEl.querySelector<HTMLButtonElement>('[data-key-extra]');
    if (extra) {
      if (t?.colon) {
        extra.textContent = ':';
        extra.dataset.key = ':';
        extra.disabled = false;
        extra.setAttribute('aria-label', 'colon');
      } else if (t?.decimal) {
        extra.textContent = '.';
        extra.dataset.key = '.';
        extra.disabled = false;
        extra.setAttribute('aria-label', 'decimal point');
      } else {
        extra.textContent = '';
        extra.dataset.key = 'none';
        extra.disabled = true;
        extra.setAttribute('aria-label', 'not needed');
      }
    }
  }

  /** Physical keyboard support. Returns true if handled. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key;
    if (/^\d$/.test(k)) this.press(k);
    else if (k === 'Backspace') this.press('back');
    else if (k === ':' || k === '.' || k === ',') {
      if (k === ',') return true; // ignore typed commas: "1,000" and "1000" are the same
      this.press(k);
    } else if (k === 'Enter') {
      // let focused buttons (e.g. Next) handle Enter themselves
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae.tagName === 'BUTTON' && !ae.classList.contains('field') && !ae.closest('.numpad')) return false;
      this.press('enter');
    } else if (k === 'Tab' && this.targets.length > 1) {
      if (!this.next(e.shiftKey ? -1 : 1)) return false;
    } else if ((k === 'ArrowRight' || k === 'ArrowLeft') && this.targets.length > 1 && this.active) {
      this.next(k === 'ArrowRight' ? 1 : -1);
    } else return false;
    e.preventDefault();
    return true;
  }
}

export function renderNumpad(pad: PadController): HTMLElement {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'extra', '0', 'back'];
  const el = h('div', { class: 'numpad', role: 'group', 'aria-label': 'Number pad' },
    ...keys.map((k) => {
      if (k === 'extra') return h('button', { class: 'key key-extra', type: 'button', 'data-key-extra': '1', 'data-key': 'none', disabled: true, 'aria-label': 'not needed' }, '');
      if (k === 'back') return h('button', { class: 'key key-back', type: 'button', 'data-key': 'back', 'aria-label': 'Delete' }, '⌫');
      return h('button', { class: 'key', type: 'button', 'data-key': k }, k);
    }),
  );
  // pointerdown so fast tapping feels instant; click fallback for keyboards / screen readers
  el.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    e.preventDefault();
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 120);
    pad.press(b.dataset.key!);
  });
  el.addEventListener('click', (e) => {
    // pointerdown already handled real taps; this catches keyboard "click" (Enter/Space on a focused key)
    if ((e as PointerEvent).detail !== 0) return;
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.disabled) pad.press(b.dataset.key!);
  });
  pad.padEl = el;
  pad.refreshKeys();
  return el;
}
