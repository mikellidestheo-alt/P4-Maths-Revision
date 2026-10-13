import { h } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import { PLACE_SHORT } from '../../engine/format';
import type { Widget, WidgetCtx } from './types';
import type { PadTarget } from '../numpad';

/**
 * Column method (stock book). Answer boxes fill from the ones on the right; small boxes are for
 * carried digits (adding) or exchanges (subtracting). Only the answer row is marked.
 */
export function columnWidget(it: Extract<Interaction, { type: 'column' }>, ctx: WidgetCtx): Widget {
  const ops = it.operands;
  const isAdd = it.op === '+';
  const width = Math.max(...ops.map((n) => String(n).length)) + (isAdd ? 1 : 0);
  const cols = width + 1; // first column holds the + / − sign
  const answer: string[] = Array(width).fill('');
  const helpers: string[] = Array(width).fill('');
  let locked = false;
  const grid = h('div', { class: `column-grid ${isAdd ? 'col-add' : 'col-sub'}`, style: { gridTemplateColumns: `minmax(28px, 0.7fr) repeat(${width}, minmax(34px, 1fr))` } });
  const cell = (cls: string, content: string | Node = '') => h('div', { class: `col-cell ${cls}` }, content);

  // header: place names
  grid.appendChild(cell('col-sign'));
  for (let i = 0; i < width; i++) grid.appendChild(cell('col-head', PLACE_SHORT[width - 1 - i] ?? ''));

  const answerTargets: PadTarget[] = [];
  const helperTargets: PadTarget[] = [];
  const answerEls: HTMLButtonElement[] = [];

  const box = (kind: 'ans' | 'help', i: number) => {
    const place = width - 1 - i;
    const b = h('button', {
      type: 'button',
      class: kind === 'ans' ? 'col-box field' : 'col-help field',
      [kind === 'ans' ? 'data-col-box' : 'data-col-help']: String(place),
      'aria-label': `${kind === 'ans' ? 'answer' : isAdd ? 'carry' : 'exchange'} box, ${PLACE_SHORT[place] ?? ''} column`,
      role: 'textbox',
      'aria-readonly': 'true',
    }, '');
    const store = kind === 'ans' ? answer : helpers;
    const t: PadTarget = {
      id: `${kind}${place}`,
      maxLen: kind === 'ans' ? 1 : isAdd ? 1 : 2,
      autoAdvance: kind === 'ans' && i > 0,
      get: () => store[i],
      set: (v) => {
        store[i] = v;
        b.textContent = v;
        b.classList.toggle('filled', v !== '');
      },
      focus: () => b.classList.add('active'),
      blur: () => b.classList.remove('active'),
    };
    b.addEventListener('click', () => {
      if (!locked) ctx.pad.activate(t);
    });
    if (kind === 'ans') answerEls[i] = b;
    return { b, t };
  };

  // subtraction: exchange boxes above the top number
  if (!isAdd) {
    grid.appendChild(cell('col-sign col-note', ''));
    const top = String(ops[0]).padStart(width, ' ');
    for (let i = 0; i < width; i++) {
      if (top[i] === ' ') grid.appendChild(cell(''));
      else {
        const { b, t } = box('help', i);
        helperTargets[i] = t;
        grid.appendChild(cell('col-helpcell', b));
      }
    }
  }
  // operand rows
  ops.forEach((n, r) => {
    grid.appendChild(cell('col-sign', r === ops.length - 1 ? (isAdd ? '+' : '−') : ''));
    const str = String(n).padStart(width, ' ');
    for (let i = 0; i < width; i++) grid.appendChild(cell('col-digit', str[i].trim()));
  });
  // addition: carry boxes
  if (isAdd) {
    grid.appendChild(cell('col-sign col-note', ''));
    for (let i = 0; i < width; i++) {
      if (i === width - 1) grid.appendChild(cell(''));
      else {
        const { b, t } = box('help', i);
        helperTargets[i] = t;
        grid.appendChild(cell('col-helpcell', b));
      }
    }
  }
  // line + answer row
  grid.appendChild(h('div', { class: 'col-line', style: { gridColumn: `1 / span ${cols}` } }));
  grid.appendChild(cell('col-sign', '='));
  for (let i = 0; i < width; i++) {
    const { b, t } = box('ans', i);
    answerTargets[i] = t;
    grid.appendChild(cell('col-anscell', b));
  }
  // answer boxes right → left, then helper boxes
  for (let i = width - 1; i >= 0; i--) ctx.pad.register(answerTargets[i]);
  for (let i = width - 1; i >= 0; i--) if (helperTargets[i]) ctx.pad.register(helperTargets[i]);
  setTimeout(() => ctx.pad.activate(answerTargets[width - 1]), 0);

  const el = h('div', { class: 'widget widget-column' },
    h('div', { class: 'column-wrap' }, grid),
    h('p', { class: 'small-help' }, isAdd ? 'Start with the ones on the right. Small boxes are for carried digits.' : 'Start with the ones on the right. Small boxes are for exchanging.'),
  );
  return {
    el,
    usesPad: true,
    getAnswer: () => answer.map((d) => d || '_').join('') as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      if (l) ctx.pad.activate(null);
    },
    reveal(exp) {
      const s = String(exp);
      answerEls.forEach((b, i) => {
        b.textContent = s[i] === '_' ? '' : s[i];
        b.classList.add('reveal');
      });
    },
  };
}
