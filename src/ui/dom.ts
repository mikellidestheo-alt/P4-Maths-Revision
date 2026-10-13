/** Tiny DOM helpers (no framework). */
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener | Partial<CSSStyleDeclaration>>;
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

function applyAttrs(el: Element, attrs: Attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign((el as HTMLElement).style, v);
    } else if (k === 'class') {
      el.setAttribute('class', String(v));
    } else if (typeof v === 'string' && v.includes('var(') && el instanceof SVGElement) {
      // CSS variables are not reliable inside SVG presentation attributes on every browser: use style
      (el as SVGElement).style.setProperty(k, v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function svgRoot(viewBox: string, attrs: Attrs = {}, ...children: Child[]) {
  return s('svg', { viewBox, xmlns: SVGNS, ...attrs }, ...children);
}

/** Point in SVG user coordinates from a pointer event. */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

export function prefersReducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion');
}
