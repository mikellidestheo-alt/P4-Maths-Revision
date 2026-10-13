/** The test bot: answers questions through the real UI using each question's expected answer. */
import { expect, type Page, type Locator } from '@playwright/test';

type Pt = [number, number];
interface Info {
  type: string;
  interaction: any;
  expected: any;
  wrong: any;
  qid: string;
  index: number;
  attempts: number;
  resolved: boolean;
  mode: string;
  kind: string;
  topicId: string;
}

export async function info(page: Page): Promise<Info> {
  return page.evaluate(() => {
    const c = (window as any).__camp;
    return {
      type: c.type, interaction: c.interaction, expected: c.expected, wrong: c.wrong, qid: c.question.id,
      index: c.index, attempts: c.attempts, resolved: c.resolved, mode: c.mode, kind: c.question.kind, topicId: c.question.topicId,
    };
  });
}

let useTouch = false;
export function setTouch(t: boolean) {
  useTouch = t;
}
async function tap(l: Locator) {
  if (useTouch) await l.tap();
  else await l.click();
}

async function typeInto(page: Page, fieldSel: string, value: string) {
  await tap(page.locator(fieldSel).first());
  // clear what's there
  const current = (await page.locator(fieldSel).first().innerText()).trim();
  for (let i = 0; i < current.length; i++) await tap(page.locator('.numpad [data-key="back"]'));
  for (const ch of value) {
    const key = ch === '.' && !value.includes(':') ? '.' : ch;
    await tap(page.locator(`.numpad [data-key="${key}"]`));
  }
}

