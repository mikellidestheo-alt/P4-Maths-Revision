# Assumptions and decisions (please check)

The school textbook wasn't available, so content is based on the test topic list only, pitched at
age 9–10 ("Stage 5 / P5"). Every range below is in `src/config/difficulty.ts` and easy to change.

## Content — worth a quick look
| Topic | What the game asks | Assumption to confirm |
|---|---|---|
| **1.1 Numbers to one million** | Build a number from words in a place-value chart; words → digits; value of a digit; partition by place value; "10,000 more/less than…" | Tier 1 up to 99,999, tier 2 up to 999,999, tier 3 includes 1,000,000 and tricky zeros (e.g. 600,970). Number words use UK style ("three hundred **and** five"). Children write numbers in digits only (no typing words). |
| 1.2 Counting in multiples | Missing trail markers, "count on/back N steps of…", step size | The sheet says "10, 100 or 100" — treated as **10, 100 or 1000**. Sequences cross hundreds/thousands/10,000s/100,000. No negative numbers. |
| 1.3 Round and order | Round to nearest 10/100/1000 (10,000 at tier 3) on a number line or typed; midpoint rounds **up**; order 3–6 numbers; < > = | Tier 3 adds "smallest/largest whole number that rounds to …". |
| 1.4 ×÷ 10 or 100 | Slide digits on a place-value chart; typed; missing numbers; word problems | **Whole numbers only** (decimals behind `T14.allowDecimals`, off). |
| 1.5 Sequences | Next terms, missing terms, the rule (add/take away N), odd one out, the nth term | Steps 3–10, 25, 50, 100, 1000; decreasing sequences stay ≥ 0. |
| 1.6 Time intervals | Set an analogue clock (minute hand snaps to 5 min); elapsed time; end/start time; hours↔minutes; 12↔24-hour | Tier 3 includes intervals past midnight ("until dawn"). 24-hour answers accept "7:35" or "07:35"; "7.30" and "730" are accepted too. |
| **1.7 Parallel & perpendicular** | Draw a fence parallel/perpendicular from a point on a grid; spot the parallel pair / the perpendicular line; count parallel side pairs / right angles in a shape; complete a parallelogram | Perpendicular means "would meet at a right angle if extended" — the drawn lines needn't touch. Includes diagonal lines (1:1, 1:2) from tier 2–3. Some of this may go beyond your curriculum guide. |
| 1.8 Coordinates | First quadrant only; plot, read, missing rectangle corner, moves ("4 right, 2 up"), describe a move | Grids 8×8 (tier 1), 10×10, 12×12 (tier 3). Coordinates written (x, y). |
| 2.1 / 2.2 Mental + / − | 2-digit with bridging → 3-digit ± multiples of 10/100 → 4-digit ± near-round; missing numbers; complements to 100/1000; near doubles; differences | Strategy hints (partition, bridge, compensate, count on). No timer. |
| 2.3 / 2.4 Written methods | Column method with carry/exchange boxes; tier 3: 3 addends, exchanging across zeros, "check with the inverse" | Up to 6 digits. Only the answer row is marked; carry/exchange boxes are working space. Feedback names the column that went wrong. |
| 2.5 Triangles | Drag corners to build right-angled / isosceles / scalene / right-angled isosceles; classify by side lengths; sort into groups; side/perimeter facts; **angles add to 180°** at tier 3 | Equilateral can't be built on a square grid, so it's only classified, not built. Isosceles includes "at least two equal sides". |
| 2.6 Symmetry | Count lines of symmetry; tap every fold line; complete a pattern about one or two mirror lines | Circles excluded (infinitely many lines). The rectangle's diagonals are a deliberate distractor. |
| 2.7 Reflection | Tap the reflected corners of a shape; reflect a point in x = k / y = k | Horizontal/vertical mirrors only (diagonals out of scope). Tier 1–2 shapes are 1–2 squares from the mirror; tier 3 uses labelled lines like x = 5 and bigger gaps. |
| Reviews | Unit 1 review (Night 3), Unit 2 review + Final mixed (Night 6) | Mixed topics, weighted towards weaker topics, max 2 per topic per review. |

## Game decisions
- **Multiple choice** = picking one answer from a short list (1.3 `< > =`, 1.7 "parallel / perpendicular / neither", 2.5 "which type of triangle?"). Capped at 2 per 10-question job and 1 per review → about 2% overall in simulation of 200 full playthroughs (unit test asserts < 10%). Tapping lines in a picture and sorting cards into groups are counted as *interactive*, not multiple choice.
- **Night plan:** 10 questions per job, tiers 1,1,1,1,2,2,2,2,3,3. 2 wrong in a row → next one a tier easier; 3 right in a row → a tier harder. The check-in "too easy/too hard" moves later nights one step (±1 max).
- **"To review"** = needed the worked solution (missed twice). Those come back at the Campfire with new numbers (up to 8 distinct skills, same or easier tier). Questions fixed on the second try are listed for parents but don't go to the recap.
- **Stars** per night from first-try accuracy on the 30 job questions: ≥ 90% ★★★, ≥ 70% ★★, otherwise ★.
- **Coins:** +2 right first time, +1 right second time, +2 for each mistake fixed at the campfire, +10 for a rescue (+5 on replays). The shop has 16 cosmetic items; buying nearly everything takes about the whole game.
- **Pacing** counts nights *finished* for the first time per local calendar date. A night already started can be finished even if the allowance is reached; replays never count.
- Only one night can be "in progress" at a time (a replay must be finished before another night starts) to keep things simple.
- **Parent gate:** the PIN is optional so the default first-run path is a single "Continue". Without a PIN, the grown-ups area opens with a 3-second press-and-hold. "Forgot PIN" asks a grown-up multiplication (3-digit × 2-digit) to remove it. This is child-proofing, not security.
- **Progress codes** leave out the PIN and any night in progress.
- The guide is "Wren", an original camp ranger. Friends: Bramble (hedgehog), Tock (owl), Juniper (fox), Ember (firefly), Lumi (moth), Ripple (otter) — all original.
- Spookiness only changes mist density and the number of friendly blinking eyes in the trees. Nothing jumps out.
- "Drag a mirror line onto a shape" (2.6) is implemented as "tap every fold line" from candidate lines — far more reliable on small touch screens. "Draw a line" (1.7) is drag-from-the-lantern *or* tap the end dot.

## Things the owner should confirm
1. Is 1.1 tier 3 (numbers with tricky zeros up to 1,000,000) and the diagonal lines in 1.7 in line with the class?
2. Should ×÷10/100 include decimals (e.g. 4.5 × 10)? Currently **off**.
3. Is 24-hour time expected (used from tier 2)? Intervals past midnight appear at tier 3.
4. Angles in a triangle (180°) — included at tier 3; turn off with `T25.includeAngleSum = false`.
