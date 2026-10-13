import { h } from '../dom';
import type { App, Screen } from '../app';
import { nav } from '../nav';
import { modal } from './game';
import { NIGHTS } from '../../game/nights';
import { allowanceLeft, isFinished, isUnlocked, refreshDaily, topicReport } from '../../game/progress';
import { exportCode, importCode, type Pacing, type Spook } from '../../storage/save';

declare const __BUILD_ID__: string;

function radioCards<T extends string | number>(name: string, opts: { v: T; t: string; d?: string }[], value: T, onPick: (v: T) => void) {
  const g = h('div', { class: 'radio-cards', role: 'radiogroup', 'aria-label': name });
  for (const o of opts) {
    const b = h('button', { type: 'button', class: 'radio-card', role: 'radio', 'aria-checked': String(o.v === value), [`data-${name}`]: String(o.v) },
      h('strong', {}, o.t), o.d ? h('span', {}, o.d) : null);
    b.addEventListener('click', () => {
      g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      onPick(o.v);
    });
    g.appendChild(b);
  }
  return g;
}

export const PACING_OPTS: { v: Pacing; t: string; d: string }[] = [
  { v: 3, t: 'Weekend plan: 3 nights a day', d: 'Recommended — all six nights over Saturday and Sunday.' },
  { v: 2, t: '2 nights a day', d: '' },
  { v: 1, t: '1 night a day', d: '' },
  { v: 0, t: 'No limit', d: '' },
];
export const SPOOK_OPTS: { v: Spook; t: string; d: string }[] = [
  { v: 'cosy', t: 'Cosy', d: 'Warm and gentle (default).' },
  { v: 'mild', t: 'Mild', d: 'A bit more mist and a few glowing eyes.' },
  { v: 'spooky', t: 'Spooky', d: 'Mistier, more friendly eyes. Never scary.' },
];

/* ---------------- first run (grown-up setup) ---------------- */

