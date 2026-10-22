const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:\\Users\\sonny\\.gemini\\antigravity-ide\\brain\\750ff459-5f43-4146-a6d7-48dde6bd2f36';

async function waitForServer(port = 5173, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          if (res.statusCode) resolve(true);
          else reject(new Error('no status'));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy());
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Server did not start within ${timeout}ms`);
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('Starting dev server on port 5173...');
  const devServer = spawn('pnpm.cmd', ['dev', '--port', '5173'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
    shell: true,
  });

  devServer.stderr.on('data', (d) => process.stderr.write(d));
  devServer.stdout.on('data', (d) => process.stdout.write(d));

  try {
    await waitForServer(5173);
    console.log('Dev server ready! Launching Chrome via Playwright...');

    const browser = await chromium.launch({
      channel: 'chrome',
      args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });

    // 1. Desktop 1920x1080 - Lobby
    console.log('Capturing Desktop 1920x1080 Lobby...');
    let ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    let page = await ctx.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'desktop-1920x1080-lobby.png'), fullPage: false });

    // 2. Desktop 1920x1080 - Theater Room (Created cleanly from lobby)
    console.log('Creating room and capturing Desktop 1920x1080 Theater...');
    await page.getByPlaceholder('What should your partner call you?').fill('Sonny');
    await page.getByRole('button', { name: 'Create a Room' }).click();
    await page.waitForURL(/\?room=/);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'desktop-1920x1080-theater.png'), fullPage: false });
    await ctx.close();

    // 3. Compact Desktop 1366x768 - Theater Room
    console.log('Capturing Desktop 1366x768 Theater...');
    ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    page = await ctx.newPage();
    await page.goto('http://localhost:5173/');
    await page.getByPlaceholder('What should your partner call you?').fill('Sonny');
    await page.getByRole('button', { name: 'Create a Room' }).click();
    await page.waitForURL(/\?room=/);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'desktop-1366x768-theater.png'), fullPage: false });
    await ctx.close();

    // 4. Mobile 360x800 - Lobby
    console.log('Capturing Mobile 360x800 Lobby...');
    ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
    page = await ctx.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, 'mobile-360x800-lobby.png'), fullPage: false });

    // 5. Mobile 360x800 - Call & Media Controls
    console.log('Capturing Mobile 360x800 Call & Media...');
    await page.getByPlaceholder('What should your partner call you?').fill('Maya');
    await page.getByRole('button', { name: 'Create a Room' }).click();
    await page.waitForURL(/\?room=/);
    await page.waitForTimeout(1500);
    const callTab = page.getByTestId('mobile-tab-call');
    if (await callTab.isVisible()) {
      await callTab.click();
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'mobile-360x800-call-media.png'), fullPage: false });

    // 6. Mobile 360x800 - Realtime Chat
    console.log('Capturing Mobile 360x800 Chat...');
    const chatTab = page.getByTestId('mobile-tab-chat');
    if (await chatTab.isVisible()) {
      await chatTab.click();
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'mobile-360x800-chat.png'), fullPage: false });
    await ctx.close();

    await browser.close();
    console.log('All screenshots captured successfully!');
  } finally {
    devServer.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
