import { h } from '../dom';
import type { Answer, Interaction } from '../../engine/types';
import type { Widget, WidgetCtx } from './types';
import { renderVisual } from '../visuals';
import { makeDraggable } from './drag';
import { play } from '../../game/audio';

/** Sort cards into groups: drag a card into a group, or tap a card and then tap a group. */
export function binsWidget(it: Extract<Interaction, { type: 'bins' }>, ctx: WidgetCtx): Widget {
  const placed: Record<string, string> = {};
  let selected: string | null = null;
  let locked = false;
  const tray = h('div', { class: 'bin-tray', 'data-bin': '__tray', 'aria-label': 'cards to sort' });
  const binEls = it.bins.map((b) => {
    const body = h('div', { class: 'bin-body' });
    const el = h('div', { class: 'bin', 'data-bin': b.id, role: 'button', tabindex: '0', 'aria-label': `${b.label} group` }, h('div', { class: 'bin-label' }, b.label), body);
    el.addEventListener('click', (e) => {
      if (locked) return;
      if ((e.target as HTMLElement).closest('.bin-item')) return;
      if (selected) put(selected, b.id);
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && selected) {
        e.preventDefault();
        put(selected, b.id);
      }
    });
    return { id: b.id, el, body };
  });
  const itemEls = new Map<string, HTMLElement>();
  for (const item of it.items) {
    const card = h('div', { class: 'bin-item', 'data-bin-item': item.id, role: 'button', tabindex: '0', 'aria-pressed': 'false' },
      item.visual ? renderVisual(item.visual) : null, h('span', {}, item.label));
    makeDraggable(card, {
      dropSelector: '[data-bin]',
      onDrop(target) {
        if (locked || !target) return;
        const id = target.dataset.bin!;
        if (id === '__tray') unplace(item.id);
        else put(item.id, id);
      },
      onTap() {
        if (locked) return;
        selected = selected === item.id ? null : item.id;
        itemEls.forEach((el, id) => {
          el.classList.toggle('selected', id === selected);
          el.setAttribute('aria-pressed', String(id === selected));
        });
        play('tap');
      },
    });
    itemEls.set(item.id, card);
    tray.appendChild(card);
  }
  function put(itemId: string, binId: string) {
    placed[itemId] = binId;
    const card = itemEls.get(itemId)!;
    binEls.find((b) => b.id === binId)!.body.appendChild(card);
    selected = null;
    itemEls.forEach((el) => {
      el.classList.remove('selected');
      el.setAttribute('aria-pressed', 'false');
    });
    play('place');
    ctx.onChange();
  }
  function unplace(itemId: string) {
    delete placed[itemId];
    tray.appendChild(itemEls.get(itemId)!);
    ctx.onChange();
  }
  const el = h('div', { class: 'widget widget-bins' },
    tray,
    h('div', { class: `bins bins-${it.bins.length}` }, ...binEls.map((b) => b.el)),
    h('p', { class: 'small-help' }, 'Drag each card into a group — or tap a card, then tap a group.'),
  );
  return {
    el,
    usesPad: false,
    getAnswer: () => ({ ...placed }) as Answer,
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      itemEls.forEach((c) => c.setAttribute('aria-disabled', String(l)));
    },
    reveal(exp) {
      const r = exp as Record<string, string>;
      for (const [itemId, binId] of Object.entries(r)) {
        const card = itemEls.get(itemId)!;
        binEls.find((b) => b.id === binId)!.body.appendChild(card);
        card.classList.add('reveal');
      }
    },
  };
}
