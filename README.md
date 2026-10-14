# 6 Nights at Camp 🏕️🌙

A cosy-spooky forest-camp **maths revision game** for a 9–10-year-old (Units 1 and 2: numbers to a
million, rounding, ×÷10/100, sequences, time, parallel/perpendicular lines, coordinates, mental and
written addition/subtraction, triangles, symmetry, reflection).

**Play:** https://mikellidestheo-alt.github.io/P4-Maths-Revision/

- A **3D forest camp** in a blocky low-poly style: you walk your camper in third person (joystick on
  touch screens, WASD/arrow keys on a laptop, drag to look around).
- Six nights, ~15–20 minutes each, no daily limit. Each night a forest friend is lost at the end of one
  of the six paths. A glowing **quest marker** leads you along the path: Task 1 → Task 2 → Task 3 →
  (the campfire, if anything needs fixing) → and only then does the friend appear at the end of the path.
- Each task is one topic's 10 questions, shown as a 2D screen over a dark forest scene. Missed questions
  come back at the campfire with fresh numbers.
- **"Walk to marker"** walks the camper there automatically, for anyone who finds the joystick tricky.
- Devices without 3D support (no WebGL) automatically get the 2D version of the camp, with the same
  questions and progress. Add `?2d=1` to the address to force it.
- Answers are typed on a built-in number pad, dragged, drawn, tapped on a grid or built — not
  multiple choice (under 10% overall).
- Mistakes never lose anything: 1st miss → a story hint, try again; 2nd miss → a worked solution,
  and the skill comes back at the campfire.
- Coins buy cosmetic camp decorations only. No ads, accounts, tracking or network calls. Progress
  stays on the device.

## Handing it over

1. Open the link on the phone/tablet/laptop she'll use. It opens on a title screen (the 3D camp slowly
   circling behind it) with one big **Start** button — it says **Continue Night N** or **Play Night N**
   once she has begun. There is no setup screen, no account and no grown-ups area.
2. Add it to the home screen (iPhone/iPad: Share → *Add to Home Screen*; Android: ⋮ → *Add to Home
   screen* / *Install app*). It then works offline.
3. Controls: joystick (touch) or W A S D / arrow keys (keyboard) to walk, drag to look around,
   **Walk to marker** to be walked there, then **Start** (or Enter) at a glowing marker. 🔊 toggles sound.

There is **no limit on nights**: she can play as many as she likes in one go. Nights open in story
order (Night 2 after Night 1, and so on), and finished nights can always be replayed.
Spookiness is set in **`src/config/game.ts`**.

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
src/world/                 the 3D forest (Three.js): map layout, quest logic, blocky models, player/camera
src/ui/                    widgets (number pad, place value, number line, clock, grid, column…), screens, SVG art
src/config/game.ts         spookiness
src/game/                  nights & friends, unlocking/scoring rules, shop, sounds
src/storage/save.ts        versioned local save
src/sw-template.js         service worker (filled in at build time)
e2e/                       Playwright tests and the playthrough bot
docs/                      PLAN, ASSUMPTIONS, QA_REPORT, SPOTCHECK
```

All art, characters and names are original (blocky low-poly SVG drawn in code).
