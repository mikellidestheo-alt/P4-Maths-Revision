import type { Answer, CheckResult, Fallback, FieldsInteraction, Interaction, Point, Question, Tier, Token } from './types';
import { parseNumber } from './answers';
import { fmt } from './format';

export interface QSpec {
  topicId: string;
  kind: string;
  tier: Tier;
  story: string;
  prompt: string;
  interaction: Interaction;
  expected: Answer;
  check(a: Answer): CheckResult;
  hint: string;
  worked: string[];
  answerText: string;
  /** values that identify this exact question */
  sig: unknown;
  isChoice?: boolean;
  fallback?: Fallback;
  wrongExample?: Answer;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function makeQuestion(spec: QSpec): Question {
  const signature = `${spec.topicId}|${spec.kind}|${JSON.stringify(spec.sig)}`;
  return {
    id: `${spec.topicId}-${spec.kind}-${hash(signature)}`,
    topicId: spec.topicId,
    kind: spec.kind,
    tier: spec.tier,
    story: spec.story,
    prompt: spec.prompt,
    interaction: spec.interaction,
    expected: spec.expected,
    check: spec.check,
    hint: spec.hint,
    worked: spec.worked,
    answerText: spec.answerText,
    signature,
    isChoice: !!spec.isChoice,
    fallback: spec.fallback,
    wrongExample: spec.wrongExample,
    solve: () => spec.expected,
  };
}

export interface HighLow {
  high?: string;
  low?: string;
}

export const PAD_MSG = 'Use the number pad to type a number.';

/** Compare a typed number against the expected one with story-flavoured feedback. */
export function judgeNumber(raw: string | undefined, expected: number, fb: HighLow = {}, allowDecimal = false): CheckResult {
  const n = parseNumber(raw ?? '', allowDecimal);
  if (n === null) return { correct: false, feedback: PAD_MSG };
  if (n === expected) return { correct: true };
  if (n > expected) return { correct: false, feedback: fb.high ?? 'That’s a bit too big.' };
  return { correct: false, feedback: fb.low ?? 'That’s a bit too small.' };
}

/** A single numeric blank: tokens before/after the box. */
export function oneNumber(
  expected: number,
  opts: { before?: Token[]; after?: Token[]; fb?: HighLow; decimal?: boolean; visual?: FieldsInteraction['visual']; extraCheck?: (n: number) => CheckResult | null } = {},
) {
  const interaction: FieldsInteraction = {
    type: 'fields',
    tokens: [...(opts.before ?? []), { kind: 'number', id: 'a', decimal: opts.decimal }, ...(opts.after ?? [])],
    visual: opts.visual,
  };
  return {
    interaction,
    expected: { a: String(expected) } as Answer,
    check(ans: Answer): CheckResult {
      const raw = (ans as Record<string, string>).a;
      const res = judgeNumber(raw, expected, opts.fb, opts.decimal);
      if (!res.correct && opts.extraCheck) {
        const n = parseNumber(raw ?? '', opts.decimal);
        if (n !== null) {
          const extra = opts.extraCheck(n);
          if (extra) return extra;
        }
      }
      return res;
    },
    wrongExample: { a: String(expected + 1) } as Answer,
  };
}

/** Several numeric blanks with expected values. `names` describe each blank for feedback. */
export function manyNumbers(
  expected: Record<string, number>,
  tokens: Token[],
  opts: { names?: Record<string, string>; layout?: 'inline' | 'markers'; visual?: FieldsInteraction['visual']; wrongMsg?: string } = {},
) {
  const interaction: FieldsInteraction = { type: 'fields', tokens, layout: opts.layout, visual: opts.visual };
  const exp: Record<string, string> = {};
  for (const k of Object.keys(expected)) exp[k] = String(expected[k]);
  return {
    interaction,
    expected: exp as Answer,
    check(ans: Answer): CheckResult {
      const a = ans as Record<string, string>;
      const wrong: string[] = [];
      for (const k of Object.keys(expected)) {
        const n = parseNumber(a[k] ?? '');
        if (n === null) return { correct: false, feedback: 'Fill in every box with a number.' };
        if (n !== expected[k]) wrong.push(k);
      }
      if (wrong.length === 0) return { correct: true };
      const name = opts.names?.[wrong[0]];
      const msg = opts.wrongMsg ?? 'Not quite.';
      return { correct: false, feedback: name ? `${msg} Look again at ${name}.` : msg };
    },
    wrongExample: { ...exp, [Object.keys(expected)[0]]: String(expected[Object.keys(expected)[0]] + 1) } as Answer,
  };
}

export const num = (id: string, label?: string): Token => ({ kind: 'number', id, label });
export const br: Token = { br: true };

/** Typed coordinates fallback for N points: fields x1,y1,x2,y2… */
export function coordsFallback(points: Point[], label = 'Type the coordinates instead', names?: string[]): Fallback {
  const tokens: Token[] = [];
  const expected: Record<string, string> = {};
  points.forEach((p, i) => {
    if (i > 0) tokens.push(br);
    const nm = names?.[i] ?? (points.length > 1 ? `Point ${i + 1}:` : '');
    if (nm) tokens.push(nm + ' ');
    tokens.push('(', { kind: 'number', id: `x${i}`, label: `${nm} across` }, ',', { kind: 'number', id: `y${i}`, label: `${nm} up` }, ')');
    expected[`x${i}`] = String(p[0]);
    expected[`y${i}`] = String(p[1]);
  });
  return {
    label,
    interaction: { type: 'fields', tokens },
    expected,
    toMain(a) {
      const out: Point[] = [];
      for (let i = 0; i < points.length; i++) {
        const x = parseNumber(a[`x${i}`] ?? ''), y = parseNumber(a[`y${i}`] ?? '');
        if (x === null || y === null) return null;
        out.push([x, y]);
      }
      return out;
    },
  };
}

/** Typed single-number fallback whose answer is passed to the main check as a string. */
export function numberFallback(expected: string, label = 'Type the number instead', before: Token[] = [], after: Token[] = []): Fallback {
  return {
    label,
    interaction: { type: 'fields', tokens: [...before, { kind: 'number', id: 'a', wide: true }, ...after] },
    expected: { a: expected },
    toMain(a) {
      const n = parseNumber(a.a ?? '');
      return n === null ? null : String(n);
    },
  };
}

export const ptKey = (p: Point) => `${p[0]},${p[1]}`;
export const fmtPt = (p: Point) => `(${p[0]}, ${p[1]})`;
export const samePoints = (a: Point[], b: Point[]) => {
  if (a.length !== b.length) return false;
  const s = new Set(a.map(ptKey));
  return s.size === a.length && b.every((p) => s.has(ptKey(p)));
};

export { fmt };
