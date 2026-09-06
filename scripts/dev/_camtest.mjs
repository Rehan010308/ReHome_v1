import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5181';

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--allow-file-access-from-files',
  ],
});
const ctx = await browser.newContext({
  permissions: ['camera', 'geolocation'],
  geolocation: { latitude: 12.9165, longitude: 79.1325 },
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)));

await page.goto(BASE + '/#/login');
await page.waitForTimeout(2500);
await page.getByRole('textbox', { name: 'Email' }).fill('rehome.household.test1@gmail.com');
await page.getByRole('textbox', { name: 'Password' }).fill('rehome-test-1234');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(6000);
console.log('after login:', page.url());

await page.goto(BASE + '/#/app/scan');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /Scan with camera/i }).click();
await page.waitForTimeout(4000);
console.log('--- camera step ---');
console.log(await page.locator('main').innerText());

const videoState = await page.evaluate(() => {
  const v = document.querySelector('video');
  if (!v) return 'no video element';
  return { w: v.videoWidth, h: v.videoHeight, playing: !v.paused, hasStream: !!v.srcObject };
});
console.log('video:', JSON.stringify(videoState));

await page.screenshot({ path: process.env.SHOT || 'camera-live.png' });

// Capture a still and let the analysis run.
const shoot = page.getByRole('button', { name: 'Capture photo' });
if (await shoot.count()) {
  await shoot.click();
  await page.waitForTimeout(45000);
  console.log('--- after capture ---');
  console.log((await page.locator('main').innerText()).slice(0, 700));
  await page.screenshot({ path: process.env.SHOT2 || 'camera-analyzed.png', fullPage: true });
} else {
  console.log('no capture button present');
}

console.log('errors:', errors.join(' | ') || 'none');
await browser.close();
