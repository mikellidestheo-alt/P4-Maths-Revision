/**
 * ALL difficulty ranges live here so they are easy to tune.
 *
 * Tiers: 1 = warm-up, 2 = core, 3 = stretch.
 * Each topic plan is 7 questions ramping 3 × tier 1, 3 × tier 2, 1 × tier 3.
 * Change a number, run `npm test` (the generator tests read these values), then redeploy.
 */

export type Tier = 1 | 2 | 3;
export type Range = [min: number, max: number];

export const PLAN = {
  /** Planned tiers for a 7-question topic set (still ends on a harder one). */
  tiers: [1, 1, 1, 2, 2, 2, 3] as Tier[],
  /** Easier / harder variants chosen by the end-of-night check-in nudge (-1 / +1). */
  tiersEasier: [1, 1, 1, 1, 2, 2, 3] as Tier[],
  tiersHarder: [1, 1, 2, 2, 2, 3, 3] as Tier[],
  /** Adaptive: this many wrong in a row → next question one tier easier. */
  wrongStreakToEase: 2,
  /** Adaptive: this many right in a row → next question one tier harder. */
  rightStreakToHarden: 3,
  /** Max multiple-choice questions in one 7-question job. */
  maxChoicePerJob: 2,
  /** Max questions in a Campfire recap (most recent misses first). */
  maxRecap: 8,
};

/** 1.1 Numbers to one million */
export const T11 = {
  max: { 1: 99_999, 2: 999_999, 3: 1_000_000 } as Record<Tier, number>,
  min: { 1: 1_000, 2: 10_000, 3: 100_000 } as Record<Tier, number>,
  /** tier 3: chance that a generated number has extra "tricky" zeros */
  trickyZeroChance: 0.7,
  /** steps used in "x more / less than" questions */
  moreLessSteps: { 1: [1, 10, 100, 1000], 2: [1, 10, 100, 1000, 10_000], 3: [1, 10, 100, 1000, 10_000, 100_000] } as Record<Tier, number[]>,
};

/** 1.2 Count on and back in multiples of 10, 100, 1000 */
export const T12 = {
  steps: { 1: [10, 100], 2: [100, 1000], 3: [10, 100, 1000] } as Record<Tier, number[]>,
  max: { 1: 10_000, 2: 100_000, 3: 1_000_000 } as Record<Tier, number>,
  markers: 6,
};

/** 1.3 Round and order numbers */
export const T13 = {
  roundTo: { 1: [10, 100], 2: [100, 1000], 3: [1000, 10_000] } as Record<Tier, number[]>,
  numberMax: { 1: 9_999, 2: 99_999, 3: 999_999 } as Record<Tier, number>,
  orderCount: { 1: [3, 4], 2: [4, 5], 3: [5, 6] } as Record<Tier, Range>,
  orderMax: { 1: 99_999, 2: 999_999, 3: 999_999 } as Record<Tier, number>,
  /** chance of a deliberate midpoint (e.g. 4,500 → 5,000) rounding question */
  midpointChance: 0.25,
};

/** 1.4 Multiply and divide by 10 or 100 */
export const T14 = {
  /** Whole numbers only by default. Set true to allow e.g. 4.5 × 10. */
  allowDecimals: false,
  /** Range of the "small" number (the one that gets bigger). */
  base: { 1: [2, 999], 2: [2, 9_999], 3: [10, 9_999] } as Record<Tier, Range>,
  factors: { 1: [10], 2: [10, 100], 3: [10, 100] } as Record<Tier, number[]>,
  maxResult: 999_999,
};

/** 1.5 Sequences and patterns of multiples */
export const T15 = {
  steps: { 1: [3, 4, 5, 10], 2: [6, 7, 8, 9, 25, 50, 100], 3: [25, 50, 100, 1000, 6, 7, 8, 9] } as Record<Tier, number[]>,
  /** Allow sequences that start off a multiple (e.g. 7, 32, 57 …) */
  offsetStart: { 1: false, 2: false, 3: true } as Record<Tier, boolean>,
  decreasingChance: { 1: 0.15, 2: 0.35, 3: 0.4 } as Record<Tier, number>,
  maxTerm: 20_000,
};

/** 1.6 Time intervals (all maths uses minutes since midnight) */
export const T16 = {
  /** minute granularity of times shown */
  minuteStep: { 1: 15, 2: 5, 3: 5 } as Record<Tier, number>,
  /** max interval length in minutes */
  maxInterval: { 1: 180, 2: 300, 3: 540 } as Record<Tier, number>,
  use24h: { 1: false, 2: true, 3: true } as Record<Tier, boolean>,
  /** analogue clock: minute hand snaps to this many minutes */
  clockSnap: 5,
};

/** 1.7 Parallel and perpendicular lines */
export const T17 = {
  gridSize: { 1: 8, 2: 10, 3: 10 } as Record<Tier, number>,
  /** direction vectors allowed for the given fence */
  directions: {
    1: [[1, 0], [0, 1]],
    2: [[1, 0], [0, 1], [1, 1], [1, -1]],
    3: [[1, 1], [1, -1], [1, 2], [2, 1], [1, -2], [2, -1]],
  } as Record<Tier, [number, number][]>,
};

/** 1.8 Position with coordinates (first quadrant) */
export const T18 = {
  gridSize: { 1: 8, 2: 10, 3: 12 } as Record<Tier, number>,
};

/** 2.1 Add mentally / 2.2 Subtract mentally */
export const T21 = {
  /** tier 1: 2-digit ± 2-digit with bridging */
  twoDigit: [12, 89] as Range,
  /** tier 2: 3-digit ± multiples of 10 or 100 */
  threeDigit: [101, 989] as Range,
  /** tier 3: 4-digit ± near-round numbers */
  fourDigit: [1_001, 8_999] as Range,
  nearRoundOffsets: [-2, -1, 1, 2] as number[],
};

/** 2.3 / 2.4 Written column methods */
export const T23 = {
  digits: { 1: [3, 3], 2: [4, 5], 3: [5, 6] } as Record<Tier, Range>,
  maxDigits: 6,
  /** tier 3 addition can have three numbers */
  threeAddendsChance: 0.4,
  /** tier 3 subtraction: exchange across zeros */
  zerosChance: 0.6,
};

/** 2.5 Types of triangles */
export const T25 = {
  /** include "angles in a triangle add to 180°" questions at tier 3 */
  includeAngleSum: true,
  gridSize: 8,
  sideMax: 20,
};

/** 2.6 Symmetry in shapes */
export const T26 = {
  patternSize: { 1: 6, 2: 6, 3: 8 } as Record<Tier, number>,
};

/** 2.7 Reflection (horizontal / vertical mirror lines only) */
export const T27 = {
  gridSize: { 1: 10, 2: 10, 3: 12 } as Record<Tier, number>,
  vertices: { 1: [3, 3], 2: [3, 4], 3: [3, 5] } as Record<Tier, Range>,
};
