import { test, expect } from '@playwright/test';

test.describe('Lobby and Room E2E Flow', () => {
  test('creates a room from lobby and enters room session', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h2')).toHaveText('Duet');
    await expect(page.getByText('Create a Room')).toBeVisible();

    // Enter name
    const nameInput = page.getByPlaceholder('What should your partner call you?');
    await nameInput.fill('Alice');

    await page.getByRole('button', { name: 'Create a Room' }).click();

    // Should transition to room
    await expect(page.getByText('Room:')).toBeVisible();
    await expect(page.getByText('Waiting for partner…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();

    // URL should have room code query param
    await expect(page).toHaveURL(/\?room=[A-HJ-NP-Z2-9]{6}/);
  });

  test('two peers can join the same room and see presence', async ({ context }) => {
    // Tab 1: Alice creates room
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

    // Tab 2: Bob joins with code
    const pageBob = await context.newPage();
    await pageBob.goto('/');
    await pageBob.getByPlaceholder('What should your partner call you?').fill('Bob');
    await pageBob.getByRole('button', { name: 'Join with Code' }).click();

    // Type/fill the room code in OtpInput
    const otpFirst = pageBob.getByRole('group', { name: 'Room code' }).locator('input').first();
    await otpFirst.fill(roomCode);

    await pageBob.getByRole('button', { name: 'Join Room' }).click();

    // Both should see each other's names
    await expect(pageAlice.getByText('Bob')).toBeVisible({ timeout: 10000 });
    await expect(pageBob.getByText('Alice')).toBeVisible({ timeout: 10000 });

    // Tab 3: Charlie tries to join same room (3rd peer rejection)
    const pageCharlie = await context.newPage();
    await pageCharlie.goto(`/?room=${roomCode}`);
    await expect(pageCharlie.getByText(/Room is full \(max 2 people\)/)).toBeVisible({ timeout: 10000 });

    await pageAlice.close();
    await pageBob.close();
    await pageCharlie.close();
  });
});
