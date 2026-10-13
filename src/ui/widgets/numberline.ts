import { h, s, svgPoint, svgRoot } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import { fmt } from '../../engine/format';
import type { Widget, WidgetCtx } from './types';
import { icon } from '../visuals';
import { play } from '../../game/audio';

/** Drag the lantern along a number line; it snaps to the labelled marks. Tap a mark to jump there. */
export function numberLineWidget(it: Extract<Interaction, { type: 'numberLine' }>, ctx: WidgetCtx): Widget {
  const W = 600, H = 170, x0 = 50, x1 = 550, y = 100;
  const ticks: number[] = [];
  for (let v = it.min; v <= it.max; v += it.tick) ticks.push(v);
  const xOf = (v: number) => x0 + ((v - it.min) / (it.max - it.min)) * (x1 - x0);
  let value = it.start;
  let locked = false;
  const svg = svgRoot(`0 0 ${W} ${H}`, { class: 'nl-svg', role: 'group', 'aria-label': 'number line' });
  svg.appendChild(s('line', { x1: x0 - 20, y1: y, x2: x1 + 20, y2: y, class: 'nl-line' }));
  // minor ticks (tenths of a step)
  for (let i = 0; i <= (ticks.length - 1) * 10; i++) {
    const x = x0 + (i / ((ticks.length - 1) * 10)) * (x1 - x0);
    svg.appendChild(s('line', { x1: x, y1: y - 6, x2: x, y2: y + 6, class: 'nl-minor' }));
  }
  ticks.forEach((v) => {
    const x = xOf(v);
    const g = s('g', { class: 'nl-tick', 'data-nl-tick': String(v), role: 'button', 'aria-label': fmt(v) });
    g.append(
      s('rect', { x: x - 34, y: y - 30, width: 68, height: 76, fill: 'transparent' }),
      s('line', { x1: x, y1: y - 16, x2: x, y2: y + 16, class: 'nl-major' }),
      s('text', { x, y: y + 42, class: 'nl-label', 'text-anchor': 'middle' }, fmt(v)),
    );
    g.addEventListener('click', () => {
      if (locked) return;
      setValue(v);
    });
    svg.appendChild(g);
  });
  if (it.flag !== undefined) {
    const fx = xOf(it.flag);
    svg.append(
      s('line', { x1: fx, y1: y - 4, x2: fx, y2: y - 52, class: 'nl-flagpole' }),
      s('path', { d: `M ${fx} ${y - 52} L ${fx + 26} ${y - 44} L ${fx} ${y - 36} Z`, class: 'nl-flag' }),
      s('text', { x: fx, y: y - 58, class: 'nl-flag-label', 'text-anchor': 'middle' }, it.label),
    );
  }
  const handle = s('g', { class: 'nl-handle', 'data-nl-handle': '1', tabindex: '0', role: 'slider', 'aria-label': 'lantern marker', 'aria-valuemin': String(it.min), 'aria-valuemax': String(it.max) });
  handle.append(s('circle', { r: 30, fill: 'transparent' }), icon('lantern', 0, -2, 18));
  svg.appendChild(handle);

  function place(x: number) {
    handle.setAttribute('transform', `translate(${x} ${y - 30})`);
  }
  function setValue(v: number) {
    value = v;
    place(xOf(v));
    handle.setAttribute('aria-valuenow', String(v));
    handle.setAttribute('aria-valuetext', fmt(v));
    play('place');
    ctx.onChange();
  }
  setValue(value);

  handle.addEventListener('pointerdown', (down: PointerEvent) => {
    if (locked) return;
    down.preventDefault();
    try {
      (handle as unknown as Element).setPointerCapture(down.pointerId);
    } catch {
      /* ignore */
    }
    const move = (e: PointerEvent) => {
      const p = svgPoint(svg, e.clientX, e.clientY);
      place(Math.max(x0, Math.min(x1, p.x)));
    };
    const up = (e: PointerEvent) => {
      handle.removeEventListener('pointermove', move as EventListener);
      handle.removeEventListener('pointerup', up as EventListener);
      handle.removeEventListener('pointercancel', up as EventListener);
      const p = svgPoint(svg, e.clientX, e.clientY);
      const raw = it.min + ((Math.max(x0, Math.min(x1, p.x)) - x0) / (x1 - x0)) * (it.max - it.min);
      const snapped = ticks.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best), ticks[0]);
      setValue(snapped);
    };
    handle.addEventListener('pointermove', move as EventListener);
    handle.addEventListener('pointerup', up as EventListener);
    handle.addEventListener('pointercancel', up as EventListener);
  });
  handle.addEventListener('keydown', (e: Event) => {
    const k = (e as KeyboardEvent).key;
    if (locked) return;
    const i = ticks.indexOf(value);
    if ((k === 'ArrowRight' || k === 'ArrowUp') && i < ticks.length - 1) setValue(ticks[i + 1]);
    else if ((k === 'ArrowLeft' || k === 'ArrowDown') && i > 0) setValue(ticks[i - 1]);
    else return;
    e.preventDefault();
  });

  const el = h('div', { class: 'widget widget-nl' },
    h('div', { class: 'nl-number' }, it.label),
    h('div', { class: 'visual nl-wrap' }, svg),
    h('p', { class: 'small-help' }, 'Drag the lantern, or tap a number on the line.'),
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => String(value) as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
    },
    reveal(exp) {
      const v = Number(exp);
      svg.querySelector(`[data-nl-tick="${v}"]`)?.classList.add('reveal');
    },
  };
}
