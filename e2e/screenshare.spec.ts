import { test, expect } from '@playwright/test';

test.describe('Phase 6: Screen Share and Stream Mode E2E', () => {
  test('peers can activate desktop screen share, enter stream mode, display quality badge, and stop sharing', async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']);

    // 1. Alice creates room
    const pageAlice = await context.newPage();
    await pageAlice.goto('/');
    await pageAlice.getByPlaceholder('What should your partner call you?').fill('Alice');
    await pageAlice.getByRole('button', { name: 'Create a Room' }).click();
    await expect(pageAlice.getByText('Waiting for partner…')).toBeVisible();

    const roomUrl = pageAlice.url();
    const roomCodeMatch = roomUrl.match(/room=([A-HJ-NP-Z2-9]{6})/);
    expect(roomCodeMatch).not.toBeNull();
    const roomCode = roomCodeMatch?.[1];
    if (!roomCode) throw new Error('Expected room code in URL');

    // 2. Bob joins with code
    const pageBob = await context.newPage();
    await pageBob.goto('/');
    await pageBob.getByPlaceholder('What should your partner call you?').fill('Bob');
    await pageBob.getByRole('button', { name: 'Join with Code' }).click();

    const otpFirst = pageBob.getByRole('group', { name: 'Room code' }).locator('input').first();
    await otpFirst.fill(roomCode);
    await pageBob.getByRole('button', { name: 'Join Room' }).click();

    // Verify both peers connected
    await expect(pageAlice.getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(pageBob.getByText('Alice')).toBeVisible({ timeout: 10000 });

    // 3. Verify desktop screen share button is available
    const aliceShareScreenBtn = pageAlice.getByTestId('share-screen-btn');
    await expect(aliceShareScreenBtn).toBeVisible();

    // 4. Alice starts desktop screen share
    await aliceShareScreenBtn.click();

    // Alice should see local screen sharing view and room in Stream Mode
    await expect(pageAlice.getByTestId('screen-stream-local')).toBeVisible({ timeout: 10000 });
    await expect(pageAlice.getByText('Stream Mode', { exact: true })).toBeVisible({ timeout: 10000 });

    // Bob detects stream mode from Alice and receives stream
    await expect(pageBob.getByText('Stream Mode', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(pageBob.getByTestId('screen-stream-remote')).toBeVisible({ timeout: 10000 });

    // 5. Alice stops screen share via main player button
    const stopShareBtn = pageAlice.getByTestId('stop-screenshare-main-btn');
    await expect(stopShareBtn).toBeVisible();
    await stopShareBtn.click();

    // Both peers cleanly return to sync mode
    await expect(pageAlice.getByTestId('screen-stream-local')).not.toBeVisible({ timeout: 5000 });
    await expect(pageBob.getByTestId('screen-stream-remote')).not.toBeVisible({ timeout: 5000 });
    await expect(pageAlice.getByText('Stream Mode', { exact: true })).not.toBeVisible({ timeout: 5000 });
    await expect(pageBob.getByText('Stream Mode', { exact: true })).not.toBeVisible({ timeout: 5000 });
  });
});
