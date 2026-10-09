import { expect, test } from '@playwright/test';

declare global { interface Window { __audioContexts?: AudioContext[] } }

test('меню, запуск, клавиатура, пауза, столкновение, перезапуск и рекорд', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0.75; });
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'NEON RUSH' })).toBeVisible();
  await page.getByRole('button', { name: 'НАЧАТЬ ЗАБЕГ' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'running');
  await expect(page.locator('#score')).not.toHaveText('00000');
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'paused');
  const pausedScore = await page.locator('#score').textContent();
  await page.waitForTimeout(300);
  await expect(page.locator('#score')).toHaveText(pausedScore!);
  await page.keyboard.press('Escape');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'running');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'over', { timeout: 15_000 });
  const result = await page.locator('#final-score').textContent();
  expect(Number(result)).toBeGreaterThan(0);
  await expect(page.locator('#result-best')).toHaveText(result!);
  await page.getByRole('button', { name: 'ЕЩЁ РАЗ' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'running');
  expect(Number(await page.locator('#score').textContent())).toBeLessThan(Number(result));
  await page.reload();
  await expect(page.locator('#menu-best')).toHaveText(result!);
  expect(errors).toEqual([]);
});

test('локализация, мышь, ручная и автоматическая пауза, возврат в меню', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.25; });
  await page.goto('./');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'START RUN' }).click();
  await page.locator('canvas').click({ position: { x: 120, y: 400 } });
  await expect.poll(async () => Number(await page.locator('#score').textContent())).toBeGreaterThan(50);
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'running');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TAKE A BREATHER' })).toBeVisible();
  await page.getByRole('button', { name: 'RESUME' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'paused');
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await expect(page.getByRole('button', { name: 'START RUN' })).toBeVisible();
});

test('сенсорное управление и портретная вёрстка на телефоне', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, locale: 'ru-RU', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0.25; });
  await page.goto('./');
  await page.getByRole('button', { name: 'НАЧАТЬ ЗАБЕГ' }).tap();
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.touchscreen.tap(canvas!.x + canvas!.width * 0.7, canvas!.y + canvas!.height * 0.6);
  await expect.poll(async () => Number(await page.locator('#score').textContent())).toBeGreaterThan(50);
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'running');
  await page.screenshot({ path: 'test-results/mobile-gameplay.png' });
  await page.getByRole('button', { name: 'Пауза', exact: true }).tap();
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'paused');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'В МЕНЮ' }).tap();
  await page.screenshot({ path: 'test-results/mobile-menu.png' });
  await context.close();
  expect(errors).toEqual([]);
});

test('запуск при заблокированном localStorage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => 0.25;
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });
  });
  await page.goto('./');
  await expect(page.locator('#menu-best')).toHaveText('0');
  await page.getByRole('button', { name: 'НАЧАТЬ ЗАБЕГ' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'running');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'over', { timeout: 10_000 });
  await expect(page.locator('#storage-note')).toHaveText('Рекорд доступен только до закрытия страницы');
  await page.getByRole('button', { name: 'В МЕНЮ' }).click();
  expect(Number(await page.locator('#menu-best').textContent())).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('узкий экран, изменение высоты браузера и поворот устройства сохраняют доступ к кнопкам', async ({ page }) => {
  await page.goto('./');
  for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 800 }, { width: 390, height: 650 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const start = page.getByRole('button', { name: 'НАЧАТЬ ЗАБЕГ' });
    await expect(start).toBeInViewport();
    const bounds = await page.locator('#stage').boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/landscape-menu.png' });
  await page.getByRole('button', { name: 'НАЧАТЬ ЗАБЕГ' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeInViewport();
  const canvasSize = await page.locator('canvas').evaluate(node => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error('Expected game canvas');
    return { width: node.width, height: node.height };
  });
  expect(canvasSize).toEqual({ width: 420, height: 760 });
});

test('интерактивное обучение: точность, комбо, Overdrive, кристаллы и настройки', async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    Object.defineProperty(window, '__audioContexts', { value: contexts });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./');
  await expect(page.locator('#stage')).toHaveAttribute('data-reduced', 'true');
  expect(await page.evaluate(() => window.__audioContexts?.length)).toBe(0);
  const sound = page.locator('#menu [data-setting="sound"]');
  await sound.click(); await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click(); await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#learn').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-practice', 'true');
  for (let step = 0; step < 6; step++) {
    await expect(page.locator('#lesson')).toHaveAttribute('data-step', String(step));
    await expect(page.locator('#lesson')).toHaveAttribute('data-ready', 'true');
    const previousLane = await page.locator('#stage').getAttribute('data-lane');
    await page.locator('canvas').click({ position: { x: 80, y: 440 } });
    await expect(page.locator('#stage')).not.toHaveAttribute('data-lane', previousLane!);
    await expect(page.locator('#lesson')).toHaveAttribute('data-complete', 'true');
    if (step >= 2) {
      await expect(page.locator('#feedback')).toContainText(['GOOD', 'PERFECT', 'ULTRA PERFECT', 'PERFECT'][step - 2]);
      await expect(page.locator('#combo')).toHaveText(String(step - 1));
    }
    if (step === 4) await expect(page.locator('#multiplier')).toHaveText('×1.5');
    if (step === 5) {
      await expect(page.locator('#skills')).toHaveAttribute('data-overdrive', 'true');
      await expect(page.locator('#multiplier')).toHaveText('×3');
      await expect(page.locator('#stage')).toHaveAttribute('data-collected', '5');
      await page.locator('#pause').click();
      const remaining = await page.locator('#charge-text').textContent();
      await page.waitForTimeout(250);
      await expect(page.locator('#charge-text')).toHaveText(remaining!);
      await page.locator('#dialog-primary').click();
      await page.screenshot({ path: 'test-results/mobile-overdrive.png' });
      await page.locator('#pause').click();
      await page.locator('#dialog [data-setting="effects"]').click();
      await page.locator('#dialog-primary').click();
      await expect(page.locator('#stage')).toHaveAttribute('data-reduced', 'false');
    }
    await page.locator('#lesson-next').click();
  }
  await expect(page.locator('#stage')).toHaveAttribute('data-practice', 'false');
  await expect(page.locator('#combo')).toHaveText('0');
  await expect(page.locator('#hud-best')).toHaveText('0');
  await page.locator('#pause').click();
  await page.locator('#menu-button').click();
  await page.locator('#language').click();
  await page.locator('#learn').click();
  await expect(page.locator('#lesson-text')).toContainText('Tap the track');
  expect(await page.evaluate(() => window.__audioContexts?.map(context => context.state))).toEqual(['running']);
  await page.locator('#lesson-skip').click();
  await expect(page.locator('#lesson')).toBeHidden();
  expect(errors).toEqual([]);
});
