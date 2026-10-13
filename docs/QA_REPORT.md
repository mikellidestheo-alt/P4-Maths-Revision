# QA report — 6 Nights at Camp

Verified in the build session on 13 October 2026 (Linux container, headless Chromium 1194 via
Playwright 1.56). Nobody has played it on a real phone yet — see "Not verified" below.

## Summary

| Check | Result |
|---|---|
| `npm test` — 144 unit tests (engine, planner, every topic generator) | ✅ pass |
| `npm run build` — type-check + production build (≈72 KB JS gzipped, 8 KB CSS) | ✅ pass |
| Bot plays the whole game through the real UI (6 nights, 180 job questions + recaps) to the Dawn | ✅ pass (repeated with fresh random questions — see below) |
| Bot "wrong answers" variant: retry → hint, worked solution, review marking, Campfire recap, rescue | ✅ pass |
| Viewport matrix (6 sizes) — every screen and every interaction type | ✅ pass |
| Pacing with a mocked clock (3 new nights a day, replays free, next day resets) | ✅ pass |
| Storage blocked, corrupted save, old-schema migration (v1 → v2), mid-night resume | ✅ pass |
| Real touch drags (Chrome touch emulation), typed fallbacks, arrow-button fallback, laptop keyboard | ✅ pass |
| Offline after first visit; new deploy picked up; old caches removed; offline then serves the new build | ✅ pass |
| WebKit (Safari engine) | ⚠️ not run — WebKit is not installed in this environment (see below) |

## Update — grown-ups area removed
At the owner's request the whole parent mode was removed (first-run setup, PIN gate, grown-ups area,
nickname, settings, progress codes, parent unlock/reset, "How was tonight?"). Nights per day (3) and
spookiness (Cosy) are now fixed in `src/config/game.ts`. The save schema moved to v2 with a migration
that keeps existing progress. All unit and end-to-end tests were updated and re-run after the change
(results below reflect the current build).

## Deployment status
- `main` was updated and the **Deploy to GitHub Pages** workflow ran on GitHub: `npm ci`, the unit
  tests and the production build all **passed on GitHub's runner**. The final Pages step stopped with
  "Get Pages site failed … Not Found" because Pages is not yet enabled for the repository.
- **To finish:** GitHub → repository **Settings → Pages → Build and deployment → Source: GitHub
  Actions**, then **Actions → Deploy to GitHub Pages → Run workflow** (or push any commit). The game
  will then be live at https://mikellidestheo-alt.github.io/P4-Maths-Revision/.
- The live URL could not be fetched from this build environment (outbound access to github.io is
  blocked here), so the deployed site itself has not been loaded by me; the identical build was
  tested locally (offline/update test serves it under the same `/P4-Maths-Revision/` path).

## Unit tests (`npm test`)

For **each of the 15 topics**, 600 questions are generated (200 per tier, seeded) and the tests assert:

- the expected answer passes `check()`, and a guaranteed-wrong answer fails with feedback;
- single-number answers are unique (nearby values ±1, ±2, ±3, ±10, ±100 are all rejected);
- sensible equivalents are accepted (`" 01,000 "` = `1000`; times `7:30` / `07:30` / `7.30`);
- typed fallbacks agree with the main check;
- no `NaN`/`undefined`, no negative numbers anywhere in the text, all numbers ≤ 1,000,000;
- every sub-skill can be regenerated at every tier (needed by the Campfire recap);
- enough variety (few duplicates);
- topic-specific maths: rounding (half rounds up), counting sequences within range, elapsed times,
  column sums/differences correct and ≤ 6 digits, triangle builder start/answer, parallel/perpendicular
  line drawing has valid answers, symmetry line counts match a geometric check for every shape.

Planner tests: tier ramp 1,1,1,1,2,2,2,2,3,3; adaptivity (2 wrong → easier, 3 right → harder);
40 simulated full sessions with no repeated question in a session, MC cap respected, review spread
≤ 2 per topic, **multiple choice < 10%** (measured ≈ 2% over 200 simulated playthroughs).

### Bugs the tests caught (and fixed)
- Worked solution for subtraction across zeros said "−1 is smaller than 4" (e.g. 602 − 349). Rewritten
  to explain exchanging across zeros properly; regression test added.
- Several wording issues found in the content read-through (see below).

## Content review

`npm run spotcheck` writes **docs/SPOTCHECK.md**: 20 generated questions per topic (story, prompt,
input, answer, hint, worked solution). I read all 300. Changes made after reading:

- 1.2 hint had a double space and an odd phrase → "Take care when you cross a thousand!".
- 1.3 rounding hint "the digit just to the right of the 10s place" → "Look at the ones digit. 5 or more? Round up…".
- 1.5 step notation "−5" (looked like a negative number) → "take away 5".
- 1.6 "From 1 pm onwards, add 12" (12:xx pm was mis-described); minutes conversion "+ 0" removed.
- 1.7 "0 right, 4 up" → "4 up".
- 2.3 three-number story read awkwardly → "Three deliveries of sticks arrived: …".
- 2.4 worked solutions now say "The 7 is now 6" after an exchange.
- 2.6 "A equilateral triangle" → "An".
- 2.5 side lengths unified to metres (tents).

UK spelling throughout (maths, colour, centre, metres); short sentences; no scary content.

## End-to-end tests (`npm run e2e`)

### Bot playthrough — `e2e/bot.spec.ts`
The bot reads each question's expected answer (exposed only with `?bot=1`) and answers **through the
UI**: tapping the number pad, dragging digit tiles and the number-line lantern (and tap-to-place on
alternate questions), using the order arrows, clock buttons, grid dots, triangle corner drags, column
boxes, sorting cards (drag and tap), and tapping fold lines.

