import type { Answer, Point, Question } from './types';

/**
 * A guaranteed-wrong answer for a question (used by the test bot to exercise the retry flow).
 * Uses the question's own `wrongExample` when it is truly wrong, otherwise perturbs the expected answer.
 */
export function makeWrong(q: Question): Answer {
  const tries: Answer[] = [];
  if (q.wrongExample !== undefined) tries.push(q.wrongExample);
  const e = q.expected;
  switch (q.interaction.type) {
    case 'fields': {
      const r = e as Record<string, string>;
      for (const k of Object.keys(r)) {
        const n = Number(r[k]);
        if (Number.isFinite(n)) tries.push({ ...r, [k]: String(n + 1) }, { ...r, [k]: String(n + 7) });
      }
      break;
    }
    case 'choice': {
      const opts = q.interaction.options.map((o) => o.id).filter((id) => id !== e);
      tries.push(...opts);
      break;
    }
    case 'order':
      tries.push((e as string[]).slice().reverse());
      break;
    case 'grid': {
      const pts = e as Point[];
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Point[]) tries.push(pts.map((p, i) => (i === 0 ? ([p[0] + d[0], p[1] + d[1]] as Point) : p)));
      tries.push(pts.slice(1));
      break;
    }
    case 'bins': {
      const r = e as Record<string, string>;
      const binIds = q.interaction.bins.map((b) => b.id);
      const k = Object.keys(r)[0];
      tries.push({ ...r, [k]: binIds.find((b) => b !== r[k])! });
      break;
    }
    case 'lineSelect':
      tries.push([], q.interaction.lines.map((l) => l.id));
      break;
    default: {
      const s = String(e).replace(/_/g, '');
      const n = Number(s);
      if (Number.isFinite(n)) tries.push(String(n + 1), String(n * 10));
    }
  }
  for (const t of tries) {
    try {
      if (!q.check(t).correct) return t;
    } catch {
      /* ignore */
    }
  }
  throw new Error(`No wrong answer found for ${q.id}`);
}
