/**
 * Pointer-Events drag helper (touch + mouse + pen). A short press without moving counts as a tap,
 * so every draggable thing can also be used with "tap it, then tap where it goes".
 */
export interface DragOpts {
  dropSelector: string;
  onDrop(target: HTMLElement | null, ev: PointerEvent): void;
  onTap(): void;
  ghost?: boolean;
  onMove?(ev: PointerEvent): void;
}

export function makeDraggable(el: HTMLElement, opts: DragOpts) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (down: PointerEvent) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    if (down.button !== 0 && down.pointerType === 'mouse') return;
    down.preventDefault();
    const startX = down.clientX, startY = down.clientY;
    let dragging = false;
    let ghost: HTMLElement | null = null;
    const rect = el.getBoundingClientRect();
    const offX = startX - rect.left, offY = startY - rect.top;
    try {
      el.setPointerCapture(down.pointerId);
    } catch {
      /* ignore */
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== down.pointerId) return;
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
        dragging = true;
        el.classList.add('dragging');
        if (opts.ghost !== false) {
          ghost = el.cloneNode(true) as HTMLElement;
          ghost.classList.add('drag-ghost');
          ghost.style.width = `${rect.width}px`;
          ghost.style.height = `${rect.height}px`;
          document.body.appendChild(ghost);
        }
      }
      if (dragging) {
        if (ghost) ghost.style.transform = `translate(${e.clientX - offX}px, ${e.clientY - offY}px)`;
        highlight(e);
        opts.onMove?.(e);
      }
    };
    let lastHi: Element | null = null;
    const highlight = (e: PointerEvent) => {
      const t = targetAt(e);
      if (lastHi && lastHi !== t) lastHi.classList.remove('drop-hover');
      if (t) t.classList.add('drop-hover');
      lastHi = t;
    };
    const targetAt = (e: PointerEvent): HTMLElement | null => {
      if (ghost) ghost.style.display = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (ghost) ghost.style.display = '';
      return (under?.closest(opts.dropSelector) as HTMLElement | null) ?? null;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== down.pointerId) return;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      lastHi?.classList.remove('drop-hover');
      el.classList.remove('dragging');
      if (dragging) {
        const t = e.type === 'pointercancel' ? null : targetAt(e);
        ghost?.remove();
        opts.onDrop(t, e);
      } else if (e.type !== 'pointercancel') {
        opts.onTap();
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  // keyboard: Enter / Space = tap
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      opts.onTap();
    }
  });
}
