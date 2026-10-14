import { h } from './dom';
import type { App } from './app';
import { GAME } from '../config/game';
import { play } from '../game/audio';

/**
 * "Unlock All" (title screen): asks for the passcode on a big-button keypad, then opens every night.
 * The code lives in GAME.unlockCode.
 */
export function unlockAllButton(app: App, onUnlocked: () => void): HTMLElement {
  const b = h('button', { type: 'button', class: 'btn btn-small btn-unlock', 'data-action': 'unlock-all' }, '🔓 Unlock All');
  b.addEventListener('click', () => passcodeDialog(app, onUnlocked, b));
  return b;
}

function passcodeDialog(app: App, onUnlocked: () => void, opener: HTMLElement) {
  const len = GAME.unlockCode.length;
  let entry = '';
  const dots = h('div', { class: 'pass-dots', 'aria-hidden': 'true' });
  const status = h('p', { class: 'pass-status', role: 'status', 'aria-live': 'polite' }, 'Type the passcode.');
  const show = () => {
    dots.replaceChildren(...Array.from({ length: len }, (_, i) => h('span', { class: `pass-dot${i < entry.length ? ' on' : ''}` })));
  };
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Unlock all nights', 'data-dialog': 'unlock' });
  const close = () => {
    box.remove();
    opener.focus({ preventScroll: true });
  };
  const check = () => {
    if (entry === GAME.unlockCode) {
      app.data.flags.allUnlocked = true;
      app.save();
      play('rescue');
      box.remove();
      onUnlocked();
      return;
    }
    play('retry');
    entry = '';
    status.textContent = 'That’s not the code. Try again.';
    card.classList.remove('pass-wrong');
    void card.offsetWidth; // restart the wobble
    card.classList.add('pass-wrong');
    show();
  };
  const press = (k: string) => {
    if (k === 'del') entry = entry.slice(0, -1);
    else if (entry.length < len) entry += k;
    show();
    status.textContent = entry.length ? `${entry.length} of ${len}` : 'Type the passcode.';
    if (entry.length === len) setTimeout(check, 120);
  };
  const keys = h('div', { class: 'pass-keys' },
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0'].map((k) => {
      const key = h('button', { type: 'button', class: `key${k === 'del' ? ' key-back' : ''}`, 'data-pass-key': k, 'aria-label': k === 'del' ? 'Delete' : k }, k === 'del' ? '⌫' : k);
      key.addEventListener('click', () => press(k));
      return key;
    }));
  const cancel = h('button', { type: 'button', class: 'btn', 'data-action': 'unlock-cancel' }, 'Cancel');
  cancel.addEventListener('click', close);
  const card = h('div', { class: 'modal-card pass-card' },
    h('h2', {}, '🔓 Unlock all nights'),
    h('p', {}, 'Grown-ups: type the passcode to open every night.'),
    dots, status, keys,
    h('div', { class: 'modal-buttons' }, cancel));
  box.appendChild(card);
  box.addEventListener('keydown', (e) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  show();
  document.body.appendChild(box);
  keys.querySelector<HTMLButtonElement>('button')!.focus();
}