export function firstRunScreen(app: App): Screen {
  const d = app.data;
  let pacing = d.settings.pacing;
  let spook = d.settings.spook;
  const name = h('input', { type: 'text', id: 'nick', maxlength: '20', autocomplete: 'off', placeholder: 'e.g. Star Camper', value: d.nickname, 'aria-describedby': 'nick-help' });
  const pin = h('input', { type: 'password', id: 'pin', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', pattern: '[0-9]*', placeholder: '4 digits (optional)' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const go = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'setup-continue' }, 'Continue');
  go.addEventListener('click', () => {
    const p = pin.value.trim();
    if (p && !/^\d{4}$/.test(p)) {
      err.textContent = 'The PIN needs to be exactly 4 digits (or leave it empty).';
      pin.focus();
      return;
    }
    d.nickname = name.value.trim().slice(0, 20);
    d.pin = p || null;
    d.settings.pacing = pacing;
    d.settings.spook = spook;
    d.setupDone = true;
    app.save();
    app.applySettings();
    nav.home(app);
  });
  const el = h('div', { class: 'screen chrome first-run', 'data-screen': 'first-run' },
    h('main', { class: 'chrome-main' },
      h('h1', {}, 'Hello, grown-up! 👋'),
      h('p', {}, '“6 Nights at Camp” is a maths revision game for Units 1 and 2. There are six nights of about 15–20 minutes. Progress stays on this device — nothing is sent anywhere.'),
      h('p', { class: 'small-help' }, 'Everything below is optional. Just press Continue to use the recommended settings.'),
      h('label', { for: 'nick' }, 'Camper’s nickname'), name,
      h('p', { id: 'nick-help', class: 'small-help' }, 'Only shown in the game, only stored on this device.'),
      h('label', { for: 'pin' }, 'Grown-up PIN (keeps the settings area child-proof)'), pin,
      h('h2', {}, 'How many nights per day?'),
      radioCards('pacing', PACING_OPTS, pacing, (v) => (pacing = v)),
      h('h2', {}, 'Spookiness'),
      radioCards('spook', SPOOK_OPTS, spook, (v) => (spook = v)),
      err,
      go));
  return { el, title: 'Welcome' };
}

/* ---------------- parent gate ---------------- */

export function parentGateScreen(app: App): Screen {
  const d = app.data;
  const back = () => nav.home(app);
  const main = h('main', { class: 'chrome-main gate' });
  const el = h('div', { class: 'screen chrome', 'data-screen': 'gate' },
    h('header', { class: 'chrome-top' }, h('button', { type: 'button', class: 'icon-btn', 'data-action': 'back', 'aria-label': 'Back to the game' }, '⟵'), h('h1', {}, 'Grown-ups only')),
    main);
  el.querySelector('[data-action="back"]')!.addEventListener('click', back);
  if (d.pin) {
    let entry = '';
    const disp = h('div', { class: 'pin-display', 'aria-live': 'polite', 'data-pin-display': '1' }, '');
    const msg = h('p', { class: 'form-error', role: 'alert' });
    const show = () => (disp.textContent = '●'.repeat(entry.length) + '○'.repeat(4 - entry.length));
    show();
    const press = (k: string) => {
      if (k === 'back') entry = entry.slice(0, -1);
      else if (entry.length < 4) entry += k;
      show();
      if (entry.length === 4) {
        if (entry === d.pin) nav.parent(app);
        else {
          msg.textContent = 'That PIN isn’t right. Try again.';
          disp.classList.remove('shake');
          void disp.offsetWidth;
          disp.classList.add('shake');
          entry = '';
          setTimeout(show, 400);
        }
      }
    };
    const keys = h('div', { class: 'numpad pin-pad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k) => {
      if (!k) return h('span');
      const b = h('button', { type: 'button', class: 'key', 'data-pin-key': k, 'aria-label': k === 'back' ? 'Delete' : k }, k === 'back' ? '⌫' : k);
      b.addEventListener('click', () => press(k));
      return b;
    }));
    const forgot = h('button', { type: 'button', class: 'link-btn', 'data-action': 'forgot-pin' }, 'Forgot the PIN?');
    forgot.addEventListener('click', () => forgotPin(app, main));
    main.append(h('p', {}, 'Enter your 4-digit PIN.'), disp, msg, keys, forgot);
    return { el, title: 'Grown-ups', onBack: back, onKey: (e) => {
      if (/^\d$/.test(e.key)) { press(e.key); return true; }
      if (e.key === 'Backspace') { press('back'); return true; }
      return false;
    } };
  }
  // no PIN set: press-and-hold gate
  const hold = h('button', { type: 'button', class: 'btn btn-primary btn-big hold-btn', 'data-action': 'hold' }, h('span', { class: 'hold-fill' }), h('span', { class: 'hold-text' }, 'Press and hold for 3 seconds'));
  let timer: number | undefined;
  const start = (e: Event) => {
    e.preventDefault();
    hold.classList.add('holding');
    timer = window.setTimeout(() => nav.parent(app), 3000);
  };
  const stop = () => {
    hold.classList.remove('holding');
    window.clearTimeout(timer);
  };
  hold.addEventListener('pointerdown', start);
  hold.addEventListener('pointerup', stop);
  hold.addEventListener('pointerleave', stop);
  hold.addEventListener('pointercancel', stop);
  hold.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) start(e); });
  hold.addEventListener('keyup', stop);
  main.append(h('p', {}, 'No PIN has been set. Grown-ups: press and hold the button.'), hold, h('p', { class: 'small-help' }, 'You can set a PIN inside the grown-ups area.'));
  return { el, title: 'Grown-ups', onBack: back };
}

function forgotPin(app: App, main: HTMLElement) {
  const a = 120 + Math.floor(Math.random() * 800), b = 12 + Math.floor(Math.random() * 80);
  const input = h('input', { type: 'text', inputmode: 'numeric', id: 'gate-ans', autocomplete: 'off' });
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const ok = h('button', { type: 'button', class: 'btn btn-primary' }, 'Remove the PIN');
  ok.addEventListener('click', () => {
    if (Number(input.value.replace(/[\s,]/g, '')) === a * b) {
      app.data.pin = null;
      app.save();
      nav.parent(app);
    } else msg.textContent = 'Not quite — try again.';
  });
  main.innerHTML = '';
  main.append(h('p', {}, `To remove the PIN, answer this grown-up question: what is ${a} × ${b}?`), h('label', { for: 'gate-ans' }, 'Answer'), input, msg, ok);
  input.focus();
}

