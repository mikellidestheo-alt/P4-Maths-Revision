# CLAUDE.md — conventions for future sessions

**What this is:** an offline PWA maths revision game ("6 Nights at Camp") for one child, deployed to
GitHub Pages from `main`. Vite + TypeScript + vanilla DOM/SVG. No framework, no runtime network calls,
no backend, no analytics. UK English, age 8–9 reading level, cosy (never scary) tone.

## Golden rules
1. **Maths correctness beats everything.** Every question is generated in code with an answer key and
   a `check()`; never hand-write answer keys. If a generator can produce something ambiguous, fix the
   generator *and* add a test in `src/topics/topics.test.ts`.
2. Mistakes are never punished (no lost progress/streaks, no red crosses). The child can never get
   stuck: two misses → worked solution → move on.
3. Rewards are cosmetic only, for accuracy and fixing mistakes, never for time spent.
4. Keep `main` deployable: run `npm test`, `npm run build` and `npm run e2e` before pushing.
5. Never commit personal data (the repo is public). The child's nickname lives only in localStorage.

## Architecture
- `src/config/difficulty.ts` — all ranges. Topic generators must read ranges from here.
- `src/engine/types.ts` — `Question`, `Interaction` (fields, choice, placeValue, slide, numberLine,
  order, clock, grid, column, bins, lineSelect) and their answer shapes (documented on `Answer`).
- `src/engine/build.ts` — `makeQuestion`, `oneNumber`, `manyNumbers`, `coordsFallback`, `numberFallback`.
- `src/engine/planner.ts` — tier plan per job, adaptivity (2 wrong → easier, 3 right → harder),
  review topic weighting, MC cap, recap variants (same `kind`, same/easier tier).
- `src/topics/tNN.ts` — one module per topic; `generate(rng, tier, ctx)` must support **every kind
  at every tier** (the recap asks for a specific kind).
- `src/ui/widgets/*` — one file per interaction. Every drag/draw widget also supports tap-to-place
  and/or arrow buttons, and questions provide a typed `fallback` where the maths allows.
- `src/ui/screens/runner.ts` — the question flow (check, hint, retry, worked solution, coins).
- `src/game/progress.ts` — pacing, unlocking, scoring, history, recap queue, parent report.
- `src/storage/save.ts` — versioned schema (`SCHEMA_VERSION`) + `migrate()`; bump the version and
  add a migration step for any breaking change. All storage access is try/catch.

## Testing hooks
- Add `?bot=1` to the URL to expose `window.__camp` (current question, expected answer, a
  guaranteed-wrong answer) and `window.__campPreview(topicId, kind, tier, seed)`.
- `e2e/bot.ts` drives every widget through the real UI. If you add an interaction type, teach the bot.
- Stable selectors: `data-screen`, `data-action`, `data-field-id`, `data-key`, `data-tile`,
  `data-place`, `data-gx/gy`, `data-cx/cy`, `data-corner`, `data-col-box`, `data-bin(-item)`,
  `data-line`, `data-choice`, `data-order-*`, `data-clock`, `data-slide`, `data-nl-*`.

## Style
Match surrounding code: small pure functions, `h()`/`s()` DOM helpers, CSS variables in `styles.css`,
≥44px touch targets, no horizontal scroll at 360px, respect `.reduce-motion`.
