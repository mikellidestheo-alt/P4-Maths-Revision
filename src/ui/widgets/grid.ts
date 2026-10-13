import { h, s, svgPoint } from '../dom';
import type { Answer, Interaction, Point } from '../../engine/types';
import type { Widget, WidgetCtx } from './types';
import { drawOnGrid, gridFrame, U } from '../visuals';
import { play } from '../../game/audio';

type GridIt = Extract<Interaction, { type: 'grid' }>;
const key = (p: Point) => `${p[0]},${p[1]}`;

/**
 * Coordinate grid. Tap (or press and slide, then let go) to place points; drag triangle corners;
 * tap squares to shade them. "Use arrow buttons" gives a cursor for anyone who finds tapping hard.
 */
export function gridWidget(it: GridIt, ctx: WidgetCtx): Widget {
  const f = gridFrame(it.w, it.h, it.axes, 'map grid');
  for (const d of it.drawings) drawOnGrid(f, d);
  const marks = s('g', { class: 'grid-marks' });
  const ghostG = s('g', { class: 'grid-ghost' });
  const cursorG = s('g', { class: 'grid-cursor' });
  f.top.append(marks, ghostG, cursorG);
  const svg = f.svg;
  svg.style.touchAction = 'none';
  svg.classList.add('grid-interactive');

  let locked = false;
  let points: Point[] = [];
  let corners: Point[] = it.mode === 'triangle' ? (it.initial ?? [[1, 1], [5, 1], [3, 4]]).map((p) => [p[0], p[1]] as Point) : [];
  let cells: Point[] = [];
  let selectedCorner: number | null = null;
  const givenCells = new Set(it.drawings.filter((d) => d.kind === 'cells').flatMap((d) => (d.kind === 'cells' ? d.cells.map(key) : [])));
  const message = h('div', { class: 'grid-msg', 'aria-live': 'polite' }, '');

  // invisible hit targets (also used by keyboard users and the test bot)
  const hits = s('g', { class: 'grid-hits' });
  if (it.mode === 'cells') {
    const b = it.cellBounds ?? { x0: 0, y0: 0, x1: it.w, y1: it.h };
    for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) {
      const [px, py] = f.toPx([x, y + 1]);
      hits.appendChild(s('rect', { x: px, y: py, width: U, height: U, class: 'hit', 'data-cx': x, 'data-cy': y }));
    }
  } else {
    for (let x = 0; x <= it.w; x++) for (let y = 0; y <= it.h; y++) {
      const [px, py] = f.toPx([x, y]);
      hits.appendChild(s('circle', { cx: px, cy: py, r: U * 0.48, class: 'hit', 'data-gx': x, 'data-gy': y }));
    }
  }
  f.top.insertBefore(hits, marks);

  const nearest = (e: PointerEvent): Point => {
    const p = svgPoint(svg, e.clientX, e.clientY);
    const gx = Math.round((p.x - f.padL) / U), gy = Math.round(it.h - (p.y - f.padT) / U);
    return [Math.max(0, Math.min(it.w, gx)), Math.max(0, Math.min(it.h, gy))];
  };
  const cellAt = (e: PointerEvent): Point | null => {
    const p = svgPoint(svg, e.clientX, e.clientY);
    const cx = Math.floor((p.x - f.padL) / U), cy = Math.floor(it.h - (p.y - f.padT) / U);
    const b = it.cellBounds ?? { x0: 0, y0: 0, x1: it.w, y1: it.h };
    if (cx < b.x0 || cy < b.y0 || cx >= b.x1 || cy >= b.y1) return null;
    return [cx, cy];
  };

  function render() {
    marks.innerHTML = '';
    if (it.mode === 'segment' && it.fixed) {
      const [fx, fy] = f.toPx(it.fixed);
      if (points[0]) {
        const [qx, qy] = f.toPx(points[0]);
        marks.appendChild(s('line', { x1: fx, y1: fy, x2: qx, y2: qy, class: 'user-seg' }));
        marks.appendChild(s('circle', { cx: qx, cy: qy, r: 9, class: 'user-dot' }));
      }
      marks.appendChild(s('circle', { cx: fx, cy: fy, r: 7, class: 'fixed-dot' }));
    } else if (it.mode === 'point' || it.mode === 'points') {
      for (const p of points) {
        const [x, y] = f.toPx(p);
        marks.appendChild(s('circle', { cx: x, cy: y, r: 11, class: 'user-dot' }));
      }
    } else if (it.mode === 'triangle') {
      marks.appendChild(s('polygon', { points: corners.map((p) => f.toPx(p).join(',')).join(' '), class: 'user-tri' }));
      corners.forEach((p, i) => {
        const [x, y] = f.toPx(p);
        const g = s('g', { class: `corner ${selectedCorner === i ? 'selected' : ''}`, 'data-corner': String(i), transform: `translate(${x} ${y})` },
          s('circle', { r: 17, class: 'corner-knob' }),
          s('text', { y: 6, 'text-anchor': 'middle', class: 'corner-label' }, 'ABC'[i]));
        marks.appendChild(g);
      });
    } else if (it.mode === 'cells') {
      for (const c of cells) {
        const [x, y] = f.toPx([c[0], c[1] + 1]);
        marks.appendChild(s('rect', { x: x + 2, y: y + 2, width: U - 4, height: U - 4, rx: 4, class: 'user-cell' }));
      }
    }
    if (it.mode === 'points' && it.count) message.textContent = `${points.length} of ${it.count} corners placed`;
  }

  function showGhost(p: Point | null) {
    ghostG.innerHTML = '';
    if (!p) return;
    if (it.mode === 'cells') {
      const [x, y] = f.toPx([p[0], p[1] + 1]);
      ghostG.appendChild(s('rect', { x, y, width: U, height: U, class: 'ghost-cell' }));
      return;
    }
    const [x, y] = f.toPx(p);
    ghostG.appendChild(s('circle', { cx: x, cy: y, r: 15, class: 'ghost-dot' }));
    if (it.mode === 'segment' && it.fixed) {
      const [fx, fy] = f.toPx(it.fixed);
      ghostG.appendChild(s('line', { x1: fx, y1: fy, x2: x, y2: y, class: 'ghost-seg' }));
    }
  }

  function commit(p: Point) {
    if (locked) return;
    switch (it.mode) {
      case 'point':
      case 'segment':
        points = [p];
        break;
      case 'points': {
        const i = points.findIndex((q) => key(q) === key(p));
        if (i >= 0) points.splice(i, 1);
        else if (points.length < (it.count ?? 99)) points.push(p);
        else {
          message.textContent = `You’ve placed all ${it.count} corners. Tap one to take it away.`;
          return;
        }
        break;
      }
      case 'triangle':
        if (selectedCorner === null) return;
        {
          corners[selectedCorner] = p;
          selectedCorner = null;
        }
        break;
      case 'cells': {
        if (givenCells.has(key(p))) return;
        const i = cells.findIndex((q) => key(q) === key(p));
        if (i >= 0) cells.splice(i, 1);
        else cells.push(p);
        break;
      }
    }
    play('place');
    render();
    ctx.onChange();
  }

  svg.addEventListener('pointerdown', (down: PointerEvent) => {
    if (locked) return;
    if (down.button !== 0 && down.pointerType === 'mouse') return;
    down.preventDefault();
    try {
      svg.setPointerCapture(down.pointerId);
    } catch {
      /* ignore */
    }
    let dragCorner: number | null = null;
    if (it.mode === 'triangle') {
      const p = svgPoint(svg, down.clientX, down.clientY);
      let best = -1, bestD = Infinity;
      corners.forEach((c, i) => {
        const [x, y] = f.toPx(c);
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (bestD < U * 0.7) dragCorner = best;
    }
    const startX = down.clientX, startY = down.clientY;
    let moved = false;
    const pos = (e: PointerEvent) => (it.mode === 'cells' ? cellAt(e) : nearest(e));
    showGhost(pos(down));
    const move = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 6) moved = true;
      const p = pos(e);
      if (dragCorner !== null && p && moved) {
        corners[dragCorner] = p;
        render();
      }
      showGhost(p);
    };
    const up = (e: PointerEvent) => {
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
      showGhost(null);
      if (e.type === 'pointercancel') return;
      const p = pos(e);
      if (it.mode === 'triangle') {
        if (dragCorner !== null && moved && p) {
          corners[dragCorner] = p;
          selectedCorner = null;
          play('place');
          render();
          ctx.onChange();
        } else if (dragCorner !== null && !moved) {
          selectedCorner = selectedCorner === dragCorner ? null : dragCorner;
          message.textContent = selectedCorner !== null ? `Corner ${'ABC'[selectedCorner]} picked — tap where it should go.` : '';
          render();
        } else if (p) {
          if (selectedCorner === null) message.textContent = 'Drag a corner, or tap a corner and then tap where it goes.';
          commit(p);
        }
        return;
      }
      if (p) commit(p);
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  });

  /* ---------- arrow-button cursor (fallback for tricky touch screens) ---------- */
  let cursor: Point = it.mode === 'cells' ? [Math.floor(it.w / 2), Math.floor(it.h / 2)] : [0, 0];
  const drawCursor = () => {
    cursorG.innerHTML = '';
    if (!cursorPanel.classList.contains('open')) return;
    if (it.mode === 'cells') {
      const [x, y] = f.toPx([cursor[0], cursor[1] + 1]);
      cursorG.appendChild(s('rect', { x: x + 1, y: y + 1, width: U - 2, height: U - 2, class: 'cursor-ring' }));
    } else {
      const [x, y] = f.toPx(cursor);
      cursorG.appendChild(s('circle', { cx: x, cy: y, r: 16, class: 'cursor-ring' }));
    }
  };
  const maxX = it.mode === 'cells' ? it.w - 1 : it.w, maxY = it.mode === 'cells' ? it.h - 1 : it.h;
  const arrow = (label: string, aria: string, dx: number, dy: number) => {
    const b = h('button', { type: 'button', class: 'arrow-btn', 'aria-label': aria, 'data-cursor': aria }, label);
    b.addEventListener('click', () => {
      cursor = [Math.max(0, Math.min(maxX, cursor[0] + dx)), Math.max(0, Math.min(maxY, cursor[1] + dy))];
      if (it.mode === 'triangle' && selectedCorner !== null) {
        corners[selectedCorner] = cursor;
        render();
        ctx.onChange();
      }
      drawCursor();
      play('tap');
    });
    return b;
  };
  const placeBtn = h('button', { type: 'button', class: 'btn-small', 'data-cursor': 'place' }, it.mode === 'cells' ? 'Shade / unshade' : it.mode === 'triangle' ? 'Pick next corner' : 'Place / remove here');
  placeBtn.addEventListener('click', () => {
    if (locked) return;
    if (it.mode === 'triangle') {
      selectedCorner = selectedCorner === null ? 0 : (selectedCorner + 1) % 3;
      cursor = corners[selectedCorner];
      message.textContent = `Moving corner ${'ABC'[selectedCorner]} with the arrows.`;
      render();
      drawCursor();
      return;
    }
    commit(cursor);
    drawCursor();
  });
  const cursorPanel = h('div', { class: 'cursor-panel' },
    h('div', { class: 'arrows' }, arrow('▲', 'up', 0, 1), h('div', { class: 'arrows-mid' }, arrow('◀', 'left', -1, 0), arrow('▶', 'right', 1, 0)), arrow('▼', 'down', 0, -1)),
    placeBtn,
  );
  const toggleCursor = h('button', { type: 'button', class: 'link-btn', 'data-action': 'grid-arrows' }, 'Trouble tapping? Use arrow buttons');
  toggleCursor.addEventListener('click', () => {
    cursorPanel.classList.toggle('open');
    toggleCursor.textContent = cursorPanel.classList.contains('open') ? 'Hide arrow buttons' : 'Trouble tapping? Use arrow buttons';
    if (it.mode === 'triangle' && cursorPanel.classList.contains('open') && selectedCorner === null) {
      selectedCorner = 0;
      cursor = corners[0];
      message.textContent = 'Moving corner A with the arrows.';
      render();
    }
    drawCursor();
  });

  render();
  const help = it.mode === 'cells' ? 'Tap squares to shade them. Tap again to unshade.'
    : it.mode === 'triangle' ? 'Drag the corners A, B and C to new dots.'
    : it.mode === 'points' ? 'Tap a dot to place a corner. Tap it again to take it away.'
    : it.mode === 'segment' ? 'Tap a dot to finish your line. You can also drag from the start point.'
    : 'Tap a dot on the grid.';
  const el = h('div', { class: 'widget widget-grid' },
    h('div', { class: 'visual grid-wrap' }, svg),
    h('p', { class: 'small-help' }, help),
    message,
    toggleCursor,
    cursorPanel,
  );
  return {
    el,
    usesPad: false,
    getAnswer(): Answer {
      if (it.mode === 'triangle') return corners.map((p) => [p[0], p[1]] as Point);
      if (it.mode === 'cells') return cells.slice();
      return points.slice();
    },
    setLocked(l) {
      locked = l;
      el.classList.toggle('locked', l);
      cursorPanel.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = l));
    },
    reveal(exp) {
      const pts = exp as Point[];
      const g = s('g', { class: 'grid-reveal' });
      if (it.mode === 'cells') {
        for (const c of pts) {
          const [x, y] = f.toPx([c[0], c[1] + 1]);
          g.appendChild(s('rect', { x: x + 6, y: y + 6, width: U - 12, height: U - 12, rx: 4, class: 'reveal-cell' }));
        }
      } else if (it.mode === 'segment' && it.fixed && pts[0]) {
        const [fx, fy] = f.toPx(it.fixed), [qx, qy] = f.toPx(pts[0]);
        g.appendChild(s('line', { x1: fx, y1: fy, x2: qx, y2: qy, class: 'reveal-seg' }));
      } else if (it.mode === 'triangle') {
        g.appendChild(s('polygon', { points: pts.map((p) => f.toPx(p).join(',')).join(' '), class: 'reveal-tri' }));
      } else {
        for (const p of pts) {
          const [x, y] = f.toPx(p);
          g.appendChild(s('circle', { cx: x, cy: y, r: 9, class: 'reveal-dot' }));
        }
      }
      f.top.appendChild(g);
    },
  };
}
