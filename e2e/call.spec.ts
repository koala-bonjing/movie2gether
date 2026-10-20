import { test, expect } from '@playwright/test';

test.describe('Phase 5: P2P WebRTC Video Call E2E', () => {
  test('peers can start video call, toggle mic/cam, and end call', async ({ context }) => {
    // Grant camera and microphone permissions to context
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

    // Verify both connected
    await expect(pageAlice.getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(pageBob.getByText('Alice')).toBeVisible({ timeout: 10000 });

    // 3. Both see the Call controls
    const aliceStartCallBtn = pageAlice.getByTestId('start-call-btn');
    const bobStartCallBtn = pageBob.getByTestId('start-call-btn');
    await expect(aliceStartCallBtn).toBeVisible();
    await expect(bobStartCallBtn).toBeVisible();

    // 4. Alice starts call
    await aliceStartCallBtn.click();
    await expect(pageAlice.getByTestId('cam-tile-local')).toBeVisible({ timeout: 10000 });

    // 5. Bob starts call (initiating negotiation)
    await bobStartCallBtn.click();
    await expect(pageBob.getByTestId('cam-tile-local')).toBeVisible({ timeout: 10000 });

    // 6. Test Mic Toggle on Alice
    const aliceMicBtn = pageAlice.getByTestId('toggle-mic-btn');
    await expect(aliceMicBtn).toBeVisible();
    await aliceMicBtn.click();
    // After clicking mute, button aria-label reflects muted
    await expect(aliceMicBtn).toHaveAttribute('aria-label', 'Unmute microphone');
    // Unmute
    await aliceMicBtn.click();
    await expect(aliceMicBtn).toHaveAttribute('aria-label', 'Mute microphone');

    // 7. Test Cam Toggle on Alice
    const aliceCamBtn = pageAlice.getByTestId('toggle-cam-btn');
    await expect(aliceCamBtn).toBeVisible();
    await aliceCamBtn.click();
    await expect(aliceCamBtn).toHaveAttribute('aria-label', 'Turn on camera');
    // Turn back on
    await aliceCamBtn.click();
    await expect(aliceCamBtn).toHaveAttribute('aria-label', 'Turn off camera');

    // 8. Test End Call on Alice
    const aliceEndCallBtn = pageAlice.getByTestId('end-call-btn');
    await expect(aliceEndCallBtn).toBeVisible();
    await aliceEndCallBtn.click();

    // Alice should be back to start call state
    await expect(pageAlice.getByTestId('start-call-btn')).toBeVisible({ timeout: 5000 });
    await expect(pageAlice.getByTestId('cam-tile-local')).not.toBeVisible();
  });
});
