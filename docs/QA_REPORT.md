# QA report — 6 Nights at Camp

Verified in the build session on 13 October 2026 (Linux container, headless Chromium 1194 via
Playwright 1.56). Nobody has played it on a real phone yet — see "Not verified" below.

## Summary

| Check | Result |
|---|---|
| `npm test` — 152 unit tests (engine, planner, every topic generator) | ✅ pass |
| `npm run build` — type-check + production build (≈72 KB JS gzipped, 8 KB CSS) | ✅ pass |
| Bot plays the whole game through the real UI (6 nights, 180 job questions + recaps) to the Dawn | ✅ pass (repeated with fresh random questions — see below) |
| Bot "wrong answers" variant: retry → hint, worked solution, review marking, Campfire recap, rescue | ✅ pass |
| Viewport matrix (6 sizes) — every screen and every interaction type | ✅ pass |
| No night limit (six nights in one sitting), story order, replays | ✅ pass |
| Storage blocked, corrupted save, old-schema migration (v1 → v2), mid-night resume | ✅ pass |
| Real touch drags (Chrome touch emulation), typed fallbacks, arrow-button fallback, laptop keyboard | ✅ pass |
| Offline after first visit; new deploy picked up; old caches removed; offline then serves the new build | ✅ pass |
| WebKit (Safari engine) | ⚠️ not run — WebKit is not installed in this environment (see below) |

