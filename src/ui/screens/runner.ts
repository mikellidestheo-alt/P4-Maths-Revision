/**
 * The question runner used for jobs (10 questions) and the Campfire recap.
 * Wrong-answer flow: 1st wrong → story feedback + hint, try again. 2nd wrong → worked solution,
 * marked for review, move on. The child can never get stuck.
 */
import { h } from '../dom';
import type { App, Screen } from '../app';
import type { Answer, Point, Question } from '../../engine/types';
import { PadController, renderNumpad } from '../numpad';
import { createWidget, type Widget } from '../widgets';
import { fieldsWidget } from '../widgets/fields';
import { play } from '../../game/audio';
import { makeWrong } from '../../engine/wrong';
import { friendSvg } from '../art';
import { openJotter } from './jotter';
import type { AnswerOutcome } from '../../game/progress';

export interface RunnerSpec {
  mode: 'job' | 'recap';
  title: string;
  total: number;
  /** questions already done (for resuming) */
  done: number;
  friendId: string;
  next(): Question;
  onShown?(q: Question): void;
  onResult(q: Question, o: AnswerOutcome): number;
  onFinish(): void;
  onExit(): void;
}

const PRAISE = ['Brilliant!', 'Spot on!', 'Super!', 'You got it!', 'Fantastic!', 'Well done!', 'Great thinking!', 'Lovely work!'];
const FIXED = ['You fixed it — great work!', 'Got it on the second go!', 'Nice fix!'];

function isEmpty(q: Question, a: Answer, fallback: boolean): boolean {
  const t = fallback ? 'fields' : q.interaction.type;
  if (t === 'fields') return Object.values(a as Record<string, string>).every((v) => v === '');
  if (t === 'choice') return a === '';
  if (t === 'placeValue' || t === 'column') return /^_*$/.test(String(a));
  if (t === 'bins') return Object.keys(a as Record<string, string>).length === 0;
  if (t === 'grid' && q.interaction.type === 'grid' && q.interaction.mode !== 'triangle' && q.interaction.mode !== 'cells') return (a as Point[]).length === 0;
  return false;
}