/* ---------------- parent area ---------------- */

export function parentScreen(app: App): Screen {
  const d = app.data;
  refreshDaily(d);
  const back = () => { app.applySettings(); nav.home(app); };
  const report = topicReport(d);
  const strong = report.filter((r) => r.status === 'strong');
  const shaky = report.filter((r) => r.status === 'shaky');
  const finished = NIGHTS.filter((n) => isFinished(d, n.n)).length;
  const stars = NIGHTS.reduce((t, n) => t + (d.nights[n.n]?.bestStars ?? 0), 0);
  const statusText = { strong: 'Strong', ok: 'OK', shaky: 'Worth practising', new: 'Not started' } as const;

  const table = h('table', { class: 'report' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Topic'), h('th', {}, 'First try'), h('th', {}, 'Within 2 tries'), h('th', {}, 'Questions'), h('th', {}, 'Status'))),
    h('tbody', {}, ...report.map((r) => h('tr', { 'data-topic-row': r.id },
      h('td', {}, `${r.id} ${r.title}`),
      h('td', {}, r.firstPct === null ? '—' : h('span', { class: 'bar' }, h('span', { class: 'bar-fill', style: { width: `${r.firstPct}%` } }), h('span', { class: 'bar-text' }, `${r.firstPct}%`))),
      h('td', {}, r.eventualPct === null ? '—' : `${r.eventualPct}%`),
      h('td', {}, String(r.attempts)),
      h('td', {}, h('span', { class: `chip chip-${r.status}` }, statusText[r.status]))))));

  const missedSection = h('div', { class: 'missed' }, ...report.filter((r) => r.missed.length).map((r) =>
    h('details', {}, h('summary', {}, `${r.id} ${r.title} — ${r.missed.length} to look at`),
      h('ul', {}, ...r.missed.map((m) => h('li', {}, h('span', {}, m.prompt), ' → ', h('strong', {}, m.answer), m.fixed ? h('span', { class: 'chip chip-strong' }, ' fixed later') : null))))));

  const checkins = d.checkins.slice(-12).reverse();

  // settings
  const set = <K extends keyof typeof d.settings>(k: K, v: (typeof d.settings)[K]) => {
    d.settings[k] = v;
    app.save();
    app.applySettings();
  };
  const motionOpts = [{ v: 'auto' as const, t: 'Follow device' }, { v: 'reduce' as const, t: 'Reduce motion' }, { v: 'full' as const, t: 'Full motion' }];
  const textOpts = [{ v: 'normal' as const, t: 'Normal text' }, { v: 'large' as const, t: 'Large text' }, { v: 'xl' as const, t: 'Extra large' }];
  const soundOpts = [{ v: 'on', t: 'Sound on' }, { v: 'off', t: 'Sound off' }];

  const nick = h('input', { type: 'text', id: 'p-nick', maxlength: '20', value: d.nickname, autocomplete: 'off' });
  nick.addEventListener('change', () => { d.nickname = nick.value.trim().slice(0, 20); app.save(); });
  const newPin = h('input', { type: 'password', id: 'p-pin', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', placeholder: d.pin ? '••••' : 'none set' });
  const pinMsg = h('p', { class: 'small-help', role: 'status' });
  const pinBtn = h('button', { type: 'button', class: 'btn btn-small' }, 'Save PIN');
  pinBtn.addEventListener('click', () => {
    const v = newPin.value.trim();
    if (v === '') { d.pin = null; pinMsg.textContent = 'PIN removed.'; }
    else if (/^\d{4}$/.test(v)) { d.pin = v; pinMsg.textContent = 'PIN saved.'; }
    else { pinMsg.textContent = 'The PIN must be 4 digits.'; return; }
    newPin.value = '';
    app.save();
  });

  // tools
  const unlockRow = h('div', { class: 'tool-row' }, ...NIGHTS.map((n) => {
    const unlocked = isUnlocked(d, n.n);
    const b = h('button', { type: 'button', class: 'btn btn-small', 'data-unlock': String(n.n), disabled: unlocked }, unlocked ? `Night ${n.n} ✓` : `Unlock Night ${n.n}`);
    b.addEventListener('click', () => {
      if (!d.unlockedByParent.includes(n.n)) d.unlockedByParent.push(n.n);
      for (let k = 2; k < n.n; k++) if (!d.unlockedByParent.includes(k)) d.unlockedByParent.push(k);
      app.save();
      app.show(parentScreen(app));
    });
    return b;
  }));
  const left = allowanceLeft(d);
  const resetDay = h('button', { type: 'button', class: 'btn btn-small', 'data-action': 'reset-day' }, 'Reset today’s nights');
  resetDay.addEventListener('click', () => {
    d.daily.newNightsFinished = 0;
    app.save();
    app.show(parentScreen(app));
  });
  const codeOut = h('textarea', { class: 'code-box', readonly: true, rows: '3', 'aria-label': 'Progress code', 'data-code-out': '1' });
  const copyBtn = h('button', { type: 'button', class: 'btn btn-small', 'data-action': 'make-code' }, 'Make progress code');
  const copyMsg = h('p', { class: 'small-help', role: 'status' });
  copyBtn.addEventListener('click', async () => {
    codeOut.value = exportCode(d);
    codeOut.select();
    try {
      await navigator.clipboard.writeText(codeOut.value);
      copyMsg.textContent = 'Copied! Paste it into the game on the other device.';
    } catch {
      copyMsg.textContent = 'Select the code and copy it.';
    }
  });
  const codeIn = h('textarea', { class: 'code-box', rows: '3', 'aria-label': 'Paste a progress code', placeholder: 'Paste a code starting CAMP1.', 'data-code-in': '1' });
  const loadBtn = h('button', { type: 'button', class: 'btn btn-small', 'data-action': 'load-code' }, 'Load progress code');
  const loadMsg = h('p', { class: 'small-help', role: 'status', 'data-load-msg': '1' });
  loadBtn.addEventListener('click', () => {
    const data = importCode(codeIn.value);
    if (!data) { loadMsg.textContent = 'That code doesn’t look right. Check it was copied completely.'; return; }
    modal(app, 'Replace the progress on this device with the progress from the code?', [
      { label: 'Yes, replace it', primary: true, act: () => {
        const pin = d.pin;
        app.store.replace({ ...data, pin, setupDone: true });
        app.applySettings();
        app.show(parentScreen(app));
      } },
      { label: 'Cancel', act: () => {} },
    ]);
  });
  const resetAll = h('button', { type: 'button', class: 'btn btn-small btn-danger', 'data-action': 'reset-all' }, 'Reset all progress');
  resetAll.addEventListener('click', () => {
    modal(app, 'Reset ALL progress? Nights, coins, shop items and the report will be cleared. Settings and PIN are kept.', [
      { label: 'Yes, reset everything', primary: true, act: () => {
        app.store.reset();
        app.seen.clear();
        app.applySettings();
        app.show(parentScreen(app));
      } },
      { label: 'Cancel', act: () => {} },
    ]);
  });
  const updateBtn = h('button', { type: 'button', class: 'btn btn-small', 'data-action': 'check-update' }, 'Check for an update');
  const updMsg = h('p', { class: 'small-help', role: 'status' });
  updateBtn.addEventListener('click', async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      updMsg.textContent = 'Checked. If there is a new version it will load next time the game opens (or tap “Refresh” when asked).';
    } catch {
      updMsg.textContent = 'Couldn’t check right now (offline?).';
    }
  });

  const el = h('div', { class: 'screen chrome parent', 'data-screen': 'parent' },
    h('header', { class: 'chrome-top' }, h('button', { type: 'button', class: 'icon-btn', 'data-action': 'back', 'aria-label': 'Back to the game' }, '⟵'), h('h1', {}, 'Grown-ups area')),
    h('main', { class: 'chrome-main' },
      h('section', {},
        h('h2', {}, 'Progress'),
        h('p', {}, `${d.nickname || 'Your camper'} has finished ${finished} of 6 nights (${stars} of 18 stars). Coins: ${d.coins}.`),
        h('p', {}, d.settings.pacing === 0 ? 'Pacing: no daily limit.' : `Pacing: ${d.settings.pacing} new night${d.settings.pacing === 1 ? '' : 's'} per day — ${left} left today.`),
        strong.length ? h('p', {}, h('strong', {}, 'Strengths: '), strong.map((r) => r.title).join(', '), '.') : null,
        shaky.length ? h('p', {}, h('strong', {}, 'Worth practising: '), shaky.map((r) => r.title).join(', '), '.') : h('p', {}, 'Nothing flagged as shaky yet.'),
        h('div', { class: 'table-scroll' }, table),
        h('p', { class: 'small-help' }, '“First try” = right first time. “Within 2 tries” includes fixing it after a hint.'),
      ),
      h('section', {}, h('h2', {}, 'Questions to practise offline'),
        missedSection.childElementCount ? missedSection : h('p', {}, 'No missed questions yet.')),
      h('section', {}, h('h2', {}, 'End-of-night check-ins'),
        checkins.length ? h('ul', {}, ...checkins.map((c) => h('li', {}, `Night ${c.night}: ${c.fun ? { boring: '😴 boring', good: '🙂 good', great: '🤩 great' }[c.fun] : '—'} · maths ${c.level ? { easy: 'too easy', right: 'just right', hard: 'too hard' }[c.level] : '—'}`))) : h('p', {}, 'None yet.'),
        h('p', { class: 'small-help' }, `Difficulty nudge from check-ins: ${d.nudge > 0 ? 'a little harder' : d.nudge < 0 ? 'a little easier' : 'normal'}.`)),
      h('section', {}, h('h2', {}, 'Settings'),
        h('h3', {}, 'Nights per day'), radioCards('pacing', PACING_OPTS, d.settings.pacing, (v) => set('pacing', v)),
        h('h3', {}, 'Spookiness'), radioCards('spook', SPOOK_OPTS, d.settings.spook, (v) => set('spook', v)),
        h('h3', {}, 'Sound'), radioCards('sound', soundOpts, d.settings.sound ? 'on' : 'off', (v) => set('sound', v === 'on')),
        h('h3', {}, 'Motion'), radioCards('motion', motionOpts, d.settings.motion, (v) => set('motion', v)),
        h('h3', {}, 'Text size'), radioCards('text', textOpts, d.settings.textSize, (v) => set('textSize', v)),
        h('label', { for: 'p-nick' }, 'Nickname'), nick,
        h('label', { for: 'p-pin' }, 'Change PIN (leave empty and save to remove it)'), h('div', { class: 'tool-row' }, newPin, pinBtn), pinMsg),
      h('section', {}, h('h2', {}, 'Tools'),
        h('h3', {}, 'Unlock a night'), h('p', { class: 'small-help' }, 'Normally each night opens when the one before is finished.'), unlockRow,
        h('h3', {}, 'Daily allowance'), h('p', {}, `New nights finished today: ${d.daily.newNightsFinished}.`), resetDay,
        h('h3', {}, 'Move progress to another device'), copyBtn, codeOut, copyMsg, codeIn, loadBtn, loadMsg,
        h('h3', {}, 'Start again'), resetAll),
      h('section', {}, h('h2', {}, 'About'),
        h('p', {}, `Version ${__BUILD_ID__}. ${app.store.persistent ? 'Progress is saved on this device only.' : '⚠️ This browser is not letting the game save progress (private browsing?).'}`),
        h('p', { class: 'small-help' }, 'No accounts, no ads, no tracking. Nothing leaves this device.'),
        updateBtn, updMsg),
    ));
  el.querySelector('[data-action="back"]')!.addEventListener('click', back);
  return { el, title: 'Grown-ups', onBack: back };
}
