import type { Tier } from '../config/difficulty';
import type { Rng } from '../engine/rng';
import type { GenContext } from '../engine/types';

/**
 * Pick a sub-skill ("kind") using per-tier weights [tier1, tier2, tier3].
 * `ctx.kind` forces a kind (used by the Campfire recap).
 * Kinds listed in `choiceKinds` are skipped when `ctx.avoidChoice` is set.
 */
export function pickKind(rng: Rng, ctx: GenContext, weights: Record<string, [number, number, number]>, tier: Tier, choiceKinds: string[] = []): string {
  if (ctx.kind && weights[ctx.kind]) return ctx.kind;
  let kinds = Object.keys(weights);
  if (ctx.avoidChoice) kinds = kinds.filter((k) => !choiceKinds.includes(k));
  const w = kinds.map((k) => weights[k][tier - 1]);
  if (w.every((x) => x <= 0)) return kinds[0];
  return rng.weighted(kinds, w);
}
