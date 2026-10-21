import { test, expect } from '@playwright/test';

test.describe('Phase 9: Hardening, Reconnects & Multi-Peer E2E', () => {
  test('multi-peer session handles call, chat, state recovery and reconnects cleanly', async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']);

    // 1. Peer A (Alice) creates room
    const pageAlice = await context.newPage();
    await pageAlice.goto('/');
    await pageAlice.getByPlaceholder('What should your partner call you?').fill('Alice');
    await pageAlice.getByRole('button', { name: 'Create a Room' }).click();
    await expect(pageAlice.getByText('Waiting for partner…')).toBeVisible({ timeout: 10000 });

    const roomUrl = pageAlice.url();
    const roomCodeMatch = roomUrl.match(/room=([A-HJ-NP-Z2-9]{6})/);
    expect(roomCodeMatch).not.toBeNull();
    const roomCode = roomCodeMatch?.[1];
    if (!roomCode) throw new Error('Expected room code in URL');

    // 2. Peer B (Bob) joins room
    const pageBob = await context.newPage();
    await pageBob.goto('/');
    await pageBob.getByPlaceholder('What should your partner call you?').fill('Bob');
    await pageBob.getByRole('button', { name: 'Join with Code' }).click();

    const otpFirst = pageBob.getByRole('group', { name: 'Room code' }).locator('input').first();
    await otpFirst.fill(roomCode);
    await pageBob.getByRole('button', { name: 'Join Room' }).click();

    // Verify peers connected
    await expect(pageAlice.locator('header').getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(pageBob.locator('header').getByText('Alice')).toBeVisible({ timeout: 10000 });

    // 3. Chat communication with code-split lazy loaded ChatView
    const chatInput = pageAlice.getByTestId('chat-input');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill('Hardening test: verifying real-time delivery');
    await pageAlice.getByTestId('chat-send-btn').click();

    await expect(pageBob.getByText('Hardening test: verifying real-time delivery')).toBeVisible({
      timeout: 10000,
    });

    // 4. WebRTC call connection with fake media
    const aliceStartCallBtn = pageAlice.getByTestId('start-call-btn');
    await expect(aliceStartCallBtn).toBeVisible({ timeout: 10000 });
    await aliceStartCallBtn.click();

    const bobStartCallBtn = pageBob.getByTestId('start-call-btn');
    await expect(bobStartCallBtn).toContainText('Partner is calling', { timeout: 10000 });
    await bobStartCallBtn.click();

    // Verify both connected
    await expect(pageAlice.getByTestId('cam-tile-remote')).toBeVisible({ timeout: 15000 });
    await expect(pageBob.getByTestId('cam-tile-remote')).toBeVisible({ timeout: 15000 });

    // 5. Test State Recovery & Reconnect (Bob refreshes tab / simulates brief network drop)
    await pageBob.reload();
    // Bob should auto-rejoin same room via query parameter ?room=CODE
    await expect(pageBob.locator('header').getByText('Alice')).toBeVisible({ timeout: 15000 });
    await expect(pageAlice.locator('header').getByText('Bob')).toBeVisible({ timeout: 15000 });

    // Chat history preserved or restored
    await expect(pageBob.getByText('Hardening test: verifying real-time delivery')).toBeVisible({
      timeout: 10000,
    });

    // 6. End Call cleanly
    const aliceEndBtn = pageAlice.getByTestId('end-call-btn');
    if (await aliceEndBtn.isVisible()) {
      await aliceEndBtn.click();
    }
  });
});
