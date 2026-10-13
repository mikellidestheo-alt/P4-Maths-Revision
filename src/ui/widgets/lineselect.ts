import { h, s } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import type { Widget, WidgetCtx } from './types';
import { linesSvg, shapeSvg } from '../visuals';
import { play } from '../../game/audio';

/** Tap lines to choose them (lines of symmetry, parallel planks…). Tap again to un-choose. */
export function lineSelectWidget(it: Extract<Interaction, { type: 'lineSelect' }>, ctx: WidgetCtx): Widget {
  const frame = it.visual.kind === 'lines' ? linesSvg(it.visual) : it.visual.kind === 'shape' ? shapeSvg({ ...it.visual, lines: [] }, { w: 280, h: 240 }, it.lines.flatMap((l) => [l.a, l.b])) : null;
  if (!frame) throw new Error('lineSelect needs a lines or shape visual');
  const chosen = new Set<string>();
  let locked = false;
  const lineEls = new Map<string, SVGGElement>();
  for (const l of it.lines) {
    const [x1, y1] = frame.map(l.a), [x2, y2] = frame.map(l.b);
    const g = s('g', { class: `pick-line ${it.visual.kind === 'shape' ? 'pick-fold' : 'pick-plank'}`, 'data-line': l.id, role: 'checkbox', 'aria-checked': 'false', tabindex: '0', 'aria-label': it.visual.kind === 'lines' ? `line ${l.id}` : 'fold line' },
      s('line', { x1, y1, x2, y2, class: 'pick-hit' }),
      s('line', { x1, y1, x2, y2, class: 'pick-vis' }));
    const toggle = () => {
      if (locked) return;
      if (chosen.has(l.id)) chosen.delete(l.id);
      else chosen.add(l.id);
      g.classList.toggle('chosen', chosen.has(l.id));
      g.setAttribute('aria-checked', String(chosen.has(l.id)));
      play('tap');
      ctx.onChange();
    };
    g.addEventListener('click', toggle);
    g.addEventListener('keydown', (e: Event) => {
      const k = (e as KeyboardEvent).key;
      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    lineEls.set(l.id, g);
    frame.svg.appendChild(g);
  }
  // planks: hide the drawn copies so the tappable ones are the only lines
  frame.svg.querySelectorAll('.plank').forEach((p) => p.remove());
  const el = h('div', { class: 'widget widget-lines' },
    h('div', { class: 'visual lines-wrap' }, frame.svg),
    h('p', { class: 'small-help' }, 'Tap a line to choose it (it turns gold with a tick). Tap again to un-choose.'),
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => [...chosen] as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
    },
    reveal(exp) {
      const want = new Set(exp as string[]);
      lineEls.forEach((g, id) => g.classList.toggle('reveal', want.has(id)));
    },
  };
}