export function runnerScreen(app: App, spec: RunnerSpec): Screen {
  let index = spec.done;
  const pad = new PadController();
  const root = h('div', { class: 'screen q-screen', 'data-screen': spec.mode === 'job' ? 'runner' : 'recap' });

  const dots = h('div', { class: 'progress-dots', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(spec.total) });
  const hintBtn = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'hint', 'aria-label': 'Show a hint' }, '💡');
  const jotBtn = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'jotter', 'aria-label': 'Open the jotter to scribble' }, '✏️');
  const backBtn = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'exit', 'aria-label': 'Back to camp' }, '⟵');
  const header = h('header', { class: 'q-header' },
    backBtn,
    h('div', { class: 'q-title' }, h('h1', {}, spec.title), dots),
    hintBtn, jotBtn,
  );
  const body = h('main', { class: 'q-body' });
  const banner = h('div', { class: 'banner', role: 'status', 'aria-live': 'polite' });
  const padWrap = h('div', { class: 'pad-wrap' }, renderNumpad(pad));
  const actions = h('div', { class: 'q-actions' });
  const footer = h('footer', { class: 'q-footer' }, banner, padWrap, actions);
  const peek = h('div', { class: 'peek', 'aria-hidden': 'true' }, friendSvg(spec.friendId, { accessory: app.data.equipped.friends }));
  root.append(header, body, footer, peek);

  backBtn.addEventListener('click', () => spec.onExit());
  jotBtn.addEventListener('click', () => openJotter());

  let q: Question;
  let widget: Widget;
  let attempts = 0;
  let resolved = false;
  let usingFallback = false;
  let hintShown = false;

  function renderDots() {
    dots.innerHTML = '';
    for (let i = 0; i < spec.total; i++) dots.appendChild(h('span', { class: `dot ${i < index ? 'done' : i === index ? 'now' : ''}` }));
    dots.setAttribute('aria-valuenow', String(index));
    dots.setAttribute('aria-label', `Question ${Math.min(index + 1, spec.total)} of ${spec.total}`);
  }

  function setBanner(kind: '' | 'good' | 'retry' | 'hint' | 'info', html: (Node | string)[]) {
    banner.className = `banner ${kind ? 'banner-' + kind : ''}`;
    banner.innerHTML = '';
    for (const n of html) banner.append(n);
  }

  function mountWidget() {
    pad.clearTargets();
    const ctx = { pad, onChange: () => {} };
    const w = usingFallback && q.fallback ? fieldsWidget(q.fallback.interaction, ctx) : createWidget(q.interaction, ctx);
    widget = w;
    widgetHolder.innerHTML = '';
    widgetHolder.appendChild(w.el);
    padWrap.hidden = !w.usesPad;
    root.classList.toggle('has-pad', w.usesPad);
    requestAnimationFrame(fitVisual);
    if (app.debug) exposeDebug();
  }

  /** With the number pad showing, shrink a picture so the answer boxes stay visible above it. */
  function fitVisual() {
    const svg = widgetHolder.querySelector<SVGSVGElement>('.widget-fields .visual svg');
    if (!svg || !widget?.usesPad) return;
    svg.style.maxHeight = '';
    const overflow = body.scrollHeight - body.clientHeight;
    if (overflow > 0) {
      const cur = svg.getBoundingClientRect().height;
      svg.style.maxHeight = `${Math.max(150, Math.floor(cur - overflow - 6))}px`;
    }
  }
  window.addEventListener('resize', () => requestAnimationFrame(fitVisual));

  let widgetHolder = h('div');
  let fallbackLink: HTMLButtonElement | null = null;

  function exposeDebug() {
    const fb = usingFallback && q.fallback;
    (window as unknown as { __camp: unknown }).__camp = {
      question: q,
      type: fb ? 'fields' : q.interaction.type,
      interaction: fb ? q.fallback!.interaction : q.interaction,
      expected: fb ? q.fallback!.expected : q.expected,
      wrong: fb ? null : makeWrong(q),
      fallback: !!fb,
      attempts,
      resolved,
      index,
      mode: spec.mode,
    };
  }

  function showQuestion() {
    q = spec.next();
    spec.onShown?.(q);
    attempts = 0;
    resolved = false;
    usingFallback = false;
    hintShown = false;
    renderDots();
    body.innerHTML = '';
    body.scrollTop = 0;
    const story = h('p', { class: 'q-story' }, q.story);
    const prompt = h('h2', { class: 'q-prompt', 'data-qid': q.id }, q.prompt);
    widgetHolder = h('div', { class: 'widget-holder' });
    body.append(story, prompt, widgetHolder);
    fallbackLink = null;
    if (q.fallback) {
      fallbackLink = h('button', { type: 'button', class: 'link-btn fallback-link', 'data-action': 'fallback' }, `Having trouble? ${q.fallback.label}`);
      fallbackLink.addEventListener('click', () => {
        if (resolved) return;
        usingFallback = !usingFallback;
        fallbackLink!.textContent = usingFallback ? 'Go back to the picture' : `Having trouble? ${q.fallback!.label}`;
        mountWidget();
      });
      body.appendChild(fallbackLink);
    }
    mountWidget();
    setBanner('', []);
    renderActions();
    prompt.focus({ preventScroll: true });
  }

  function renderActions() {
    actions.innerHTML = '';
    root.classList.toggle('has-pad', !!widget?.usesPad && !resolved);
    if (!resolved) {
      const check = h('button', { type: 'button', class: 'btn btn-primary btn-check', 'data-action': 'check' }, attempts ? 'Try again' : 'Check');
      check.addEventListener('click', submit);
      actions.appendChild(check);
    } else {
      const last = index + 1 >= spec.total;
      const next = h('button', { type: 'button', class: 'btn btn-primary btn-next', 'data-action': 'next' }, last ? 'Finish ✨' : 'Next ➜');
      next.addEventListener('click', goNext);
      actions.appendChild(next);
      setTimeout(() => next.focus({ preventScroll: true }), 30);
    }
  }

  pad.onSubmit = () => {
    if (!resolved) submit();
    else goNext();
  };

  hintBtn.addEventListener('click', () => {
    if (resolved) return;
    hintShown = true;
    setBanner('hint', [h('strong', {}, '💡 Hint: '), q.hint]);
  });

  function currentAnswer(): Answer | null {
    const a = widget.getAnswer();
    if (usingFallback && q.fallback) return q.fallback.toMain(a as Record<string, string>);
    return a;
  }

  function submit() {
    if (resolved) return;
    const raw = widget.getAnswer();
    if (isEmpty(q, raw, usingFallback)) {
      setBanner('info', ['Have a go first! ', usingFallback || q.interaction.type === 'fields' || q.interaction.type === 'column' ? 'Use the number pad to type your answer.' : 'Use the picture to answer.']);
      return;
    }
    const a = currentAnswer();
    const res = a === null ? { correct: false, feedback: 'Fill in every box.' } : q.check(a);
    if (a === null) {
      setBanner('info', ['Fill in every box with a number.']);
      return;
    }
    if (res.correct) {
      resolved = true;
      widget.setLocked(true);
      const firstTry = attempts === 0;
      const coins = spec.onResult(q, { firstTry, eventual: true });
      play('correct');
      if (coins) setTimeout(() => play('coin'), 250);
      const msg = firstTry ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : FIXED[Math.floor(Math.random() * FIXED.length)];
      setBanner('good', [h('strong', {}, `✨ ${msg} `), res.feedback ?? '', coins ? h('span', { class: 'coin-pop' }, ` +${coins} 🪙`) : '']);
      root.classList.remove('glow');
      void root.offsetWidth;
      root.classList.add('glow');
      peekFriend();
      renderActions();
      if (app.debug) exposeDebug();
      return;
    }
    attempts++;
    if (attempts === 1) {
      play('retry');
      setBanner('retry', [h('strong', {}, 'Not quite! '), res.feedback ?? '', h('br'), h('span', { class: 'hint-line' }, '💡 ', q.hint)]);
      renderActions();
      if (app.debug) exposeDebug();
      return;
    }
    // second miss: show how to do it, mark for review, move on
    resolved = true;
    widget.setLocked(true);
    spec.onResult(q, { firstTry: false, eventual: false });
    try {
      widget.reveal?.(usingFallback ? q.expected : q.expected);
    } catch {
      /* reveal is a nice-to-have */
    }
    showWorked();
    renderActions();
    if (app.debug) exposeDebug();
  }

  function showWorked() {
    const sheet = h('section', { class: 'worked', 'aria-label': 'How to do it' },
      h('h3', {}, 'Let’s work it out together'),
      h('ol', {}, ...q.worked.map((w) => h('li', {}, w))),
      h('p', { class: 'worked-answer' }, 'Answer: ', h('strong', {}, q.answerText)),
      h('p', { class: 'worked-note' }, spec.mode === 'job' ? '🔥 This one will come back at the campfire with new numbers.' : '🌙 Good try! You can practise this one again another night.'),
    );
    body.appendChild(sheet);
    setBanner('info', ['That was a tricky one. Read how it works, then carry on.']);
    setTimeout(() => sheet.scrollIntoView({ behavior: document.documentElement.classList.contains('reduce-motion') ? 'auto' : 'smooth', block: 'start' }), 50);
  }

  function peekFriend() {
    peek.classList.remove('show');
    void peek.offsetWidth;
    peek.classList.add('show');
  }

  function goNext() {
    index++;
    if (index >= spec.total) {
      spec.onFinish();
      return;
    }
    showQuestion();
  }

  if (index >= spec.total) setTimeout(() => spec.onFinish(), 0);
  else showQuestion();
  void hintShown;
  return {
    el: root,
    title: spec.title,
    music: 'focus',
    onBack: () => spec.onExit(),
    onKey: (e) => {
      if (document.querySelector('.jotter-overlay')) return false;
      return pad.handleKey(e);
    },
  };
}
