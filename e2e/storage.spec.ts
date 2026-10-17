import { test, expect, type Page } from '@playwright/test';
import { openGame, playQuestion, readSave, setTouch, walkAndInteract, open, reopen } from './bot';

const KEY = 'sixNightsCamp.save';

async function inject(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(([k, p]) => {
    const cur = JSON.parse(localStorage.getItem(k as string) || '{}');
    localStorage.setItem(k as string, JSON.stringify({ ...cur, ...(p as object) }));
  }, [KEY, patch] as const);
  await reopen(page);
}

const done = (stars = 2) => ({ finished: true, bestStars: stars, plays: 1 });

test.beforeEach(() => setTouch(true));

test('first visit goes straight into the 3D camp; there is no grown-ups area', async ({ page }) => {
  await open(page, './?bot=1');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 1 of 6');
  await expect(page.locator('[data-quest]')).toContainText('Task 1 of 3: Label the supply crates');
  await expect(page.locator('[data-action="grownups"]')).toHaveCount(0);
  await expect(page.locator('[data-action="sound"]')).toBeVisible();
  await expect(page.locator('.world-canvas canvas')).toBeVisible();
});

test('background music: starts with Play, goes quiet for questions, and the 🎵 button is remembered', async ({ page }) => {
  const music = () => page.evaluate(() => (window as any).__campMusic.state());
  await page.goto('./?bot=1');
  await expect(page.locator('[data-screen="start"]')).toBeVisible();
  await expect(page.locator('[data-action="music"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect.poll(async () => (await music()).playing).toBe(true);
  expect((await music()).mood).toBe('camp');
  await expect.poll(async () => (await music()).bars).toBeGreaterThan(0);
  // a question: same song, softer and sparser
  await walkAndInteract(page);
  await expect(page.locator('.q-prompt')).toBeVisible();
  expect((await music()).mood).toBe('focus');
  await page.locator('[data-action="exit"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  expect((await music()).mood).toBe('camp');
  // music off: sound effects stay on
  await page.locator('[data-action="music"]').click();
  await expect(page.locator('[data-action="music"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await music()).playing).toBe(false);
  expect((await readSave(page)).settings).toEqual({ sound: true, music: false });
  await page.reload();
  await expect(page.locator('[data-action="music"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  expect((await music()).playing).toBe(false);
  // music on again; then sound off silences the music too
  await page.locator('[data-action="music"]').click();
  await expect.poll(async () => (await music()).playing).toBe(true);
  await page.locator('[data-action="sound"]').click();
  await expect(page.locator('[data-action="music"]')).toHaveAttribute('aria-pressed', 'false');
  expect((await music()).playing).toBe(false);
  // tapping 🎵 while everything is off brings both back
  await page.locator('[data-action="music"]').click();
  await expect(page.locator('[data-action="sound"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await music()).playing).toBe(true);
});

test('full screen button: on the start screen and in the game, toggles full screen and back', async ({ page }) => {
  await page.goto('./?bot=1');
  const fs = page.locator('[data-action="fullscreen"]');
  await expect(fs).toBeVisible();
  await expect(fs).toHaveAttribute('aria-pressed', 'false');
  await fs.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(fs).toHaveAttribute('aria-pressed', 'true');
  await expect(fs).toHaveAttribute('aria-label', 'Leave full screen');
  // stays full screen into the game; the top bar button shows it
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.locator('[data-action="fullscreen"]')).toHaveAttribute('aria-pressed', 'true');
  // left some other way (e.g. Esc): the button follows
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('[data-action="fullscreen"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-action="fullscreen"]').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.locator('[data-action="fullscreen"]').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test('full screen button is left out where the browser has no full screen (iPhone Safari)', async ({ page }) => {
  await page.addInitScript(() => {
    for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(Document.prototype, k, { get: () => false });
    for (const k of ['requestFullscreen', 'webkitRequestFullscreen']) Object.defineProperty(Element.prototype, k, { value: undefined });
  });
  await page.goto('./?bot=1');
  await expect(page.locator('[data-action="play"]')).toBeVisible();
  await expect(page.locator('[data-action="fullscreen"]')).toHaveCount(0);
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-action="music"]')).toBeVisible();
  await expect(page.locator('[data-action="fullscreen"]')).toHaveCount(0);
});

test('after all six nights: the start screen lists each night with its maths; tapping one plays it', async ({ page }) => {
  await page.goto('./?bot=1');
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
    schemaVersion: 3, nights: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, { finished: true, bestStars: n % 3 + 1, plays: 1 }])), flags: { dawnSeen: true },
  })), KEY);
  await page.reload();
  const cards = page.locator('[data-pick-night]');
  await expect(cards).toHaveCount(6);
  await expect(page.locator('.start-sub')).toContainText('Choose a night');
  await expect(cards.nth(0)).toContainText('Bramble the hedgehog');
  await expect(cards.nth(0)).toContainText('Numbers to one million');
  await expect(cards.nth(2)).toContainText('Parallel and perpendicular lines');
  await expect(cards.nth(2)).toContainText('Review: a mix of Nights 1–3');
  await expect(cards.nth(5)).toContainText('Final challenge: a bit of everything');
  await expect(page.locator('[data-action="play"]')).toHaveText(/Explore the camp/);
  // pick Night 3: straight into the forest with Night 3's first job
  await page.locator('[data-pick-night="3"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 3 of 6');
  await expect(page.locator('[data-quest]')).toContainText('Task 1 of 3');
  // come back later: Continue is offered, Night 3 is marked, and picking another night asks first
  await page.reload();
  await expect(page.locator('[data-action="play"]')).toHaveText(/Continue Night 3/);
  await expect(page.locator('[data-pick-night="3"]')).toContainText('In progress');
  await page.locator('[data-pick-night="5"]').click();
  await expect(page.locator('.modal')).toContainText('partway through Night 3');
  await page.locator('[data-modal="Play Night 5"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 5 of 6');
  // stars are kept
  expect((await readSave(page)).nights[3].bestStars).toBe(1);
});

test('2D: after all six nights the night list opens the chosen night', async ({ page }) => {
  await page.goto('./?bot=1&2d=1');
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
    schemaVersion: 3, nights: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, { finished: true, bestStars: 2, plays: 1 }])), flags: { dawnSeen: true },
  })), KEY);
  await page.reload();
  await expect(page.locator('[data-pick-night]')).toHaveCount(6);
  await page.locator('[data-pick-night="4"]').click();
  await expect(page.locator('[data-screen="night"]')).toBeVisible();
  await expect(page.locator('[data-screen="night"]')).toContainText('Adding in your head');
});

