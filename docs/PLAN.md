# Build plan — 6 Nights at Camp

Status key: [x] done · [ ] to do

## Architecture in one paragraph
Vite + TypeScript, vanilla DOM/SVG. `src/engine` holds the seeded RNG, the
`Question` model, answer parsing and the night planner (tier ramp + light
adaptivity + review weighting). `src/topics` has one module per test topic
(15 + the review mixers), each a pure `generate(rng, tier, ctx)` function that
returns a fully self-checking `Question`. `src/ui/widgets` renders each
interaction type (fields + numpad, place-value chart, number line, ordering,
clock, grid, column method, bins, line picker). `src/ui/screens` are the game
screens; `src/game` holds nights/friends/rewards/unlocking rules; `src/storage`
is the versioned save. A hand-written service worker (generated at build
time by a tiny Vite plugin) gives offline play and clean updates.

## Milestones
- [x] M0 Scaffold, PWA, Pages workflow, save system, home + moons, shared widgets
- [x] M1 Night 1 (1.1, 1.2, 1.3) incl. recap, rescue, rewards, check-in
- [x] M2 Night 2 (1.4, 1.5, 1.6 + clock widget)
- [x] M3 Night 3 (1.7 line drawing, 1.8 grid, Unit 1 review)
- [x] M4 Night 4 (2.1, 2.2, 2.3 column widget)
- [x] M5 Night 5 (2.4, 2.5 triangle builder, 2.6 symmetry)
- [x] M6 Night 6 (2.7 reflection, Unit 2 review, Final challenge, Dawn)
- [x] M7 Shop, audio, a11y, offline/update, full QA, docs
- [x] Follow-up: grown-ups/parent area removed at the owner's request (save schema v2)
- [x] Follow-up: daily night limit and rest screen removed at the owner's request (save schema v3)
- [x] Follow-up: 3D third-person forest world with quest markers (Three.js), 2D fallback, dark forest backdrop behind tasks
- [x] Follow-up: start (title) screen over the circling 3D camp, with a 2D fallback version
- [x] Follow-up: background music (synthesised campfire lullaby; quieter during questions; brighter at dawn; 🎵 toggle)
- [x] Follow-up: full screen toggle (start screen and top bar; hidden where unsupported)
- [x] Follow-up: after all six nights, the start screen lists the nights with their maths topics to choose from
- [x] Follow-up: the night cards are always on the start screen; Nights 2–6 locked (story order) until the first playthrough
- [x] Follow-up: "Unlock All" button on the title screen behind a passcode (1234)
- [x] Follow-up: Unlock All also opens every task in a night (any order); the friend still appears only after all three
- [x] Follow-up: boy/girl camper choice on the title screen; camper clothes and accessories in the shop
- [x] Follow-up: 7 questions per task (was 10), with question-type variety within each task

Note: because the whole game was built in one autonomous session, the
milestones were developed in order on one branch and verified together;
see `docs/QA_REPORT.md`.

## Verification checklist
- [x] Unit tests: ≥500 generated questions per topic, all tiers
- [x] Bot playthrough of all six nights through the real UI, to Dawn
- [x] Bot "wrong twice" variant (retry flow, review marking, recap)
- [x] Viewport matrix screenshots + layout assertions
- [x] No night limit / story order; storage disabled / corrupted / migrated
- [x] Offline reload + update after redeploy
- [x] Content spot-check (20 per topic, printed by `npm run spotcheck`)
