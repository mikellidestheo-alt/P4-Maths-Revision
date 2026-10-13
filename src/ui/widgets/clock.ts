import { h, s, svgPoint, svgRoot } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import { clockFace as fmtClock } from '../../engine/format';
import type { Widget, WidgetCtx } from './types';
import { clockFace, handPath } from '../visuals';
import { play } from '../../game/audio';
import { T16 } from '../../config/difficulty';

/** Analogue clock: drag the hands (minute hand snaps to 5 minutes), or use the + / − buttons. */
export function clockWidget(it: Extract<Interaction, { type: 'clock' }>, ctx: WidgetCtx): Widget {
  const SNAP = T16.clockSnap;
  let mins = ((Math.round(it.start / SNAP) * SNAP) % 720 + 720) % 720;
  let locked = false;
  const svg = svgRoot('-115 -115 230 230', { class: 'clock-svg clock-interactive', role: 'group', 'aria-label': 'clock to set' });
  svg.appendChild(clockFace());
  const hourHand = s('g', { class: 'hand-group', 'data-hand': 'hour' }, s('path', { d: handPath(52, 12), class: 'hand hand-hour' }), s('circle', { cy: -46, r: 16, class: 'hand-knob hand-knob-hour' }));
  const minHand = s('g', { class: 'hand-group', 'data-hand': 'minute' }, s('path', { d: handPath(82, 7), class: 'hand hand-minute' }), s('circle', { cy: -78, r: 16, class: 'hand-knob hand-knob-minute' }));
  svg.append(hourHand, minHand, s('circle', { r: 6, class: 'clock-pin' }));

  function render() {
    hourHand.setAttribute('transform', `rotate(${(mins / 60) * 30})`);
    minHand.setAttribute('transform', `rotate(${(mins % 60) * 6})`);
    svg.setAttribute('aria-valuetext', fmtClock(mins));
  }
  function set(m: number) {
    mins = ((m % 720) + 720) % 720;
    render();
    ctx.onChange();
  }
  render();

  const angleAt = (e: PointerEvent) => {
    const p = svgPoint(svg, e.clientX, e.clientY);
    let a = (Math.atan2(p.x, -p.y) * 180) / Math.PI;
    if (a < 0) a += 360;
    return a;
  };

  function dragHand(g: SVGGElement, which: 'hour' | 'minute') {
    g.style.touchAction = 'none';
    g.addEventListener('pointerdown', (down: PointerEvent) => {
      if (locked) return;
      down.preventDefault();
      down.stopPropagation();
      try {
        (g as unknown as Element).setPointerCapture(down.pointerId);
      } catch {
        /* ignore */
      }
      g.classList.add('dragging');
      const move = (e: PointerEvent) => {
        const a = angleAt(e);
        if (which === 'minute') {
          const newMin = (Math.round(a / 6 / SNAP) * SNAP) % 60;
          const oldMin = mins % 60;
          let hour = Math.floor(mins / 60);
          if (oldMin >= 45 && newMin <= 15 && newMin < oldMin) hour++;
          else if (oldMin <= 15 && newMin >= 45 && newMin > oldMin) hour--;
          if (newMin !== oldMin || hour !== Math.floor(mins / 60)) {
            set(hour * 60 + newMin);
            play('tap');
          }
        } else {
          const hour = Math.floor(a / 30) % 12;
          if (hour !== Math.floor(mins / 60) % 12) {
            set(hour * 60 + (mins % 60));
            play('tap');
          }
        }
      };
      const up = () => {
        g.classList.remove('dragging');
        g.removeEventListener('pointermove', move as EventListener);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
      };
      g.addEventListener('pointermove', move as EventListener);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
  }
  dragHand(minHand, 'minute');
  dragHand(hourHand, 'hour');

  const btn = (label: string, aria: string, key: string, delta: number) => {
    const b = h('button', { type: 'button', class: 'clock-btn', 'data-clock': key, 'aria-label': aria }, label);
    b.addEventListener('click', () => {
      if (locked) return;
      set(mins + delta);
      play('tap');
    });
    return b;
  };
  const controls = h('div', { class: 'clock-controls' },
    h('div', { class: 'clock-ctl' }, h('span', {}, 'Hour hand'), btn('−', 'hour back', 'h-', -60), btn('+', 'hour forward', 'h+', 60)),
    h('div', { class: 'clock-ctl' }, h('span', {}, 'Minutes'), btn('−5', 'five minutes back', 'm-', -SNAP), btn('+5', 'five minutes forward', 'm+', SNAP)),
  );
  const el = h('div', { class: 'widget widget-clock' },
    h('div', { class: 'visual clock-wrap' }, svg),
    h('p', { class: 'small-help' }, 'Drag the long minute hand and the short hour hand — or use the buttons.'),
    controls,
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => fmtClock(mins) as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      controls.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = l));
    },
  };
}
