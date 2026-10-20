import { test, expect } from '@playwright/test';

const TEST_VIDEO_URL = 'http://localhost:5173/sample.mp4';

test.describe('Playback Synchronization E2E', () => {
  test('syncs play and pause between two peers in the same room', async ({ context }) => {
    // 1. Alice creates a room
    const pageAlice = await context.newPage();
    await pageAlice.goto('/');
    await pageAlice.getByPlaceholder('What should your partner call you?').fill('Alice');
    await pageAlice.getByRole('button', { name: 'Create a Room' }).click();

    await expect(pageAlice.getByText('Waiting for partner…')).toBeVisible({ timeout: 10000 });
    const roomUrl = pageAlice.url();
    const match = roomUrl.match(/room=([A-HJ-NP-Z2-9]{6})/);
    expect(match).not.toBeNull();
    const roomCode = match?.[1];
    if (!roomCode) throw new Error('Missing room code');

    // 2. Bob joins the room
    const pageBob = await context.newPage();
    await pageBob.goto('/');
    await pageBob.getByPlaceholder('What should your partner call you?').fill('Bob');
    await pageBob.getByRole('button', { name: 'Join with Code' }).click();
    const otpFirst = pageBob.getByRole('group', { name: 'Room code' }).locator('input').first();
    await otpFirst.fill(roomCode);
    await pageBob.getByRole('button', { name: 'Join Room' }).click();

    // Verify presence reflected on both tabs
    await expect(pageAlice.getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(pageBob.getByText('Alice')).toBeVisible({ timeout: 10000 });

    // 3. Alice loads video
    await pageAlice.getByPlaceholder('…or paste a direct video link').fill(TEST_VIDEO_URL);
    await pageAlice.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(pageAlice.locator('video')).toBeAttached();

    // 4. Bob loads video
    await pageBob.getByPlaceholder('…or paste a direct video link').fill(TEST_VIDEO_URL);
    await pageBob.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(pageBob.locator('video')).toBeAttached();

    // Drift indicator should indicate In sync
    await expect(pageAlice.getByText(/In sync|\d+ms drift/)).toBeVisible({ timeout: 10000 });

    // 5. Alice plays video
    const alicePlay = pageAlice.getByRole('button', { name: 'Play', exact: true });
    await alicePlay.click();
    await expect(pageAlice.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    // Bob should transition to playing automatically via sync engine
    await expect(pageBob.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
      timeout: 10000,
    });

    // 6. Bob pauses video
    const bobPause = pageBob.getByRole('button', { name: 'Pause', exact: true });
    await bobPause.click();
    await expect(pageBob.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

    // Alice should transition to paused automatically via sync engine
    await expect(pageAlice.getByRole('button', { name: 'Play', exact: true })).toBeVisible({
      timeout: 10000,
    });

    await pageAlice.close();
    await pageBob.close();
  });
});
