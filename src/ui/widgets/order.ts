import { h } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import type { Widget, WidgetCtx } from './types';
import { play } from '../../game/audio';

/** Put cards in order: drag them, tap two cards to swap them, or use the ▲▼ buttons. */
export function orderWidget(it: Extract<Interaction, { type: 'order' }>, ctx: WidgetCtx): Widget {
  let order = it.items.map((x) => x.id);
  const label = new Map(it.items.map((x) => [x.id, x.label]));
  let selected: string | null = null;
  let locked = false;
  const list = h('ol', { class: 'order-list', 'aria-label': it.direction === 'asc' ? 'smallest at the top' : 'largest at the top' });
  const indicator = h('div', { class: 'order-indicator' });

  function render() {
    list.innerHTML = '';
    order.forEach((id, i) => {
      const up = h('button', { type: 'button', class: 'order-arrow', 'data-order-up': id, 'aria-label': `move ${label.get(id)} up`, disabled: i === 0 || locked }, '▲');
      const down = h('button', { type: 'button', class: 'order-arrow', 'data-order-down': id, 'aria-label': `move ${label.get(id)} down`, disabled: i === order.length - 1 || locked }, '▼');
      up.addEventListener('click', () => move(id, i - 1));
      down.addEventListener('click', () => move(id, i + 1));
      const card = h('div', { class: `order-card ${selected === id ? 'selected' : ''}`, 'data-order-id': id, role: 'button', tabindex: '0', 'aria-pressed': String(selected === id) },
        h('span', { class: 'order-grip', 'aria-hidden': 'true' }, '⋮⋮'),
        h('span', { class: 'order-label' }, label.get(id)!),
      );
      attachDrag(card, id);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tap(id);
        }
      });
      list.appendChild(h('li', { class: 'order-item' }, card, h('div', { class: 'order-arrows' }, up, down)));
    });
  }

  function move(id: string, to: number) {
    if (locked) return;
    const from = order.indexOf(id);
    if (to < 0 || to >= order.length || from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    selected = null;
    play('place');
    render();
    ctx.onChange();
  }

  function tap(id: string) {
    if (locked) return;
    if (selected === null) selected = id;
    else if (selected === id) selected = null;
    else {
      const a = order.indexOf(selected), b = order.indexOf(id);
      [order[a], order[b]] = [order[b], order[a]];
      selected = null;
      play('place');
      ctx.onChange();
    }
    render();
  }

  function attachDrag(card: HTMLElement, id: string) {
    card.style.touchAction = 'none';
    card.addEventListener('pointerdown', (down: PointerEvent) => {
      if (locked) return;
      if (down.button !== 0 && down.pointerType === 'mouse') return;
      down.preventDefault();
      const startY = down.clientY, startX = down.clientX;
      let dragging = false;
      try {
        card.setPointerCapture(down.pointerId);
      } catch {
        /* ignore */
      }
      const targetIndex = (y: number) => {
        const items = [...list.children] as HTMLElement[];
        let idx = items.length;
        for (let i = 0; i < items.length; i++) {
          const r = items[i].getBoundingClientRect();
          if (y < r.top + r.height / 2) {
            idx = i;
            break;
          }
        }
        return idx;
      };
      const mv = (e: PointerEvent) => {
        if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
          dragging = true;
          card.classList.add('dragging');
          list.appendChild(indicator);
        }
        if (dragging) {
          card.style.transform = `translateY(${e.clientY - startY}px)`;
          const idx = targetIndex(e.clientY);
          const items = [...list.querySelectorAll('.order-item')] as HTMLElement[];
          const ref = items[idx];
          const lr = list.getBoundingClientRect();
          const top = ref ? ref.getBoundingClientRect().top - lr.top - 3 : (items.length ? items[items.length - 1].getBoundingClientRect().bottom - lr.top + 1 : 0);
          indicator.style.top = `${top}px`;
        }
      };
      const up = (e: PointerEvent) => {
        card.removeEventListener('pointermove', mv);
        card.removeEventListener('pointerup', up);
        card.removeEventListener('pointercancel', up);
        indicator.remove();
        card.style.transform = '';
        card.classList.remove('dragging');
        if (!dragging) {
          if (e.type !== 'pointercancel') tap(id);
          return;
        }
        let idx = targetIndex(e.clientY);
        const from = order.indexOf(id);
        if (idx > from) idx--;
        move(id, Math.max(0, Math.min(order.length - 1, idx)));
        render();
      };
      card.addEventListener('pointermove', mv);
      card.addEventListener('pointerup', up);
      card.addEventListener('pointercancel', up);
    });
  }

  render();
  const el = h('div', { class: 'widget widget-order' },
    h('div', { class: 'order-end' }, it.direction === 'asc' ? '⬆ smallest' : '⬆ largest'),
    h('div', { class: 'order-wrap' }, list),
    h('div', { class: 'order-end' }, it.direction === 'asc' ? '⬇ largest' : '⬇ smallest'),
    h('p', { class: 'small-help' }, 'Drag the boxes, tap two boxes to swap them, or use the arrows.'),
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => order.slice() as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      render();
    },
    reveal(exp) {
      order = (exp as string[]).slice();
      render();
      el.classList.add('revealed');
    },
  };
}