async function dragTo(page: Page, from: Locator, to: Locator) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag: element not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** Click a point on an SVG <line> inside the element, at fraction t along it (screen coords). */
async function clickLine(page: Page, id: string) {
  const pt = await page.evaluate((lid) => {
    const g = document.querySelector(`[data-line="${lid}"]`)!;
    const line = g.querySelector('line.pick-vis') as SVGLineElement;
    const svg = line.ownerSVGElement!;
    const m = line.getScreenCTM()!;
    const t = 0.93;
    const x = line.x1.baseVal.value + (line.x2.baseVal.value - line.x1.baseVal.value) * t;
    const y = line.y1.baseVal.value + (line.y2.baseVal.value - line.y1.baseVal.value) * t;
    const p = new DOMPoint(x, y).matrixTransform(m);
    void svg;
    return { x: p.x, y: p.y };
  }, id);
  if (useTouch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

/** Enter an answer value into whatever widget is showing. `variant` alternates drag vs tap styles. */
export async function enterAnswer(page: Page, inf: Info, ans: any, variant = 0) {
  const it = inf.interaction;
  switch (inf.type) {
    case 'fields': {
      for (const t of it.tokens) {
        if (typeof t !== 'object' || 'br' in t) continue;
        const v = ans[t.id];
        if (v === undefined) continue;
        if (t.kind === 'toggle') await tap(page.locator(`[data-toggle-id="${t.id}"][data-value="${v}"]`));
        else await typeInto(page, `[data-field-id="${t.id}"]`, String(v));
      }
      break;
    }
    case 'choice':
      await tap(page.locator(`[data-choice="${ans}"]`));
      break;
    case 'placeValue': {
      const s = String(ans);
      const n = s.length;
      for (let i = 0; i < n; i++) {
        const place = n - 1 - i;
        const slot = page.locator(`[data-place="${place}"]`);
        if (s[i] === '_') continue;
        const tile = page.locator(`[data-tile="${s[i]}"]`);
        if ((variant + i) % 2 === 0) await dragTo(page, tile, slot);
        else {
          await tap(tile);
          await tap(slot);
          await tap(tile); // deselect
        }
      }
      break;
    }
    case 'slide': {
      const start = it.start, target = Number(ans);
      const steps = Math.round(Math.log10(target / start));
      const btn = page.locator(steps > 0 ? '[data-slide="left"]' : '[data-slide="right"]');
      for (let i = 0; i < Math.abs(steps); i++) await tap(btn);
      break;
    }
    case 'numberLine': {
      const tick = page.locator(`[data-nl-tick="${ans}"]`);
      if (variant % 2 === 0) await dragTo(page, page.locator('[data-nl-handle]'), tick.locator('line'));
      else await tap(tick);
      break;
    }
    case 'order': {
      const want: string[] = ans;
      for (let i = 0; i < want.length; i++) {
        for (let guard = 0; guard < 10; guard++) {
          const ids = await page.locator('[data-order-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.orderId));
          const cur = ids.indexOf(want[i]);
          if (cur <= i) break;
          await tap(page.locator(`[data-order-up="${want[i]}"]`));
        }
      }
      break;
    }
    case 'clock': {
      const [h, m] = String(ans).split(':').map(Number);
      const target = (h % 12) * 60 + m;
      const start = ((Math.round(it.start / 5) * 5) % 720 + 720) % 720;
      const diff = (target - start + 720) % 720;
      for (let i = 0; i < Math.floor(diff / 60); i++) await tap(page.locator('[data-clock="h+"]'));
      for (let i = 0; i < (diff % 60) / 5; i++) await tap(page.locator('[data-clock="m+"]'));
      break;
    }
    case 'grid': {
      const pts: Pt[] = ans;
      if (it.mode === 'triangle') {
        const cur: Pt[] = it.initial;
        for (let i = 0; i < 3; i++) {
          if (cur[i][0] === pts[i][0] && cur[i][1] === pts[i][1]) continue;
          const corner = page.locator(`[data-corner="${i}"]`);
          const target = page.locator(`[data-gx="${pts[i][0]}"][data-gy="${pts[i][1]}"]`);
          if (variant % 2 === 0) await dragTo(page, corner, target);
          else {
            await tap(corner);
            await tap(target);
          }
        }
      } else if (it.mode === 'cells') {
        for (const p of pts) await tap(page.locator(`[data-cx="${p[0]}"][data-cy="${p[1]}"]`));
      } else {
        for (const p of pts) {
          if (p[0] < 0 || p[1] < 0 || p[0] > it.w || p[1] > it.h) continue;
          await tap(page.locator(`[data-gx="${p[0]}"][data-gy="${p[1]}"]`));
        }
      }
      break;
    }
    case 'column': {
      const s = String(ans);
      const n = s.length;
      for (let i = n - 1; i >= 0; i--) {
        if (s[i] === '_') continue;
        await tap(page.locator(`[data-col-box="${n - 1 - i}"]`));
        await tap(page.locator(`.numpad [data-key="${s[i]}"]`));
      }
      break;
    }
    case 'bins': {
      const r: Record<string, string> = ans;
      let k = 0;
      for (const [item, bin] of Object.entries(r)) {
        if ((variant + k++) % 2 === 0) await dragTo(page, page.locator(`[data-bin-item="${item}"]`), page.locator(`.bin[data-bin="${bin}"] .bin-label`));
        else {
          await tap(page.locator(`[data-bin-item="${item}"]`));
          await tap(page.locator(`.bin[data-bin="${bin}"] .bin-label`));
        }
      }
      break;
    }
    case 'lineSelect': {
      for (const id of ans as string[]) await clickLine(page, id);
      break;
    }
    default:
      throw new Error('unknown interaction ' + inf.type);
  }
}

/** Answer the current question correctly (or wrongly `wrongTimes` first), then press Next. */
export async function playQuestion(page: Page, opts: { wrongTimes?: 0 | 1 | 2; variant?: number } = {}) {
  const wrongTimes = opts.wrongTimes ?? 0;
  await page.waitForFunction(() => (window as any).__camp && !(window as any).__camp.resolved);
  let inf = await info(page);
  for (let w = 0; w < wrongTimes; w++) {
    inf = await info(page);
    if (inf.wrong === null) break;
    await enterAnswer(page, inf, inf.wrong, opts.variant);
    await tap(page.locator('[data-action="check"]'));
    await page.waitForTimeout(30);
    if (w === 0) await expect(page.locator('.banner')).toHaveClass(/banner-(retry|good|info)/);
    inf = await info(page);
    if (inf.resolved) break;
    // undo the wrong entry so the next entry starts clean
    await clearInputs(page, inf);
  }
  inf = await info(page);
  if (!inf.resolved) {
    await enterAnswer(page, inf, inf.expected, opts.variant);
    await tap(page.locator('[data-action="check"]'));
    await expect(page.locator('.banner')).toHaveClass(/banner-good|banner-info/);
  }
  const after = await info(page);
  expect(after.resolved, `question ${after.qid} should be resolved`).toBe(true);
  await tap(page.locator('[data-action="next"]'));
  return { inf: after, outcome: 'ok' as const };
}

/** Undo what a wrong attempt left behind, so the next entry starts clean. */
async function clearInputs(page: Page, inf: Info) {
  const it = inf.interaction;
  if (inf.type === 'grid' && (it.mode === 'points' || it.mode === 'cells')) {
    // toggle off the wrong points/cells by tapping them again
    const pts: Pt[] = inf.wrong ?? [];
    for (const p of pts) {
      const sel = it.mode === 'cells' ? `[data-cx="${p[0]}"][data-cy="${p[1]}"]` : `[data-gx="${p[0]}"][data-gy="${p[1]}"]`;
      if (await page.locator(sel).count()) await tap(page.locator(sel));
    }
  } else if (inf.type === 'lineSelect') {
    for (const id of (inf.wrong ?? []) as string[]) await clickLine(page, id);
  } else if (inf.type === 'placeValue') {
    await tap(page.locator('[data-action="pv-clear"]'));
  } else if (inf.type === 'slide') {
    await tap(page.locator('[data-slide="reset"]'));
  } else if (inf.type === 'clock') {
    // the clock: move back to the start time
    const [h, m] = String(inf.wrong).split(':').map(Number);
    const cur = (h % 12) * 60 + m;
    const start = ((Math.round(it.start / 5) * 5) % 720 + 720) % 720;
    const diff = (cur - start + 720) % 720;
    for (let i = 0; i < Math.floor(diff / 60); i++) await tap(page.locator('[data-clock="h-"]'));
    for (let i = 0; i < (diff % 60) / 5; i++) await tap(page.locator('[data-clock="m-"]'));
  } else if (inf.type === 'column') {
    const n = String(inf.expected).length;
    for (let p = 0; p < n; p++) {
      await tap(page.locator(`[data-col-box="${p}"]`));
      await tap(page.locator('.numpad [data-key="back"]'));
    }
  } else if (inf.type === 'grid' && it.mode === 'triangle') {
    // triangle: the wrong example is the starting triangle, nothing to undo
  }
}

export async function screen(page: Page): Promise<string> {
  return (await page.locator('[data-screen]').first().getAttribute('data-screen')) ?? '';
}

export async function setupFirstRun(page: Page, opts: { pacing?: 0 | 1 | 2 | 3; pin?: string; nickname?: string } = {}) {
  await page.waitForSelector('[data-screen="first-run"]');
  if (opts.nickname) await page.fill('#nick', opts.nickname);
  if (opts.pin) await page.fill('#pin', opts.pin);
  if (opts.pacing !== undefined) await page.click(`[data-pacing="${opts.pacing}"]`);
  await page.click('[data-action="setup-continue"]');
  await page.waitForSelector('[data-screen="home"]');
}

/**
 * Play from the current screen until `stopAt` is reached. `wrongPlan(i)` says how many wrong tries
 * to make on the i-th question overall. Returns counts for assertions.
 */
export async function playUntil(page: Page, stopAt: (s: string) => boolean, wrongPlan: (i: number, inf: Info) => 0 | 1 | 2 = () => 0, maxSteps = 2000) {
  let q = 0;
  const seenScreens: string[] = [];
  const stats = { questions: 0, recap: 0, wrongTwice: 0, wrongOnce: 0, types: new Set<string>(), recapKinds: [] as string[], missedKinds: [] as string[] };
  for (let step = 0; step < maxSteps; step++) {
    await page.waitForTimeout(20);
    const s = await screen(page);
    seenScreens.push(s);
    if (stopAt(s)) return { stats, seenScreens };
    switch (s) {
      case 'home': {
        const start = page.locator('[data-action="start"]');
        if (await start.count()) await tap(start);
        else throw new Error('home: no start button (camp asleep?)');
        break;
      }
      case 'night': {
        const fire = page.locator('[data-action="campfire"]');
        if (await fire.isEnabled()) {
          await tap(fire);
          break;
        }
        const card = page.locator('.job-card:not(.done)').first();
        await tap(card);
        break;
      }
      case 'runner':
      case 'recap': {
        await page.waitForFunction(() => (window as any).__camp && !(window as any).__camp.resolved);
        const inf = await info(page);
        const w = wrongPlan(q, inf);
        stats.types.add(inf.type);
        if (s === 'recap') {
          stats.recap++;
          stats.recapKinds.push(`${inf.topicId}|${inf.kind}`);
        } else stats.questions++;
        if (w === 2 && s === 'runner') stats.missedKinds.push(`${inf.topicId}|${inf.kind}`);
        if (w === 2) stats.wrongTwice++;
        if (w === 1) stats.wrongOnce++;
        await playQuestion(page, { wrongTimes: w, variant: q });
        q++;
        break;
      }
      case 'job-done':
        await tap(page.locator('[data-action="job-back"]'));
        break;
      case 'campfire': {
        const r = page.locator('[data-action="recap"], [data-action="search"]').first();
        await tap(r);
        break;
      }
      case 'rescue':
        await tap(page.locator('[data-action="rescue-next"]'));
        break;
      case 'checkin':
        await tap(page.locator('[data-fun="great"]'));
        await tap(page.locator('[data-level="right"]'));
        await tap(page.locator('[data-action="goodnight"]'));
        break;
      case 'rest':
      case 'dawn':
        throw new Error(`unexpected screen ${s}`);
      default:
        throw new Error(`unknown screen "${s}"`);
    }
  }
  throw new Error('playUntil: too many steps; last screens ' + seenScreens.slice(-10).join(','));
}

export async function readSave(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sixNightsCamp.save') || 'null'));
}
