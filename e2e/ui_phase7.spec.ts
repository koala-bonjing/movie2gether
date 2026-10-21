import { test, expect } from '@playwright/test';

test.describe('Phase 7: UI Polish, Themes, Subtitles, Responsive Layouts E2E', () => {
  test('theme picker switches accent themes and persists across reload', async ({ page }) => {
    await page.goto('/');

    // 1. Verify theme picker button exists in lobby
    const themeBtn = page.getByTestId('theme-picker-btn');
    await expect(themeBtn).toBeVisible();

    // 2. Open theme menu
    await themeBtn.click();
    const mintOption = page.getByTestId('theme-option-mint');
    await expect(mintOption).toBeVisible();

    // 3. Select Mint theme (#7BD3A8)
    await mintOption.click();

    // Verify CSS custom property --accent was updated
    const accentMint = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    expect(accentMint.toUpperCase()).toBe('#7BD3A8');

    // 4. Reload page and check persistence
    await page.reload();
    const persistedAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    expect(persistedAccent.toUpperCase()).toBe('#7BD3A8');
  });

  test('subtitles loading, track attachment, font size control, and removal', async ({ page }) => {
    await page.goto('/?room=DEMO07');

    // Load video
    const urlInput = page.getByPlaceholder('…or paste a direct video link');
    await urlInput.fill('http://localhost:5173/sample.mp4');
    await page.getByRole('button', { name: 'Load', exact: true }).click();

    const video = page.locator('video');
    await expect(video).toBeAttached();

    // Load an SRT subtitle file via file input
    const subInput = page.locator('input[type="file"][accept*=".srt"]').first();
    const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
Hello from Duet subtitles!
`;
    await subInput.setInputFiles({
      name: 'duet_sample.srt',
      mimeType: 'text/plain',
      buffer: Buffer.from(sampleSrt),
    });

    // Verify track tag attached
    const track = video.locator('track[kind="subtitles"]');
    await expect(track).toBeAttached();
    await expect(track).toHaveAttribute('label', 'duet_sample');

    // Verify subtitle info shown with default Medium size
    await expect(page.getByText('duet_sample')).toBeVisible();
    await expect(page.getByText('(Medium)')).toBeVisible();

    // Change font size to Large
    await page.getByRole('button', { name: 'LG', exact: true }).click();
    await expect(page.getByText('(Large)')).toBeVisible();

    const fontSizeStyle = await video.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--sub-font-size').trim(),
    );
    expect(fontSizeStyle).toBe('24px');

    // Toggle hide/show
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeVisible();
    await expect(track).not.toBeAttached();

    await page.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(track).toBeAttached();

    // Remove subtitles
    await page.getByTitle('Remove subtitles').first().click();
    await expect(track).not.toBeAttached();
    await expect(page.getByText('None loaded')).toBeVisible();
  });

  test('responsive viewports have zero horizontal overflow and render mobile tabs below 1024px', async ({
    page,
  }) => {
    const viewports = [
      { width: 360, height: 640 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/?room=RESP01');

      // Verify no horizontal scrolling across viewport widths
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at ${vp.width}x${vp.height}`).toBe(false);

      if (vp.width < 1024) {
        // Mobile tabs should be present and functional
        const chatTab = page.getByTestId('mobile-tab-chat');
        const callTab = page.getByTestId('mobile-tab-call');
        await expect(chatTab).toBeVisible();
        await expect(callTab).toBeVisible();

        // Switch tabs
        await callTab.click();
        await expect(page.getByTestId('call-section')).toBeVisible();
        await chatTab.click();
        await expect(page.getByTestId('chat-input')).toBeVisible();
      } else {
        // Desktop: bottom status strip visible
        await expect(page.getByTestId('desktop-status-strip')).toBeVisible();
      }
    }
  });

  test('theater mode toggles player container expansion', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?room=THEATER01');

    const loadBtn = page.getByRole('button', { name: 'Load', exact: true });
    await page.getByPlaceholder('…or paste a direct video link').fill('http://localhost:5173/sample.mp4');
    await loadBtn.click();

    // Find and click theater mode button
    const theaterBtn = page.getByTestId('theater-mode-btn');
    await expect(theaterBtn).toBeVisible();
    await theaterBtn.click();

    // In theater mode, the desktop sidebar is hidden so player has 100% full width
    await expect(page.locator('aside')).not.toBeAttached();

    // Toggle back
    await theaterBtn.click();
    await expect(page.locator('aside')).toBeAttached();
  });
});