- Mocked clock: Saturday 17 Oct 2026 09:00. Nights 1–3 → **rest screen** ("camp is asleep"), home has
  no Start button. Clock moved to Sunday 18 Oct → nights 4–6 → **Dawn** screen.
- Asserts: all six nights finished with 3 stars, 180 job questions, every topic attempted ≥ 10 times,
  no page errors.
- Typical run time ≈ 1.5 minutes.

Repeat runs (fresh random questions each time) — results:

- First run: pass. Then batches of repeats exposed two problems, both fixed:
  1. Symmetry fold lines were clipped at the picture edge, so their ends couldn't be tapped (real bug).
  2. A shaded triangle sat on top of grid dots and blocked the test's "tap the dot" action (a real
     finger tap still worked, but drawn marks now never block taps).
  Also an over-strict test (it required every interaction type in one random game) was relaxed.
- Final: **6 out of 6** full-game repeats pass (≈1.7 min each), plus the full suite below.

### Wrong-answer flow — `e2e/wrong.spec.ts`
Night 1 with deliberate misses: first miss shows "Not quite!", the story feedback and the hint, the
button becomes "Try again"; second miss shows "Let's work it out together", the answer and "This one
will come back at the campfire". The Campfire offered 3–8 skills to fix; every recap question
re-tested a skill that was missed (same kind, new numbers); missing a recap question twice still moves
on; rescue shows fewer than 3 stars; answering "too hard" sets the difficulty nudge to −1.

### Viewport matrix — `e2e/layout.spec.ts`
Sizes: iPhone portrait 390×844, iPhone landscape 844×390, small Android 360×740, tablet portrait
820×1180, tablet landscape 1180×820, laptop 1366×768. For home, night, shop, friends,
and **21 question previews covering every interaction type**, it asserts:
no horizontal scroll; no control clipped sideways; tap targets ≥ 40 px (most are 44–56 px); the prompt
and the Check button are on screen; the first answer box is visible above the number pad; the number
pad never overlaps the question area.

Problems found this way and fixed:
- Map questions on the small Android phone pushed the answer boxes below the pad → pictures now shrink
  to fit above the pad.
- Plank labels clipped at the picture edge → kept inside.
- Triangle-sorting cards had unreadable side lengths → written as text on the card.
- Landscape two-column layout was overridden by a later CSS rule → fixed.
- Laptop: question content now centred with slightly larger text.
- Symmetry fold lines extended past the picture so their ends couldn't be tapped → picture bounds now
  include the whole line (`e2e/lines.spec.ts` checks 40 shapes).

Screenshots: `e2e/screenshots/<viewport>--<screen>.png` (regenerated on each run; not committed).

### Widgets — `e2e/widgets.spec.ts` (touch phone + laptop)
- Every drag/draw/tap question with a typed fallback (12 kinds) answered correctly via "Having trouble?
  Type … instead".
- **Real touch drags** (Chrome DevTools touch events): digit tile into a column, number-line lantern,
  order card from bottom to top, triangle corner, clock minute hand. This caught a real bug: the clock
  hands ignored touch drags because `touch-action: none` was set on SVG groups (ignored by browsers)
  instead of the SVG — fixed.
- Grid point placed with the arrow-button fallback; fence drawn by dragging from the lantern.
- Laptop: typing digits and Enter on a physical keyboard; Enter for Next; times with a colon.

### Pacing and storage — `e2e/storage.spec.ts`
First visit opens straight on the camp; there is no grown-ups button. Pacing (3 a day): after three
new nights the camp sleeps; tonight's moon → rest screen; replaying a finished night is allowed and
doesn't use the allowance; the next calendar day restores the allowance by itself; with two nights done
the third can still start. Storage blocked (`localStorage` throws): game plays and the home screen says
progress won't be saved. Corrupted JSON: fresh start, no crash, raw copy kept as a backup key. A v1
save (with the old PIN/nickname fields) migrates to v2 keeping coins and nights. Closing mid-night:
"Continue Night 1", job shows "3/10 done", resumes at question 4.

### Offline and updates — `e2e/offline.spec.ts`
Two builds served from a local server. After the first visit the service worker controls the page;
offline reload loads the home screen and a question with the number pad. After "deploying" build B:
the next visit shows build B immediately, the new cache replaces the old one, and offline then serves
build B (never the stale build).

## Accessibility notes
Colour contrast of main text on the night background is high (≈ 15:1; muted text ≈ 10:1; button text
on orange ≈ 9:1). Status is never shown by colour alone (ticks, text labels, "Strong / Worth practising"
words). Visible focus rings, `aria-label`s on icon buttons, radio/checkbox roles on choices, live
regions for feedback, keyboard support for the number pad, number line, order list and line picking.
Reduced motion follows the device setting and stops all animation.

## Not verified / known limitations
- **No real-device testing.** Behaviour on actual iPhones/iPads (Safari), Android Chrome and the
  installed home-screen app was simulated with Chromium only.
- **WebKit not run**: Playwright WebKit isn't installed here and the environment rules forbid
  installing browsers. To run it: `npx playwright install webkit && PW_WEBKIT=1 npm run e2e`.
- iOS-specific: audio needs a first tap (handled); "Add to Home Screen" must be done from Safari's
  Share menu (the in-game tip says so). iOS may clear website data for home-screen apps that are
  unused for weeks — irrelevant for a weekend but worth knowing.
- The 12×12 reflection grid is small on a 360 px phone (each square ≈ 26 px). Taps snap to the
  nearest dot, there's a ghost marker while pressing, and an arrow-button fallback and typed fallback.
- Sound effects are synthesised and were not listened to on device speakers.
- Night length (15–20 min) is an estimate; the bot takes ~15 s per night.
