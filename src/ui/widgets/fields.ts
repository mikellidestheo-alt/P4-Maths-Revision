import { h } from '../dom';
import type { Answer, FieldsInteraction, Interaction } from '../../engine/types';
import type { Widget, WidgetCtx } from './types';
import { renderVisual } from '../visuals';
import { play } from '../../game/audio';

export function fieldsWidget(it: FieldsInteraction, ctx: WidgetCtx): Widget {
  const values: Record<string, string> = {};
  const toggles: HTMLElement[] = [];
  const fieldEls: HTMLButtonElement[] = [];
  let locked = false;
  const row = h('div', { class: `fields ${it.layout === 'markers' ? 'fields-markers' : 'fields-inline'}` });
  let line = h('div', { class: 'fields-line' });
  row.appendChild(line);
  for (const t of it.tokens) {
    if (typeof t === 'string') {
      line.appendChild(h('span', { class: it.layout === 'markers' ? 'marker' : 'tok' }, t));
    } else if ('br' in t) {
      line = h('div', { class: 'fields-line' });
      row.appendChild(line);
    } else if (t.kind === 'toggle') {
      values[t.id] = '';
      const group = h('div', { class: 'toggle', role: 'radiogroup', 'aria-label': t.label ?? 'choose' });
      for (const o of t.options) {
        const b = h('button', { type: 'button', class: 'toggle-btn', role: 'radio', 'aria-checked': 'false', 'data-toggle-id': t.id, 'data-value': o.value }, o.label);
        b.addEventListener('click', () => {
          if (locked) return;
          values[t.id] = o.value;
          group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
          play('tap');
          ctx.onChange();
        });
        group.appendChild(b);
      }
      toggles.push(group);
      line.appendChild(group);
    } else {
      values[t.id] = '';
      const disp = h('span', { class: 'field-text' }, '');
      const b = h('button', {
        type: 'button',
        class: `field ${t.kind === 'time' ? 'field-time' : ''} ${t.kind === 'number' && t.wide ? 'field-wide' : ''} ${it.layout === 'markers' ? 'marker marker-blank' : ''}`,
        'data-field-id': t.id,
        'aria-label': t.label ?? 'answer box',
        role: 'textbox',
        'aria-readonly': 'true',
      }, disp);
      const target = {
        id: t.id,
        colon: t.kind === 'time',
        decimal: t.kind === 'number' && !!t.decimal,
        maxLen: t.kind === 'time' ? 5 : 9,
        get: () => values[t.id],
        set: (v: string) => {
          values[t.id] = v;
          disp.textContent = v;
          b.classList.toggle('filled', v !== '');
        },
        focus: () => b.classList.add('active'),
        blur: () => b.classList.remove('active'),
      };
      ctx.pad.register(target);
      b.addEventListener('click', () => {
        if (locked) return;
        ctx.pad.activate(target);
      });
      fieldEls.push(b);
      line.appendChild(b);
    }
  }
  const el = h('div', { class: 'widget widget-fields' }, it.visual ? renderVisual(it.visual) : null, row);
  setTimeout(() => ctx.pad.activateFirst(), 0);
  return {
    el,
    usesPad: fieldEls.length > 0,
    getAnswer: () => ({ ...values }),
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      if (l) ctx.pad.activate(null);
    },
  };
}

export function choiceWidget(it: Extract<Interaction, { type: 'choice' }>, ctx: WidgetCtx): Widget {
  let chosen = '';
  let locked = false;
  const opts = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'choices' });
  for (const o of it.options) {
    const b = h('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': 'false', 'data-choice': o.id }, o.visual ? renderVisual(o.visual) : null, h('span', {}, o.label));
    b.addEventListener('click', () => {
      if (locked) return;
      chosen = o.id;
      opts.querySelectorAll('.choice').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      play('tap');
      ctx.onChange();
    });
    opts.appendChild(b);
  }
  const el = h('div', { class: 'widget widget-choice' }, it.visual ? renderVisual(it.visual) : null, opts);
  return {
    el,
    usesPad: false,
    getAnswer: () => chosen as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
    },
    reveal(exp) {
      opts.querySelector(`[data-choice="${exp}"]`)?.classList.add('reveal');
    },
  };
}