test('3D: the marker moves along the path; closing mid-job resumes at the same task', async ({ page }) => {
  await open(page, './?bot=1');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await walkAndInteract(page);
  for (let i = 0; i < 3; i++) await playQuestion(page);
  await reopen(page);
  await expect(page.locator('[data-quest]')).toContainText('Task 1 of 3');
  await walkAndInteract(page);
  await expect(page.locator('.dot.done')).toHaveCount(3);
  for (let i = 0; i < 4; i++) await playQuestion(page);
  await page.locator('[data-action="job-back"]').tap();
  await expect(page.locator('[data-quest]')).toContainText('Task 2 of 3: Fix the trail markers');
  // the next marker is further along the path, away from camp
  const w = await page.evaluate(() => { const x = (window as any).__campWorld; return { p: x.pos, t: x.state.objective.point }; });
  expect(Math.hypot(w.t.x, w.t.z)).toBeGreaterThan(Math.hypot(w.p.x, w.p.z) + 8);
});

test('start screen: night cards with only Night 1 open; Continue mid-night; Enter also starts', async ({ page }) => {
  await page.goto('./?bot=1');
  await expect(page.locator('[data-screen="start"]')).toBeVisible();
  await expect(page.locator('.start-title')).toContainText('Nights at Camp');
  const cards = page.locator('[data-pick-night]');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(0)).toBeEnabled();
  await expect(cards.nth(0)).toHaveClass(/pick-next/);
  await expect(cards.nth(0)).toContainText('▶ Play');
  for (let i = 1; i < 6; i++) {
    await expect(cards.nth(i)).toBeDisabled();
    await expect(cards.nth(i)).toContainText(`Finish Night ${i} to unlock`);
  }
  // locked nights still show what maths is coming
  await expect(cards.nth(1)).toContainText('Time intervals');
  // Enter plays the open night
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 1 of 6');
  await walkAndInteract(page);
  await playQuestion(page);
  await page.reload();
  await expect(page.locator('[data-action="play"]')).toHaveText(/Continue Night 1/);
  await expect(page.locator('[data-pick-night="1"]')).toContainText('In progress');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('.world-canvas canvas')).toBeVisible();
});

