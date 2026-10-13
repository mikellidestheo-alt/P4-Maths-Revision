import type { Tier } from '../config/difficulty';
import type { Rng } from './rng';
export type { Tier } from '../config/difficulty';

export type Point = [number, number];

/** A blank the child fills in. */
export type FieldSpec =
  | { kind: 'number'; id: string; decimal?: boolean; label?: string; wide?: boolean }
  | { kind: 'time'; id: string; label?: string }
  | { kind: 'toggle'; id: string; options: { value: string; label: string }[]; label?: string };

/** Template pieces: plain strings are text, objects are blanks. `{br:true}` is a line break. */
export type Token = string | FieldSpec | { br: true };

export type Colour = 'fence' | 'path' | 'mirror' | 'shape' | 'answer' | 'soft' | 'gold';

/** Things drawn on a coordinate grid. Coordinates are grid units, origin bottom-left. */
export type Drawing =
  | { kind: 'segment'; a: Point; b: Point; colour?: Colour; label?: string; dashed?: boolean }
  | { kind: 'polygon'; pts: Point[]; colour?: Colour; label?: string; vertexLabels?: string[] }
  | { kind: 'point'; p: Point; label?: string; icon?: 'crate' | 'tent' | 'lantern' | 'star' | 'flag' | 'dot' }
  | { kind: 'cells'; cells: Point[]; colour?: Colour }
  | { kind: 'mirror'; axis: 'x' | 'y'; at: number };

/** Non-interactive pictures shown with a question. */
export type Visual =
  | { kind: 'grid'; w: number; h: number; axes: boolean; drawings: Drawing[] }
  | { kind: 'clock'; mins: number; label?: string }
  | { kind: 'shape'; pts: Point[]; sideLabels?: (string | null)[]; angleLabels?: (string | null)[]; rightAngles?: number[]; ticks?: number[]; lines?: { a: Point; b: Point; dashed?: boolean }[] }
  | { kind: 'placeValue'; value: number; columns: number }
  | { kind: 'lines'; lines: { id: string; a: Point; b: Point; label: string }[]; w: number; h: number };

export interface FieldsInteraction { type: 'fields'; tokens: Token[]; layout?: 'inline' | 'markers'; visual?: Visual }
export type Interaction =
  | FieldsInteraction
  | { type: 'choice'; options: { id: string; label: string; visual?: Visual }[]; visual?: Visual }
  | { type: 'placeValue'; columns: number }
  | { type: 'slide'; start: number; columns: number }
  | { type: 'numberLine'; min: number; max: number; tick: number; flag?: number; label: string; start: number }
  | { type: 'order'; items: { id: string; label: string }[]; direction: 'asc' | 'desc' }
  | { type: 'clock'; start: number }
  | {
      type: 'grid';
      w: number;
      h: number;
      axes: boolean;
      /** point: one point · points: N points (any order) · segment: from `fixed` to one tapped point · triangle: move 3 corners · cells: toggle squares */
      mode: 'point' | 'points' | 'segment' | 'triangle' | 'cells';
      count?: number;
      fixed?: Point;
      initial?: Point[];
      drawings: Drawing[];
      /** cells mode: which cells may be toggled (defaults to whole grid) */
      cellBounds?: { x0: number; y0: number; x1: number; y1: number };
    }
  | { type: 'column'; op: '+' | '-'; operands: number[] }
  | { type: 'bins'; items: { id: string; label: string; visual?: Visual }[]; bins: { id: string; label: string }[] }
  | { type: 'lineSelect'; visual: Visual; lines: { id: string; a: Point; b: Point }[] };

export type InteractionType = Interaction['type'];

/** Answer shapes per interaction type:
 *  fields → Record<id,string>; choice/placeValue/slide/numberLine/clock/column → string;
 *  order/lineSelect → string[]; grid → Point[]; bins → Record<itemId,binId>. */
export type Answer = string | string[] | Point[] | Record<string, string>;

export interface CheckResult {
  correct: boolean;
  /** Story-flavoured explanation for a wrong answer, or a kind note on a right one. */
  feedback?: string;
}

export interface Fallback {
  /** What the button says, e.g. "Type the number instead" */
  label: string;
  interaction: FieldsInteraction;
  /** Convert typed fields into a main-interaction answer (null if unreadable). */
  toMain(a: Record<string, string>): Answer | null;
  expected: Record<string, string>;
}

export interface Question {
  id: string;
  topicId: string;
  /** Sub-skill key – recap re-generates the same kind with fresh numbers. */
  kind: string;
  tier: Tier;
  /** In-game framing (one short sentence). */
  story: string;
  /** The maths ask (short). */
  prompt: string;
  interaction: Interaction;
  /** A canonical correct answer (used by the bot and the worked solution). */
  expected: Answer;
  check(a: Answer): CheckResult;
  hint: string;
  worked: string[];
  /** Human readable answer for the parent area. */
  answerText: string;
  /** Used to avoid identical repeats in a session. */
  signature: string;
  isChoice: boolean;
  fallback?: Fallback;
  /** Optional guaranteed-wrong answer for the test bot. */
  wrongExample?: Answer;
  solve(): Answer;
}

export interface GenContext {
  /** Ask for a particular sub-skill (used by recap). */
  kind?: string;
  /** Kinds to avoid (e.g. multiple choice when the job's MC cap is used up). */
  avoidChoice?: boolean;
}

export interface TopicModule {
  id: string;
  title: string;
  /** Short story name for the job, e.g. "Label the supply crates" */
  job: string;
  unit: 1 | 2;
  kinds: string[];
  generate(rng: Rng, tier: Tier, ctx: GenContext): Question;
}
