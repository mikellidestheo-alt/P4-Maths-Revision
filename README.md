# 6 Nights at Camp 🏕️🌙

A cosy-spooky forest-camp **maths revision game** for a 9–10-year-old (Units 1 and 2: numbers to a
million, rounding, ×÷10/100, sequences, time, parallel/perpendicular lines, coordinates, mental and
written addition/subtraction, triangles, symmetry, reflection).

**Play:** https://mikellidestheo-alt.github.io/P4-Maths-Revision/

- Six nights, ~15–20 minutes each. Each night you rescue a lost forest friend.
- Each night has three camp "jobs" (one per topic, 10 questions each), then a Campfire recap of the
  questions that were missed (with fresh numbers), then the rescue.
- Answers are typed on a built-in number pad, dragged, drawn, tapped on a grid or built — not
  multiple choice (under 10% overall).
- Mistakes never lose anything: 1st miss → a story hint, try again; 2nd miss → a worked solution,
  and the skill comes back at the campfire.
- Coins buy cosmetic camp decorations only. No ads, accounts, tracking or network calls. Progress
  stays on the device.

## Handing it over (grown-ups)

1. Open the link on the phone/tablet/laptop she'll use. On first launch, a one-minute setup asks for
   an optional nickname, an optional 4-digit PIN, nights per day (default **3 a day** — the weekend
   plan) and spookiness (default **Cosy**). Just pressing **Continue** is fine.
2. Add it to the home screen (iPhone/iPad: Share → *Add to Home Screen*; Android: ⋮ → *Add to Home
   screen* / *Install app*). It then works offline.
3. The ⚙️ button opens the **grown-ups area** (PIN, or press-and-hold if no PIN was set): per-topic
   results, a strengths / worth-practising list, the exact missed questions with answers (to practise
   on paper), check-in answers, settings, unlocking a night, resetting today's allowance, moving
   progress to another device with a copy-and-paste code, and resetting everything.

Pacing: after the day's allowance of *new* nights, the camp goes to sleep until the next calendar
day. Finished nights can always be replayed and replays never use up the allowance.

## Developing

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests: every generator, 600 questions per topic, all tiers
npm run build        # type-check + production build into dist/
npm run e2e          # build + Playwright: full bot playthrough, viewport matrix, offline/update
npm run spotcheck    # regenerate docs/SPOTCHECK.md (20 sample questions per topic)
npm run icons        # re-render the PNG icons
```

Playwright uses the pre-installed Chromium. WebKit runs too if installed (`PW_WEBKIT=1 npm run e2e`
after `npx playwright install webkit`).

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`: unit tests → build → GitHub Pages.
One-time setting: **GitHub → Settings → Pages → Build and deployment → Source: GitHub Actions.**
The Vite base path is `/P4-Maths-Revision/` (`vite.config.ts`).

Updates are safe: the service worker fetches the page from the network first, so a new deploy
appears the next time the game is opened online (and a "new version ready" toast offers a refresh if
it arrives mid-session); offline it falls back to the last good version. Old caches are deleted.

## Tuning difficulty

All ranges live in **`src/config/difficulty.ts`** (one block per topic, plus the plan: tiers per
10-question set, adaptivity streaks, multiple-choice cap, recap size). Examples:

- Allow decimals in ×÷10/100: `T14.allowDecimals = true`.
- Turn off "angles add up to 180°": `T25.includeAngleSum = false`.
- Smaller numbers in written methods: `T23.digits` / `T23.maxDigits`.
- Gentler start: edit `PLAN.tiers` (e.g. five tier-1 questions).

After a change run `npm test` (the generator tests check every answer key) and push to `main`.

## Layout

```
src/config/difficulty.ts   every tunable range
src/engine/                seeded RNG, Question model, answer parsing, planner, geometry
src/topics/                one generator module per topic (+ tests, spot-check)
src/ui/                    widgets (number pad, place value, number line, clock, grid, column…), screens, SVG art
src/game/                  nights & friends, pacing/scoring rules, shop, sounds
src/storage/save.ts        versioned local save + progress codes
src/sw-template.js         service worker (filled in at build time)
e2e/                       Playwright tests and the playthrough bot
docs/                      PLAN, ASSUMPTIONS, QA_REPORT, SPOTCHECK
```

All art, characters and names are original (blocky low-poly SVG drawn in code).
