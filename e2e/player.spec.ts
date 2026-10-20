import { test, expect } from '@playwright/test';

test.describe('Player E2E Smoke Test', () => {
  test('loads home page, displays player placeholder and file picker', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveText('Duet');
    await expect(page.getByText('Local mode')).toBeVisible();
    await expect(page.getByText('Phase 0 & 1: Ready to play')).toBeVisible();
    await expect(page.getByText('Pick a video below to start.')).toBeVisible();
    await expect(page.getByText('Pick a video file')).toBeVisible();
    await expect(page.getByPlaceholder('…or paste a direct video link')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load', exact: true })).toBeVisible();
  });

  test('validates URL input and mounts video element', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('…or paste a direct video link');
    await input.fill('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    await page.getByRole('button', { name: 'Load', exact: true }).click();

    const video = page.locator('video');
    await expect(video).toBeAttached();
    await expect(video).toHaveAttribute('src', /BigBuckBunny\.mp4/);

    // Play/Pause button and controls are available
    const playButton = page.getByRole('button', { name: 'Play', exact: true });
    await expect(playButton).toBeVisible();

    // Seek and Volume sliders are rendered
    await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();

    // Test Play button click
    await playButton.click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    // Test Pause button click
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

    // Test keyboard shortcut: Space to toggle play
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

    // Test keyboard shortcut: M to toggle mute
    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
  });
});