test('start screen: finishing a night unlocks the next one; finished nights can be replayed', async ({ page }) => {
  await page.goto('./?bot=1');
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ schemaVersion: 3, nights: { 1: { finished: true, bestStars: 2, plays: 1 }, 2: { finished: true, bestStars: 3, plays: 1 } } })), KEY);
  await page.reload();
  await expect(page.locator('[data-pick-night="1"]')).toBeEnabled();
  await expect(page.locator('[data-pick-night="1"]')).toContainText('★★☆');
  await expect(page.locator('[data-pick-night="2"]')).toContainText('★★★');
  await expect(page.locator('[data-pick-night="3"]')).toHaveClass(/pick-next/);
  for (const n of [4, 5, 6]) await expect(page.locator(`[data-pick-night="${n}"]`)).toBeDisabled();
  await expect(page.locator('.start-sub')).toContainText('Juniper');
  await page.locator('[data-pick-night="3"]').click();
  await expect(page.locator('[data-quest]')).toContainText('Night 3 of 6');
});

test('Unlock All: the passcode opens every night; a wrong code does nothing; it is remembered', async ({ page }) => {
  await page.goto('./?bot=1');
  const btn = page.locator('[data-action="unlock-all"]');
  await expect(btn).toHaveText(/Unlock All/);
  // wrong code (tapped on the keypad): nothing opens
  await btn.click();
  const dlg = page.locator('[data-dialog="unlock"]');
  await expect(dlg).toBeVisible();
  for (const k of ['4', '3', '2', '1']) await dlg.locator(`[data-pass-key="${k}"]`).click();
  await expect(dlg.locator('.pass-status')).toContainText('not the code');
  await expect(dlg.locator('.pass-dot.on')).toHaveCount(0);
  await dlg.locator('[data-action="unlock-cancel"]').click();
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('[data-pick-night="2"]')).toBeDisabled();
  // Esc closes it too, without the start screen reacting
  await btn.click();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('[data-screen="start"]')).toBeVisible();
  // right code (typed, with a correction): every night opens
  await btn.click();
  await page.keyboard.type('19');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('234');
  await expect(dlg).toHaveCount(0);
  for (let n = 1; n <= 6; n++) await expect(page.locator(`[data-pick-night="${n}"]`)).toBeEnabled();
  await expect(page.locator('.start-sub')).toContainText('Every night is open');
  await expect(page.locator('.pick-next')).toHaveCount(1); // only the first unplayed night glows
  await expect(btn).toHaveCount(0);
  expect((await readSave(page)).flags.allUnlocked).toBe(true);
  // remembered after a reload; nothing was marked finished
  await page.reload();
  await expect(page.locator('[data-pick-night="6"]')).toBeEnabled();
  expect(Object.keys((await readSave(page)).nights)).toEqual([]);
  // jump straight to Night 6
  await page.locator('[data-pick-night="6"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 6 of 6');
  // the moons in the game are open too
  await expect(page.locator('[data-moon="4"]')).toBeEnabled();
});

