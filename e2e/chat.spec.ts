import { test, expect } from '@playwright/test';

test.describe('Phase 4: Real-time Text Chat E2E', () => {
  test('two peers can chat in real-time, linkify URLs, and sanitize HTML', async ({ context }) => {
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

    // 3. Alice sends a message
    const aliceInput = pageAlice.getByTestId('chat-input');
    await expect(aliceInput).toBeVisible();
    await aliceInput.fill('Hello Bob!');
    await pageAlice.getByTestId('chat-send-btn').click();

    // Alice sees her own message
    await expect(pageAlice.getByText('Hello Bob!')).toBeVisible();

    // Bob receives Alice's message
    await expect(pageBob.getByText('Hello Bob!')).toBeVisible({ timeout: 5000 });

    // 4. Bob replies
    const bobInput = pageBob.getByTestId('chat-input');
    await bobInput.fill('Hey Alice, check out https://example.com/movie');
    await pageBob.getByTestId('chat-send-btn').click();

    // Alice sees Bob's message with safe link
    await expect(pageAlice.getByText(/Hey Alice, check out/)).toBeVisible({ timeout: 5000 });
    const link = pageAlice.getByRole('link', { name: 'https://example.com/movie' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com/movie');
    await expect(link).toHaveAttribute('target', '_blank');

    // 5. Test XSS / HTML sanitization: pasting HTML tags renders plain text only
    await aliceInput.fill('<b id="xss-test">Bold text</b><script>window.pwned=true</script>');
    await pageAlice.getByTestId('chat-send-btn').click();

    await expect(pageBob.getByText('<b id="xss-test">Bold text</b><script>window.pwned=true</script>')).toBeVisible({
      timeout: 5000,
    });

    // Ensure the HTML tag was not rendered as a DOM element
    const xssElement = await pageBob.$('#xss-test');
    expect(xssElement).toBeNull();
  });
});
