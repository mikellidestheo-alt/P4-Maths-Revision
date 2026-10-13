import { h } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import { PLACE_SHORT, fmt } from '../../engine/format';
import type { Widget, WidgetCtx } from './types';
import { makeDraggable } from './drag';
import { play } from '../../game/audio';

/** Build a number by dragging (or tapping) digit tiles into a place-value chart. */
export function placeValueWidget(it: Extract<Interaction, { type: 'placeValue' }>, ctx: WidgetCtx): Widget {
  const n = it.columns;
  const slots: (string | null)[] = Array(n).fill(null);
  let selected: string | null = null;
  let locked = false;

  const slotEls = slots.map((_, i) => {
    const place = n - 1 - i;
    const b = h('button', { type: 'button', class: 'pv-slot', 'data-place': String(place), 'aria-label': `${PLACE_SHORT[place]} column, empty` }, '');
    b.addEventListener('click', () => {
      if (locked) return;
      if (selected !== null) setSlot(i, selected);
      else if (slots[i] !== null) setSlot(i, null);
    });
    return b;
  });

  function setSlot(i: number, v: string | null) {
    slots[i] = v;
    const place = n - 1 - i;
    slotEls[i].textContent = v ?? '';
    slotEls[i].classList.toggle('filled', v !== null);
    slotEls[i].setAttribute('aria-label', `${PLACE_SHORT[place]} column, ${v ?? 'empty'}`);
    play('place');
    ctx.onChange();
  }

  const tileEls = '0123456789'.split('').map((d) => {
    const t = h('div', { class: 'tile', role: 'button', tabindex: '0', 'data-tile': d, 'aria-label': `digit ${d}`, 'aria-pressed': 'false' }, d);
    makeDraggable(t, {
      dropSelector: '.pv-slot',
      onDrop(target) {
        if (locked || !target) return;
        const i = slotEls.indexOf(target as HTMLButtonElement);
        if (i >= 0) setSlot(i, d);
      },
      onTap() {
        if (locked) return;
        selected = selected === d ? null : d;
        tileEls.forEach((x) => {
          x.classList.toggle('selected', x.dataset.tile === selected);
          x.setAttribute('aria-pressed', String(x.dataset.tile === selected));
        });
        play('tap');
      },
    });
    return t;
  });

  const clearBtn = h('button', { type: 'button', class: 'btn-small', 'data-action': 'pv-clear' }, 'Clear');
  clearBtn.addEventListener('click', () => {
    if (locked) return;
    slots.forEach((_, i) => setSlot(i, null));
  });

  const el = h('div', { class: 'widget widget-pv' },
    h('div', { class: 'pv-chart', style: { gridTemplateColumns: `repeat(${n}, 1fr)` } },
      ...slots.map((_, i) => h('div', { class: 'pv-head' }, PLACE_SHORT[n - 1 - i])),
      ...slotEls),
    h('p', { class: 'small-help' }, 'Drag a digit into a column — or tap a digit, then tap a column. Tap a column to empty it.'),
    h('div', { class: 'tiles' }, ...tileEls),
    h('div', { class: 'row-end' }, clearBtn),
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => slots.map((v) => v ?? '_').join('') as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      tileEls.forEach((t) => t.setAttribute('aria-disabled', String(l)));
    },
    reveal(exp) {
      const s = String(exp);
      slotEls.forEach((b, i) => {
        b.textContent = s[i] === '_' ? '' : s[i];
        b.classList.add('reveal');
      });
    },
  };
}

/** Slide all the digits left (×10) or right (÷10) across a place-value chart. */
export function slideWidget(it: Extract<Interaction, { type: 'slide' }>, ctx: WidgetCtx): Widget {
  const C = it.columns;
  const digits = String(it.start).split('');
  const len = digits.length;
  let shift = 0;
  let locked = false;
  const places = (): Map<number, string> => {
    const m = new Map<number, string>();
    digits.forEach((d, i) => m.set(len - 1 - i + shift, d));
    return m;
  };
  const value = (): string => {
    const m = places();
    const minP = Math.min(...m.keys()), maxP = Math.max(...m.keys());
    let sInt = '', sDec = '';
    for (let p = maxP; p >= Math.min(0, minP); p--) {
      const d = m.get(p) ?? '0';
      if (p >= 0) sInt += d;
      else sDec += d;
    }
    sInt = sInt.replace(/^0+(?=\d)/, '') || '0';
    sDec = sDec.replace(/0+$/, '');
    return sDec ? `${sInt}.${sDec}` : sInt;
  };
  const cols: number[] = [];
  for (let p = C - 1; p >= -2; p--) cols.push(p);
  const heads = cols.map((p) => h('div', { class: `pv-head ${p < 0 ? 'pv-dec' : ''}` }, p >= 0 ? PLACE_SHORT[p] : p === -1 ? '0.1' : '0.01'));
  const cells = cols.map((p) => h('div', { class: `pv-cell ${p < 0 ? 'pv-dec' : ''}`, 'data-place': String(p) }, ''));
  const readout = h('div', { class: 'slide-readout', 'aria-live': 'polite' }, '');
  const left = h('button', { type: 'button', class: 'btn-slide', 'data-slide': 'left', 'aria-label': 'Move digits left: multiply by 10' }, '⟵ × 10');
  const right = h('button', { type: 'button', class: 'btn-slide', 'data-slide': 'right', 'aria-label': 'Move digits right: divide by 10' }, '÷ 10 ⟶');
  const reset = h('button', { type: 'button', class: 'btn-small', 'data-slide': 'reset' }, 'Start again');
  function render() {
    const m = places();
    const minP = Math.min(...m.keys());
    const maxP = Math.max(...m.keys());
    cells.forEach((c, i) => {
      const p = cols[i];
      const d = m.get(p);
      let txt = d ?? '';
      let ph = false;
      if (d === undefined && p >= 0 && p < minP && p <= maxP) {
        txt = '0';
        ph = true;
      }
      c.textContent = txt;
      c.classList.toggle('placeholder', ph);
      c.classList.toggle('filled', txt !== '');
    });
    left.disabled = locked || maxP + 1 > C - 1;
    right.disabled = locked || minP - 1 < -2;
    const v = value();
    readout.textContent = `Number: ${v.includes('.') ? v : fmt(Number(v))}`;
  }
  left.addEventListener('click', () => {
    shift++;
    play('place');
    render();
    ctx.onChange();
  });
  right.addEventListener('click', () => {
    shift--;
    play('place');
    render();
    ctx.onChange();
  });
  reset.addEventListener('click', () => {
    if (locked) return;
    shift = 0;
    render();
    ctx.onChange();
  });
  render();
  const el = h('div', { class: 'widget widget-slide' },
    h('div', { class: 'pv-chart slide-chart', style: { gridTemplateColumns: `repeat(${cols.length}, 1fr)` } }, ...heads, ...cells),
    readout,
    h('div', { class: 'slide-buttons' }, left, right),
    h('div', { class: 'row-end' }, reset),
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => value() as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      render();
    },
  };
}