test('Unlock All (3D): tonight\'s tasks can be done in any order; the friend only appears after all three', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./?bot=1');
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ schemaVersion: 3, flags: { allUnlocked: true } })), KEY);
  await page.reload();
  await page.locator('[data-pick-night="1"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('.world-tip')).toContainText('any order');
  const spots = () => page.evaluate(() => (window as any).__campWorld.jobSpots.map((j: any) => j.jobId));
  expect(await spots()).toEqual(['1.1', '1.2', '1.3']);
  await page.evaluate(() => { const w = (window as any).__campWorld; const p = w.jobSpots[0].point; w.teleport(p.x * 0.55, p.z * 0.55); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'e2e/screenshots/unlock-all-open-tasks.png' });
  const goTo = async (jobId: string) => {
    await page.evaluate((id) => {
      const w = (window as any).__campWorld;
      const p = w.jobSpots.find((j: any) => j.jobId === id).point;
      w.teleport(p.x, p.z);
    }, jobId);
    await expect(page.locator('[data-action="interact"]')).toBeVisible();
  };
  const playJob = async () => {
    await expect(page.locator('.q-prompt')).toBeVisible();
    for (let i = 0; i < 7; i++) await playQuestion(page);
    await page.locator('[data-action="job-back"]').click();
    await expect(page.locator('[data-screen="world"]')).toBeVisible();
  };
  // Task 3 first (the marker points at Task 1, but every sign is open)
  await goTo('1.3');
  await expect(page.locator('[data-action="interact"]')).toContainText('Start: Sort the stockroom');
  await page.locator('[data-action="interact"]').click();
  await playJob();
  expect(await spots()).toEqual(['1.1', '1.2']);
  await expect(page.locator('[data-quest]')).toHaveAttribute('data-quest', 'job');
  await expect(page.locator('[data-quest-step]')).toContainText('Task 2 of 3');
  // then Task 2, then Task 1: no friend until the last one is done
  await goTo('1.2');
  await page.locator('[data-action="interact"]').click();
  await playJob();
  await expect(page.locator('[data-quest]')).toHaveAttribute('data-quest', 'job');
  await goTo('1.1');
  await page.locator('[data-action="interact"]').click();
  await playJob();
  await expect(page.locator('[data-quest]')).toHaveAttribute('data-quest', 'friend');
  await expect(page.locator('[data-quest]')).toContainText('Rescue Bramble');
  const save = await readSave(page);
  for (const j of ['1.1', '1.2', '1.3']) expect(save.current.jobs[j].done).toBe(true);
});

test('boy or girl camper on the start screen; camper clothes from the shop', async ({ page }) => {
  await page.goto('./?bot=1');
  const boy = page.locator('[data-avatar="boy"]'), girl = page.locator('[data-avatar="girl"]');
  await expect(boy).toHaveAttribute('aria-pressed', 'true');
  await girl.click();
  await expect(girl).toHaveAttribute('aria-pressed', 'true');
  await expect(boy).toHaveAttribute('aria-pressed', 'false');
  expect((await readSave(page)).equipped.avatar).toBe('girl');
  // the 3D camper behind the menu changes straight away
  expect(await page.evaluate(() => (window as any).__campApp.world.lookId)).toMatch(/^girl\|/);
  // remembered
  await page.reload();
  await expect(page.locator('[data-avatar="girl"]')).toHaveAttribute('aria-pressed', 'true');
  // shop: buy and wear a hat, then take it off
  await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)!); d.coins = 100; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
  await page.reload();
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await page.locator('[data-action="shop"]').click();
  await expect(page.locator('.shop-group').first()).toHaveText('Your camper');
  await page.locator('[data-item="wear-head-pirate"]').click();
  await expect(page.locator('[data-item="wear-head-pirate"]')).toHaveText(/Wearing/);
  let save = await readSave(page);
  expect(save.coins).toBe(65);
  expect(save.equipped.head).toBe('wear-head-pirate');
  // only one hat at a time
  await page.locator('[data-item="wear-head-ears"]').click();
  save = await readSave(page);
  expect(save.equipped.head).toBe('wear-head-ears');
  await expect(page.locator('[data-item="wear-head-pirate"]')).toHaveText('Wear');
  // back in the forest the camper wears it
  await page.locator('[data-action="back"]').click();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__campWorld.lookId)).toContain('wear-head-ears');
  // take it off again
  await page.locator('[data-action="shop"]').click();
  await page.locator('[data-item="wear-head-ears"]').click();
  expect((await readSave(page)).equipped.head).toBeUndefined();
});

test('2D fallback also has the start screen', async ({ page }) => {
  await page.goto('./?bot=1&2d=1');
  await expect(page.locator('[data-screen="start"] svg.scene')).toBeVisible();
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});