## Update — grown-ups area and night limits removed
At the owner's request the whole parent mode was removed (first-run setup, PIN gate, grown-ups area,
nickname, settings, progress codes, parent unlock/reset, "How was tonight?"). Spookiness (Cosy) is
fixed in `src/config/game.ts`. Then **all night limits were removed** (no daily allowance, no "camp is
asleep" rest screen); nights still open in story order. The save schema moved to v3 with migrations
that keep existing progress. All unit and end-to-end tests were updated and re-run after the change
(results below reflect the current build).

## Update — 3D world (third person, quest markers)
The camp and forest are now a 3D world (Three.js): a blocky camper in third person, Wren, the six
friends as blocky 3D animals, six forest paths with landmarks, quest markers (light beam, ground ring,
bobbing arrow, a guide arrow by the camper's feet, and a quest card with the distance). Tasks stay 2D
on a dark forest backdrop. Verified:
- **Unit tests (152):** every task/campfire/friend spot is open ground; no tree on a path or in camp;
  every "Walk to marker" route (from camp, from every spot, from the forest edge, to every night)
  sampled every 0.25 units never touches a tree, plinth, campfire or camp prop; quest order
  Task 1 → 2 → 3 → campfire (only when needed) → friend; next night after a rescue; "done" after Night 6;
  save migration.
- **Bot, 3D:** walks to every marker with the real "Walk to marker" button and presses the real Start
  button; plays all six nights to the Dawn (~4 minutes including walking).
- **Bot, 2D fallback (`?2d=1`):** all six nights to the Dawn, so devices without WebGL still work.
- **Wrong-answer flow in 3D:** after misses, the campfire marker appears before the friend; the friend
  only appears after the recap.
- **3D specifics:** keyboard walking moves the camper; the marker moves further along the path after each
  job; a reload mid-job resumes at the same task; the 3D world loads offline.
- **Layout:** the world HUD at all six viewports (quest card, joystick and walk button inside the screen
  and not overlapping) plus the 2D fallback screens.
- Looked at screenshots of: the camp (with every shop decoration, a pink lantern, Wren's hat), all six
  friend reveals and landmarks, the dawn world with rescued friends, and the forest backdrop behind tasks.
  Fixed from those: camera too close on phones, square fireflies, install tip covering the view, bushes
  hiding Bramble, campfire/plinths without colliders.
- **Performance:** measured here only with software (CPU) rendering — about 20 fps on a phone-sized
  screen. Real phones/tablets draw on the GPU and should be much smoother, but this has **not** been
  checked on a real device. The trees are 2 instanced draw calls; pixel ratio is capped at 1.5.

## Update — start screen
The game now opens on a title screen: "6 Nights at Camp", the six moons (filled for rescued friends),
one big Play button (**Start** / **Continue Night N** / **Play Night N** / **Explore the camp**, Enter
also works), a sound toggle and a short "How to play". Behind it the real 3D camp circles slowly
(no quest beam, no input); without WebGL it shows the 2D camp. Verified:
- Start screen at all six viewports: title, moons and Play button fit with no scrolling and the Play
  button is ≥44px; screenshots reviewed.
- Play goes to the 3D world (or the 2D camp with `?2d=1`); the label follows progress; every e2e spec
  (bot playthroughs 3D and 2D, wrong-answer flow, storage, offline, widgets) now starts from this screen.
- Found and fixed while doing this: going from the world to the world (tapping a moon) unmounted the
  shared 3D world, leaving a blank screen. Screens now only unmount it if it is still theirs; covered by
  a new test.

## Update — background music
A gentle campfire lullaby plays in the background: a slow waltz (80 bpm) with a soft held chord, a
music-box pattern, an occasional bell tune and a few crickets, all with a little reverb. It is made in
code with Web Audio, so there are no audio files to download and it works offline. During questions the
same song carries on, sparser and at under half the volume, with no tune or crickets so it doesn't pull
attention. After all six rescues (dawn) it changes to a brighter key with birdsong. 🎵 turns the music on
and off (remembered); 🔊 still silences everything. It starts on the first tap, as phones require, and
fades out when the app is in the background. Verified:
- **Unit tests:** over 400 bars per mood, every note fits the chord (no semitone clashes), notes stay
  inside their bar, pitch and volume stay in range, the same seed gives the same music; focus mode has no
  tune or animal calls and fewer notes; camp has crickets, dawn has birds.
- **Rendered and measured** (offline in Chromium): no clicks, nearly all energy below 2 kHz (warm, nothing
  shrill), steady loudness, and about 6 dB quieter than the sound effects (questions about 13 dB quieter).
- **e2e:** music starts with Play; mood goes camp → focus in a question → camp again; 🎵 off stops
  it and keeps sound effects; the setting survives a reload; 🔊 off stops the music too; 🎵 while
  everything is off turns both back on. Layout tests pass with the extra button at all six sizes.
- **Not verified:** how it sounds on a real phone speaker (small speakers lose the low bass; the
  melody and music-box parts are in the range phones play well).

## Update — full screen
A full screen button (expand-corners icon) sits next to 🎵 and 🔊 on the start screen and in the top bar.
It hides the browser's address bar and tabs; the 3D world resizes to fill the screen. Tapping it again,
pressing Esc or swiping out all leave full screen, and the button always shows the current state. It is
not saved between visits, because browsers only allow full screen straight after a tap. iPhone Safari
has no full screen for web pages, so the button is left out there (adding the game to the home screen
already opens it without the browser bars). Verified (e2e): the button toggles full screen on and off,
full screen carries on from the start screen into the game, the button follows when full screen is left
another way, and it is left out when the browser has no full screen. Layout tests pass at all six sizes.

## Update — choose a night (after the first round)
Once all six nights are finished, the start screen shows "All six friends are safe! Choose a night to
play again:" and six cards. Each card has the night number, the friend, her best stars for it and the three
kinds of maths in it, with the same job icons as the forest signs (reviews say which nights they mix, e.g.
"Review: a mix of Nights 1–3"; Night 6 ends with "Final challenge: a bit of everything"). Tapping a card
goes straight into that night (3D: the marker leads to its first task; 2D: that night's camp screen).
"Explore the camp" stays underneath. If a replay is half done, "Continue Night N" sits on top, that card
is marked "In progress", and choosing a different night asks first (stars are always kept). Before the
first round is complete the start screen is unchanged. Verified:
- **Unit tests:** every night lists its jobs in play order with the real topic titles; the review labels
  match the nights their questions actually come from.
- **e2e (3D and 2D):** the list appears only after all six nights; card contents; picking Night 3 starts
  Night 3; Continue/In progress after a reload; switching to Night 5 asks first and keeps stars.
- **Layout:** the list fits all six sizes with no sideways scrolling; it scrolls where the screen is short
  (phones, landscape) and every card and "Explore the camp" can be reached; one column on phones, two on
  tablets in portrait, three on wider screens. Screenshots reviewed.

## Deployment status
- GitHub Pages is enabled (source: GitHub Actions). Every push to `main` runs **Deploy to GitHub
  Pages**: unit tests → build → publish. The first runs failed only because Pages wasn't enabled yet;
  since then deploys succeed (first successful deploy: run #4, "Remove all night limits").
- Live at https://mikellidestheo-alt.github.io/P4-Maths-Revision/. The live URL could not be fetched
  from this build environment (outbound access to github.io is blocked here); the identical build was
  tested locally under the same `/P4-Maths-Revision/` path.

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

- Plays nights 1–6 back to back in one sitting (there is no night limit and never a "come back
  tomorrow" screen) and reaches the **Dawn** screen.
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

### Unlocking and storage — `e2e/storage.spec.ts`
First visit opens straight on the camp; there is no grown-ups button. No night limit: with five nights
finished, Night 6 starts straight away; replays always work. Story order: Night 2 is locked until Night 1
is finished. Storage blocked (`localStorage` throws): game plays and the home screen says
progress won't be saved. Corrupted JSON: fresh start, no crash, raw copy kept as a backup key. A v1
save (with the old PIN/nickname fields and daily counter) migrates to v3 keeping coins and nights. Closing mid-night:
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
