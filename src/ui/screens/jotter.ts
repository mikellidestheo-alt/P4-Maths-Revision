import { h } from '../dom';

/** A scribble pad for working things out (nothing is checked or saved). */
export function openJotter() {
  if (document.querySelector('.jotter-overlay')) return;
  const canvas = h('canvas', { class: 'jotter-canvas', 'aria-label': 'Jotter: draw with your finger or mouse' });
  const close = h('button', { type: 'button', class: 'btn', 'data-action': 'jotter-close' }, 'Close');
  const clearBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Clear');
  const overlay = h('div', { class: 'jotter-overlay', role: 'dialog', 'aria-label': 'Jotter' },
    h('div', { class: 'jotter-box' },
      h('div', { class: 'jotter-top' }, h('strong', {}, '✏️ Jotter — scribble your working out'), h('div', {}, clearBtn, close)),
      canvas));
  document.body.appendChild(overlay);
  const ctx = canvas.getContext('2d')!;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2a2140';
  };
  requestAnimationFrame(resize);
  let drawing = false;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const r = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const r = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
  });
  const stop = () => (drawing = false);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  clearBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
  const done = () => {
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      done();
    }
  };
  window.addEventListener('keydown', onKey, true);
  close.addEventListener('click', done);
  close.focus();
}