test('3D: tapping a moon (replay or next night) keeps the 3D view showing', async ({ page }) => {
  await open(page, './?bot=1');
  await inject(page, { nights: { 1: done() } });
  await expect(page.locator('[data-quest]')).toContainText('Night 2 of 6');
  await page.locator('[data-moon="1"]').click();
  await page.locator('[data-modal="Replay Night 1"]').click();
  await expect(page.locator('[data-quest]')).toContainText('Night 1 of 6');
  await expect(page.locator('[data-quest]')).toContainText('(replay)');
  await expect(page.locator('.world-canvas canvas')).toBeVisible();
  const moving = await page.evaluate(() => new Promise<boolean>((r) => {
    const w = (window as any).__campWorld; const t0 = w.camera.position.clone(); w.camYaw += 1;
    setTimeout(() => r(w.camera.position.distanceTo(t0) > 0.1), 600);
  }));
  expect(moving, 'the 3D view is still running').toBe(true);
});

test('3D: walking with the keyboard moves the camper', async ({ page }) => {
  await open(page, './?bot=1');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  const before = await page.evaluate(() => ({ ...(window as any).__campWorld.pos }));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => ({ ...(window as any).__campWorld.pos }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
});

test('no night limit: after five nights today, Night 6 can start straight away; replays always work', async ({ page }) => {
  await open(page, './?bot=1&2d=1');
  await openGame(page);
  await inject(page, { nights: { 1: done(), 2: done(), 3: done(), 4: done(), 5: done() } });
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 6/);
  await expect(page.locator('.sleep-note, .pace-note')).toHaveCount(0);
  await page.locator('[data-moon="1"]').click();
  await page.locator('[data-modal="Replay Night 1"]').click();
  await expect(page.locator('[data-screen="night"]')).toContainText('(replay)');
});

test('story order still applies: a later night opens when the one before is finished', async ({ page }) => {
  await open(page, './?bot=1&2d=1');
  await openGame(page);
  await expect(page.locator('[data-moon="2"]')).toBeDisabled();
  await inject(page, { nights: { 1: done() } });
  await expect(page.locator('[data-moon="2"]')).toBeEnabled();
  await expect(page.locator('[data-moon="3"]')).toBeDisabled();
});

test('works with storage blocked (private mode) and says progress will not be saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError: storage blocked'); } });
  });
  await open(page, './?bot=1&2d=1');
  await openGame(page);
  await expect(page.locator('.warn-note')).toBeVisible();
  await page.locator('[data-action="start"]').tap();
  await page.locator('[data-job="1.1"]').tap();
  await playQuestion(page);
  await playQuestion(page);
  await expect(page.locator('.dot.done')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a corrupted save does not crash the game; an old save is migrated', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, './?bot=1&2d=1');
  await page.evaluate((k) => localStorage.setItem(k, '{"schemaVersion":1, "nights": {broken'), KEY);
  await reopen(page);
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 1/);
  const backup = await page.evaluate((k) => localStorage.getItem(k + '.corrupt'), KEY);
  expect(backup).toContain('broken');
  // a v1 save from before the grown-ups area was removed keeps its progress
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ schemaVersion: 1, setupDone: true, pin: '1234', nickname: 'Robin', coins: 12, nights: { 1: { finished: true, bestStars: 1, plays: 1 } } })), KEY);
  await reopen(page);
  await expect(page.locator('[data-coins]')).toHaveText('12');
  await expect(page.locator('[data-tonight]')).toHaveAttribute('data-tonight', '2');
  const save = await readSave(page);
  expect(save.schemaVersion).toBe(3);
  expect(save).not.toHaveProperty('daily');
  expect(save).not.toHaveProperty('pin');
  expect(errors).toEqual([]);
});

test('2D fallback: closing the app mid-night resumes where she left off', async ({ page }) => {
  await open(page, './?bot=1&2d=1');
  await openGame(page);
  await page.locator('[data-action="start"]').tap();
  await page.locator('[data-job="1.1"]').tap();
  for (let i = 0; i < 3; i++) await playQuestion(page);
  await reopen(page);
  await expect(page.locator('[data-action="start"]')).toHaveText(/Continue Night 1/);
  await page.locator('[data-action="start"]').tap();
  await expect(page.locator('[data-job="1.1"]')).toContainText('3/7 done');
  await page.locator('[data-job="1.1"]').tap();
  await expect(page.locator('.dot.done')).toHaveCount(3);
});
