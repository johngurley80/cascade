import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  phase: string;
  paused: boolean;
  wave: number;
  health: number;
  enemies: { x: number; y: number; kind: string; wet: boolean }[];
  largestCascade: number;
  kills: number;
  offer: string[];
  elements: string[];
  upgradeVisible: boolean;
  resultVisible: boolean;
}

const snapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cascade?: { snapshot(): Snapshot } }).__cascade?.snapshot() ?? null);

/** Map 720×1280 gameplay coordinates to page coordinates. */
async function mapper(page: Page) {
  const box = (await page.locator('canvas').boundingBox())!;
  return (x: number, y: number): [number, number] => [box.x + (x * box.width) / 720, box.y + (y * box.height) / 1280];
}

test('loads, fires, reaches the upgrade screen and starts wave 2', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('?seed=7&speed=4');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  const P = await mapper(page);

  await page.mouse.click(...P(360, 860)); // PLAY
  await expect.poll(async () => (await snapshot(page))?.phase).toBe('playing');

  // Aim at the enemy closest to the defence line and hold fire until the wave is cleared.
  let st = await snapshot(page);
  let holding = false;
  const deadline = Date.now() + 90_000;
  while (st && !st.upgradeVisible && Date.now() < deadline) {
    const visible = st.enemies.filter((e) => e.y > 110);
    if (visible.length > 0) {
      const target = visible.reduce((a, b) => (b.y > a.y ? b : a));
      await page.mouse.move(...P(target.x, target.y + 10));
      if (!holding) {
        await page.mouse.down();
        holding = true;
      }
    }
    await page.waitForTimeout(50);
    st = await snapshot(page);
  }
  if (holding) await page.mouse.up();

  expect(st?.upgradeVisible).toBe(true);
  expect(st?.kills).toBeGreaterThan(0);
  expect([...(st?.offer ?? [])].sort()).toEqual(['lightning', 'water']);

  await page.waitForTimeout(500);
  await page.keyboard.press('1'); // take the first offered element
  await expect.poll(async () => (await snapshot(page))?.wave).toBe(2);
  st = await snapshot(page);
  expect(st?.elements.length).toBe(2);
  expect(st?.phase).toBe('playing');
  expect(errors).toEqual([]);
});

test('fits a phone-sized viewport without page scroll', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('?seed=3');
  const box = (await page.locator('canvas').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(390.5);
  expect(box.height).toBeLessThanOrEqual(844.5);
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  expect(scroll).toEqual([390, 844]);
  await context.close();
});
